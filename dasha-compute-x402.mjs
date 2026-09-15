/**
 * Dasha Compute x402 canary primitives - inert until all owner-gated values exist.
 *
 * No facilitator calls, live settlement, credit debit, or Worker routing live here.
 * The production gate MUST require: explicit flag, one allow-listed route, an
 * explicit atomic price, treasury payTo, facilitator URL + fee payer, and USDC.
 */
import { TOKEN_DECIMALS, USDC_MINT, usdcAmountRaw } from './dasha-compute-credits.mjs';

export const X402_SOLANA_NETWORK = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const X402_SCHEME = 'exact';
export const X402_VERSION = 2;
export const X402_MAX_TIMEOUT_SECONDS = 120;
export const X402_REPLAY_PREFIX = 'compute:x402-replay:';
export const X402_REPLAY_TTL_MS = 120_000;
export const X402_BILLING_DOCS = 'flag_off';
export const X402_CANARY_ROUTE = '/compute/api/x402/v1/chat/completions';
export const X402_USDC_MINT = USDC_MINT;

export function isComputeX402PocEnabled(env) {
  const raw = String(env?.COMPUTE_X402_POC ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function wantsX402Pay(request) {
  if (!request || !request.headers) return false;
  const pay = String(request.headers.get('x-dasha-pay') || '').trim().toLowerCase();
  if (pay === 'x402') return true;
  const accept = String(request.headers.get('accept') || '').toLowerCase();
  return accept.includes('application/x402+json');
}

export function hasBearerAuth(request) {
  const auth = String(request?.headers?.get?.('authorization') || '');
  return /^bearer\s+\S+/i.test(auth);
}

export function x402ExactAmountAtomic(cents) {
  if (cents == null || !Number.isFinite(Number(cents)) || Number(cents) <= 0) return null;
  const raw = usdcAmountRaw(cents, TOKEN_DECIMALS);
  return raw == null || raw <= 0 ? null : String(raw);
}

export function x402CanaryConfig(env) {
  const amount = String(env?.COMPUTE_X402_AMOUNT_ATOMIC || '').trim();
  const payTo = String(env?.COMPUTE_X402_PAY_TO || '').trim();
  const facilitatorUrl = String(env?.COMPUTE_X402_FACILITATOR_URL || '').trim();
  const feePayer = String(env?.COMPUTE_X402_FEE_PAYER || '').trim();
  const route = String(env?.COMPUTE_X402_ROUTE || X402_CANARY_ROUTE).trim();
  const reasons = [];
  if (!isComputeX402PocEnabled(env)) reasons.push('flag_off');
  if (route !== X402_CANARY_ROUTE) reasons.push('route_not_allowlisted');
  if (!/^\d+$/.test(amount) || BigInt(amount || '0') <= 0n) reasons.push('price_unset');
  if (!payTo) reasons.push('pay_to_unset');
  if (!facilitatorUrl) reasons.push('facilitator_unset');
  if (!feePayer) reasons.push('fee_payer_unset');
  return {
    ready: reasons.length === 0,
    reasons,
    route,
    amount: amount || null,
    payTo: payTo || null,
    facilitatorUrl: facilitatorUrl || null,
    feePayer: feePayer || null,
    network: X402_SOLANA_NETWORK,
    asset: X402_USDC_MINT,
  };
}

export function buildSolanaExactChallenge({
  resourceUrl = `https://www.getdasha.com${X402_CANARY_ROUTE}`,
  description = 'Dasha Compute x402 canary chat completion',
  amountAtomic,
  payTo,
  asset = X402_USDC_MINT,
  network = X402_SOLANA_NETWORK,
  maxTimeoutSeconds = X402_MAX_TIMEOUT_SECONDS,
  feePayer,
  memo,
} = {}) {
  const amount = String(amountAtomic || '').trim();
  if (!/^\d+$/.test(amount) || BigInt(amount || '0') <= 0n || !payTo || !feePayer) return null;
  return {
    x402Version: X402_VERSION,
    error: 'PAYMENT-SIGNATURE header is required',
    resource: { url: String(resourceUrl), description: String(description), mimeType: 'application/json' },
    accepts: [{
      scheme: X402_SCHEME,
      network,
      amount,
      asset,
      payTo: String(payTo),
      maxTimeoutSeconds,
      extra: { feePayer: String(feePayer), ...(memo ? { memo: String(memo) } : {}) },
    }],
    extensions: {},
  };
}

export function encodePaymentRequiredHeader(challenge) {
  if (!challenge || typeof challenge !== 'object') return null;
  const bytes = new TextEncoder().encode(JSON.stringify(challenge));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
}

export function parsePaymentSignatureHeader(raw) {
  const header = String(raw || '').trim();
  if (!header) return { ok: false, error: 'missing PAYMENT-SIGNATURE' };
  let payload;
  try {
    const bin = typeof atob === 'function' ? atob(header) : Buffer.from(header, 'base64').toString('binary');
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, error: 'PAYMENT-SIGNATURE is not base64 JSON' };
  }
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'bad payload' };
  if (Number(payload.x402Version) !== X402_VERSION) return { ok: false, error: 'unsupported x402 version' };
  const tx = payload?.payload?.transaction;
  if (!tx || typeof tx !== 'string' || tx.length < 16) return { ok: false, error: 'missing payload.transaction' };
  return { ok: true, payload };
}

export function maybeX402Challenge(env, request, opts = {}) {
  if (!isComputeX402PocEnabled(env) || !wantsX402Pay(request)) return null;
  if (hasBearerAuth(request)) return { error: 'dual_auth', status: 400 };
  const config = x402CanaryConfig(env);
  if (!config.ready) return { error: 'x402_not_configured', status: 503, reasons: config.reasons };
  const challenge = buildSolanaExactChallenge({
    amountAtomic: config.amount,
    payTo: config.payTo,
    feePayer: config.feePayer,
    ...opts,
  });
  const sig = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('payment-signature');
  if (!sig) return { challenge, status: 402 };
  const parsed = parsePaymentSignatureHeader(sig);
  if (!parsed.ok) return { error: parsed.error, status: 402, challenge };
  return { error: 'x402_verify_not_enabled', status: 501 };
}

/**
 * Future receipt-link extension. Do not mutate dasha.receipt.v0's canonical
 * signed body. Sign this companion body separately, then expose it beside the
 * existing receipt after settlement is confirmed.
 */
export function canonicalX402ReceiptBinding({ receiptHash, settlementTransaction, network = X402_SOLANA_NETWORK, payer = null, amountAtomic, asset = X402_USDC_MINT }) {
  if (!receiptHash || !settlementTransaction || !/^\d+$/.test(String(amountAtomic || '')) || BigInt(String(amountAtomic)) <= 0n) return null;
  return {
    schema: 'dasha.x402-receipt-binding.v0',
    receipt_hash: String(receiptHash),
    settlement_transaction: String(settlementTransaction),
    network: String(network),
    payer: payer == null ? null : String(payer),
    amount: String(amountAtomic),
    asset: String(asset),
  };
}

export function buildX402Offer(env = {}) {
  const cfg = x402CanaryConfig(env);
  return {
    schema: 'dasha.x402-offer.v0',
    enabled: cfg.ready,
    status: cfg.ready ? 'canary' : 'owner_configuration_required',
    protocol: { version: X402_VERSION, scheme: X402_SCHEME, transport: 'http' },
    resource: {
      method: 'POST',
      path: X402_CANARY_ROUTE,
      openai_compatible: true,
      description: 'One allow-listed Dasha Compute inference route',
    },
    payment: {
      currency: 'USDC', network: cfg.network, asset: cfg.asset,
      amount: cfg.amount, payTo: cfg.payTo,
    },
    receipt: {
      existing_schema: 'dasha.receipt.v0',
      binding_schema: 'dasha.x402-receipt-binding.v0',
      verify_url_template: 'https://www.getdasha.com/compute/api/verify?hash={receipt_hash}',
    },
    constraints: { no_bearer_auth: true, settle_before_inference: true, single_route: true },
    blockers: cfg.reasons,
  };
}

export function x402BillingDocsLine(env) {
  return x402CanaryConfig(env).ready ? 'canary_configured_unwired' : X402_BILLING_DOCS;
}
