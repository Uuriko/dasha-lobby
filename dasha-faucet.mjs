/**
 * Dasha tip faucet — pure helpers + status/claim ledger (no outbound I/O).
 * Product: once-a-day free $dasha for a real human. Not an SEO airdrop farm.
 */
import { isValidSolanaAddress } from './dasha-simp-actions.mjs';

export const FAUCET_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const FAUCET_TREASURY_DEFAULT = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
export const FAUCET_SIWS_DOMAIN = 'lobby.getdasha.com';
export const FAUCET_DECIMALS = 6;
export const FAUCET_AMOUNT_UI = 100;
export const FAUCET_AMOUNT_RAW = 100_000_000n;
export const FAUCET_COOLDOWN_DAYS_DEFAULT = 1;
export const FAUCET_COOLDOWN_MS = FAUCET_COOLDOWN_DAYS_DEFAULT * 24 * 60 * 60 * 1000;
/** Default anti-farm knobs (override via env). */
export const FAUCET_DAILY_CAP_DEFAULT = 48;
export const FAUCET_HOURLY_CAP_DEFAULT = 12;
export const FAUCET_MIN_X_AGE_DAYS_DEFAULT = 7;
export const FAUCET_MIN_X_FOLLOWERS_DEFAULT = 0; // soft; 0 = off
export const FAUCET_BURST_WINDOW_MS = 30 * 60 * 1000; // recent-cluster window
export const FAUCET_PAUSE_MIN_MS = 10 * 60 * 1000;
export const FAUCET_PAUSE_MAX_MS = 90 * 60 * 1000;
export const FAUCET_RECENT_KEEP_MS = 60 * 60 * 1000;
export const FAUCET_RECENT_ATS_MAX = 64;
/** Quiet-day floor: below this pressure, P(pause) is 0. */
export const FAUCET_QUIET_PRESSURE = 0.15;
/** In-flight reserve older than this is a crashed send, not a live tip. */
export const FAUCET_PENDING_MS = 2 * 60 * 1000;

export function destShapeError(dest, four = '', opts = {}) {
  dest = String(dest || '').trim();
  four = String(four || '').trim();
  const mint = String(opts.mint || FAUCET_MINT).trim();
  const treasury = String(opts.treasury || FAUCET_TREASURY_DEFAULT).trim();
  if (/t\.me|telegram/i.test(dest)) return 'dest_not_wallet';
  if (!isValidSolanaAddress(dest)) return 'dest_not_wallet';
  if (dest === mint) return 'dest_mint';
  if (treasury && dest === treasury) return 'dest_treasury';
  if (four && dest.slice(-4) !== four) return 'last-4 does not match';
  return '';
}

export function humanError(code) {
  const key = String(code || '').trim();
  if (!key || key.charAt(0) === '{') return 'claim failed.';
  const map = {
    dest_not_wallet: 'dest_not_wallet',
    dest_token: 'dest_token',
    dest_mint: 'dest_mint',
    dest_treasury: 'dest_treasury',
    dest_pda: 'dest_pda',
    'last-4 does not match': 'last-4 does not match',
    'link X first': 'link X first',
    'prove wallet': 'prove wallet',
    'already claimed': 'already claimed',
    confirming: 'confirming',
    treasury_empty: 'treasury_empty',
    faucet_paused: 'faucet paused',
    treasury_rent: 'treasury_rent',
    rpc_unavailable: 'rpc_unavailable',
    not_configured: 'not_configured',
    'invalid faucet challenge': 'invalid faucet challenge',
    siws_domain: 'siws_domain',
    'non-json response': 'non-json response',
    transfer_unready: 'faucet paused',
    daily_cap: 'daily tip limit reached — try tomorrow',
    hourly_cap: 'tips paused briefly — try later',
    x_too_new: 'X account is too new for a tip',
    x_reauth: 'Link X again to verify account age',
  };
  return map[key] || key;
}

/** Live CF secret is FAUCET_KEYPAIR; also accept TREASURY/SIGNER aliases. */
export function faucetSignerSecret(env = {}) {
  return String(
    env.FAUCET_KEYPAIR || env.FAUCET_TREASURY_SECRET || env.FAUCET_SIGNER_SECRET || '',
  ).trim();
}

export function faucetConfig(env = {}) {
  const treasury = String(env.FAUCET_TREASURY || FAUCET_TREASURY_DEFAULT).trim();
  const mint = String(env.MINT || FAUCET_MINT).trim();
  const hasSession = Boolean(env.LOBBY_SESSION_SECRET);
  const hasSigner = Boolean(faucetSignerSecret(env));
  const paused = String(env.FAUCET_PAUSED || '') === '1' || String(env.FAUCET_PAUSED || '').toLowerCase() === 'true';
  const amountUi = Number(env.FAUCET_AMOUNT_UI || FAUCET_AMOUNT_UI) || FAUCET_AMOUNT_UI;
  const decimals = Number(env.FAUCET_DECIMALS || FAUCET_DECIMALS) || FAUCET_DECIMALS;
  const amountRaw = BigInt(env.FAUCET_AMOUNT_RAW || FAUCET_AMOUNT_RAW);
  const cooldownDays = Math.max(1, Number(env.FAUCET_COOLDOWN_DAYS || FAUCET_COOLDOWN_DAYS_DEFAULT) || FAUCET_COOLDOWN_DAYS_DEFAULT);
  const dailyCap = Math.max(1, Number(env.FAUCET_DAILY_CAP || FAUCET_DAILY_CAP_DEFAULT) || FAUCET_DAILY_CAP_DEFAULT);
  const hourlyCap = Math.max(1, Number(env.FAUCET_HOURLY_CAP || FAUCET_HOURLY_CAP_DEFAULT) || FAUCET_HOURLY_CAP_DEFAULT);
  const minXAgeDays = Math.max(0, Number(env.FAUCET_MIN_X_AGE_DAYS ?? FAUCET_MIN_X_AGE_DAYS_DEFAULT));
  const minXFollowers = Math.max(0, Number(env.FAUCET_MIN_X_FOLLOWERS ?? FAUCET_MIN_X_FOLLOWERS_DEFAULT));
  const configured = hasSession && isValidSolanaAddress(treasury) && mint === FAUCET_MINT;
  return {
    treasury,
    mint,
    hasSigner,
    paused,
    amountUi,
    decimals,
    amountRaw,
    cooldownDays,
    dailyCap,
    hourlyCap,
    minXAgeDays,
    minXFollowers,
    configured,
  };
}

/** Public GET/HEAD JSON on www + lobby. Claim POST stays lobby (SIWS/X cookies). */
export function isFaucetPublicReadPath(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '') || '/';
  return p === '/faucet/status' || p === '/faucet/me';
}

export function utcDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD
}

export function utcHourKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

/**
 * Soft X age gate. Missing createdAt on old sessions → reauth (fail closed for new links only when field present).
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function checkXEligibility(session, { minXAgeDays = 7, minXFollowers = 0, now = Date.now() } = {}) {
  if (!session?.xId) return { ok: false, error: 'link X first' };
  if (minXAgeDays > 0) {
    if (!Number.isFinite(session.xCreatedAt)) {
      // Fail closed: an old cookie without created_at must re-link X before a funded tip.
      return { ok: false, error: 'x_reauth' };
    }
    const ageMs = now - Number(session.xCreatedAt);
    const need = minXAgeDays * 24 * 60 * 60 * 1000;
    if (ageMs < need) return { ok: false, error: 'x_too_new' };
  }
  if (minXFollowers > 0 && typeof session.xFollowers === 'number' && session.xFollowers < minXFollowers) {
    return { ok: false, error: 'x_too_new' }; // same public copy: account not seasoned enough
  }
  return { ok: true };
}

export function pruneRecentAts(ats, now = Date.now(), keepMs = FAUCET_RECENT_KEEP_MS) {
  const list = (Array.isArray(ats) ? ats : [])
    .map((t) => Number(t))
    .filter((t) => Number.isFinite(t) && now - t >= 0 && now - t <= keepMs);
  return list.length > FAUCET_RECENT_ATS_MAX ? list.slice(-FAUCET_RECENT_ATS_MAX) : list;
}

/**
 * 0..1 pressure from today's volume + how clustered the last 15–60 min were.
 * Quiet day ≈ 0. Many claims close together ≈ 1.
 */
export function burstPressure(metrics, cfg = {}, { now = Date.now() } = {}) {
  const day = utcDayKey(now);
  const m = metrics || {};
  const dayCount = m.dayKey === day ? Number(m.dayCount) || 0 : 0;
  const recentAts = pruneRecentAts(m.recentAts, now, FAUCET_BURST_WINDOW_MS);
  const recentCount = recentAts.length;
  const lastAt = Number(m.lastClaimAt) || 0;
  const gapMs = lastAt > 0 ? now - lastAt : Infinity;
  const dailyCap = Math.max(1, Number(cfg.dailyCap) || FAUCET_DAILY_CAP_DEFAULT);
  const hourlyCap = Math.max(1, Number(cfg.hourlyCap) || FAUCET_HOURLY_CAP_DEFAULT);
  const volume = Math.min(1, dayCount / dailyCap);
  const cluster = Math.min(1, recentCount / hourlyCap);
  const tightMs = 2 * 60 * 1000;
  const gap = !Number.isFinite(gapMs) || gapMs >= FAUCET_BURST_WINDOW_MS
    ? 0
    : gapMs <= tightMs
      ? 1
      : 1 - (gapMs - tightMs) / (FAUCET_BURST_WINDOW_MS - tightMs);
  const pressure = Math.min(1, volume * 0.25 + cluster * 0.45 + gap * 0.45);
  return { pressure, dayCount, recentCount, gapMs, volume, cluster, gap };
}

/** Quiet floor is 0. Above it, P rises with pressure². Full burst ≈ 75%. */
export function burstPauseChance(pressure) {
  const p = Math.max(0, Math.min(1, Number(pressure) || 0));
  if (p < FAUCET_QUIET_PRESSURE) return 0;
  return p * p * 0.75;
}

export function rollBurstPause(pressure, { now = Date.now(), rng = Math.random } = {}) {
  const chance = burstPauseChance(pressure);
  const roll = Number(typeof rng === 'function' ? rng() : rng);
  if (!(roll < chance)) {
    return { paused: false, chance, pressure, pauseMs: 0, autoPausedUntil: 0 };
  }
  const span = FAUCET_PAUSE_MAX_MS - FAUCET_PAUSE_MIN_MS;
  const durRoll = Number(typeof rng === 'function' ? rng() : rng);
  const pauseMs = FAUCET_PAUSE_MIN_MS + Math.floor((Number.isFinite(durRoll) ? Math.min(1, Math.max(0, durRoll)) : 0) * (span + 1));
  return { paused: true, chance, pressure, pauseMs, autoPausedUntil: now + pauseMs };
}

/**
 * @param {{ dayKey?: string, dayCount?: number, hourKey?: string, hourCount?: number, autoPausedUntil?: number, recentAts?: number[], lastClaimAt?: number }} metrics
 */
export function checkRateLimits(metrics, cfg, { now = Date.now(), rng = Math.random } = {}) {
  const m = metrics || {};
  if (cfg.paused) return { ok: false, error: 'faucet_paused' };
  if (Number(m.autoPausedUntil) > now) return { ok: false, error: 'hourly_cap', autoPausedUntil: m.autoPausedUntil };
  const day = utcDayKey(now);
  const hour = utcHourKey(now);
  const dayCount = m.dayKey === day ? Number(m.dayCount) || 0 : 0;
  const hourCount = m.hourKey === hour ? Number(m.hourCount) || 0 : 0;
  if (dayCount >= cfg.dailyCap) return { ok: false, error: 'daily_cap', dayCount, dailyCap: cfg.dailyCap };
  const { pressure } = burstPressure(m, cfg, { now });
  const burst = rollBurstPause(pressure, { now, rng });
  if (burst.paused) {
    return {
      ok: false,
      error: 'hourly_cap',
      hourCount,
      hourlyCap: cfg.hourlyCap,
      autoPausedUntil: burst.autoPausedUntil,
      pressure,
    };
  }
  return { ok: true, dayCount, hourCount, day, hour, pressure };
}

/** After a successful claim, bump counters; may set autoPausedUntil from burst pressure. */
export function noteSuccessfulClaim(metrics, cfg, { now = Date.now(), rng = Math.random } = {}) {
  const day = utcDayKey(now);
  const hour = utcHourKey(now);
  const prev = metrics || {};
  const dayCount = (prev.dayKey === day ? Number(prev.dayCount) || 0 : 0) + 1;
  const hourCount = (prev.hourKey === hour ? Number(prev.hourCount) || 0 : 0) + 1;
  const prevLast = Number(prev.lastClaimAt) || 0;
  const recentAts = pruneRecentAts([...(Array.isArray(prev.recentAts) ? prev.recentAts : []), now], now);
  let autoPausedUntil = Number(prev.autoPausedUntil) || 0;
  if (autoPausedUntil < now) autoPausedUntil = 0;
  const { pressure } = burstPressure({
    dayKey: day,
    dayCount,
    recentAts,
    lastClaimAt: prevLast,
  }, cfg, { now });
  const burst = rollBurstPause(pressure, { now, rng });
  if (burst.paused) autoPausedUntil = Math.max(autoPausedUntil, burst.autoPausedUntil);
  return {
    dayKey: day,
    dayCount,
    hourKey: hour,
    hourCount,
    autoPausedUntil,
    lastClaimAt: now,
    recentAts,
    pressure,
  };
}

export function rateLimitStatusFields(metrics, cfg, { now = Date.now() } = {}) {
  const day = utcDayKey(now);
  const hour = utcHourKey(now);
  const m = metrics || {};
  const dayCount = m.dayKey === day ? Number(m.dayCount) || 0 : 0;
  const hourCount = m.hourKey === hour ? Number(m.hourCount) || 0 : 0;
  const autoPausedUntil = Number(m.autoPausedUntil) || 0;
  return {
    dailyCap: cfg.dailyCap,
    dailyUsed: dayCount,
    dailyRemaining: Math.max(0, cfg.dailyCap - dayCount),
    hourlyCap: cfg.hourlyCap,
    hourlyUsed: hourCount,
    minXAgeDays: cfg.minXAgeDays,
    autoPaused: autoPausedUntil > now,
    autoPausedUntil: autoPausedUntil > now ? autoPausedUntil : null,
  };
}

/**
 * @param {{ configured: boolean, paused?: boolean, hasSigner?: boolean, amountRaw: bigint, amountUi: number, decimals: number, cooldownDays: number, mint: string, treasury: string }} cfg
 * @param {{ balanceRaw?: bigint|null, rpcOk?: boolean }} inventory
 */
function statusBase(cfg, extra = {}) {
  return {
    configured: true,
    funded: false,
    amountRaw: Number(cfg.amountRaw),
    amountUi: cfg.amountUi,
    mint: cfg.mint,
    decimals: cfg.decimals,
    cooldownDays: cfg.cooldownDays,
    treasury: cfg.treasury,
    ...extra,
  };
}

export function buildStatus(cfg, inventory = {}) {
  const jar = (status) => attachJarFields(status, inventory, cfg.decimals);
  if (!cfg.configured) {
    return jar({
      configured: false,
      funded: false,
      amountRaw: Number(cfg.amountRaw),
      amountUi: cfg.amountUi,
      mint: cfg.mint,
      decimals: cfg.decimals,
      cooldownDays: cfg.cooldownDays,
      treasury: cfg.treasury,
      error: 'not_configured',
    });
  }
  if (cfg.paused) {
    return jar(statusBase(cfg, { error: 'faucet_paused' }));
  }
  if (inventory.rpcOk === false) {
    // Soft-empty when signer exists but RPC is flaky: still show tip jar as empty, not “network busy”,
    // so pitch-in remains the clear call-to-action. Flag rpc for operators.
    if (cfg.hasSigner) {
      return jar(statusBase(cfg, {
        error: 'treasury_empty',
        rpc: 'unavailable',
        rpcDetail: inventory.rpcDetail ? String(inventory.rpcDetail).slice(0, 120) : undefined,
      }));
    }
    return jar(statusBase(cfg, { error: 'rpc_unavailable' }));
  }
  const bal = inventory.balanceRaw == null ? 0n : BigInt(inventory.balanceRaw);
  // Funded for UX only when inventory covers a tip AND a signer exists (no false claim CTAs).
  const funded = bal >= cfg.amountRaw && Boolean(cfg.hasSigner);
  return jar(statusBase(cfg, {
    funded,
    error: funded ? null : bal < cfg.amountRaw ? 'treasury_empty' : 'not_configured',
    balanceRaw: Number(bal > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : bal),
  }));
}

/* `proven` means the destination was demonstrated by an ed25519 signature over the SIWS challenge,
   not merely typed in. Only a proven wallet may occupy the byWallet index: addresses are public, so
   an unproven bind lets anyone spend a stranger's per-wallet slot and lock them out for the whole
   cooldown. Unproven claims still dedup by X id, so nobody double-dips. Defaults to true so a call
   site that has not been updated errs toward more deduplication, never less. */
export function claimLookup(store, { xId, wallet, proven = true }) {
  const byX = xId ? store?.byX?.[String(xId)] : null;
  const byW = proven && wallet ? store?.byWallet?.[String(wallet)] : null;
  return byX || byW || null;
}

export function claimAllowed(store, { xId, wallet, proven = true, now = Date.now(), cooldownMs = FAUCET_COOLDOWN_MS }) {
  if (!xId) return { ok: false, error: 'link X first' };
  if (!wallet || destShapeError(wallet)) return { ok: false, error: destShapeError(wallet) || 'dest_not_wallet' };
  if (!proven) return { ok: false, error: 'prove wallet' };
  const prev = claimLookup(store, { xId, wallet, proven });
  // In-flight reservation (multi-tab): wait / poll.
  // A reserve with no signature that is older than FAUCET_PENDING_MS is a crashed
  // send (HackerOne-style double-claim races die here if we never expire).
  if (prev?.pending) {
    const age = now - Number(prev.at || 0);
    if (age < FAUCET_PENDING_MS) return { ok: false, error: 'confirming', prev };
  }
  if (prev?.signature) {
    const at = Number(prev.at || 0);
    if (!cooldownMs || now - at < cooldownMs) return { ok: false, error: 'already claimed', prev };
  }
  return { ok: true };
}

/**
 * Reserve claim slot before broadcast (prevents double-send).
 * Clear with clearPendingClaim on hard failure; finalize with recordClaim on success.
 */
export function reserveClaim(store, { xId, wallet, at = Date.now(), proven = true }) {
  const next = {
    byX: { ...(store?.byX || {}) },
    byWallet: { ...(store?.byWallet || {}) },
  };
  const row = {
    xId: String(xId),
    wallet: String(wallet),
    signature: '',
    at,
    pending: true,
    proven: Boolean(proven),
  };
  next.byX[String(xId)] = row;
  if (proven) next.byWallet[String(wallet)] = row;
  return next;
}

export function recordClaim(store, { xId, wallet, signature, at = Date.now(), proven = true }) {
  const next = {
    byX: { ...(store?.byX || {}) },
    byWallet: { ...(store?.byWallet || {}) },
  };
  const row = {
    xId: String(xId),
    wallet: String(wallet),
    signature: String(signature),
    at,
    pending: false,
    proven: Boolean(proven),
  };
  next.byX[String(xId)] = row;
  if (proven) next.byWallet[String(wallet)] = row;
  return next;
}

/* Rollback must only ever undo the caller's OWN reservation.
   Introduced by the unproven-destination change: an unproven claim no longer consults byWallet, so
   two claims can now be in flight for the same wallet — the owner's proven one and a stranger's
   pasted one. Without these guards the stranger's failed send would delete the owner's in-flight
   byWallet row, removing the guard mid-transfer. Gate on `proven` (an unproven claim never touches
   the wallet index, read or write) and on xId ownership (never delete a row someone else placed). */
export function clearPendingClaim(store, { xId, wallet, proven = true }) {
  const next = {
    byX: { ...(store?.byX || {}) },
    byWallet: { ...(store?.byWallet || {}) },
  };
  const px = xId ? next.byX[String(xId)] : null;
  const pw = proven && wallet ? next.byWallet[String(wallet)] : null;
  if (px?.pending) delete next.byX[String(xId)];
  if (pw?.pending && String(pw.xId) === String(xId)) delete next.byWallet[String(wallet)];
  return next;
}

/** Idempotent claim response helper when already paid. */
export function alreadyClaimedResponse(prev) {
  if (!prev?.signature) return null;
  return {
    ok: true,
    signature: prev.signature,
    solscan: `https://solscan.io/tx/${prev.signature}`,
    dest: prev.wallet || null,
    replay: true,
  };
}

export function meFromSession(session, store, bind, { now = Date.now(), cooldownMs = FAUCET_COOLDOWN_MS } = {}) {
  const xId = session?.xId ? String(session.xId) : '';
  const linked = Boolean(xId);
  const dest = bind?.dest || store?.byX?.[xId]?.wallet || null;
  const claim = xId ? store?.byX?.[xId] : null;
  const at = Number(claim?.at || 0);
  const inCooldown = Boolean(claim?.signature) && cooldownMs && now - at < cooldownMs;
  return {
    linked,
    configured: true,
    claimed: inCooldown,
    nextAt: inCooldown ? at + cooldownMs : (claim?.at && cooldownMs ? at + cooldownMs : null),
    dest: dest || null,
    signature: claim?.signature || null,
    x: linked
      ? { handle: session.handle || null, display: session.handle ? `@${session.handle}` : null }
      : null,
  };
}

/** Fail-closed donate: never award, never mark funded. Live junk and unverified sigs both return sig miss. */
export function donateFailClosed(input = {}) {
  const sig = String(input?.signature ?? input?.sig ?? '').trim();
  if (donateSigError(sig)) return { error: 'sig miss' };
  return { error: 'sig miss' };
}

export function donateSigError(sig) {
  const s = String(sig || '').trim();
  if (!s || s.length < 64 || s.length > 88 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return 'sig miss';
  return '';
}

export const DONATE_LAUNCH_MS = Date.parse('2026-08-16T00:00:00.000Z');
export const DONATE_MIN_RAW = 1_000_000_000n;
export const SPL_TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const SPL_MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const BURN_INTENT_SCHEMA = 'dasha-simp-burn/v0';
export const BURN_MEMO_PREFIX = 'dasha-burn:';
export const BURN_INTENT_TTL_MS = 5 * 60 * 1000;
export const BURN_INTENTS_MAX_BYTES = 1_000_000;
export const BURN_RECEIPTS_MAX = 25;
const U64_MAX = 18_446_744_073_709_551_615n;

export function createBurnIntent({ id, xId, owner, source, amountRaw } = {}, { now = Date.now() } = {}) {
  id = String(id || '').trim();
  xId = String(xId || '').trim();
  owner = String(owner || '').trim();
  source = String(source || '').trim();
  if (typeof amountRaw !== 'string') return { error: 'invalid burn amount' };
  const amount = String(amountRaw || '').trim();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id) || !/^\d{1,32}$/.test(xId)) return { error: 'invalid burn intent' };
  if (!isValidSolanaAddress(owner) || !isValidSolanaAddress(source) || source === owner || source === FAUCET_MINT) {
    return { error: 'invalid burn intent' };
  }
  if (!/^[1-9]\d{0,19}$/.test(amount) || BigInt(amount) > U64_MAX) return { error: 'invalid burn amount' };
  return {
    ok: true,
    intent: {
      schema: BURN_INTENT_SCHEMA,
      id,
      xId,
      owner,
      source,
      mint: FAUCET_MINT,
      amountRaw: amount,
      decimals: FAUCET_DECIMALS,
      purpose: 'simp-burn-preview',
      memo: BURN_MEMO_PREFIX + id,
      issuedAt: now,
      expiresAt: now + BURN_INTENT_TTL_MS,
      usedAt: null,
    },
  };
}

export function burnIntentError(intent, expected = {}, { now = Date.now() } = {}) {
  if (!intent || intent.schema !== BURN_INTENT_SCHEMA) return 'invalid burn intent';
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(intent.id || '')) || !/^\d{1,32}$/.test(String(intent.xId || ''))) return 'invalid burn intent';
  if (!isValidSolanaAddress(intent.owner) || !isValidSolanaAddress(intent.source) || intent.owner === intent.source) return 'invalid burn intent';
  if (intent.mint !== FAUCET_MINT || intent.source === FAUCET_MINT || intent.decimals !== FAUCET_DECIMALS || intent.purpose !== 'simp-burn-preview' || intent.memo !== BURN_MEMO_PREFIX + intent.id) return 'invalid burn intent';
  const amount = String(intent.amountRaw || '');
  if (!/^[1-9]\d{0,19}$/.test(amount) || BigInt(amount) > U64_MAX) return 'invalid burn intent';
  if (intent.usedAt != null) return 'burn intent used';
  const issuedAt = Number(intent.issuedAt);
  const expiresAt = Number(intent.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt - issuedAt !== BURN_INTENT_TTL_MS) return 'invalid burn intent';
  if (expiresAt <= now || issuedAt > now + 60_000) return 'burn intent expired';
  for (const key of ['xId', 'owner', 'source', 'mint', 'amountRaw']) {
    if (expected[key] != null && String(intent[key]) !== String(expected[key])) return 'burn intent mismatch';
  }
  return '';
}

export function consumeBurnIntent(intent, expected = {}, { now = Date.now() } = {}) {
  const error = burnIntentError(intent, expected, { now });
  return error ? { error } : { ok: true, intent: { ...intent, usedAt: now } };
}

export function pruneBurnIntents(store, { now = Date.now() } = {}) {
  return Object.fromEntries(Object.entries(store || {}).filter(([, intent]) =>
    Number(intent?.expiresAt) > now && intent?.usedAt == null));
}

/** Keep one pending irreversible action per account and stay below the shared storage value ceiling. */
export function upsertBurnIntent(store, intent, {
  now = Date.now(), maxBytes = BURN_INTENTS_MAX_BYTES,
} = {}) {
  const error = burnIntentError(intent, {}, { now });
  if (error) return { error };
  const next = Object.fromEntries(Object.entries(pruneBurnIntents(store, { now })).filter(([id, row]) =>
    id !== intent.id && String(row?.xId || '') !== String(intent.xId)));
  next[intent.id] = intent;
  const bytes = new TextEncoder().encode(JSON.stringify(next)).byteLength;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || bytes > maxBytes) return { error: 'burn preview full' };
  return { ok: true, intents: next, bytes };
}

export function burnAggregate(receipts) {
  let count = 0;
  let amountRaw = 0n;
  for (const [signature, receipt] of Object.entries(receipts || {})) {
    const raw = String(receipt?.amountRaw || '');
    if (donateSigError(signature) || !/^\d{1,20}$/.test(raw) || !/^\d{1,32}$/.test(String(receipt?.xId || ''))) continue;
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(receipt?.intentId || '')) || !Number.isFinite(Number(receipt?.at))) continue;
    try {
      const amount = BigInt(raw);
      if (amount <= 0n || amount > U64_MAX) continue;
      amountRaw += amount;
      count++;
    } catch {}
  }
  return { count, amountRaw: String(amountRaw) };
}

export function burnReceiptsFull(receipts) {
  return Object.keys(receipts && typeof receipts === 'object' && !Array.isArray(receipts) ? receipts : {}).length >= BURN_RECEIPTS_MAX;
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

function tokenAccountMintAmount(balances, accountIndex, owner, mint) {
  const row = (Array.isArray(balances) ? balances : []).find((item) =>
    Number(item?.accountIndex) === accountIndex && String(item?.owner || '') === owner && String(item?.mint || '') === mint);
  try { return row?.uiTokenAmount?.amount == null ? null : BigInt(row.uiTokenAmount.amount); } catch { return null; }
}

function messagePayer(tx) {
  const keys = tx?.transaction?.message?.accountKeys;
  const first = Array.isArray(keys) ? keys[0] : null;
  if (!first) return '';
  if (typeof first === 'string') return first;
  return String(first.pubkey || first.toString?.() || '');
}

/** Pure proof for one clean, finalized BurnChecked transaction. Intent/replay gates live above this parser. */
export function inspectBurnTx(tx, {
  owner,
  intentId,
  signature = '',
  mint = FAUCET_MINT,
  decimals = 6,
  now = Date.now(),
  windowMs = 15 * 60 * 1000,
} = {}) {
  if (!tx || tx.meta?.err || !owner || !/^[A-Za-z0-9_-]{16,64}$/.test(String(intentId || ''))) return { error: 'burn miss' };
  if (signature && tx.transaction?.signatures?.[0] !== signature) return { error: 'burn miss' };
  const blockTime = Number(tx.blockTime) * 1000;
  if (!Number.isFinite(blockTime) || blockTime > now + 60_000 || now - blockTime > windowMs) return { error: 'burn miss' };
  const message = tx.transaction?.message;
  const keys = Array.isArray(message?.accountKeys) ? message.accountKeys : [];
  const signer = keys.some((key) => typeof key === 'object' && String(key.pubkey || '') === owner && key.signer === true);
  if (!signer) return { error: 'burn miss' };
  const instructions = Array.isArray(message?.instructions) ? message.instructions : [];
  if (instructions.length !== 2) return { error: 'burn miss' };
  const memos = instructions.filter((ix) => String(ix?.programId || '') === SPL_MEMO_PROGRAM);
  if (memos.length !== 1 || String(memos[0].parsed || '') !== BURN_MEMO_PREFIX + intentId) return { error: 'burn miss' };
  const burns = instructions.filter((ix) =>
    String(ix?.programId || '') === SPL_TOKEN_PROGRAM && ix?.parsed?.type === 'burnChecked');
  if (burns.length !== 1) return { error: 'burn miss' };
  const info = burns[0].parsed?.info || {};
  if (String(info.authority || '') !== owner || String(info.mint || '') !== mint) return { error: 'burn miss' };
  const tokenAmount = info.tokenAmount || {};
  if (Number(tokenAmount.decimals) !== decimals) return { error: 'burn miss' };
  let amountRaw;
  try { amountRaw = BigInt(tokenAmount.amount); } catch { return { error: 'burn miss' }; }
  if (amountRaw <= 0n) return { error: 'burn miss' };
  const source = String(info.account || '');
  const sourceIndex = keys.findIndex((key) => String(typeof key === 'object' ? key.pubkey || '' : key) === source);
  if (sourceIndex < 0) return { error: 'burn miss' };
  const pre = tokenAccountMintAmount(tx.meta.preTokenBalances, sourceIndex, owner, mint);
  const post = tokenAccountMintAmount(tx.meta.postTokenBalances, sourceIndex, owner, mint);
  if (pre == null || post == null || pre - post !== amountRaw) return { error: 'burn miss' };
  return { ok: true, amountRaw, at: blockTime, owner, source };
}

export function inspectDonateTx(tx, {
  treasury = FAUCET_TREASURY_DEFAULT,
  mint = FAUCET_MINT,
  faucetSigner = '',
  now = Date.now(),
  launchAt = DONATE_LAUNCH_MS,
  minRaw = DONATE_MIN_RAW,
  windowMs = 7 * 24 * 60 * 60 * 1000,
} = {}) {
  if (!tx || tx.meta?.err) return { error: 'sig miss' };
  const blockTime = Number(tx.blockTime) * 1000;
  if (!Number.isFinite(blockTime) || blockTime > now + 60_000) return { error: 'sig miss' };
  if (blockTime < launchAt) return { error: 'sig miss' };
  if (now - blockTime > windowMs) return { error: 'sig miss' };
  const payer = messagePayer(tx);
  if (!payer) return { error: 'sig miss' };
  if (faucetSigner && payer === faucetSigner) return { error: 'sig miss' };
  const pre = tokenOwnerMintAmount(tx.meta.preTokenBalances, treasury, mint);
  const post = tokenOwnerMintAmount(tx.meta.postTokenBalances, treasury, mint);
  if (pre == null || post == null) return { error: 'sig miss' };
  const delta = post - pre;
  if (delta < minRaw) return { error: 'sig miss' };
  return { ok: true, amountRaw: delta, at: blockTime, payer };
}

export function faucetSiwsInput({ domain, publicKey, nonce, issuedAt, expirationTime }) {
  return {
    domain,
    address: publicKey,
    statement:
      'Prove this wallet is yours to claim a Dasha tip. This is not a transaction and does not spend SOL or approve tokens.',
    uri: `https://${domain}/`,
    version: '1',
    chainId: 'mainnet',
    nonce,
    issuedAt: new Date(issuedAt).toISOString(),
    expirationTime: new Date(expirationTime).toISOString(),
  };
}

/** Signed SIWS text must name our domain, the key, the tip statement, and the issued nonce. */
export function siwsMessageError(message, { publicKey, domain, nonce } = {}) {
  const msg = String(message || '');
  const key = String(publicKey || '').trim();
  if (!key || !msg.includes(key) || !msg.includes('Dasha tip')) return 'invalid faucet challenge';
  if (domain && !msg.includes(String(domain))) return 'siws_domain';
  if (nonce && !msg.includes(String(nonce))) return 'invalid faucet challenge';
  return '';
}

/** Potter public wallet — only legal withdraw dest. Never a parameter from the public. */
export const FAUCET_WITHDRAW_DEST = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
export const SYSTEM_RENT_EXEMPT_LAMPORTS = 890880n;
export const TX_FEE_LAMPORTS = 5000n;
export const ATA_RENT_LAMPORTS = 2_039_280n;

export function donateAmountUi(amountRaw, decimals = FAUCET_DECIMALS) {
  try {
    const raw = BigInt(amountRaw || 0);
    const den = 10n ** BigInt(decimals);
    const whole = raw / den;
    const frac = raw % den;
    if (frac === 0n) return Number(whole);
    return Number(raw) / Number(den);
  } catch {
    return 0;
  }
}

function safeInt(n) {
  try {
    const v = BigInt(n ?? 0);
    if (v < 0n) return 0;
    return Number(v > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : v);
  } catch {
    return 0;
  }
}

/** Always the public tip-jar address. Status must never shrink or replace it. */
export function jarCopyAddress(_status) {
  return FAUCET_TREASURY_DEFAULT;
}

export function jarBalanceUi(status, decimals = FAUCET_DECIMALS) {
  if (!status || typeof status !== 'object') return null;
  if (status.balanceUi != null && status.balanceUi !== '') {
    const n = Number(status.balanceUi);
    return Number.isFinite(n) ? n : null;
  }
  if (status.balanceRaw == null) return null;
  const n = donateAmountUi(status.balanceRaw, Number(status.decimals) || decimals);
  return Number.isFinite(n) ? n : null;
}

export function jarHeadline(status) {
  const n = jarBalanceUi(status);
  if (n == null) return '';
  const shown = Math.abs(n - Math.round(n)) < 1e-9 ? String(Math.round(n)) : String(n);
  return shown + ' $dasha in the jar.';
}

export function jarSolNote(status) {
  if (!status || status.solLamports == null || status.solLamports === '') return '';
  return Number(status.solLamports) === 0 ? 'Jar needs a drop of SOL.' : '';
}

export function attachJarFields(status, inventory = {}, decimals = FAUCET_DECIMALS) {
  const next = { ...(status || {}) };
  if (inventory.balanceRaw != null) {
    next.balanceRaw = safeInt(inventory.balanceRaw);
    next.balanceUi = donateAmountUi(inventory.balanceRaw, decimals);
  } else if (next.balanceRaw != null && next.balanceUi == null) {
    next.balanceUi = donateAmountUi(next.balanceRaw, decimals);
  }
  if (inventory.solLamports != null) {
    next.solLamports = safeInt(inventory.solLamports);
  } else if (!('solLamports' in next)) {
    next.solLamports = null;
  }
  if (!next.treasury) next.treasury = FAUCET_TREASURY_DEFAULT;
  return next;
}

/** Shared admin gate: FAUCET_ADMIN, else fill secret, else existing lobby session secret. */
export function faucetAdminSecret(env = {}) {
  return String(env.FAUCET_ADMIN || env.FAUCET_FILL_SECRET || env.LOBBY_SESSION_SECRET || '').trim();
}

export function faucetAdminOk(env = {}, provided = '') {
  const got = String(provided || '').trim();
  const want = faucetAdminSecret(env);
  if (!want || !got || want.length !== got.length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return d === 0;
}

/**
 * One-shot drain plan: all $dasha + leftover SOL above rent+fee, dest locked to Potter.
 * Pure. Broadcast lives in dasha-faucet-solana.mjs.
 */
export function planTreasuryWithdraw({
  solLamports = 0n,
  tokenRaw = 0n,
  dest = FAUCET_WITHDRAW_DEST,
  createDestAta = false,
  rentExemptMin = SYSTEM_RENT_EXEMPT_LAMPORTS,
  feeLamports = TX_FEE_LAMPORTS,
  ataRentLamports = ATA_RENT_LAMPORTS,
} = {}) {
  dest = String(dest || '').trim();
  if (dest !== FAUCET_WITHDRAW_DEST) {
    return {
      ok: false,
      error: 'dest_not_potter',
      dest: FAUCET_WITHDRAW_DEST,
      tokenRaw: '0',
      solSend: '0',
      solKeep: '0',
      canSend: false,
    };
  }
  let sol = 0n;
  let tok = 0n;
  try {
    sol = BigInt(solLamports || 0);
    tok = BigInt(tokenRaw || 0);
  } catch {
    return { ok: false, error: 'bad_amount', dest, tokenRaw: '0', solSend: '0', solKeep: '0', canSend: false };
  }
  if (sol < 0n || tok < 0n) {
    return { ok: false, error: 'bad_amount', dest, tokenRaw: '0', solSend: '0', solKeep: '0', canSend: false };
  }
  const ataRent = createDestAta ? BigInt(ataRentLamports) : 0n;
  const need = BigInt(feeLamports) + BigInt(rentExemptMin) + ataRent;
  if (tok > 0n && sol < need) {
    return {
      ok: false,
      error: 'treasury_rent',
      dest,
      tokenRaw: String(tok),
      tokenUi: donateAmountUi(tok),
      solSend: '0',
      solKeep: String(sol),
      solLamports: String(sol),
      canSend: false,
      createDestAta: Boolean(createDestAta),
    };
  }
  const solSend = sol > need ? sol - BigInt(rentExemptMin) - BigInt(feeLamports) - ataRent : 0n;
  const canSend = tok > 0n || solSend > 0n;
  if (!canSend) {
    return {
      ok: false,
      error: 'treasury_empty',
      dest,
      tokenRaw: '0',
      tokenUi: 0,
      solSend: '0',
      solKeep: String(sol),
      solLamports: String(sol),
      canSend: false,
      createDestAta: Boolean(createDestAta),
    };
  }
  return {
    ok: true,
    dest,
    tokenRaw: String(tok),
    tokenUi: donateAmountUi(tok),
    solSend: String(solSend),
    solKeep: String(rentExemptMin),
    solLamports: String(sol),
    canSend: true,
    createDestAta: Boolean(createDestAta),
  };
}
