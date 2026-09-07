/**
 * Compute x402 PoC skeleton — flag OFF by default.
 *
 * COMPUTE_X402_POC unset/0/false → noop (prepaid + key-cap paths bit-identical).
 * No facilitator. No live USDC settle. Never debit credits / key spend on this lane.
 * Worker chat branch is intentionally NOT wired this hop — builders + flag only.
 */
import {
  CREDIT_DEST,
  HOSTED_ASK_PRICE_CENTS,
  TOKEN_DECIMALS,
  USDC_MINT,
  usdcAmountRaw,
} from './dasha-compute-credits.mjs';

/** Solana mainnet CAIP-2 (x402 / Solana Pay peers). */
export const X402_SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const X402_SCHEME = 'exact';
export const X402_VERSION = 2;
export const X402_MAX_TIMEOUT_SECONDS = 120;
export const X402_REPLAY_PREFIX = 'compute:x402-replay:';
export const X402_REPLAY_TTL_MS = 120_000;

/** Docs-only honesty on GET /compute/api billing — not an enable switch. */
export const X402_BILLING_DOCS = 'flag_off';

/**
 * True only when env COMPUTE_X402_POC is explicitly "1" / "true" / "yes" / "on".
 * Default (unset) and every other value → false.
 */
export function isComputeX402PocEnabled(env) {
  const raw = String(env?.COMPUTE_X402_POC ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/** Opt-in discriminator so prepaid OpenAI-shaped 402s stay distinct. */
export function wantsX402Pay(request) {
  if (!request || !request.headers) return false;
  const pay = String(request.headers.get('x-dasha-pay') || '').trim().toLowerCase();
  if (pay === 'x402') return true;
  const accept = String(request.headers.get('accept') || '').toLowerCase();
  return accept.includes('application/x402+json');
}

/** Dual-auth: bearer present + x402 opt-in → reject (prefer 400 later). */
export function hasBearerAuth(request) {
  const auth = String(request?.headers?.get?.('authorization') || '');
  return /^bearer\s+\S+/i.test(auth);
}

/** Atomic USDC for Hosted ask ($0.05 → "50000"). */
export function x402ExactAmountAtomic(cents = HOSTED_ASK_PRICE_CENTS) {
  const raw = usdcAmountRaw(cents, TOKEN_DECIMALS);
  if (raw == null) return null;
  return String(raw);
}

/**
 * Build Solana `exact` PaymentRequired challenge for one Hosted-priced job.
 * Stub only — no facilitator feePayer required until Potter enables settle.
 */
export function buildSolanaExactChallenge({
  resourceUrl = 'https://www.getdasha.com/compute/api/v1/chat/completions',
  description = 'Dasha Compute chat completion ($0.05)',
  cents = HOSTED_ASK_PRICE_CENTS,
  payTo = CREDIT_DEST,
  asset = USDC_MINT,
  network = X402_SOLANA_NETWORK,
  maxTimeoutSeconds = X402_MAX_TIMEOUT_SECONDS,
  feePayer = null,
  now = Date.now(),
} = {}) {
  const amount = x402ExactAmountAtomic(cents);
  if (!amount) return null;
  const accepts = [{
    scheme: X402_SCHEME,
    network,
    amount,
    asset,
    payTo,
    maxTimeoutSeconds,
    extra: feePayer ? { feePayer: String(feePayer) } : { feePayer: null, settle: 'not_enabled' },
  }];
  const body = {
    x402_version: X402_VERSION,
    x402Version: X402_VERSION,
    error: 'PAYMENT-SIGNATURE header is required',
    resource: {
      url: String(resourceUrl),
      description: String(description),
      mimeType: 'application/json',
    },
    accepts,
    // Alias some peers use (Solvela-shaped top-level).
    PaymentRequired: true,
    amount_cents: Math.floor(Number(cents) || 0),
    issued_at: Math.floor(Number(now) || Date.now()),
  };
  return body;
}

/** Base64 PAYMENT-REQUIRED header value from challenge body. */
export function encodePaymentRequiredHeader(challenge) {
  if (!challenge || typeof challenge !== 'object') return null;
  const json = JSON.stringify(challenge);
  // Workers + Node: btoa on binary-safe latin1 of utf8 bytes.
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
}

/**
 * Shape-check PAYMENT-SIGNATURE (base64 JSON PaymentPayload). No verify/settle.
 * Returns { ok, error?, payload? }.
 */
export function parsePaymentSignatureHeader(raw) {
  const header = String(raw || '').trim();
  if (!header) return { ok: false, error: 'missing PAYMENT-SIGNATURE' };
  let json;
  try {
    const bin = typeof atob === 'function' ? atob(header) : Buffer.from(header, 'base64').toString('binary');
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    json = new TextDecoder().decode(bytes);
  } catch {
    return { ok: false, error: 'PAYMENT-SIGNATURE not base64' };
  }
  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    return { ok: false, error: 'PAYMENT-SIGNATURE not JSON' };
  }
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'bad payload' };
  const version = payload.x402Version ?? payload.x402_version;
  if (version != null && Number(version) !== X402_VERSION) {
    return { ok: false, error: 'unsupported x402 version' };
  }
  const tx = payload?.payload?.transaction || payload?.transaction;
  if (!tx || typeof tx !== 'string' || tx.length < 16) {
    return { ok: false, error: 'missing payload.transaction' };
  }
  return { ok: true, payload };
}

/**
 * Future Worker hook: returns challenge body only when flag ON + opt-in + no bearer.
 * Flag off → always null (prepaid path unchanged). No settle. No debit.
 */
export function maybeX402Challenge(env, request, opts = {}) {
  if (!isComputeX402PocEnabled(env)) return null;
  if (!wantsX402Pay(request)) return null;
  if (hasBearerAuth(request)) return { error: 'dual_auth', status: 400 };
  const sig = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('payment-signature');
  if (sig) {
    const parsed = parsePaymentSignatureHeader(sig);
    if (!parsed.ok) return { error: parsed.error, status: 402, challenge: buildSolanaExactChallenge(opts) };
    // Signature present — verify/settle NOT implemented this hop.
    return { error: 'x402_verify_not_enabled', status: 501 };
  }
  return { challenge: buildSolanaExactChallenge(opts), status: 402 };
}

/** Honesty field for billing docs — never means live settle. */
export function x402BillingDocsLine(env) {
  if (isComputeX402PocEnabled(env)) return 'flag_on_stub'; // still no settle
  return X402_BILLING_DOCS;
}
