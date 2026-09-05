import {
  CONNECTOR_ACTIVATION_POINTS,
  CONNECTOR_CONTRIBUTION_POINTS,
  OSS_SCHEMA,
  buildPublicBoard,
  isValidEvidenceUrl,
  isValidOssEvidenceUrl,
  proposeAward,
} from './dasha-simp-score.mjs';
import { MINT } from './dasha-lobby-mod.mjs';

export const CLAIM_LIMIT = 50;
export const PENDING_LIMIT = 3;
export const SNAPSHOT_LIMIT = 24;
export const HOLDER_TTL_MS = 24 * 60 * 60 * 1000;
export const OSS_TIERS = new Set([5, 15, 40, 100, 200]);
export const REFERRAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFERRAL_RETURN_MS = 24 * 60 * 60 * 1000;
export const REFERRAL_CAP_28D = 5;

export function pruneExpiredReferrals(referrals, { now = Date.now() } = {}) {
  let expired = 0;
  const next = Object.fromEntries(Object.entries(referrals || {}).filter(([, row]) => {
    const keep = Boolean(row?.quizAt || Number(row?.claimedAt) + REFERRAL_TTL_MS >= now);
    if (!keep) expired++;
    return keep;
  }));
  return { referrals: expired ? next : referrals, expired };
}

export function claimReferral(referrals, profiles, session, code, { now = Date.now() } = {}) {
  const invitee = String(session?.xId || '');
  const token = String(code || '');
  if (!invitee || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { ok: false, status: 400, error: 'invalid referral' };
  const pruned = pruneExpiredReferrals(referrals, { now });
  if (profiles?.[invitee] || pruned.referrals?.[invitee]) return { ok: false, status: 409, error: 'referral already settled', expired: pruned.expired };
  // ponytail: linear scan is enough for the bounded pilot; index codes if the Board reaches thousands.
  const inviter = Object.entries(profiles || {}).find(([id, profile]) => id !== invitee && profile?.referralCode === token);
  if (!inviter) return { ok: false, status: 404, error: 'referral not found' };
  return {
    ok: true,
    referrals: { ...pruned.referrals, [invitee]: { inviterXId: inviter[0], inviteeXId: invitee, claimedAt: now } },
    expired: pruned.expired,
  };
}

export function referralCapReached(referrals, inviterXId, { now = Date.now() } = {}) {
  const start = now - 28 * 24 * 60 * 60 * 1000;
  return Object.values(referrals || {}).filter((row) => row?.inviterXId === String(inviterXId) && row.activatedAt >= start && row.activatedAt <= now).length >= REFERRAL_CAP_28D;
}

export function noteReferralQuiz(referrals, xId, { now = Date.now() } = {}) {
  const key = String(xId || '');
  const row = referrals?.[key];
  if (!row || row.quizAt || now - row.claimedAt > REFERRAL_TTL_MS) return referrals;
  return { ...referrals, [key]: { ...row, quizAt: now } };
}

export function activateReferral(referrals, xId, { now = Date.now() } = {}) {
  const key = String(xId || '');
  const row = referrals?.[key];
  if (!row?.quizAt || row.activatedAt || now - row.quizAt < REFERRAL_RETURN_MS) return referrals;
  return { ...referrals, [key]: { ...row, activatedAt: now } };
}

export function qualifyReferral(referrals, xId, { now = Date.now() } = {}) {
  const key = String(xId || '');
  const row = referrals?.[key];
  if (!row?.activatedAt || row.contributedAt) return referrals;
  return { ...referrals, [key]: { ...row, contributedAt: now } };
}

export function removeReferralIdentity(referrals, xId) {
  const key = String(xId || '');
  return Object.fromEntries(Object.entries(referrals || {}).filter(([invitee, row]) => invitee !== key && row.inviterXId !== key));
}

export function applyReferralScores(profiles, referrals, { now = Date.now() } = {}) {
  const next = Object.fromEntries(Object.entries(profiles || {}).map(([id, profile]) => [id, { ...profile, connectorPoints: 0 }]));
  const start = now - 28 * 24 * 60 * 60 * 1000;
  const used = new Map();
  for (const row of Object.values(referrals || {}).sort((a, b) => Number(a.activatedAt) - Number(b.activatedAt))) {
    if (!row?.activatedAt || row.activatedAt < start || row.activatedAt > now || !next[row.inviterXId] || !next[row.inviteeXId]) continue;
    const count = used.get(row.inviterXId) || 0;
    const inviterEligible = count < REFERRAL_CAP_28D;
    used.set(row.inviterXId, count + 1);
    next[row.inviteeXId].connectorPoints += CONNECTOR_ACTIVATION_POINTS;
    if (inviterEligible) next[row.inviterXId].connectorPoints += CONNECTOR_ACTIVATION_POINTS;
    if (row.contributedAt && row.contributedAt >= row.activatedAt) {
      next[row.inviteeXId].connectorPoints += CONNECTOR_CONTRIBUTION_POINTS;
      if (inviterEligible) next[row.inviterXId].connectorPoints += CONNECTOR_CONTRIBUTION_POINTS;
    }
  }
  return next;
}

const SUBTYPES = {
  creative: new Set(['maker', 'remix']),
  community: new Set(['helper', 'lobby_regular']),
  code: new Set(['maintainer']),
};

function cleanUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

export function normalizeClaim(input) {
  const kind = String(input?.kind || '').toLowerCase();
  const subtype = String(input?.subtype || '').toLowerCase();
  const evidenceUrl = cleanUrl(input?.evidenceUrl);
  if (!SUBTYPES[kind]?.has(subtype)) return { ok: false, error: 'invalid claim type' };
  const valid = kind === 'code'
    ? isValidOssEvidenceUrl(evidenceUrl)
    : isValidEvidenceUrl(evidenceUrl) && /^https:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^/]+\/status\/\d+(?:[/?#]|$)/i.test(evidenceUrl);
  if (!valid) return { ok: false, error: 'invalid evidence URL' };
  return { ok: true, value: { kind, subtype, evidenceUrl } };
}

export function submitClaim(claims, profiles, session, input, { now = Date.now(), id = crypto.randomUUID() } = {}) {
  if (!session?.xId || !profiles?.[String(session.xId)]) return { ok: false, status: 401, error: 'join board first' };
  const parsed = normalizeClaim(input);
  if (!parsed.ok) return { ...parsed, status: 400 };
  const xId = String(session.xId);
  const rows = Object.values(claims || {});
  if (rows.filter((row) => row.xId === xId).length >= CLAIM_LIMIT) return { ok: false, status: 429, error: 'claim limit reached' };
  if (rows.filter((row) => row.xId === xId && row.status === 'pending').length >= PENDING_LIMIT) return { ok: false, status: 429, error: 'finish pending claims first' };
  const duplicate = rows.some((row) => row.evidenceUrl === parsed.value.evidenceUrl && row.status !== 'declined') ||
    Object.values(profiles).some((profile) => (profile.awards || []).some((award) => award.evidenceUrl === parsed.value.evidenceUrl));
  if (duplicate) return { ok: false, status: 409, error: 'evidence already claimed' };
  const claim = {
    id: String(id).slice(0, 50),
    xId,
    handle: profiles[xId].handle,
    ...parsed.value,
    status: 'pending',
    submittedAt: now,
    reviewedAt: null,
    reason: null,
  };
  return { ok: true, claim, claims: { ...claims, [claim.id]: claim } };
}

export function publicClaim(claim) {
  return {
    id: claim.id,
    kind: claim.kind,
    subtype: claim.subtype,
    evidenceUrl: claim.evidenceUrl,
    status: claim.status,
    submittedAt: claim.submittedAt,
    reviewedAt: claim.reviewedAt,
    reason: claim.reason || null,
  };
}

export function claimsForSession(claims, session) {
  if (!session?.xId) return [];
  return Object.values(claims || {})
    .filter((claim) => claim.xId === String(session.xId))
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .map(publicClaim);
}

export function pendingClaims(claims) {
  return Object.values(claims || {})
    .filter((claim) => claim.status === 'pending')
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((claim) => ({ ...publicClaim(claim), handle: claim.handle }));
}

function badgeFor(claim) {
  if (claim.kind === 'creative') return claim.subtype === 'remix' ? 'remixer' : 'maker';
  if (claim.kind === 'community') return claim.subtype === 'lobby_regular' ? 'lobby_regular' : 'helper';
  return 'maintainer';
}

export function reviewClaim(claims, profiles, input, { now = Date.now() } = {}) {
  const id = String(input?.id || '');
  const decision = input?.decision;
  const claim = claims?.[id];
  if (!claim || claim.status !== 'pending') return { ok: false, status: 404, error: 'pending claim not found' };
  if (decision !== 'accept' && decision !== 'decline') return { ok: false, status: 400, error: 'decision must be accept or decline' };
  const reason = String(input?.reason || '').trim().slice(0, 160) || null;
  const nextClaim = { ...claim, status: decision === 'accept' ? 'accepted' : 'declined', reviewedAt: now, reason };
  const nextClaims = { ...claims, [id]: nextClaim };
  if (decision === 'decline') return { ok: true, claim: publicClaim(nextClaim), claims: nextClaims, profiles };
  const profile = profiles?.[claim.xId];
  if (!profile) return { ok: false, status: 409, error: 'board profile missing' };
  const kind = claim.kind === 'code' ? 'oss' : claim.kind;
  const points = kind === 'oss' ? Number(input?.ossPoints) : undefined;
  if (kind === 'oss' && !OSS_TIERS.has(points)) return { ok: false, status: 400, error: 'invalid OSS scorer tier' };
  const awarded = proposeAward(profile, {
    id: `claim:${claim.id}`,
    kind,
    ...(kind === 'oss' ? { schema: OSS_SCHEMA, points } : {}),
    evidenceUrl: claim.evidenceUrl,
    at: now,
    badge: badgeFor(claim),
  }, { now });
  if (!awarded.ok) return { ok: false, status: 400, error: awarded.error };
  return {
    ok: true,
    claim: publicClaim(nextClaim),
    claims: nextClaims,
    profiles: { ...profiles, [claim.xId]: awarded.profile },
  };
}

export function snapshotSeason(snapshots, profiles, input, { now = Date.now() } = {}) {
  const id = String(input?.id || '').trim().toLowerCase();
  const title = String(input?.title || '').trim().slice(0, 80);
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(id) || !title) return { ok: false, status: 400, error: 'valid season id and title required' };
  if (snapshots?.[id]) return { ok: false, status: 409, error: 'season already frozen' };
  const profilesList = Object.values(profiles || {});
  const snapshot = {
    id,
    title,
    frozenAt: now,
    board: buildPublicBoard(profilesList, { now }),
    memberHandles: Object.fromEntries(profilesList.filter(row => row?.xId && row?.handle).map(row => [String(row.xId), String(row.handle)])),
  };
  const rows = Object.entries({ ...(snapshots || {}), [id]: snapshot })
    .sort((a, b) => b[1].frozenAt - a[1].frozenAt)
    .slice(0, SNAPSHOT_LIMIT);
  return { ok: true, snapshot, snapshots: Object.fromEntries(rows) };
}

/** Remove one X identity from retained season boards; internal member map is never public. */
export function scrubSeasonSnapshots(snapshots, xId, currentHandle = '') {
  const key = String(xId || '');
  const fallback = String(currentHandle || '').toLowerCase();
  return Object.fromEntries(Object.entries(snapshots || {}).map(([id, snapshot]) => {
    const handle = String(snapshot?.memberHandles?.[key] || fallback).toLowerCase();
    const memberHandles = { ...(snapshot?.memberHandles || {}) };
    delete memberHandles[key];
    const board = Object.fromEntries(Object.entries(snapshot?.board || {}).map(([lane, rows]) => [
      lane,
      Array.isArray(rows) && handle ? rows.filter(row => String(row?.handle || '').toLowerCase() !== handle) : rows,
    ]));
    return [id, { ...snapshot, board, memberHandles }];
  }));
}

export function publicSeasons(snapshots) {
  return Object.values(snapshots || {})
    .sort((a, b) => b.frozenAt - a.frozenAt)
    .map((row) => ({ id: row.id, title: row.title, frozenAt: row.frozenAt, board: row.board }));
}

export function isValidSolanaAddress(value) {
  try {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(value || '')) && base58Decode(value).length === 32;
  } catch {
    return false;
  }
}

export function walletMessage({ handle, publicKey, nonce, issuedAt, expiresAt, domain = 'www.getdasha.com', uri = 'https://www.getdasha.com/' }) {
  return `${domain} wants you to sign in with your Solana account:\n${publicKey}\n\nProve the private holder badge for @${handle} and mint ${MINT}. No transaction or public balance.\n\nURI: ${uri}\nVersion: 1\nChain ID: mainnet\nNonce: ${nonce}\nIssued At: ${new Date(issuedAt).toISOString()}\nExpiration Time: ${new Date(expiresAt).toISOString()}\nRequest ID: simp-holder`;
}

export function walletLoginMessage({ publicKey, nonce, issuedAt, expiresAt, domain, uri }) {
  return `${domain} wants you to sign in with your Solana account:\n${publicKey}\n\nLog in to Dasha. This signature sends no transaction and proves address control only.\n\nURI: ${uri}\nVersion: 1\nChain ID: mainnet\nNonce: ${nonce}\nIssued At: ${new Date(issuedAt).toISOString()}\nExpiration Time: ${new Date(expiresAt).toISOString()}\nRequest ID: dasha-login`;
}

export function base58Decode(text) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const char of String(text || '')) {
    const n = alphabet.indexOf(char);
    if (n < 0) throw new Error('invalid base58');
    value = value * 58n + BigInt(n);
  }
  const bytes = [];
  while (value > 0n) {
    bytes.push(Number(value & 255n));
    value >>= 8n;
  }
  for (const char of String(text || '')) {
    if (char !== '1') break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

export async function verifyEd25519(message, publicKey58, signature58) {
  if (!isValidSolanaAddress(publicKey58)) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(String(signature58 || ''))) return false;
  const publicKey = base58Decode(publicKey58);
  const signature = base58Decode(signature58);
  if (publicKey.length !== 32 || signature.length !== 64) return false;
  const key = await crypto.subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify('Ed25519', key, signature, new TextEncoder().encode(message));
}

export function hasPositiveTokenBalance(data, { owner, mint }) {
  if (!Array.isArray(data?.result?.value)) return false;
  return data.result.value.some((row) => {
    const info = row?.account?.data?.parsed?.info;
    if (info?.owner !== owner || info?.mint !== mint) return false;
    try { return BigInt(info.tokenAmount?.amount) > 0n; } catch { return false; }
  });
}

export function applyHolderProof(profiles, session, { now = Date.now() } = {}) {
  const xId = String(session?.xId || '');
  const profile = profiles?.[xId];
  if (!profile) return { ok: false, status: 401, error: 'join board first' };
  const updated = { ...profile, holderCheckedAt: now, holderUntil: now + HOLDER_TTL_MS, updatedAt: now };
  return { ok: true, profile: updated, profiles: { ...profiles, [xId]: updated } };
}
