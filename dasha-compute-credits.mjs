/**
 * Compute prepaid credits — Solana USDC / $dasha top-up helpers (pure + pricing + verify).
 * Dest = Potter wallet (not faucet treasury). Card/Stripe deferred.
 */
import * as ed from '@noble/ed25519';
import { base58Encode, rpc } from './dasha-faucet-solana.mjs';

export const CREDIT_PACKS = [
  { id: '5', cents: 500 },
  { id: '20', cents: 2000 },
  { id: '50', cents: 5000 },
];

export const CREDIT_DEST = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const DASHA_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const DASHA_PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
export const TOKEN_DECIMALS = 6;

export const CREDIT_DISCOUNTS = { usdc: 0.03, dasha: 0.05 };
export const CREDIT_METHODS = ['usdc', 'dasha'];
export const CREDIT_ORDER_TTL_MS = 30 * 60_000;

export function packById(id) {
  return CREDIT_PACKS.find((p) => p.id === String(id || '')) || null;
}

/** Charge cents after crypto discount vs card list (face) price. */
export function priceFor(method, pack) {
  const m = String(method || '').toLowerCase();
  const p = pack && typeof pack === 'object' ? pack : packById(pack);
  if (!p || !Number.isFinite(p.cents) || p.cents <= 0) return null;
  if (m === 'usdc') return { method: 'usdc', face_cents: p.cents, charge_cents: Math.round(p.cents * (1 - CREDIT_DISCOUNTS.usdc)), mint: USDC_MINT, decimals: TOKEN_DECIMALS };
  if (m === 'dasha') return { method: 'dasha', face_cents: p.cents, charge_cents: Math.round(p.cents * (1 - CREDIT_DISCOUNTS.dasha)), mint: DASHA_MINT, decimals: TOKEN_DECIMALS };
  return null;
}

/** USDC: charge cents → raw (6 decimals). $4.85 → 4_850_000. */
export function usdcAmountRaw(chargeCents, decimals = TOKEN_DECIMALS) {
  const c = Math.floor(Number(chargeCents));
  if (!Number.isFinite(c) || c <= 0) return null;
  const scale = 10n ** BigInt(Math.max(0, decimals - 2));
  return BigInt(c) * scale;
}

/** $dasha raw from USD charge + live price. Fail closed if price unknown. */
export function dashaAmountRaw(chargeCents, priceUsd, decimals = TOKEN_DECIMALS) {
  const c = Number(chargeCents);
  const px = Number(priceUsd);
  if (!(c > 0) || !(px > 0) || !Number.isFinite(c) || !Number.isFinite(px)) return null;
  const chargeUsd = c / 100;
  const tokens = chargeUsd / px;
  if (!(tokens > 0) || !Number.isFinite(tokens)) return null;
  const scale = 10 ** decimals;
  const raw = Math.ceil(tokens * scale - 1e-9);
  if (!(raw > 0) || !Number.isFinite(raw)) return null;
  return BigInt(raw);
}

export function amountUiFromRaw(amountRaw, decimals = TOKEN_DECIMALS) {
  const raw = typeof amountRaw === 'bigint' ? amountRaw : BigInt(amountRaw);
  const den = 10n ** BigInt(decimals);
  const whole = raw / den;
  const frac = raw % den;
  if (frac === 0n) return String(whole);
  const fracStr = String(frac).padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

export async function generateReference() {
  const priv = ed.utils.randomPrivateKey();
  const pub = await ed.getPublicKeyAsync(priv);
  return base58Encode(pub);
}

export function solanaPayUrl({ dest, amount, mint, reference, label = 'Dasha Compute' }) {
  const recipient = String(dest || '').trim();
  const amt = String(amount || '').trim();
  const token = String(mint || '').trim();
  const ref = String(reference || '').trim();
  if (!recipient || !amt || !token || !ref) return '';
  const q = new URLSearchParams();
  q.set('amount', amt);
  q.set('spl-token', token);
  q.set('reference', ref);
  q.set('label', String(label).slice(0, 32));
  return `solana:${recipient}?${q.toString()}`;
}

function accountKeyStr(key) {
  if (!key) return '';
  if (typeof key === 'string') return key;
  return String(key.pubkey || key.toString?.() || '');
}

function messageAccountKeys(tx) {
  const msg = tx?.transaction?.message;
  if (!msg) return [];
  if (Array.isArray(msg.accountKeys)) return msg.accountKeys.map(accountKeyStr).filter(Boolean);
  // versioned tx loaded with jsonParsed sometimes nests differently
  const staticKeys = msg.staticAccountKeys;
  if (Array.isArray(staticKeys)) return staticKeys.map(accountKeyStr).filter(Boolean);
  return [];
}

function tokenOwnerMintAmount(balances, owner, mint) {
  const rows = Array.isArray(balances) ? balances : [];
  let raw = null;
  for (const row of rows) {
    if (String(row?.owner || '') !== owner) continue;
    if (String(row?.mint || '') !== mint) continue;
    const amt = row?.uiTokenAmount?.amount;
    if (amt == null) continue;
    try {
      const n = BigInt(amt);
      raw = raw == null ? n : raw + n;
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * Verify inbound SPL transfer to dest+mint with Solana Pay reference in account keys.
 * Expects jsonParsed getTransaction shape (meta.pre/postTokenBalances).
 */
export function verifyCreditTx(tx, { dest, mint, amountRaw, reference } = {}) {
  if (!tx || tx.meta?.err) return { ok: false, error: 'tx miss' };
  const wantDest = String(dest || '').trim();
  const wantMint = String(mint || '').trim();
  const wantRef = String(reference || '').trim();
  let need;
  try { need = typeof amountRaw === 'bigint' ? amountRaw : BigInt(amountRaw); } catch { return { ok: false, error: 'tx miss' }; }
  if (!wantDest || !wantMint || !wantRef || need <= 0n) return { ok: false, error: 'tx miss' };

  const keys = messageAccountKeys(tx);
  if (!keys.includes(wantRef)) return { ok: false, error: 'reference miss' };

  const pre = tokenOwnerMintAmount(tx.meta?.preTokenBalances, wantDest, wantMint);
  const post = tokenOwnerMintAmount(tx.meta?.postTokenBalances, wantDest, wantMint);
  // First receive: pre may be null (no prior token balance row)
  const preN = pre == null ? 0n : pre;
  if (post == null) return { ok: false, error: 'balance miss' };
  const delta = post - preN;
  if (delta < need) return { ok: false, error: 'amount miss' };
  return { ok: true, amountRaw: delta };
}

/** Fetch $dasha USD price. Env DASHA_PRICE_USD wins for tests; else Gecko → Dex. Fail closed → null. */
export async function fetchDashaPriceUsd(env = {}, fetchImpl = globalThis.fetch) {
  const fromEnv = Number(env?.DASHA_PRICE_USD);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  const opts = { signal: AbortSignal.timeout?.(8000), headers: { accept: 'application/json', 'user-agent': 'dasha-compute-credits' } };
  try {
    const gecko = await fetchImpl(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${DASHA_PAIR}`, opts);
    if (gecko?.ok) {
      const attrs = (await gecko.json())?.data?.attributes;
      const px = Number(attrs?.base_token_price_usd);
      if (Number.isFinite(px) && px > 0) return px;
    }
  } catch {}
  try {
    const dex = await fetchImpl(`https://api.dexscreener.com/latest/dex/pairs/solana/${DASHA_PAIR}`, opts);
    if (dex?.ok) {
      const data = await dex.json();
      const pair = data?.pair || (Array.isArray(data?.pairs) ? data.pairs.find((r) => String(r?.pairAddress || '') === DASHA_PAIR) : null);
      const px = Number(pair?.priceUsd);
      if (Number.isFinite(px) && px > 0) return px;
    }
  } catch {}
  return null;
}

export async function lockPayAmount(method, pack, env = {}) {
  const priced = priceFor(method, pack);
  if (!priced) return { ok: false, error: 'bad pack or method' };
  if (priced.method === 'usdc') {
    const amountRaw = usdcAmountRaw(priced.charge_cents, priced.decimals);
    if (amountRaw == null) return { ok: false, error: 'bad amount' };
    return {
      ok: true,
      ...priced,
      amountRaw,
      amountUi: amountUiFromRaw(amountRaw, priced.decimals),
      price_usd: 1,
    };
  }
  const priceUsd = await fetchDashaPriceUsd(env);
  if (!(priceUsd > 0)) return { ok: false, error: 'price unavailable' };
  const amountRaw = dashaAmountRaw(priced.charge_cents, priceUsd, priced.decimals);
  if (amountRaw == null) return { ok: false, error: 'price unavailable' };
  return {
    ok: true,
    ...priced,
    amountRaw,
    amountUi: amountUiFromRaw(amountRaw, priced.decimals),
    price_usd: priceUsd,
  };
}

/** Tip packs mirror credit faces; charge = face (no top-up discount). */
export const SPONSOR_TIP_PACKS = CREDIT_PACKS;
export const SPONSOR_TIP_MIN_CENTS = 100;
export const SPONSOR_TIP_MAX_CENTS = 100_000;

export function tipCentsFromInput({ pack, cents } = {}) {
  if (pack != null && String(pack).trim() !== '') {
    const p = packById(pack);
    return p ? p.cents : null;
  }
  const n = Math.floor(Number(cents));
  if (!Number.isFinite(n) || n < SPONSOR_TIP_MIN_CENTS || n > SPONSOR_TIP_MAX_CENTS) return null;
  return n;
}

/** Lock tip amount at face cents (USDC / $dasha). Fail closed on dasha price. */
export async function lockTipAmount(method, cents, env = {}) {
  const face = Math.floor(Number(cents));
  const m = String(method || '').toLowerCase();
  if (!Number.isFinite(face) || face < SPONSOR_TIP_MIN_CENTS || face > SPONSOR_TIP_MAX_CENTS) {
    return { ok: false, error: 'bad amount' };
  }
  if (m !== 'usdc' && m !== 'dasha') return { ok: false, error: 'pick usdc or dasha' };
  if (m === 'usdc') {
    const amountRaw = usdcAmountRaw(face, TOKEN_DECIMALS);
    if (amountRaw == null) return { ok: false, error: 'bad amount' };
    return {
      ok: true,
      method: 'usdc',
      face_cents: face,
      charge_cents: face,
      mint: USDC_MINT,
      decimals: TOKEN_DECIMALS,
      amountRaw,
      amountUi: amountUiFromRaw(amountRaw, TOKEN_DECIMALS),
      price_usd: 1,
    };
  }
  const priceUsd = await fetchDashaPriceUsd(env);
  if (!(priceUsd > 0)) return { ok: false, error: 'price unavailable' };
  const amountRaw = dashaAmountRaw(face, priceUsd, TOKEN_DECIMALS);
  if (amountRaw == null) return { ok: false, error: 'price unavailable' };
  return {
    ok: true,
    method: 'dasha',
    face_cents: face,
    charge_cents: face,
    mint: DASHA_MINT,
    decimals: TOKEN_DECIMALS,
    amountRaw,
    amountUi: amountUiFromRaw(amountRaw, TOKEN_DECIMALS),
    price_usd: priceUsd,
  };
}

export function creditsCatalog(balanceCents = null) {
  return {
    balance_cents: balanceCents == null ? null : Math.max(0, Math.floor(Number(balanceCents) || 0)),
    packs: CREDIT_PACKS.map((p) => ({ id: p.id, credits_cents: p.cents, label: `$${p.id}` })),
    methods: [...CREDIT_METHODS],
    discounts: { usdc: CREDIT_DISCOUNTS.usdc, dasha: CREDIT_DISCOUNTS.dasha },
    dest: CREDIT_DEST,
  };
}

export async function findCreditPayment(env, { reference, dest, mint, amountRaw }) {
  const ref = String(reference || '').trim();
  if (!ref) return { ok: false, error: 'no reference' };
  let sigs;
  try {
    sigs = await rpc(env, 'getSignaturesForAddress', [ref, { limit: 8 }]);
  } catch (e) {
    return { ok: false, error: 'rpc', detail: String(e?.message || e).slice(0, 120) };
  }
  const list = Array.isArray(sigs) ? sigs : [];
  for (const row of list) {
    const signature = String(row?.signature || '').trim();
    if (!signature || row?.err) continue;
    let tx;
    try {
      tx = await rpc(env, 'getTransaction', [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
    } catch {
      continue;
    }
    if (!tx) continue;
    const check = verifyCreditTx(tx, { dest, mint, amountRaw, reference: ref });
    if (check.ok) return { ok: true, signature, amountRaw: check.amountRaw, tx };
  }
  return { ok: false, error: 'pending' };
}

export async function loadTxBySignature(env, signature) {
  const sig = String(signature || '').trim();
  if (!sig || sig.length < 32 || sig.length > 128) return null;
  try {
    return await rpc(env, 'getTransaction', [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
  } catch {
    return null;
  }
}

/** Fixed Hosted Ask price past free floor (cents). Community/Mixture do not deduct in v1. */
export const HOSTED_ASK_PRICE_CENTS = 5;

/**
 * Pure debit math. Fail closed if balance < price.
 * @returns {{ ok: true, balance_cents: number, charged_cents: number, previous_cents: number } | { ok: false, error: string, balance_cents?: number }}
 */
export function applyCreditDebit(balanceCents, priceCents) {
  const bal = Math.max(0, Math.floor(Number(balanceCents) || 0));
  const price = Math.floor(Number(priceCents));
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'bad price', balance_cents: bal };
  if (bal < price) return { ok: false, error: 'insufficient credits', balance_cents: bal };
  return {
    ok: true,
    previous_cents: bal,
    charged_cents: price,
    balance_cents: bal - price,
  };
}
