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
