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
