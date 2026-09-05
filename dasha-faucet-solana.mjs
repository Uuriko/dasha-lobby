/**
 * Solana tip send for Dasha faucet: create-idempotent ATA + SPL transfer.
 * Uses @noble/ed25519 + JSON-RPC only (Worker-safe, no web3.js).
 */
import * as ed from '@noble/ed25519';
import { base58Decode, isValidSolanaAddress } from './dasha-simp-actions.mjs';
import { FAUCET_MINT, FAUCET_AMOUNT_RAW, FAUCET_TREASURY_DEFAULT, destShapeError, faucetSignerSecret, FAUCET_WITHDRAW_DEST, planTreasuryWithdraw } from './dasha-faucet.mjs';

export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes) {
  const src = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let zeros = 0;
  while (zeros < src.length && src[zeros] === 0) zeros++;
  const size = Math.ceil((src.length * 138) / 100) + 1;
  const buf = new Uint8Array(size);
  for (let i = 0; i < src.length; i++) {
    let carry = src[i];
    for (let j = size - 1; j >= 0; j--) {
      carry += 256 * buf[j];
      buf[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
  }
  let k = 0;
  while (k < size && buf[k] === 0) k++;
  let out = '';
  while (zeros--) out += '1';
  for (; k < size; k++) out += B58[buf[k]];
  return out || '1';
}

function concatBytes(...parts) {
  const list = parts.map((p) => (typeof p === 'string' ? new TextEncoder().encode(p) : p));
  const total = list.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of list) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function u32LE(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function u64LE(n) {
  const v = BigInt(n);
  const b = new Uint8Array(8);
  const view = new DataView(b.buffer);
  view.setUint32(0, Number(v & 0xffffffffn), true);
  view.setUint32(4, Number((v >> 32n) & 0xffffffffn), true);
  return b;
}

function compactU16(n) {
  if (n < 0 || n > 0xffff) throw new Error('compact-u16 range');
  if (n < 0x80) return new Uint8Array([n]);
  if (n < 0x4000) return new Uint8Array([ (n & 0x7f) | 0x80, n >> 7 ]);
  return new Uint8Array([ (n & 0x7f) | 0x80, ((n >> 7) & 0x7f) | 0x80, n >> 14 ]);
}

function isOnCurve(bytes32) {
  try {
    ed.Point.fromBytes(bytes32);
    return true;
  } catch {
    return false;
  }
}

export async function findProgramAddress(seeds, programIdBytes) {
  const marker = new TextEncoder().encode('ProgramDerivedAddress');
  for (let bump = 255; bump >= 0; bump--) {
    const preimage = concatBytes(...seeds, new Uint8Array([bump]), programIdBytes, marker);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', preimage));
    if (!isOnCurve(hash)) return { address: hash, bump };
  }
  throw new Error('unable to find program address');
}

export async function associatedTokenAddress(owner58, mint58, tokenProgram58 = TOKEN_PROGRAM_ID) {
  const owner = base58Decode(owner58);
  const mint = base58Decode(mint58);
  const tokenProgram = base58Decode(tokenProgram58);
  const ataProgram = base58Decode(ASSOCIATED_TOKEN_PROGRAM_ID);
  if (owner.length !== 32 || mint.length !== 32) throw new Error('bad owner/mint');
  const { address } = await findProgramAddress([owner, tokenProgram, mint], ataProgram);
  return base58Encode(address);
}

/**
 * Parse faucet signer: base58 64-byte secret, base58 32-byte seed,
 * or JSON array (Solana CLI id.json / FAUCET_KEYPAIR style).
 */
export function keypairFromSecret(secret) {
  const raw = String(secret || '').trim();
  if (!raw) throw new Error('missing faucet secret');
  let bytes;
  if (raw.startsWith('[')) {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error('faucet secret JSON must be an array');
    bytes = new Uint8Array(arr.map((n) => Number(n) & 255));
  } else {
    bytes = base58Decode(raw);
  }
  let seed;
  if (bytes.length === 64) seed = bytes.slice(0, 32);
  else if (bytes.length === 32) seed = bytes;
  else throw new Error('faucet secret must be 32 or 64 bytes');
  return { seed, secret64: bytes.length === 64 ? bytes : null };
}

export async function publicKeyFromSecret(secret) {
  const { seed } = keypairFromSecret(secret);
  const pub = await ed.getPublicKeyAsync(seed);
  return base58Encode(pub);
}

function accountMeta(pubkey58, isSigner, isWritable) {
  return { pubkey: pubkey58, isSigner, isWritable };
}

function encodeInstruction(ix, keyIndex) {
  const accounts = new Uint8Array(ix.keys.length);
  for (let i = 0; i < ix.keys.length; i++) accounts[i] = keyIndex.get(ix.keys[i].pubkey);
  const data = ix.data instanceof Uint8Array ? ix.data : new Uint8Array(ix.data);
  return concatBytes(
    new Uint8Array([keyIndex.get(ix.programId)]),
    compactU16(accounts.length),
    accounts,
    compactU16(data.length),
    data,
  );
}

function compileMessage({ payer, instructions, recentBlockhash }) {
  const keyMeta = new Map();
  const touch = (pubkey, isSigner, isWritable) => {
    const prev = keyMeta.get(pubkey) || { isSigner: false, isWritable: false };
    keyMeta.set(pubkey, {
      isSigner: prev.isSigner || isSigner,
      isWritable: prev.isWritable || isWritable,
    });
  };
  touch(payer, true, true);
  for (const ix of instructions) {
    touch(ix.programId, false, false);
    for (const k of ix.keys) touch(k.pubkey, k.isSigner, k.isWritable);
  }
  // Sort: signed+writable, signed+ro, unsigned+writable, unsigned+ro; payer first among signed.
  const keys = [...keyMeta.entries()].map(([pubkey, m]) => ({ pubkey, ...m }));
  keys.sort((a, b) => {
    const score = (k) => (k.isSigner ? 0 : 2) + (k.isWritable ? 0 : 1);
    const d = score(a) - score(b);
    if (d !== 0) return d;
    if (a.pubkey === payer) return -1;
    if (b.pubkey === payer) return 1;
    return a.pubkey < b.pubkey ? -1 : a.pubkey > b.pubkey ? 1 : 0;
  });
  // Ensure payer is index 0
  const payerIdx = keys.findIndex((k) => k.pubkey === payer);
  if (payerIdx > 0) {
    const [p] = keys.splice(payerIdx, 1);
    keys.unshift(p);
  }
  const numRequiredSignatures = keys.filter((k) => k.isSigner).length;
  const numReadonlySigned = keys.filter((k) => k.isSigner && !k.isWritable).length;
  const numReadonlyUnsigned = keys.filter((k) => !k.isSigner && !k.isWritable).length;
  const keyIndex = new Map(keys.map((k, i) => [k.pubkey, i]));
  const header = new Uint8Array([numRequiredSignatures, numReadonlySigned, numReadonlyUnsigned]);
  const accountKeys = concatBytes(...keys.map((k) => base58Decode(k.pubkey)));
  const blockhash = base58Decode(recentBlockhash);
  if (blockhash.length !== 32) throw new Error('bad blockhash');
  const ixBytes = instructions.map((ix) => encodeInstruction(ix, keyIndex));
  const compiledIxs = concatBytes(compactU16(instructions.length), ...ixBytes);
  const message = concatBytes(header, compactU16(keys.length), accountKeys, blockhash, compiledIxs);
  return { message, numRequiredSignatures, accountKeys: keys.map((k) => k.pubkey) };
}

async function signTransaction(message, seed) {
  const sig = await ed.signAsync(message, seed);
  return new Uint8Array(sig);
}

function serializeTx(signatures, message) {
  return concatBytes(compactU16(signatures.length), ...signatures, message);
}

/** Full create-idempotent ATA instruction with resolved ATA. */
export function createAtaIdempotentInstruction({ payer, ata, owner, mint, tokenProgram = TOKEN_PROGRAM_ID }) {
  return {
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      accountMeta(payer, true, true),
      accountMeta(ata, false, true),
      accountMeta(owner, false, false),
      accountMeta(mint, false, false),
      accountMeta(SYSTEM_PROGRAM_ID, false, false),
      accountMeta(tokenProgram, false, false),
    ],
    data: new Uint8Array([1]),
  };
}

export function transferInstruction({ source, destination, owner, amount, tokenProgram = TOKEN_PROGRAM_ID }) {
  // Token program Transfer = 3
  return {
    programId: tokenProgram,
    keys: [
      accountMeta(source, false, true),
      accountMeta(destination, false, true),
      accountMeta(owner, true, false),
    ],
    data: concatBytes(new Uint8Array([3]), u64LE(amount)),
  };
}

/** Same public pool as Worker tokenBalanceRaw. Dedicated RPC first, then fallbacks. */
export const SOLANA_PUBLIC_RPCS = [
  'https://public.rpc.solanavibestation.com',
  'https://solana.leorpc.com/?api_key=FREE',
  'https://api.mainnet.solana.com',
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
];

export function solanaRpcList(env = {}) {
  const primary = String(env.SOLANA_RPC_URL || '').trim();
  const extras = String(env.SOLANA_RPC_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const configured = [...new Set([primary, ...extras].filter(Boolean))];
  const endpoints = [...new Set([...configured, ...SOLANA_PUBLIC_RPCS])]
    .filter((u) => u.startsWith('https://'))
    .slice(0, 6);
  if (!endpoints.length) throw new Error('Solana RPC must use HTTPS');
  return endpoints;
}

export async function rpc(env, method, params) {
  const list = solanaRpcList(env);
  let lastErr;
  for (const endpoint of list) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(12_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error?.message || `rpc ${method} failed`);
      // Dedicated RPCs often omit history. Null getTransaction must not stop the pool.
      if (method === 'getTransaction' && data.result == null) {
        lastErr = new Error('tx miss');
        continue;
      }
      return data.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('rpc unavailable');
}

export async function accountExists(env, address) {
  const info = await rpc(env, 'getAccountInfo', [address, { encoding: 'base64' }]);
  return Boolean(info?.value);
}

function txToBase64(tx) {
  if (typeof Buffer !== 'undefined') return Buffer.from(tx).toString('base64');
  let bin = '';
  for (let i = 0; i < tx.length; i++) bin += String.fromCharCode(tx[i]);
  return btoa(bin);
}

/**
 * Build + sign tip tx without broadcasting.
 * @param {{ skipBalanceChecks?: boolean, forceCreateAta?: boolean }} opts
 */
export async function buildSignedTipTx(env, {
  destOwner,
  amountRaw = FAUCET_AMOUNT_RAW,
  mint = FAUCET_MINT,
  secret = faucetSignerSecret(env),
  skipBalanceChecks = false,
  forceCreateAta = false,
} = {}) {
  const shape = destShapeError(destOwner, '', {
    mint: String(mint || FAUCET_MINT).trim(),
    treasury: String(env?.FAUCET_TREASURY || FAUCET_TREASURY_DEFAULT).trim(),
  });
  if (shape) return { ok: false, error: shape };
  if (!secret) return { ok: false, error: 'not_configured' };
  const { seed } = keypairFromSecret(secret);
  const payer = await publicKeyFromSecret(secret);
  if (destOwner === payer) return { ok: false, error: 'dest_treasury' };
  // Prefer configured treasury; if it differs from signer pubkey, pay from signer (owner of ATAs).
  const configuredTreasury = String(env.FAUCET_TREASURY || '').trim();
  if (configuredTreasury && configuredTreasury !== payer && !skipBalanceChecks) {
    // Still allow: source ATA is always under signer pubkey.
  }
  const sourceAta = await associatedTokenAddress(payer, mint);
  const destAta = await associatedTokenAddress(destOwner, mint);
  let destExists = false;
  try {
    destExists = await accountExists(env, destAta);
  } catch {
    if (!skipBalanceChecks) return { ok: false, error: 'rpc_unavailable' };
  }
  const createAta = forceCreateAta || !destExists;
  if (!skipBalanceChecks) {
    if (createAta) {
      const bal = await rpc(env, 'getBalance', [payer]);
      const lamports = typeof bal === 'object' && bal != null ? Number(bal.value ?? bal) : Number(bal);
      if (!(lamports >= 2_500_000)) return { ok: false, error: 'treasury_rent' };
    }
    let have = 0n;
    try {
      const sourceInfo = await rpc(env, 'getTokenAccountBalance', [sourceAta]);
      have = BigInt(sourceInfo?.value?.amount || sourceInfo?.amount || 0);
    } catch {
      return { ok: false, error: 'treasury_empty' };
    }
    if (have < BigInt(amountRaw)) return { ok: false, error: 'treasury_empty' };
  }
  const latest = await rpc(env, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const blockhash = latest?.value?.blockhash || latest?.blockhash;
  if (!blockhash) return { ok: false, error: 'rpc_unavailable' };
  const ixs = [];
  if (createAta) {
    ixs.push(createAtaIdempotentInstruction({ payer, ata: destAta, owner: destOwner, mint }));
  }
  ixs.push(
    transferInstruction({
      source: sourceAta,
      destination: destAta,
      owner: payer,
      amount: amountRaw,
    }),
  );
  const { message, numRequiredSignatures } = compileMessage({
    payer,
    instructions: ixs,
    recentBlockhash: blockhash,
  });
  const sig = await signTransaction(message, seed);
  const signatures = [sig];
  while (signatures.length < numRequiredSignatures) signatures.push(new Uint8Array(64));
  const tx = serializeTx(signatures, message);
  const wire = txToBase64(tx);
  return {
    ok: true,
    wire,
    signature: base58Encode(sig),
    solscan: `https://solscan.io/tx/${base58Encode(sig)}`,
    destAta,
    sourceAta,
    payer,
    createdAta: createAta,
    dest: destOwner,
    messageBytes: message.length,
    txBytes: tx.length,
    blockhash,
  };
}

/** simulateTransaction only — never sends. */
export async function simulateTipTransfer(env, built) {
  if (!built?.ok || !built.wire) return { ok: false, error: 'bad_tx', detail: 'missing wire' };
  try {
    const result = await rpc(env, 'simulateTransaction', [
      built.wire,
      { encoding: 'base64', sigVerify: true, commitment: 'processed' },
    ]);
    const err = result?.value?.err ?? result?.err ?? null;
    const logs = result?.value?.logs || result?.logs || [];
    return {
      ok: true,
      simulated: true,
      err,
      logs: Array.isArray(logs) ? logs.slice(0, 24) : [],
      unitsConsumed: result?.value?.unitsConsumed ?? null,
    };
  } catch (e) {
    return { ok: false, error: 'rpc_unavailable', detail: String(e.message || e).slice(0, 240) };
  }
}

/**
 * Send tip: create dest ATA if needed (treasury pays rent), then transfer amountRaw.
 * @returns {{ ok: true, signature: string, solscan: string, destAta: string, createdAta: boolean } | { ok: false, error: string }}
 */
export async function sendTipTransfer(env, {
  destOwner,
  amountRaw = FAUCET_AMOUNT_RAW,
  mint = FAUCET_MINT,
  secret = faucetSignerSecret(env),
}) {
  try {
    const built = await buildSignedTipTx(env, { destOwner, amountRaw, mint, secret, skipBalanceChecks: false });
    if (!built.ok) return built;
    try {
      await rpc(env, 'sendTransaction', [
        built.wire,
        { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3 },
      ]);
    } catch (e) {
      const msg = String(e.message || e);
      if (/insufficient|rent/i.test(msg)) return { ok: false, error: 'treasury_rent' };
      if (/blockhash/i.test(msg)) return { ok: false, error: 'rpc_unavailable' };
      return { ok: false, error: 'rpc_unavailable', detail: msg.slice(0, 200) };
    }
    return {
      ok: true,
      signature: built.signature,
      solscan: built.solscan,
      destAta: built.destAta,
      createdAta: built.createdAta,
      dest: destOwner,
    };
  } catch (e) {
    const msg = String(e.message || e);
    if (/secret|configured/i.test(msg)) return { ok: false, error: 'not_configured' };
    return { ok: false, error: 'rpc_unavailable', detail: msg.slice(0, 200) };
  }
}

/** Pure helpers for tests: compile a transfer-only message shape. */
export async function buildTipInstructions({ payer, destOwner, mint, amountRaw, createAta }) {
  const sourceAta = await associatedTokenAddress(payer, mint);
  const destAta = await associatedTokenAddress(destOwner, mint);
  const ixs = [];
  if (createAta) {
    ixs.push(createAtaIdempotentInstruction({ payer, ata: destAta, owner: destOwner, mint }));
  }
  ixs.push(transferInstruction({ source: sourceAta, destination: destAta, owner: payer, amount: amountRaw }));
  return { sourceAta, destAta, instructions: ixs };
}

/** SystemProgram Transfer (index 2). */
export function systemTransferInstruction({ from, to, lamports }) {
  return {
    programId: SYSTEM_PROGRAM_ID,
    keys: [
      accountMeta(from, true, true),
      accountMeta(to, false, true),
    ],
    data: concatBytes(u32LE(2), u64LE(lamports)),
  };
}

/** Pure instruction list for the Potter drain. Dest is locked. */
export async function buildWithdrawInstructions({
  payer,
  dest = FAUCET_WITHDRAW_DEST,
  mint = FAUCET_MINT,
  tokenRaw = 0n,
  solSend = 0n,
  createAta = false,
}) {
  if (String(dest) !== FAUCET_WITHDRAW_DEST) {
    return { ok: false, error: 'dest_not_potter', dest: FAUCET_WITHDRAW_DEST };
  }
  const sourceAta = await associatedTokenAddress(payer, mint);
  const destAta = await associatedTokenAddress(dest, mint);
  const ixs = [];
  if (createAta) {
    ixs.push(createAtaIdempotentInstruction({ payer, ata: destAta, owner: dest, mint }));
  }
  if (BigInt(tokenRaw) > 0n) {
    ixs.push(transferInstruction({
      source: sourceAta,
      destination: destAta,
      owner: payer,
      amount: tokenRaw,
    }));
  }
  if (BigInt(solSend) > 0n) {
    ixs.push(systemTransferInstruction({ from: payer, to: dest, lamports: solSend }));
  }
  if (!ixs.length) return { ok: false, error: 'treasury_empty', dest, sourceAta, destAta, instructions: [] };
  return { ok: true, dest, sourceAta, destAta, instructions: ixs };
}

/**
 * Build + sign the full-treasury withdraw. Default dest is Potter.
 * skipBalanceChecks is for unit tests only.
 */
export async function buildSignedWithdrawTx(env, {
  dest = FAUCET_WITHDRAW_DEST,
  secret = faucetSignerSecret(env),
  skipBalanceChecks = false,
  forceCreateAta = false,
  solLamports: solOverride,
  tokenRaw: tokenOverride,
} = {}) {
  if (String(dest || '') !== FAUCET_WITHDRAW_DEST) {
    return { ok: false, error: 'dest_not_potter', dest: FAUCET_WITHDRAW_DEST };
  }
  if (!secret) return { ok: false, error: 'not_configured' };
  const { seed } = keypairFromSecret(secret);
  const payer = await publicKeyFromSecret(secret);
  const mint = String(env?.MINT || FAUCET_MINT).trim();
  const sourceAta = await associatedTokenAddress(payer, mint);
  const destAta = await associatedTokenAddress(dest, mint);
  let solLamports = solOverride != null ? BigInt(solOverride) : 0n;
  let tokenRaw = tokenOverride != null ? BigInt(tokenOverride) : 0n;
  let destExists = false;
  if (!skipBalanceChecks) {
    try {
      const bal = await rpc(env, 'getBalance', [payer]);
      solLamports = BigInt(typeof bal === 'object' && bal != null ? (bal.value ?? bal) : bal || 0);
    } catch {
      return { ok: false, error: 'rpc_unavailable' };
    }
    try {
      const sourceInfo = await rpc(env, 'getTokenAccountBalance', [sourceAta]);
      tokenRaw = BigInt(sourceInfo?.value?.amount || sourceInfo?.amount || 0);
    } catch {
      tokenRaw = 0n;
    }
    try {
      destExists = await accountExists(env, destAta);
    } catch {
      return { ok: false, error: 'rpc_unavailable' };
    }
  } else {
    destExists = !forceCreateAta;
  }
  const createAta = forceCreateAta || !destExists;
  const plan = planTreasuryWithdraw({
    solLamports,
    tokenRaw,
    dest,
    createDestAta: createAta,
  });
  if (!plan.ok) return { ...plan, payer, sourceAta, destAta };
  let blockhash = '11111111111111111111111111111111';
  if (!skipBalanceChecks) {
    const latest = await rpc(env, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
    blockhash = latest?.value?.blockhash || latest?.blockhash;
    if (!blockhash) return { ok: false, error: 'rpc_unavailable', ...plan };
  }
  const built = await buildWithdrawInstructions({
    payer,
    dest,
    mint,
    tokenRaw: plan.tokenRaw,
    solSend: plan.solSend,
    createAta,
  });
  if (!built.ok) return { ...plan, ...built, payer };
  const { message, numRequiredSignatures } = compileMessage({
    payer,
    instructions: built.instructions,
    recentBlockhash: blockhash,
  });
  const sig = await signTransaction(message, seed);
  const signatures = [sig];
  while (signatures.length < numRequiredSignatures) signatures.push(new Uint8Array(64));
  const tx = serializeTx(signatures, message);
  return {
    ok: true,
    ...plan,
    wire: txToBase64(tx),
    signature: base58Encode(sig),
    solscan: `https://solscan.io/tx/${base58Encode(sig)}`,
    destAta: built.destAta,
    sourceAta: built.sourceAta,
    payer,
    createdAta: createAta,
    dest,
    blockhash,
  };
}

export async function sendTreasuryWithdraw(env, opts = {}) {
  try {
    const built = await buildSignedWithdrawTx(env, { ...opts, skipBalanceChecks: false });
    if (!built.ok) return built;
    if (opts.dryRun !== false && opts.broadcast !== true) {
      return { ...built, dryRun: true, broadcast: false };
    }
    try {
      await rpc(env, 'sendTransaction', [
        built.wire,
        { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3 },
      ]);
    } catch (e) {
      const msg = String(e.message || e);
      if (/insufficient|rent/i.test(msg)) return { ok: false, error: 'treasury_rent', dest: built.dest };
      return { ok: false, error: 'rpc_unavailable', detail: msg.slice(0, 200), dest: built.dest };
    }
    return {
      ok: true,
      dryRun: false,
      broadcast: true,
      dest: built.dest,
      signature: built.signature,
      solscan: built.solscan,
      tokenRaw: built.tokenRaw,
      tokenUi: built.tokenUi,
      solSend: built.solSend,
      createdAta: built.createdAta,
    };
  } catch (e) {
    const msg = String(e.message || e);
    if (/secret|configured/i.test(msg)) return { ok: false, error: 'not_configured' };
    return { ok: false, error: 'rpc_unavailable', detail: msg.slice(0, 200) };
  }
}
