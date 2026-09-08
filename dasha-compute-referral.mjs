/**
 * Referral mechanics (tasks 16-17): account-bound codes, attribution, milestones.
 * Provider: referee comes online -> referrer +$2; referee reaches 50 jobs ->
 * referrer +$5, referee +$2. Buyer: first top-up >= $5 -> both +$5.
 * Recipient-side grants capped at $50/month; one referral per account;
 * 10 attributions/code/day trips review (attribution skipped). No device
 * fingerprinting - self-referral is blocked by account equality + payout
 * wallet uniqueness at grant time.
 */
import { sha256Hex } from './dasha-compute-heads.mjs';

export const REF_M1_CENTS = 200;
export const REF_M2_JOBS = 50;
export const REF_M2_REFERRER_CENTS = 500;
export const REF_M2_REFEREE_CENTS = 200;
export const REF_BUYER_MIN_TOPUP_CENTS = 500;
export const REF_BUYER_CENTS = 500;
export const REF_MONTH_CAP_CENTS = 5000;
export const REF_VELOCITY_PER_DAY = 10;

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function normalizeRefCode(raw) {
  const code = String(raw || '').trim().toLowerCase();
  return /^dash-[a-z2-9]{8}$/.test(code) ? code : '';
}

/** Deterministic per-account code. Collision handled by caller via stored mapping. */
export async function referralCodeFor(owner, salt = '') {
  const hex = await sha256Hex(`dasha-ref${salt}:${String(owner || '')}`);
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % CODE_ALPHABET.length];
  return `dash-${code}`;
}

export function refMonthKey(now = Date.now()) {
  return new Date(Number(now)).toISOString().slice(0, 7);
}

export function refDayKey(now = Date.now()) {
  return new Date(Number(now)).toISOString().slice(0, 10);
}
