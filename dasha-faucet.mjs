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
