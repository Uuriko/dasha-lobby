import { authSessionFromRequest, randomUrlToken } from './dasha-lobby-x.mjs';
import {
  CREDIT_DEST,
  CREDIT_DISCOUNTS,
  CREDIT_ORDER_TTL_MS,
  HOSTED_ASK_PRICE_CENTS,
  applyCreditDebit,
  creditsCatalog,
  findCreditPayment,
  generateReference,
  loadTxBySignature,
  lockPayAmount,
  lockTipAmount,
  packById,
  solanaPayUrl,
  tipCentsFromInput,
  verifyCreditTx,
} from './dasha-compute-credits.mjs';
import {
  createCardCheckoutSession,
  retrieveCardSession,
  sessionSettlesOrder,
  stripeConfigured,
  stripeWebhookConfigured,
  verifyStripeSignature,
} from './dasha-compute-card.mjs';
import {
  PROVIDER_MIN_PAYOUT_CENTS,
  PROVIDER_PAYOUT_MODE,
  PROVIDER_USDC_MINT,
  accrueProviderEarn,
  autoSendUsdcEnabled,
  computePayoutKeypair,
  computePayoutSecret,
  createPendingPayout,
  earningsCatalog,
  extractPayoutSecret,
  isValidSolanaTxSignature,
  listPendingProviderPayouts,
  markProviderPayoutPaid,
  normalizeEarnRow,
  normalizePayoutPref,
  payoutSecretOk,
  publicPayoutRow,
  solscanTxUrl,
  usdcRawFromCents,
} from './dasha-compute-provider-earn.mjs';
import { sendTipTransfer } from './dasha-faucet-solana.mjs';
import {
  listReceiptsForOwner,
  publicSettled24h,
  recordSettledInference,
  sumSettled24h,
} from './dasha-compute-settled.mjs';
import {
  REF_BUYER_CENTS,
  REF_BUYER_MIN_TOPUP_CENTS,
  REF_M1_CENTS,
  REF_M2_JOBS,
  REF_M2_REFEREE_CENTS,
  REF_M2_REFERRER_CENTS,
  REF_MONTH_CAP_CENTS,
  REF_VELOCITY_PER_DAY,
  normalizeRefCode,
  refDayKey,
  refMonthKey,
  referralCodeFor,
} from './dasha-compute-referral.mjs';
import {
  HEAD_MAX_AGE_MS,
  anchoredVerdict,
  appendChainedReceipt,
  appendHead,
  chainTip,
  headsSigningKey,
  headsTip,
  listAllHeads,
  listChain,
  listHeads,
  listHeadsForDay,
  makeHead,
} from './dasha-compute-heads.mjs';
import { X402_BILLING_DOCS, x402BillingDocsLine } from './dasha-compute-x402.mjs';
import {
  computeGuestKeyResponse,
  guestKeyAllows,
  guestKeyExpired,
  handleGuestKeyWrite,
  isComputeGuestKeyPath,
  isGuestApiKey,
  parseGuestApiToken,
  takeGuestRate,
  GUEST_KEY_CHAT_MAX,
  GUEST_KEY_CHAT_WINDOW_MS,
} from './dasha-compute-guest-key.mjs';
import {
  attachEffortToReceipt,
  dashaEffortExtension,
  effortHonesty,
  effortHonestyFromJob,
  effortResponseHeaders,
  hostedEffortFace,
  hostedReasoningEffortInput,
  parseReasoningEffort,
} from './dasha-compute-reasoning-effort.mjs';
import {
  attachReceiptHonesty,
  countConversationTurns,
  honestLoopFields,
} from './dasha-compute-receipt-honesty.mjs';
export { X402_BILLING_DOCS, x402BillingDocsLine };

export { HOSTED_ASK_PRICE_CENTS };

/** LiteLLM-style spend visibility on chat completions. Community omits USD when cost is unknown. */
export const DASHA_SPEND_HEADER_ROUTE = 'X-Dasha-Route';
export const DASHA_SPEND_HEADER_MODEL = 'X-Dasha-Model';
export const DASHA_SPEND_HEADER_USD = 'X-Dasha-Spend-Usd';
export const DASHA_SPEND_EXPOSE = 'X-Dasha-Spend-Usd, X-Dasha-Route, X-Dasha-Model';

/** Response face is community | hosted. Mac routes (community/mixture/self) collapse to community. */
export function dashaChatRouteFace(route) {
  return String(route || '') === 'hosted' ? 'hosted' : 'community';
}

/**
 * Honest spend headers. Never invent pennies from tokens.
 * spendCents: integer cents when known; null/undefined omits X-Dasha-Spend-Usd.
 */
export function dashaChatSpendHeaders({ route, model, spendCents = null } = {}) {
  const headers = {
    [DASHA_SPEND_HEADER_ROUTE]: dashaChatRouteFace(route),
    'Access-Control-Expose-Headers': DASHA_SPEND_EXPOSE,
  };
  const id = String(model || '').trim();
  if (id) headers[DASHA_SPEND_HEADER_MODEL] = id.slice(0, 64);
  if (spendCents != null && spendCents !== '' && Number.isFinite(Number(spendCents))) {
    headers[DASHA_SPEND_HEADER_USD] = (Math.max(0, Math.floor(Number(spendCents))) / 100).toFixed(2);
  }
  return headers;
}

/** Buyer SSE hold: close cleanly in the 30–45s window (FRESH_MS=45s) so CF/browser idle kill is not a Failed to fetch. */
export const SSE_BUYER_HOLD_MS = 35_000;
export const SSE_KEEPALIVE_MS = 10_000;

const MODELS = new Set(['qwen3-4b', 'qwen3-8b', 'gemma3-12b', 'gpt-oss-20b', 'qwen3-30b-a3b', 'gemma3-27b', 'gpt-oss-120b']);
export const COMPUTE_CATALOG_MODELS = MODELS;

/**
 * Poll unions catalog models the Mac is advertising into allowedModels.
 * Register-time allow-list stays until the kit actually polls a new catalog id
 * (DASHA_MODEL_MAP add). Unknown / non-catalog ids stay out.
 */
export function growAllowedModels(prior, polled = [], catalog = MODELS) {
  const next = new Set();
  for (const model of prior || []) {
    const id = String(model);
    if (catalog.has(id)) next.add(id);
  }
  for (const model of polled || []) {
    const id = String(model);
    if (catalog.has(id)) next.add(id);
  }
  return [...next];
}
const FRESH_MS = 45_000;
const JOB_TTL_MS = 5 * 60_000;
const LEASE_MS = 5 * 60_000;
const NIGHT_JOB_TTL_MS = 24 * 60 * 60_000;
const NIGHT_INTERVALS = { daily: 24 * 60 * 60_000, weekly: 7 * 24 * 60 * 60_000 };
const NIGHT_TEMPLATES = {
  research: 'Research the request carefully. Return a concise report with findings, evidence, uncertainties, and recommended next actions.',
  review: 'Review the supplied material. Identify important defects, risks, opportunities, and concrete improvements in priority order.',
  briefing: 'Produce an executive briefing. Lead with what changed, why it matters, and the decisions or actions required.',
  custom: 'Complete the requested task carefully and return a useful standalone result.',
};
const NIGHT_STEP_COUNTS = { research: 3, review: 2, briefing: 1, custom: 1 };
export const API_KEY_LIMIT_DEFAULT_CENTS = 500;
const API_KEY_LIMIT_MIN_CENTS = 100;
const API_KEY_LIMIT_MAX_CENTS = 100_000;
const API_KEY_LIMIT_RESETS = new Set(['daily', 'weekly', 'monthly', 'none']);
const API_KEY_LIMIT_RESET_MS = {
  daily: 24 * 60 * 60_000,
  weekly: 7 * 24 * 60 * 60_000,
  monthly: 30 * 24 * 60 * 60_000,
};
const SECURITY = { 'Cache-Control': 'no-store', 'Strict-Transport-Security': 'max-age=31536000', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
const hostedRates = new Map();
/** Test-only: clear in-memory Hosted free-floor counters. */
export function resetHostedRatesForTests() { hostedRates.clear(); }

export const COMPUTE_SPONSOR_TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
export const COMPUTE_SPONSOR_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const COMPUTE_SPONSOR_MACHINES = [
  { id: 'mini-m4', n: '01', name: 'Mac mini M4', role: 'always-on node', usd: 599 },
  { id: 'mini-pro', n: '02', name: 'Mac mini M4 Pro', role: 'denser node', usd: 1399 },
  { id: 'air-13', n: '03', name: 'MacBook Air 13', role: 'travel node', usd: 999 },
  { id: 'air-15', n: '04', name: 'MacBook Air 15', role: 'travel node', usd: 1199 },
  { id: 'mbp-14', n: '05', name: 'MacBook Pro 14', role: 'daily driver', usd: 1599 },
  { id: 'mbp-16', n: '06', name: 'MacBook Pro 16', role: 'night shift', usd: 2499 },
  { id: 'studio', n: '07', name: 'Mac Studio', role: 'studio node', usd: 1999 },
  { id: 'pro', n: '08', name: 'Mac Pro', role: 'rack', usd: 6999 },
];

export function sponsorBoard(pledges = [], tipRows = []) {
  // pledges = machine name rows (compute:sponsor:); tipRows = paid tips (compute:sponsor-pledge:)
  const byId = Object.fromEntries((pledges || []).filter(Boolean).map(row => [row.machine, row]));
  const tips = (tipRows || [])
    .filter(row => row && (row.status === 'funded' || row.status === 'paid') && Number(row.cents) > 0)
    .map(row => ({
      id: row.id || null,
      cents: Math.floor(Number(row.cents) || 0),
      machine: row.machine || 'network',
      name: row.name || null,
      handle: row.handle || null,
      method: row.method || null,
      createdAt: row.createdAt || row.paidAt || null,
    }))
    .filter(row => row.cents > 0)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const tipCentsByMachine = {};
  for (const tip of tips) {
    if (!tip.machine || tip.machine === 'network') continue;
    tipCentsByMachine[tip.machine] = (tipCentsByMachine[tip.machine] || 0) + tip.cents;
  }
  const machines = COMPUTE_SPONSOR_MACHINES.map(machine => {
    const row = byId[machine.id];
    const tipCents = tipCentsByMachine[machine.id] || 0;
    const status = tipCents > 0 || row?.status === 'funded'
      ? 'funded'
      : row
        ? 'named'
        : 'open';
    const sponsor = row
      ? { name: row.name, handle: row.handle || null, url: row.url || null }
      : (tips.find(t => t.machine === machine.id && t.name)
        ? { name: tips.find(t => t.machine === machine.id && t.name).name, handle: tips.find(t => t.machine === machine.id && t.name).handle || null, url: null }
        : null);
    return { ...machine, status, sponsor, raised_cents: tipCents || Math.floor(Number(row?.cents) || 0) || 0 };
  });
  // Honesty: raised_usd is ONLY real tip pledge cents — never catalog machine.usd.
  const raised_cents = tips.reduce((sum, tip) => sum + tip.cents, 0);
  const credit = tips
    .filter(tip => tip.name)
    .slice(0, 24)
    .map(tip => ({
      machine: tip.machine === 'network'
        ? 'Network'
        : (COMPUTE_SPONSOR_MACHINES.find(m => m.id === tip.machine)?.name || tip.machine),
      name: tip.name,
      handle: tip.handle,
      cents: tip.cents,
    }));
  return {
    treasury: COMPUTE_SPONSOR_TREASURY,
    dest: COMPUTE_SPONSOR_TREASURY,
    mint: COMPUTE_SPONSOR_MINT,
    raised_cents,
    raised_usd: Math.round(raised_cents) / 100,
    goal_usd: COMPUTE_SPONSOR_MACHINES.reduce((sum, machine) => sum + machine.usd, 0),
    machines,
    credit,
    tips: tips.slice(0, 40),
  };
}

function sponsorActor(session) {
  if (session?.provider === 'x' && session.xId) return { owner: `x:${session.xId}`, handle: session.handle || null, fallback: session.name || session.handle || 'anon' };
  if (session?.provider === 'wallet' && session.wallet) return { owner: `wallet:${session.wallet}`, handle: null, fallback: `${session.wallet.slice(0, 4)}…${session.wallet.slice(-4)}` };
  if (session?.provider === 'grok' && session.displayName) return { owner: `grok:${String(session.displayName).toLowerCase()}`, handle: null, fallback: session.displayName };
  return null;
}

function publicSponsorUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString().slice(0, 120);
  } catch { return null; }
}


function cors(origin, credentials = false) {
  return origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dasha-Route', ...(credentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}), Vary: 'Origin' } : {};
}

function json(body, status = 200, origin = null, credentials = false, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...SECURITY, ...cors(origin, credentials), 'Content-Type': 'application/json; charset=utf-8', ...extra } });
}

/** Same 403 — clearer for API testers who hit browser-session Compute without Origin. */
export const ORIGIN_REQUIRED_HINT = 'Browser session needs Origin from getdasha.com. API keys use POST /compute/api/v1/chat/completions.';
export const ORIGIN_REQUIRED = { error: 'origin required', hint: ORIGIN_REQUIRED_HINT };
function originRequired() {
  return json(ORIGIN_REQUIRED, 403);
}

function maybeHead(request, res) {
  return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
}

/** Funnel telemetry (task 22): aggregate counters only - no emails, prompts, or fingerprints. */
const METRIC_STEP_RE = /^[a-z0-9:_-]{1,32}$/;
const METRIC_ANON_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METRIC_CLIENT_EVENTS = new Set(['page', 'provide', 'ask', 'pay', 'signin', 'kit']);
const metricDay = () => new Date().toISOString().slice(0, 10);
const metricHour = (now) => new Date(now).toISOString().slice(0, 13);

/** Public compute health probe. /compute/api/health is a fail-loud alias of healthz (same 200 JSON, not 308). */
function isComputeApiHealthzPath(path) {
  return path === '/compute/api/healthz' || path === '/compute/api/healthz/'
    || path === '/compute/api/health' || path === '/compute/api/health/';
}

/**
 * Leftover /compute/v1/chat/completions (agents omit /api).
 * Same fail-loud chat handler as /compute/api/v1/chat/completions — not a 308, not opaque 404.
 * Title-case via toLowerCase. Slash kept. Never fold bare /v1/chat/completions.
 */
export function rewriteComputeV1ChatCompletionsPath(pathname) {
  const p = String(pathname || '').toLowerCase();
  if (p === '/compute/v1/chat/completions') return '/compute/api/v1/chat/completions';
  if (p === '/compute/v1/chat/completions/') return '/compute/api/v1/chat/completions/';
  return null;
}

function computeApiPathname(pathname) {
  return rewriteComputeV1ChatCompletionsPath(pathname) || String(pathname || '');
}

function withV1Cors(res, origin) {
  const headers = new Headers(res.headers);
  if (!headers.has('Access-Control-Allow-Origin')) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Dasha-Route');
    if (origin !== '*') headers.set('Access-Control-Allow-Credentials', 'true');
    headers.append('Vary', 'Origin');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}


const FACTORY_KEY = 'compute:factory:v0';

function emptyFactoryCounters() {
  return { jobs: { hosted: 0, community: 0, mixture: 0, failed: 0 }, models: {} };
}

function normalizeFactoryCounters(raw) {
  const base = emptyFactoryCounters();
  const jobs = raw?.jobs && typeof raw.jobs === 'object' ? raw.jobs : {};
  for (const key of Object.keys(base.jobs)) {
    const n = Number(jobs[key]);
    base.jobs[key] = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  const models = raw?.models && typeof raw.models === 'object' ? raw.models : {};
  for (const [id, value] of Object.entries(models)) {
    if (!MODELS.has(id)) continue;
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) base.models[id] = Math.floor(n);
  }
  return base;
}


function computeApiRootBody(env) {
  return {
    live: Boolean(env?.AI),
    model: 'gpt-oss-20b',
    login_required: true,
    limit: '3 free / 10 min · then credits',
    session_chat: ORIGIN_REQUIRED_HINT,
    usage: 'v1 chat/completions + Hosted /compute/api/chat SSE + jobs/:id when stored (see /compute/api/v1)',
    guest_keys: '/compute/api/guest-keys',
    guest_key_mint: 'live',
    billing: {
      chat_completions: "Prepaid credits via USDC/$dasha ($0.05/job) for community/mixture; self-route free; key spend cap is runaway protection; no card",
      keys: `Create-time spend cap default $${API_KEY_LIMIT_DEFAULT_CENTS / 100}/month · 402 on exceed · see /caps`,
      // Honesty only — COMPUTE_X402_POC default off; no facilitator / settle this hop.
      x402: x402BillingDocsLine(env),
    },
  };
}

function computeV1Gateway(request, allowedOrigin, credentials) {
  const res = json({
    object: 'gateway',
    service: 'dasha-compute',
    version: '0.3.1',
    auth: 'bearer',
    models: '/compute/api/v1/models',
    chat_completions: '/compute/api/v1/chat/completions',
    network: '/compute/api/v1/network',
    healthz: '/compute/api/healthz',
    errors: 'openai + status/reason/hint/next',
    // OpenRouter apply bar + Hosted UI parity: usage on stream stop + non-stream JSON.
    usage: {
      chat_completions: 'OpenAI-style usage on non-stream JSON and on the SSE final finish_reason=stop chunk',
      hosted_chat: 'POST /compute/api/chat SSE emits usage on the final stop chunk (Hosted UI)',
      jobs: "GET /compute/api/jobs/:id returns stored usage (+ route) when present — never invent",
      reasoning_effort: 'low|medium|high (alias effort). Hosted applies it. Community may ignore — honesty on dasha.',
    },
    billing: {
      chat_completions: "Prepaid credits via USDC/$dasha ($0.05/job) for community/mixture; self-route free; key spend cap is runaway protection; no card",
      // Honesty only — flag off / planned; not an enable switch.
      x402: X402_BILLING_DOCS,
    },
  }, 200, allowedOrigin || '*', credentials);
  return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
}

const V1_PUBLIC = 'https://lobby.getdasha.com/compute/api/v1';

export function presentedApiToken(request) {
  return String(request?.headers?.get?.('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
}

export function invalidApiKeyMessage(request) {
  const token = presentedApiToken(request);
  if (/^ocm_(live|host|enroll)_/i.test(token)) {
    return 'ocm_live_ is an OCM key. Compute wants dsk_ or dgk_.';
  }
  return 'invalid API key';
}

/** AX next-step for agents. OpenAI {error.message,type,code} stays. */
export function openaiErrorAx(message, status = 400, type = 'invalid_request_error') {
  const msg = String(message || '');
  if (/ocm_live_|OCM key/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'wrong_product_key',
      hint: 'OCM key on Compute. Use dsk_/dgk_ here; ocm_live_ only on /compute/ocm/v1.',
      next: [
        { path: '/compute/api/guest-keys' },
        { path: '/compute/ocm/v1' },
        { path: '/compute/skill.md' },
        { command: 'Use ocm_live_ on https://www.getdasha.com/compute/ocm/v1 — never on /compute/api/v1' },
      ],
    };
  }
  if (type === 'authentication_error' || /invalid API key/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'invalid_api_key',
      hint: 'Compute: dsk_ or dgk_ on /compute/api/v1. ocm_live_ is OCM at /compute/ocm/v1.',
      next: [
        { path: '/compute#build' },
        { path: '/compute/llms.txt' },
        { path: '/compute/skill.md' },
        { path: '/compute/api/guest-keys' },
        { path: '/compute/ocm/v1' },
        { command: `curl -sS -H 'Authorization: Bearer $DASHA_KEY' ${V1_PUBLIC}/chat/completions` },
      ],
    };
  }
  if (/top up credits/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'credits_required',
      hint: 'Prepaid $0.05/job. Pay at /compute#pay.',
      next: [
        { path: '/compute#pay' },
        { path: '/compute/api/credits' },
      ],
    };
  }
  if (/key spend limit/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'key_spend_limit',
      hint: 'Raise the key cap at /compute#build.',
      next: [{ path: '/compute#build' }],
    };
  }
  if (/^effort must be/i.test(msg) || /^effort conflict$/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'invalid_effort',
      hint: msg.slice(0, 80),
      next: [
        { path: '/compute/api/v1/chat/completions' },
        { path: '/compute/skill.md' },
      ],
    };
  }
  if (/No Mac is online/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'no_mac_online',
      hint: 'Join a Mac or poll GET /compute/api/network.',
      next: [
        { path: '/compute/api/network' },
        { path: '/compute#provide' },
      ],
    };
  }
  if (/Your Mac is offline/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'self_offline',
      hint: 'Bring your Mac online, or drop route=self.',
      next: [
        { path: '/compute#provide' },
        { path: '/compute/api/network' },
      ],
    };
  }
  if (/finish your current community request first/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'job_in_flight',
      hint: 'Wait. Then GET /compute/api/jobs.',
      next: [{ path: '/compute/api/jobs' }],
    };
  }
  if (/guest key rate limited/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'guest_key_rate_limited',
      hint: 'Wait, then POST chat again. Or mint a new guest key.',
      next: [
        { path: '/compute/api/v1/chat/completions' },
        { path: '/compute/api/guest-keys' },
        { path: '/compute#build' },
      ],
    };
  }
  if (/guest key cannot/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'guest_key_scope',
      hint: 'Guest keys are chat + models only. Sign in at /compute#build for a developer key.',
      next: [
        { path: '/compute/api/v1/chat/completions' },
        { path: '/compute/api/v1/models' },
        { path: '/compute#build' },
      ],
    };
  }
  if (/community limit reached/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'rate_limited',
      hint: 'Wait, then POST /compute/api/v1/chat/completions again.',
      next: [{ path: '/compute/api/v1/chat/completions' }],
    };
  }
  if (/unsupported model/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'unsupported_model',
      hint: 'GET /compute/api/v1/models for live ids.',
      next: [{ path: '/compute/api/v1/models' }],
    };
  }
  if (/send 1–12 user\/assistant messages/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'invalid_messages',
      hint: 'POST 1–12 user/assistant messages.',
      next: [{ path: '/compute/api/v1/chat/completions' }],
    };
  }
  if (/does not exist/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'unknown_model',
      hint: 'GET /compute/api/v1/models for live ids.',
      next: [
        { path: '/compute/api/v1/models' },
        { command: `curl -sS -H 'Authorization: Bearer $DASHA_KEY' ${V1_PUBLIC}/models` },
      ],
    };
  }
  if (/embeddings are not supported|legacy completions are not supported|responses are not supported/i.test(msg)) {
    return {
      status: 'action_required',
      reason: 'use_chat_completions',
      hint: 'POST /compute/api/v1/chat/completions.',
      next: [{ path: '/compute/api/v1/chat/completions' }],
    };
  }
  if (/Only POST is supported/i.test(msg)) {
    const short = /Use POST (\S+)/.exec(msg)?.[1] || '/v1/chat/completions';
    const path = short.startsWith('/compute/') ? short : `/compute/api${short.startsWith('/v1') ? short : `/v1${short}`}`;
    return {
      status: 'action_required',
      reason: 'method_not_allowed',
      hint: 'POST only.',
      next: [{ path }, { command: `Use POST ${path}` }],
    };
  }
  if (/job expired|request timed out|request cancelled|provider failed/i.test(msg)) {
    const reason = /cancelled/i.test(msg) ? 'cancelled' : /timed out/i.test(msg) ? 'timeout' : /expired/i.test(msg) ? 'job_expired' : 'provider_failed';
    return {
      status: 'action_required',
      reason,
      hint: 'POST /compute/api/v1/chat/completions again.',
      next: [{ path: '/compute/api/v1/chat/completions' }],
    };
  }
  if (/provider inference failed/i.test(msg)) {
    return {
      status: 'failed',
      reason: 'provider_failed',
      hint: 'Provider hiccup; retry or pick another live model from /compute/api/v1/models.',
      next: [
        { path: '/compute/api/v1/chat/completions' },
        { path: '/compute/api/v1/models' },
      ],
    };
  }
  return {
    status: status >= 500 ? 'failed' : 'action_required',
    reason: type === 'server_error' ? 'server_error' : 'invalid_request',
    hint: msg.slice(0, 120) || 'Check the request.',
    next: [{ path: '/compute/api/v1/models' }],
  };
}

export function openaiErrorBody(message, status = 400, type = 'invalid_request_error') {
  const ax = openaiErrorAx(message, status, type);
  return {
    error: { message, type, code: null },
    status: ax.status,
    reason: ax.reason,
    hint: ax.hint,
    next: ax.next,
  };
}

function openaiError(message, status = 400, type = 'invalid_request_error', extra = {}) {
  return json(openaiErrorBody(message, status, type), status, null, false, extra);
}

async function body(request, limit = 4096) {
  if (Number(request.headers.get('Content-Length') || 0) > limit) return {};
  const text = await request.text().catch(() => '');
  if (new TextEncoder().encode(text).length > limit) return {};
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

async function sha256(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value))));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function sameSecret(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}


/** Parse create-time spend cap. Explicit null = uncapped; omit/invalid → default $5. */
/** Embeddable status badge (task 23): aggregate providers_online only, no provider/account data. */
export function computeBadgeSvg(online) {
  const n = Math.max(0, Number.isFinite(Number(online)) ? Math.floor(Number(online)) : 0);
  const label = n === 1 ? '1 Mac online' : `${n} Macs online`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="64" viewBox="0 0 360 64" role="img" aria-label="Dasha Compute - ${label}"><rect width="360" height="64" fill="#070608"/><rect x="2" y="2" width="356" height="60" fill="none" stroke="#dfff00" stroke-width="4"/><text x="16" y="26" fill="#dfff00" font-family="Arial Black,Arial,Helvetica,sans-serif" font-size="17" font-weight="900">DASHA COMPUTE</text><text x="16" y="49" fill="#f4eddb" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700">${label}</text></svg>`;
}

export function parseApiKeyLimitCents(raw) {
  if (raw === null) return null;
  if (raw === undefined) return API_KEY_LIMIT_DEFAULT_CENTS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < API_KEY_LIMIT_MIN_CENTS || n > API_KEY_LIMIT_MAX_CENTS) return API_KEY_LIMIT_DEFAULT_CENTS;
  return n;
}

export function parseApiKeyLimitReset(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return API_KEY_LIMIT_RESETS.has(value) ? value : 'monthly';
}

export function apiKeySpendWindowMs(limitReset) {
  return API_KEY_LIMIT_RESET_MS[limitReset] || 0;
}

/** Zero spend when the reset window has elapsed. Mutates a shallow copy. */
export function refreshApiKeySpendWindow(key, now = Date.now()) {
  const row = { ...key };
  const reset = parseApiKeyLimitReset(row.limitReset ?? row.limit_reset ?? 'monthly');
  row.limitReset = reset;
  if (row.limitCents === undefined && row.limit_cents !== undefined) row.limitCents = row.limit_cents;
  if (row.limitCents !== null && row.limitCents !== undefined) {
    const n = Number(row.limitCents);
    row.limitCents = Number.isInteger(n) ? n : API_KEY_LIMIT_DEFAULT_CENTS;
  } else if (row.limitCents === undefined) {
    row.limitCents = API_KEY_LIMIT_DEFAULT_CENTS;
  }
  let spend = Math.max(0, Math.floor(Number(row.spendCents) || 0));
  let windowStart = Number(row.spendWindowStart) || Number(row.createdAt) || now;
  const windowMs = apiKeySpendWindowMs(reset);
  if (reset !== 'none' && windowMs > 0 && now - windowStart >= windowMs) {
    spend = 0;
    windowStart = now;
  }
  row.spendCents = spend;
  row.spendWindowStart = windowStart;
  return row;
}

export function apiKeyPublicView(key, now = Date.now()) {
  const row = refreshApiKeySpendWindow(key, now);
  const limit = row.limitCents == null ? null : Math.max(0, Math.floor(Number(row.limitCents) || 0));
  const spend = Math.max(0, Math.floor(Number(row.spendCents) || 0));
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    created_at: row.createdAt,
    last_used_at: row.lastUsedAt || null,
    limit_cents: limit,
    limit_remaining_cents: limit == null ? null : Math.max(0, limit - spend),
    limit_reset: row.limitReset || 'monthly',
    spend_cents: spend,
  };
}

export function identity(session) {
  if (session?.provider === 'x') return `x:${session.xId}`;
  if (session?.provider === 'wallet') return `wallet:${session.wallet}`;
  if (session?.provider === 'grok' && session.displayName) return `grok:${String(session.displayName).toLowerCase()}`;
  if (session?.provider === 'email' && session.email) return `email:${session.email}`;
  return '';
}

function takeRate(rates, key, max, windowMs = 60_000) {
  const now = Date.now(), recent = (rates.get(key) || []).filter(at => now - at < windowMs);
  if (recent.length >= max) return false;
  recent.push(now); rates.set(key, recent); return true;
}

export function modelIdentitySystemContent(model) {
  const id = String(model || '').trim();
  if (!id) return '';
  return `You are model ${id} on Dasha Compute. If asked your name/model, answer with exactly that id.`;
}

export function withModelIdentityHint(messages, model) {
  const tip = modelIdentitySystemContent(model);
  if (!tip || !Array.isArray(messages) || !messages.length) return messages;
  const already = messages.some((m) => {
    if (m?.role !== 'system' || typeof m.content !== 'string') return false;
    if (m.content === tip) return true;
    return m.content.includes('on Dasha Compute') && m.content.includes('answer with exactly that id');
  });
  if (already) return messages;
  return [{ role: 'system', content: tip }, ...messages];
}

function chatMessages(input) {
  const rows = Array.isArray(input?.messages) ? input.messages : typeof input?.prompt === 'string' ? [{ role: 'user', content: input.prompt }] : [];
  if (!rows.length || rows.length > 12) return null;
  let total = 0;
  const messages = [];
  for (const row of rows) {
    const role = String(row?.role || ''), content = typeof row?.content === 'string' ? row.content.trim() : '';
    if (!['system', 'user', 'assistant'].includes(role) || !content || content.length > 2000 || (total += content.length) > 6000) return null;
    messages.push({ role, content });
  }
  return messages.at(-1)?.role === 'user' ? messages : null;
}

function providerHardware(input, allowedModels) {
  const source = input?.hardware;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const clean = {};
  for (const key of ['system', 'machine', 'release', 'python']) if (typeof source[key] === 'string' && source[key].trim()) clean[key] = source[key].trim().slice(0, 64);
  const memory = Number(source.memory_gb);
  if (Number.isFinite(memory) && memory > 0 && memory <= 2048) clean.memory_gb = Math.round(memory * 10) / 10;
  const measuredAt = Number(source.benchmarked_at);
  if (Number.isFinite(measuredAt) && measuredAt > 0) clean.benchmarked_at = Math.floor(measuredAt);
  clean.benchmarks = (Array.isArray(source.benchmarks) ? source.benchmarks : []).slice(0, 12).flatMap(row => {
    const model = String(row?.model || ''), tokensPerSecond = Number(row?.tokens_per_second);
    return allowedModels.includes(model) && Number.isFinite(tokensPerSecond) && tokensPerSecond > 0 && tokensPerSecond <= 10_000 ? [{ model, tokens_per_second: Math.round(tokensPerSecond * 100) / 100 }] : [];
  });
  return clean;
}

function tokenUsage(input) {
  const source = input?.usage && typeof input.usage === 'object' ? input.usage : {};
  return Object.fromEntries(['prompt_tokens', 'completion_tokens', 'total_tokens'].map(name => [name, Math.max(0, Math.min(10_000_000, Math.floor(Number(source[name]) || 0)))]));
}

export function normalizeStreamProviderError(raw) {
  const msg = String(raw || '').trim().slice(0, 300);
  if (!msg) return '';
  if (/^provider inference failed:/i.test(msg) || /^provider cut$/i.test(msg) || /^empty completion$/i.test(msg)) return msg;
  if (/URLError|urllib\.error|stream ended before completion|Connection reset|Connection refused|IncompleteRead|RemoteDisconnected/i.test(msg)) {
    return `provider inference failed: ${msg.slice(0, 240)}`;
  }
  if (/provider inference failed/i.test(msg)) return msg;
  return msg;
}

export function isProviderStreamCutError(msg) {
  return /provider inference failed|provider cut|empty completion|stream ended before completion|URLError/i.test(String(msg || ''));
}

/** Fail-closed public settle face. Omit when cents/state unknown. Never invent. */
export function publicJobSettle(job) {
  const cents = Math.max(0, Math.floor(Number(job?.settle_cents) || 0));
  const state = String(job?.settle_state || '').trim();
  if (!(cents > 0) || !state) return null;
  return { cents, state };
}

export function measuredTokPerSecForModel(providers, model, now = Date.now()) {
  const id = String(model || '').trim();
  if (!id || !Array.isArray(providers)) return null;
  const serving = providers.filter((provider) => providerServesModel(provider, id, now));
  const measured = serving.map((provider) => provider.hardware?.benchmarks?.find((row) => row.model === id)?.tokens_per_second).filter(Number.isFinite);
  if (!measured.length) return null;
  const tps = measured.reduce((sum, value) => sum + value, 0) / measured.length;
  if (!(tps > 0) || tps > 10_000) return null;
  return Math.round(tps * 100) / 100;
}

export function publicPhase0Receipt(job, { tokensPerSecond = null } = {}) {
  if (!job?.id) return null;
  const status = String(job.status || '');
  if (status !== 'complete' && status !== 'failed') return null;
  const route = String(job.route || '').trim();
  let provider_class = null;
  if (route === 'community' || route === 'mixture' || route === 'self') provider_class = route;
  else if (String(job.engine || '') === 'hosted') provider_class = 'hosted';
  const model_id = String(job.model || '').trim() || null;
  const completedMs = Number(job.completedAt);
  const completed_at = Number.isFinite(completedMs) && completedMs > 0 ? new Date(completedMs).toISOString() : null;
  const receipt = {
    job_id: String(job.id),
    attestation: null
  };
  if (model_id) receipt.model_id = model_id;
  if (job.request_id) receipt.request_id = String(job.request_id).slice(0, 80);
  if (provider_class) receipt.provider_class = provider_class;
  if (completed_at) receipt.completed_at = completed_at;
  const tps = Number(tokensPerSecond);
  if (Number.isFinite(tps) && tps > 0 && tps <= 10_000) {
    receipt.tokens_per_second = Math.round(tps * 100) / 100;
  }
  const settle = status === 'complete' ? publicJobSettle(job) : null;
  if (settle) receipt.settled = settle;
  if (status === 'failed') receipt.ok = false;
  return attachEffortToReceipt(attachReceiptHonesty(receipt, job), effortHonestyFromJob(job));
}

async function cancelJob(storage, key, job, now = Date.now()) {
  if (job.status === 'leased') await storage.put(key, { ...job, status: 'cancelled', messages: null, chunks: null, answer: null, error: null, expiresAt: now + LEASE_MS });
  else await storage.delete(key);
}

function nightStepPrompt(task) {
  const step = Number(task.stepIndex || 0), prior = String(task.artifacts?.[0]?.content || '').slice(-3000);
  if (task.template === 'research' && step === 1) return `Challenge the findings below. Identify unsupported claims, missing evidence, and stronger alternatives.\n\n${prior}`;
  if (task.template === 'research' && step === 2) return `Synthesize a final decision-ready report from the original assignment and reviewed findings.\n\nOriginal assignment:\n${task.prompt}\n\nReviewed findings:\n${prior}`;
  if (task.template === 'review' && step === 1) return `Turn this critical review into a prioritized action plan with concrete acceptance checks.\n\n${prior}`;
  return task.prompt;
}


function providerServesModel(provider, model, now) {
  return now - Number(provider.lastSeenAt || 0) < FRESH_MS && Array.isArray(provider.models) && provider.models.includes(model);
}

/** Buyer SSE drop while a Mac is still advertising: keep queued/leased so the client can resume the same job. */
export function keepBuyerJobOnStreamDrop(job, providers = [], now = Date.now()) {
  if (!job || !['queued', 'leased'].includes(String(job.status || ''))) return false;
  const model = String(job.model || '');
  if (!model) return false;
  return (Array.isArray(providers) ? providers : []).some((provider) => providerServesModel(provider, model, now));
}

/** Resolve community-path route: self | community | mixture (+ prefer_self Darkbloom-style). */
export function resolveJobRoute(owner, input = {}, providers = [], now = Date.now()) {
  const model = String(input.model || '');
  const raw = String(input.route || '').trim().toLowerCase();
  const preferSelf = input.prefer_self === true || input.preferSelf === true;
  let route = raw === 'mixture' ? 'mixture' : raw === 'self' ? 'self' : 'community';
  const ownedOnline = providers.filter(provider => provider.owner === owner && providerServesModel(provider, model, now));
  const anyOnline = providers.some(provider => providerServesModel(provider, model, now));
  if (preferSelf && route !== 'self') {
    route = ownedOnline.length ? 'self' : route;
  }
  return { route, ownedOnline, anyOnline, preferSelf };
}

function mergeRouteFromHeaders(input, request) {
  const next = input && typeof input === 'object' ? { ...input } : {};
  const hdr = String(request?.headers?.get?.('X-Dasha-Route') || request?.headers?.get?.('x-dasha-route') || '').trim().toLowerCase();
  if (!hdr) return next;
  if (hdr === 'prefer') {
    if (next.prefer_self !== true && next.preferSelf !== true) next.prefer_self = true;
    return next;
  }
  if ((hdr === 'self' || hdr === 'community' || hdr === 'mixture') && !next.route) next.route = hdr;
  return next;
}


export class ComputeNetwork {
  constructor(state, env) { this.state = state; this.env = env; this.rates = new Map(); }

  async prune(now = Date.now()) {
    for (const [key, job] of await this.state.storage.list({ prefix: 'compute:job:' })) {
      if (!job || Number(job.expiresAt) <= now) {
        await this.state.storage.delete(key);
        if (job?.nightId && ['queued', 'leased'].includes(job.status)) await this.finishNight(job, 'failed', null, 'job expired before completion', now);
      }
      else if (job.status === 'leased' && Number(job.leaseExpiresAt) <= now) {
        const hadStreamProgress = job.stream === true && (job.chunks || []).some(chunk => String(chunk || '').trim());
        if (hadStreamProgress) {
          await this.state.storage.put(key, { ...job, chunks: [], status: 'failed', error: 'provider cut', usage: null, messages: null, completedAt: now, providerId: null, leaseExpiresAt: null, expiresAt: now + 10 * 60_000 });
          await this.finishNight(job, 'failed', null, 'provider cut', now);
          await this.recordFactoryOutcome({ engine: job.route === 'mixture' ? 'mixture' : 'community', model: job.model, failed: true });
        } else {
          await this.state.storage.put(key, { ...job, status: 'queued', providerId: null, leaseExpiresAt: null, ...(job.stream ? { chunks: [] } : {}) });
        }
      }
    }
    for (const [key, provider] of await this.state.storage.list({ prefix: 'compute:provider:' })) {
      if (!provider || (now - Number(provider.createdAt || 0) > 30 * 24 * 60 * 60_000 && !provider.lastSeenAt)) await this.state.storage.delete(key);
    }
    await this.runNightTasks(now);
  }

  async runNightTasks(now) {
    const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
    const jobs = [...(await this.state.storage.list({ prefix: 'compute:job:' })).values()];
    const activeOwners = new Set(jobs.filter(job => ['queued', 'leased'].includes(job.status)).map(job => job.owner));
    const tasks = [...(await this.state.storage.list({ prefix: 'compute:night:' })).values()].sort((a, b) => a.nextRunAt - b.nextRunAt);
    for (const task of tasks) {
      if (task.status !== 'scheduled' || Number(task.nextRunAt) > now || activeOwners.has(task.owner) || !providers.some(provider => provider.models?.includes(task.model))) continue;
      const nightMessages = [{ role: 'system', content: NIGHT_TEMPLATES[task.template] }, { role: 'user', content: nightStepPrompt(task) }];
      const turns = countConversationTurns(nightMessages);
      const job = { id: `job_${randomUrlToken(9)}`, nightId: task.id, nightStep: Number(task.stepIndex || 0), owner: task.owner, model: task.model, route: 'community', messages: nightMessages, maxTokens: 2048, temperature: 0.4, stream: false, status: 'queued', providerId: null, createdAt: now, expiresAt: now + NIGHT_JOB_TTL_MS, ...(turns ? { turns } : {}) };
      await this.state.storage.put(`compute:job:${job.id}`, job);
      await this.state.storage.put(`compute:night:${task.id}`, { ...task, status: 'running', lastJobId: job.id, lastRunAt: now });
      activeOwners.add(task.owner);
    }
  }

  async finishNight(job, status, answer, error, now) {
    if (!job.nightId) return;
    const key = `compute:night:${job.nightId}`, task = await this.state.storage.get(key);
    if (!task) return;
    const artifact = { id: job.id, step: Number(job.nightStep || 0) + 1, status, model: job.model, provider: job.providerId || null, content: answer || null, error: error || null, created_at: job.createdAt, completed_at: now };
    let nextRunAt = null;
    const nextStep = Number(task.stepIndex || 0) + 1, hasNextStep = status === 'complete' && nextStep < NIGHT_STEP_COUNTS[task.template];
    if (!hasNextStep && NIGHT_INTERVALS[task.repeat]) {
      nextRunAt = Number(task.nextRunAt) + NIGHT_INTERVALS[task.repeat];
      while (nextRunAt <= now) nextRunAt += NIGHT_INTERVALS[task.repeat];
    }
    await this.state.storage.put(key, { ...task, status: hasNextStep ? (task.approvalRequired ? 'awaiting_approval' : 'scheduled') : nextRunAt ? 'scheduled' : status, stepIndex: hasNextStep ? nextStep : 0, nextRunAt: hasNextStep && !task.approvalRequired ? now : nextRunAt, lastJobId: job.id, lastCompletedAt: now, artifacts: [artifact, ...(task.artifacts || [])].slice(0, 5) });
  }

  /** Referral: fetch-or-mint the account's code (collision-safe via stored mapping). */
  async referralEnsureCode(owner, now = Date.now()) {
    const key = `compute:referral-code:${owner}`;
    const existing = await this.state.storage.get(key);
    if (existing) return existing;
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = await referralCodeFor(owner, attempt ? `:${attempt}` : '');
      const mapKey = `compute:referral-owner:${code}`;
      const mapped = await this.state.storage.get(mapKey);
      if (mapped && mapped !== owner) continue;
      await this.state.storage.put(key, code);
      await this.state.storage.put(mapKey, owner);
      return code;
    }
    return null;
  }

  /** One referral per account; 10 attributions/code/day trips review (skipped, metric bump). */
  async referralAttribute(owner, rawCode, now = Date.now()) {
    const who = String(owner || '').trim();
    const code = normalizeRefCode(rawCode);
    if (!who || !code) return { ok: false, error: 'bad code' };
    if (await this.state.storage.get(`compute:referral:${who}`)) return { ok: false, error: 'already attributed' };
    const referrer = await this.state.storage.get(`compute:referral-owner:${code}`);
    if (!referrer || referrer === who) return { ok: false, error: 'unknown or self' };
    const vKey = `compute:refvel:${code}:${refDayKey(now)}`;
    const vel = Number(await this.state.storage.get(vKey)) || 0;
    if (vel >= REF_VELOCITY_PER_DAY) {
      await this.bumpMetric('referral:velocity-review');
      return { ok: false, error: 'velocity review' };
    }
    await this.state.storage.put(vKey, vel + 1);
    await this.state.storage.put(`compute:referral:${who}`, { code, referrer, at: now, milestones: [] });
    const cKey = `compute:referral-count:${referrer}`;
    await this.state.storage.put(cKey, (Number(await this.state.storage.get(cKey)) || 0) + 1);
    await this.bumpMetric('referral:attributed');
    return { ok: true, referrer };
  }

  /** Grant referral credits. Recipient-side month cap $50; wallet-uniqueness guard vs the other party. */
  async referralGrant(recipient, cents, reason, now = Date.now(), { otherParty = null } = {}) {
    const who = String(recipient || '').trim();
    if (!who) return { ok: false, error: 'no recipient' };
    if (otherParty) {
      const [a, b] = await Promise.all([
        this.state.storage.get(`compute:provider-payout-pref:${who}`),
        this.state.storage.get(`compute:provider-payout-pref:${otherParty}`),
      ]);
      if (a?.wallet && b?.wallet && String(a.wallet) === String(b.wallet)) {
        await this.bumpMetric('referral:self-wallet-skip');
        return { ok: false, error: 'same payout wallet' };
      }
    }
    const mKey = `compute:refgrant:${who}:${refMonthKey(now)}`;
    const used = Math.max(0, Math.floor(Number((await this.state.storage.get(mKey))?.cents) || 0));
    if (used + cents > REF_MONTH_CAP_CENTS) {
      await this.bumpMetric('referral:cap-skip');
      return { ok: false, error: 'month cap' };
    }
    const balKey = `compute:credit-balance:${who}`;
    const bal = Math.max(0, Math.floor(Number((await this.state.storage.get(balKey))?.cents) || 0));
    await this.state.storage.put(balKey, { owner: who, cents: bal + cents, updatedAt: now });
    await this.state.storage.put(mKey, { cents: used + cents, updatedAt: now });
    await this.state.storage.put(`compute:credit-ledger:${who}:${now}:ref-${randomUrlToken(6)}`, {
      owner: who, cents, reason: `referral:${reason}`, balance_cents: bal + cents, at: now,
    });
    await this.bumpMetric(`referral:grant:${reason}`);
    return { ok: true };
  }

  /** Idempotent milestone marker + grants. grants: [{to:'referrer'|'referee', cents}] */
  async referralMilestone(referee, name, grants, now = Date.now()) {
    const who = String(referee || '').trim();
    const rKey = `compute:referral:${who}`;
    const row = await this.state.storage.get(rKey);
    if (!row || (row.milestones || []).includes(name)) return { ok: false, error: 'none or done' };
    await this.state.storage.put(rKey, { ...row, milestones: [...(row.milestones || []), name] });
    for (const g of grants || []) {
      const target = g.to === 'referee' ? who : row.referrer;
      await this.referralGrant(target, g.cents, name, now, { otherParty: g.to === 'referee' ? row.referrer : who });
    }
    return { ok: true };
  }

  /** M2: referee's providers reached 50 served jobs in total. */
  async referralCheckM2(owner, now = Date.now()) {
    const row = await this.state.storage.get(`compute:referral:${String(owner || '')}`);
    if (!row || (row.milestones || []).includes('m2')) return;
    const provs = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(v => v && v.owner === owner);
    let jobs = 0;
    for (const prov of provs) jobs += Number((await this.state.storage.get(`compute:provider-earn:${prov.id}`))?.jobs) || 0;
    if (jobs >= REF_M2_JOBS) {
      await this.referralMilestone(owner, 'm2', [
        { to: 'referrer', cents: REF_M2_REFERRER_CENTS },
        { to: 'referee', cents: REF_M2_REFEREE_CENTS },
      ], now);
    }
  }

  /** Buyer side: first top-up >= $5 settles -> both sides +$5. */
  async referralCheckBuyer(owner, topupCents, now = Date.now()) {
    if (Math.floor(Number(topupCents) || 0) < REF_BUYER_MIN_TOPUP_CENTS) return;
    await this.referralMilestone(owner, 'buyer', [
      { to: 'referrer', cents: REF_BUYER_CENTS },
      { to: 'referee', cents: REF_BUYER_CENTS },
    ], now);
  }

  async provider(request, input) {
    const providerId = String(input?.provider_id || '').trim();
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(providerId)) return null;
    const provider = await this.state.storage.get(`compute:provider:${providerId}`);
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    return provider && sameSecret(await sha256(token), provider.tokenHash) ? provider : null;
  }


  async loadFactoryCounters() {
    return normalizeFactoryCounters(await this.state.storage.get(FACTORY_KEY));
  }

  async recordFactoryOutcome({ engine, model, failed = false } = {}) {
    const counters = await this.loadFactoryCounters();
    const eng = engine === 'hosted' || engine === 'mixture' || engine === 'community' ? engine : 'community';
    if (failed) counters.jobs.failed += 1;
    else counters.jobs[eng] += 1;
    const mid = String(model || '');
    if (MODELS.has(mid)) counters.models[mid] = (counters.models[mid] || 0) + 1;
    counters.updated_at = Date.now();
    await this.state.storage.put(FACTORY_KEY, counters);
    return counters;
  }

  /** Paid-inference settle only (credits or community earn). Replay-safe.
   *  When the heads signing key is configured, every fresh settle also joins the
   *  signed receipt chain and gets covered by a fresh head. Signing failure never
   *  breaks the settle - the receipt stays unsigned (honest degradation). */
  async recordPaidInferenceSettle(input = {}) {
    const res = await recordSettledInference(this.state.storage, input);
    if (res.ok && !res.replay) {
      try {
        const key = await headsSigningKey(this.env);
        if (key) {
          const row = await appendChainedReceipt(this.state.storage, key, res.receipt);
          await appendHead(this.state.storage, await makeHead(key, row.hash, await headsTip(this.state.storage)));
        }
      } catch (e) { /* unsigned settle is better than a failed settle */ }
    }
    return res;
  }
  async factoryPayload(now = Date.now()) {
    await this.prune(now);
    const counters = await this.loadFactoryCounters();
    const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
    const settled = publicSettled24h(await sumSettled24h(this.state.storage, now));
    return {
      schema: 'factory.compute.v0',
      generated_at: new Date(now).toISOString(),
      jobs: counters.jobs,
      models: counters.models,
      providers_online_latest: providers.length,
      settled_24h: settled,
      note: 'counters only; prompts not included; settled_24h = paid-inference only',
    };
  }

  async apiKey(request) {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const guest = parseGuestApiToken(token);
    if (guest) {
      const key = await this.state.storage.get(`compute:api-key:${guest.id}`);
      if (!key || !isGuestApiKey(key) || !sameSecret(await sha256(token), key.tokenHash)) return null;
      if (guestKeyExpired(key)) return null;
      const now = Date.now();
      const refreshed = { ...key, lastUsedAt: now };
      await this.state.storage.put(`compute:api-key:${refreshed.id}`, refreshed);
      return refreshed;
    }
    const match = token.match(/^dsk_([A-Za-z0-9_-]{12})\.([A-Za-z0-9_-]{20,})$/);
    if (!match) return null;
    const key = await this.state.storage.get(`compute:api-key:key_${match[1]}`);
    if (!key || !sameSecret(await sha256(token), key.tokenHash)) return null;
    const now = Date.now();
    const refreshed = refreshApiKeySpendWindow(key, now);
    refreshed.lastUsedAt = now;
    await this.state.storage.put(`compute:api-key:${refreshed.id}`, refreshed);
    return refreshed;
  }

  /** Hard dollar cap for developer keys. checkOnly skips write. */
  async chargeApiKeySpend(key, cents, now = Date.now(), { checkOnly = false } = {}) {
    const charge = Math.max(0, Math.floor(Number(cents) || 0));
    if (!key?.id || charge <= 0) return { ok: false, error: 'bad spend', status: 400 };
    let row = refreshApiKeySpendWindow(key, now);
    const limit = row.limitCents;
    if (limit != null) {
      const cap = Math.max(0, Math.floor(Number(limit) || 0));
      if (row.spendCents + charge > cap) {
        return { ok: false, error: 'key spend limit reached', status: 402, key: row, limit_cents: cap, spend_cents: row.spendCents };
      }
    }
    if (checkOnly) return { ok: true, key: row, charged_cents: 0 };
    row = { ...row, spendCents: row.spendCents + charge, lastUsedAt: row.lastUsedAt || now };
    await this.state.storage.put(`compute:api-key:${row.id}`, row);
    return { ok: true, key: row, charged_cents: charge };
  }


  async queueJob(owner, input, now) {
    const parsedEffort = parseReasoningEffort(input);
    if (!parsedEffort.ok) return { error: parsedEffort.error, status: 400 };
    const model = String(input.model || '');
    let messages = chatMessages(input);
    if (!messages) return { error: 'send 1–12 user/assistant messages, max 2,000 characters each and 6,000 total', status: 400 };
    if (!MODELS.has(model)) return { error: 'unsupported model', status: 400 };
    messages = withModelIdentityHint(messages, model);
    if (!takeRate(this.rates, owner, 5)) return { error: 'community limit reached; try again shortly', status: 429 };
    await this.prune(now);
    const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()];
    const { route, ownedOnline, anyOnline } = resolveJobRoute(owner, input, providers, now);
    if (route === 'self') {
      if (!ownedOnline.length) return { error: 'Your Mac is offline.', status: 503 };
    } else if (!anyOnline) {
      return { error: 'No Mac is online.', status: 503 };
    }
    if ([...(await this.state.storage.list({ prefix: 'compute:job:' })).values()].some(job => job.owner === owner && ['queued', 'leased'].includes(job.status))) return { error: 'finish your current community request first', status: 409 };
    const requestedTemperature = Number(input.temperature);
    const stream = input.stream === true;
    const turns = countConversationTurns(messages);
    const job = { id: `job_${randomUrlToken(9)}`, owner, model, route, messages, maxTokens: Math.max(1, Math.min(4096, Number(input.max_tokens) || 512)), temperature: Number.isFinite(requestedTemperature) ? Math.max(0, Math.min(2, requestedTemperature)) : 0.6, stream, ...(stream ? { chunks: [] } : {}), status: 'queued', providerId: null, createdAt: now, expiresAt: now + JOB_TTL_MS, ...(input.request_id != null && String(input.request_id).trim() ? { request_id: String(input.request_id).trim().slice(0, 80) } : {}), ...(parsedEffort.effort ? { effort: parsedEffort.effort } : {}), ...(turns ? { turns } : {}) };
    await this.state.storage.put(`compute:job:${job.id}`, job);
    return { job };
  }

  streamResponse(job, origin = null, extra = {}, opts = {}) {
    const encoder = new TextEncoder(), storage = this.state.storage, key = `compute:job:${job.id}`;
    const holdMs = Number.isFinite(Number(opts.holdMs)) ? Math.max(0, Number(opts.holdMs)) : SSE_BUYER_HOLD_MS;
    const keepaliveMs = Number.isFinite(Number(opts.keepaliveMs)) ? Math.max(0, Number(opts.keepaliveMs)) : SSE_KEEPALIVE_MS;
    let stopped = false;
    const listProviders = async () => {
      try { return [...(await storage.list({ prefix: 'compute:provider:' })).values()]; } catch { return []; }
    };
    return new Response(new ReadableStream({ async start(controller) {
      let sent = 0;
      const started = Date.now();
      let lastPing = 0;
      const emit = value => controller.enqueue(encoder.encode(`data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`));
      const ping = () => controller.enqueue(encoder.encode(`: keepalive\n\n`));
      // First byte immediately — silent queued SSE was dying ~30–45s (browser Failed to fetch / CF idle).
      ping();
      lastPing = Date.now();
      while (!stopped) {
        const current = await storage.get(key);
        if (stopped) return;
        if (!current) { emit({ error: { message: 'job expired', type: 'server_error', code: null } }); emit('[DONE]'); controller.close(); return; }
        if (Number(current.expiresAt) <= Date.now()) break;
        for (const delta of (current.chunks || []).slice(sent)) emit({ id: `chatcmpl_${job.id.slice(4)}`, object: 'chat.completion.chunk', created: Math.floor(job.createdAt / 1000), model: job.model, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] });
        sent = (current.chunks || []).length;
        if (current.status === 'complete') {
          const settle = publicJobSettle(current);
          const receipt = publicPhase0Receipt(current);
          emit({ id: `chatcmpl_${job.id.slice(4)}`, object: 'chat.completion.chunk', created: Math.floor(job.createdAt / 1000), model: job.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: current.usage || tokenUsage({}), ...(settle ? { settle } : {}), ...(receipt ? { receipt } : {}), ...dashaEffortExtension(effortHonestyFromJob(current)) });
          emit('[DONE]');
          controller.close();
          return;
        }
        if (current.status === 'failed' || current.status === 'cancelled') {
          const errMsg = current.error || (current.status === 'cancelled' ? 'job cancelled' : 'provider failed');
          emit({ error: { message: errMsg, type: 'server_error', code: isProviderStreamCutError(errMsg) ? 'provider_cut' : null } });
          emit('[DONE]');
          controller.close();
          return;
        }
        if (sent > 0 && current.status === 'queued') {
          emit({ error: { message: 'provider cut', type: 'server_error', code: 'provider_cut' } });
          emit('[DONE]');
          controller.close();
          return;
        }
        // No first token by ~35s and Mac still fresh: close SSE, keep job, client resumes same id.
        if (sent === 0 && Date.now() - started >= holdMs && keepBuyerJobOnStreamDrop(current, await listProviders(), Date.now())) {
          emit({ resume: true, id: current.id, status: current.status });
          controller.close();
          return;
        }
        if (keepaliveMs > 0 && Date.now() - lastPing >= keepaliveMs) {
          ping();
          lastPing = Date.now();
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (stopped) return;
      emit({ error: { message: 'request timed out', type: 'server_error', code: null } });
      emit('[DONE]');
      controller.close();
    }, async cancel() {
      stopped = true;
      const current = await storage.get(key);
      if (!current) return;
      if (keepBuyerJobOnStreamDrop(current, await listProviders(), Date.now())) return;
      await cancelJob(storage, key, current);
    } }), { headers: { ...SECURITY, ...cors(origin, Boolean(origin)), 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', ...extra } });
  }

  /** Aggregate counter bump. Name-constrained, counter only, no payloads. */
  async bumpMetric(name) {
    if (!METRIC_STEP_RE.test(name)) return;
    const key = `compute:metric:${metricDay()}:${name}`;
    const current = Number(await this.state.storage.get(key)) || 0;
    await this.state.storage.put(key, current + 1);
  }

  async fetch(request, allowedOrigin) {
    const path = computeApiPathname(new URL(request.url).pathname), now = Date.now(), credentials = Boolean(allowedOrigin);
    if (isComputeGuestKeyPath(path)) {
      const guestProbe = computeGuestKeyResponse(request);
      if (guestProbe) return guestProbe;
      return handleGuestKeyWrite(request, { storage: this.state.storage, rates: this.rates });
    }
    if ((path === '/compute/api' || path === '/compute/api/' || path === '/compute/api/status' || path === '/compute/api/status/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const res = json(computeApiRootBody(this.env), 200, allowedOrigin || '*', credentials);
      return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
    }
    if (isComputeApiHealthzPath(path) && (request.method === 'GET' || request.method === 'HEAD')) {
      return maybeHead(request, json({ ok: true, service: 'dasha-compute', version: '0.3.1', midstream_fail_honesty: true }, 200, allowedOrigin || '*', credentials));
    }
    if ((path === '/compute/api/night' || path === '/compute/api/night/') && (request.method === 'GET' || request.method === 'HEAD' || request.method === 'POST')) {
      if (!allowedOrigin) return maybeHead(request, originRequired());
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, true));
      if (request.method === 'GET' || request.method === 'HEAD') {
        await this.prune(now);
        const tasks = [...(await this.state.storage.list({ prefix: 'compute:night:' })).values()].filter(task => task.owner === owner).sort((a, b) => b.createdAt - a.createdAt);
        return maybeHead(request, json({ tasks }, 200, allowedOrigin, true));
      }
      const existing = [...(await this.state.storage.list({ prefix: 'compute:night:' })).values()].filter(task => task.owner === owner);
      if (existing.length >= 20) return json({ error: 'Night Shift task limit reached' }, 409, allowedOrigin, true);
      const input = await body(request, 12 * 1024), title = String(input.title || '').trim().slice(0, 80), prompt = String(input.prompt || '').trim(), model = String(input.model || ''), template = String(input.template || 'custom'), repeat = String(input.repeat || 'none'), requestedAt = Number(input.run_at), nextRunAt = Number.isFinite(requestedAt) ? Math.max(now, requestedAt) : now;
      if (!title || !prompt || prompt.length > 6000) return json({ error: 'title and prompt are required; prompt maximum is 6000 characters' }, 400, allowedOrigin, true);
      if (!MODELS.has(model) || !NIGHT_TEMPLATES[template] || !['none', ...Object.keys(NIGHT_INTERVALS)].includes(repeat)) return json({ error: 'unsupported model, template, or repeat schedule' }, 400, allowedOrigin, true);
      await this.prune(now);
      // Schedule even with 0 Macs — runNightTasks fires when a matching provider comes online.
      const task = { id: `night_${randomUrlToken(9)}`, owner, title, prompt, model, template, repeat, approvalRequired: input.approval_required === true, stepIndex: 0, steps: NIGHT_STEP_COUNTS[template], status: 'scheduled', nextRunAt, lastRunAt: null, lastCompletedAt: null, lastJobId: null, artifacts: [], createdAt: now };
      await this.state.storage.put(`compute:night:${task.id}`, task);
      await this.runNightTasks(now);
      return json({ task: await this.state.storage.get(`compute:night:${task.id}`) }, 201, allowedOrigin, true);
    }

    if ((path === '/compute/api/night/summary' || path === '/compute/api/night/summary/') && (request.method === 'GET' || request.method === 'HEAD')) {
      if (!allowedOrigin) return maybeHead(request, originRequired());
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, true));
      const tasks = [...(await this.state.storage.list({ prefix: 'compute:night:' })).values()].filter(task => task.owner === owner);
      const artifacts = tasks.flatMap(task => (task.artifacts || []).map(artifact => ({ task_id: task.id, title: task.title, ...artifact }))).sort((a, b) => b.completed_at - a.completed_at).slice(0, 20);
      return maybeHead(request, json({ generated_at: now, artifacts }, 200, allowedOrigin, true));
    }

    const nightRunMatch = path.match(/^\/compute\/api\/night\/(night_[A-Za-z0-9_-]{12})\/run$/);
    if (nightRunMatch && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request)), key = `compute:night:${nightRunMatch[1]}`, task = await this.state.storage.get(key);
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!task || task.owner !== owner) return json({ error: 'Night Shift task not found' }, 404, allowedOrigin, true);
      if (task.status === 'running' || task.status === 'awaiting_approval') return json({ error: 'task is already running or awaiting approval' }, 409, allowedOrigin, true);
      await this.prune(now);
      const runProviders = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()];
      if (!runProviders.some(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS && provider.models?.includes(task.model))) return json({ error: 'No Mac is online.' }, 503, allowedOrigin, true);
      await this.state.storage.put(key, { ...task, status: 'scheduled', stepIndex: 0, nextRunAt: now });
      await this.runNightTasks(now);
      return json({ task: await this.state.storage.get(key) }, 202, allowedOrigin, true);
    }

    const nightApproveMatch = path.match(/^\/compute\/api\/night\/(night_[A-Za-z0-9_-]{12})\/approve$/);
    if (nightApproveMatch && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request)), key = `compute:night:${nightApproveMatch[1]}`, task = await this.state.storage.get(key);
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!task || task.owner !== owner) return json({ error: 'Night Shift task not found' }, 404, allowedOrigin, true);
      if (task.status !== 'awaiting_approval') return json({ error: 'task is not awaiting approval' }, 409, allowedOrigin, true);
      await this.prune(now);
      const approveProviders = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()];
      if (!approveProviders.some(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS && provider.models?.includes(task.model))) return json({ error: 'No Mac is online.' }, 503, allowedOrigin, true);
      await this.state.storage.put(key, { ...task, status: 'scheduled', nextRunAt: now });
      await this.runNightTasks(now);
      return json({ task: await this.state.storage.get(key) }, 202, allowedOrigin, true);
    }

    const nightMatch = path.match(/^\/compute\/api\/night\/(night_[A-Za-z0-9_-]{12})$/);
    if (nightMatch && request.method === 'DELETE') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request)), key = `compute:night:${nightMatch[1]}`, task = await this.state.storage.get(key);
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!task || task.owner !== owner) return json({ error: 'Night Shift task not found' }, 404, allowedOrigin, true);
      if (task.lastJobId) {
        const jobKey = `compute:job:${task.lastJobId}`, job = await this.state.storage.get(jobKey);
        if (job?.status === 'leased') await this.state.storage.put(jobKey, { ...job, status: 'cancelled', messages: null, chunks: null, expiresAt: now + LEASE_MS });
        else if (job) await this.state.storage.delete(jobKey);
      }
      await this.state.storage.delete(key);
      return json({ ok: true, prompt_deleted: true }, 200, allowedOrigin, true);
    }

    if ((path === '/compute/api/keys' || path === '/compute/api/keys/') && (request.method === 'GET' || request.method === 'HEAD' || request.method === 'POST')) {
      if (!allowedOrigin) return maybeHead(request, originRequired());
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, true));
      const keys = [...(await this.state.storage.list({ prefix: 'compute:api-key:' })).values()].filter(key => key.owner === owner);
      if (request.method === 'GET' || request.method === 'HEAD') {
        return maybeHead(request, json({ keys: keys.map(key => apiKeyPublicView(key, now)) }, 200, allowedOrigin, true));
      }
      if (keys.length >= 10) return json({ error: 'API key limit reached' }, 409, allowedOrigin, true);
      const input = await body(request), slug = randomUrlToken(9), id = `key_${slug}`, token = `dsk_${slug}.${randomUrlToken(24)}`, name = String(input.name || '').trim().slice(0, 64) || 'Developer key';
      const limitCents = Object.prototype.hasOwnProperty.call(input, 'limit_cents') ? parseApiKeyLimitCents(input.limit_cents) : API_KEY_LIMIT_DEFAULT_CENTS;
      const limitReset = parseApiKeyLimitReset(input.limit_reset);
      const record = {
        id, owner, name, prefix: token.slice(0, 12), tokenHash: await sha256(token), createdAt: now, lastUsedAt: 0,
        limitCents, limitReset, spendCents: 0, spendWindowStart: now,
      };
      await this.state.storage.put(`compute:api-key:${id}`, record);
      await this.bumpMetric('key:create');
      return json({
        id, name, api_key: token,
        limit_cents: limitCents, limit_reset: limitReset, spend_cents: 0,
        limit_remaining_cents: limitCents == null ? null : limitCents,
        note: 'Copy this key now. Dasha stores only its hash. Non-self chat spends prepaid credits; cap limits runaway.',
      }, 201, allowedOrigin, true);
    }

    const keyMatch = path.match(/^\/compute\/api\/keys\/(key_[A-Za-z0-9_-]{12})$/);
    if (keyMatch && request.method === 'DELETE') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request)), key = await this.state.storage.get(`compute:api-key:${keyMatch[1]}`);
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!key || key.owner !== owner) return json({ error: 'API key not found' }, 404, allowedOrigin, true);
      await this.state.storage.delete(`compute:api-key:${key.id}`);
      return json({ ok: true }, 200, allowedOrigin, true);
    }

    // v1 gateway: every response (errors + successes + stream) carries ACAO (OpenAI convention).
    const v1Origin = allowedOrigin || '*';
    const v1cors = (res) => withV1Cors(res, v1Origin);
    const v1err = (message, status = 400, type = 'invalid_request_error', extra = {}) => v1cors(openaiError(message, status, type, extra));
    if ((path === '/compute/api/v1/models' || path === '/compute/api/v1/models/') && (request.method === 'GET' || request.method === 'HEAD')) {
      // Soft-guest list: same advertised ids as public GET /compute/api/network.
      await this.prune(now);
      const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
      const models = [...new Set(providers.flatMap(provider => provider.models || []))];
      return maybeHead(request, v1cors(json({ object: 'list', data: models.map(id => ({ id, object: 'model', created: 0, owned_by: 'dasha-community' })) })));
    }

    const modelRetrieve = path.match(/^\/compute\/api\/v1\/models\/([A-Za-z0-9._-]+)\/?$/);
    if (modelRetrieve && (request.method === 'GET' || request.method === 'HEAD')) {
      const modelKey = await this.apiKey(request);
      if (!modelKey) return maybeHead(request, v1err(invalidApiKeyMessage(request), 401, 'authentication_error'));
      if (!guestKeyAllows(modelKey, 'models')) return maybeHead(request, v1err('guest key cannot use this endpoint', 403, 'invalid_request_error'));
      await this.prune(now);
      const id = modelRetrieve[1];
      const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
      const models = [...new Set(providers.flatMap(provider => provider.models || []))];
      if (!models.includes(id)) return maybeHead(request, v1err(`The model '${id}' does not exist`, 404, 'invalid_request_error'));
      return maybeHead(request, v1cors(json({ id, object: 'model', created: 0, owned_by: 'dasha-community' })));
    }

    if ((path === '/compute/api/v1/embeddings' || path === '/compute/api/v1/embeddings/') && request.method === 'POST') {
      const embedKey = await this.apiKey(request);
      if (!embedKey) return v1err(invalidApiKeyMessage(request), 401, 'authentication_error');
      if (!guestKeyAllows(embedKey, 'embeddings')) return v1err('guest key cannot use this endpoint', 403, 'invalid_request_error');
      return v1err('embeddings are not supported; use POST /v1/chat/completions', 400, 'invalid_request_error');
    }

    if ((path === '/compute/api/v1/embeddings' || path === '/compute/api/v1/embeddings/') && request.method !== 'OPTIONS') {
      if (!await this.apiKey(request)) return maybeHead(request, v1err(invalidApiKeyMessage(request), 401, 'authentication_error'));
      return maybeHead(request, v1err('Only POST is supported. Use POST /v1/embeddings', 405, 'invalid_request_error'));
    }

    if ((path === '/compute/api/v1/completions' || path === '/compute/api/v1/completions/') && request.method === 'POST') {
      const completionKey = await this.apiKey(request);
      if (!completionKey) return v1err(invalidApiKeyMessage(request), 401, 'authentication_error');
      if (!guestKeyAllows(completionKey, 'completions')) return v1err('guest key cannot use this endpoint', 403, 'invalid_request_error');
      return v1err('legacy completions are not supported; use POST /v1/chat/completions', 400, 'invalid_request_error');
    }

    if ((path === '/compute/api/v1/completions' || path === '/compute/api/v1/completions/') && request.method !== 'OPTIONS') {
      if (!await this.apiKey(request)) return maybeHead(request, v1err(invalidApiKeyMessage(request), 401, 'authentication_error'));
      return maybeHead(request, v1err('Only POST is supported. Use POST /v1/completions', 405, 'invalid_request_error'));
    }

    if ((path === '/compute/api/v1/responses' || path === '/compute/api/v1/responses/') && request.method === 'POST') {
      const responseKey = await this.apiKey(request);
      if (!responseKey) return v1err(invalidApiKeyMessage(request), 401, 'authentication_error');
      if (!guestKeyAllows(responseKey, 'responses')) return v1err('guest key cannot use this endpoint', 403, 'invalid_request_error');
      return v1err('responses are not supported; use POST /v1/chat/completions', 400, 'invalid_request_error');
    }

    if ((path === '/compute/api/v1/responses' || path === '/compute/api/v1/responses/') && request.method !== 'OPTIONS') {
      if (!await this.apiKey(request)) return maybeHead(request, v1err(invalidApiKeyMessage(request), 401, 'authentication_error'));
      return maybeHead(request, v1err('Only POST is supported. Use POST /v1/responses', 405, 'invalid_request_error'));
    }

    if ((path === '/compute/api/v1/chat/completions' || path === '/compute/api/v1/chat/completions/') && request.method === 'POST') {
      const key = await this.apiKey(request);
      if (!key) return v1err(invalidApiKeyMessage(request), 401, 'authentication_error');
      if (!guestKeyAllows(key, 'chat')) return v1err('guest key cannot use this endpoint', 403, 'invalid_request_error');
      if (isGuestApiKey(key) && !takeGuestRate(this.rates, `guest-chat:${key.id}`, GUEST_KEY_CHAT_MAX, GUEST_KEY_CHAT_WINDOW_MS)) {
        return v1err('guest key rate limited; try again shortly', 429, 'invalid_request_error');
      }
      // v1: prepaid HOSTED_ASK_PRICE_CENTS per non-self API chat (community/mixture). Self-route free. Key limit_cents is runaway-only.
      // Guest keys skip prepaid debit — tight mint + chat rate is the floor.
      const guest = isGuestApiKey(key);
      const input = mergeRouteFromHeaders(await body(request, 12 * 1024), request);
      await this.prune(now);
      const providersPeek = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()];
      const peek = resolveJobRoute(key.owner, input, providersPeek, now);
      // Community Mac cost is unknown — route+model only. Never invent USD from tokens or the $0.05 credit gate.
      const chatSpend = (jobLike) => dashaChatSpendHeaders({
        route: jobLike?.route || peek.route,
        model: jobLike?.model || input.model,
      });
      if (peek.route !== 'self' && !guest) {
        const gate = await this.chargeApiKeySpend(key, HOSTED_ASK_PRICE_CENTS, now, { checkOnly: true });
        if (!gate.ok) return v1err(gate.error || 'key spend limit reached', gate.status || 402, 'invalid_request_error', chatSpend());
        const balPeek = Math.max(0, Math.floor(Number((await this.state.storage.get(`compute:credit-balance:${key.owner}`))?.cents) || 0));
        if (balPeek < HOSTED_ASK_PRICE_CENTS) {
          return v1err('top up credits', 402, 'invalid_request_error', chatSpend());
        }
      }
      const queued = await this.queueJob(key.owner, input, now);
      if (queued.error) return v1err(queued.error, queued.status, queued.status >= 500 ? 'server_error' : 'invalid_request_error', chatSpend());
      if (queued.job.route !== 'self' && !guest) {
        const debit = await this.debitCredits(key.owner, {
          cents: HOSTED_ASK_PRICE_CENTS,
          reason: 'api-chat',
          requestId: `api:${queued.job.id}`,
          now,
        });
        if (!debit.ok) {
          await this.state.storage.delete(`compute:job:${queued.job.id}`);
          return v1err(debit.error || 'top up credits', 402, 'invalid_request_error', chatSpend(queued.job));
        }
        const spend = await this.chargeApiKeySpend(key, HOSTED_ASK_PRICE_CENTS, now);
        if (!spend.ok) {
          await this.state.storage.delete(`compute:job:${queued.job.id}`);
          return v1err(spend.error || 'key spend limit reached', spend.status || 402, 'invalid_request_error', chatSpend(queued.job));
        }
      }
      if (input.stream) {
        const honesty = effortHonestyFromJob(queued.job);
        return v1cors(this.streamResponse(queued.job, null, { ...effortResponseHeaders(honesty), ...chatSpend(queued.job) }));
      }
      while (!request.signal.aborted) {
        const job = await this.state.storage.get(`compute:job:${queued.job.id}`);
        if (!job) return v1err('job expired', 410, 'server_error', chatSpend(queued.job));
        if (Number(job.expiresAt) <= Date.now()) break;
        if (job.status === 'complete') {
          const honesty = effortHonestyFromJob(job);
          const receipt = publicPhase0Receipt(job);
          return v1cors(json({
            id: `chatcmpl_${job.id.slice(4)}`,
            job_id: job.id,
            ...(job.request_id ? { request_id: job.request_id } : {}),
            object: 'chat.completion',
            created: Math.floor(job.createdAt / 1000),
            model: job.model,
            choices: [{ index: 0, message: { role: 'assistant', content: job.answer }, finish_reason: 'stop' }],
            usage: job.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            ...(receipt ? { receipt } : {}),
            ...dashaEffortExtension(honesty),
          }, 200, null, false, { ...effortResponseHeaders(honesty), ...chatSpend(job) }));
        }
        if (job.status === 'failed') return v1err(job.error || 'provider failed', 502, 'server_error', chatSpend(job));
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      await this.state.storage.delete(`compute:job:${queued.job.id}`);
      return v1err(request.signal.aborted ? 'request cancelled' : 'request timed out', request.signal.aborted ? 499 : 504, 'server_error', chatSpend(queued.job));
    }

    if ((path === '/compute/api/v1/chat/completions' || path === '/compute/api/v1/chat/completions/') && request.method !== 'OPTIONS') {
      if (!await this.apiKey(request)) return v1err(invalidApiKeyMessage(request), 401, 'authentication_error');
      return v1err('Only POST is supported. Use POST /v1/chat/completions', 405, 'invalid_request_error');
    }


    if ((path === '/compute/api/factory' || path === '/compute/api/factory/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return maybeHead(request, json(await this.factoryPayload(now), 200, allowedOrigin || '*', credentials));
    }
    if ((path === '/compute/api/factory' || path === '/compute/api/factory/') && request.method === 'POST') {
      // Internal hosted bump from computeApi via DO stub. Low-sensitivity counters; rate-limited.
      const input = await body(request);
      if (String(input?.source || '') !== 'hosted-chat') return json({ error: 'not found' }, 404, allowedOrigin, credentials);
      if (!takeRate(this.rates, 'factory:hosted-bump', 120, 60_000)) return json({ error: 'rate limited' }, 429, allowedOrigin, credentials);
      const failed = input.failed === true;
      await this.recordFactoryOutcome({ engine: 'hosted', model: 'gpt-oss-20b', failed });
      const settle = input?.settled && typeof input.settled === 'object' ? input.settled : null;
      if (!failed && settle && settle.paid === true) {
        await this.recordPaidInferenceSettle({
          owner: settle.owner || null,
          engine: 'hosted',
          usage: settle.usage || null,
          tokens: settle.tokens,
          cents: settle.cents != null ? settle.cents : HOSTED_ASK_PRICE_CENTS,
          model: 'gpt-oss-20b',
          requestId: settle.request_id || null,
          replayKey: settle.replay_key || (settle.request_id ? `hosted:${settle.request_id}` : null),
          now: Date.now()
        });
      }
      await this.bumpMetric('ask:hosted:complete');
      return json({ ok: true }, 202, allowedOrigin, credentials);
    }

    // Funnel telemetry (task 22): client beacon intake. anon_id is a client-local UUID used ONLY
    // for rate limiting - never stored. No emails, prompts, or fingerprints accepted.
    if (path === '/compute/api/event' || path === '/compute/api/event/') {
      if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin || '*', credentials));
      let body = {};
      try { body = await request.json(); } catch { body = {}; }
      const eventName = String(body && body.name || '');
      const step = String(body && body.step || '');
      const anon = String(body && body.anon_id || '');
      if (!METRIC_CLIENT_EVENTS.has(eventName) || !METRIC_STEP_RE.test(step)) return json({ error: 'unknown event' }, 400, allowedOrigin || '*', credentials);
      if (!METRIC_ANON_RE.test(anon)) return json({ error: 'anon_id required' }, 400, allowedOrigin || '*', credentials);
      if (!takeRate(this.rates, `event:${anon}`, 60)) return json({ error: 'rate limited' }, 429, allowedOrigin || '*', credentials);
      await this.bumpMetric(`${eventName}:${step}`);
      return json({ ok: true }, 202, allowedOrigin || '*', credentials);
    }

    // Public daily rollup (doubles as a transparency asset): counts per step per day + hourly providers_online.
    if ((path === '/compute/api/metrics' || path === '/compute/api/metrics/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const entries = [...(await this.state.storage.list({ prefix: 'compute:metric:' })).entries()];
      const days = {};
      const providersHourly = {};
      for (const [key, value] of entries) {
        const rest = key.slice('compute:metric:'.length);
        if (rest.startsWith('providers:')) { providersHourly[rest.slice('providers:'.length)] = Number(value) || 0; continue; }
        const day = rest.slice(0, 10), name = rest.slice(11);
        if (!day || !name) continue;
        (days[day] ||= {})[name] = Number(value) || 0;
      }
      return maybeHead(request, json({ days, providers_online_hourly: providersHourly }, 200, allowedOrigin || '*', false, { 'Cache-Control': 'public, max-age=60' }));
    }

    // Embeddable status badge: public SVG of providers_online, 60s cache. Aggregate count only.
    if (path === '/compute/badge.svg' && (request.method === 'GET' || request.method === 'HEAD')) {
      await this.prune(now);
      const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
      return maybeHead(request, new Response(computeBadgeSvg(providers.length), {
        status: 200,
        headers: {
          ...SECURITY,
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Access-Control-Allow-Origin': '*',
          'X-Robots-Tag': 'noindex',
          'X-Dasha-Edge': 'compute-badge',
        },
      }));
    }

    if ((path === '/compute/api/network' || path === '/compute/api/network/' || path === '/compute/api/v1/network' || path === '/compute/api/v1/network/') && (request.method === 'GET' || request.method === 'HEAD')) {
      await this.prune(now);
      const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
      const jobs = [...(await this.state.storage.list({ prefix: 'compute:job:' })).values()];
      const models = [...new Set(providers.flatMap(provider => provider.models || []))];
      const capacity = models.map(model => {
        const serving = providers.filter(provider => provider.models?.includes(model)), measured = serving.map(provider => provider.hardware?.benchmarks?.find(row => row.model === model)?.tokens_per_second).filter(Number.isFinite);
        const tps = measured.length ? measured.reduce((sum, value) => sum + value, 0) / measured.length : 0;
        return { model, providers: serving.length, measured_providers: measured.length, tokens_per_second: Math.round(tps * 100) / 100 };
      });
      const hourKey = `compute:metric:providers:${metricHour(now)}`;
      if ((await this.state.storage.get(hourKey)) === undefined) await this.state.storage.put(hourKey, providers.length);
      const kit_versions = {};
      for (const provider of providers) { const v = String(provider.kitVersion || 'pre-0.3.1'); kit_versions[v] = (kit_versions[v] || 0) + 1; }
      return maybeHead(request, json({ providers_online: providers.length, models_available: models, capacity, kit_versions, jobs_queued: jobs.filter(job => job.status === 'queued').length, card_available: stripeConfigured(this.env) }, 200, allowedOrigin || '*', credentials));
    }

    if ((path === '/compute/api/providers' || path === '/compute/api/providers/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, credentials));
      const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => provider.owner === owner).map(provider => ({ id: provider.id, name: provider.name, models: provider.models || [], allowed_models: provider.allowedModels || provider.models || [], hardware: provider.hardware || null, kit_version: provider.kitVersion || null, created_at: provider.createdAt, last_seen_at: provider.lastSeenAt || null, online: now - Number(provider.lastSeenAt || 0) < FRESH_MS }));
      return maybeHead(request, json({ providers }, 200, allowedOrigin, credentials));
    }

    if (path === '/compute/api/providers/register' || path === '/compute/api/providers/register/') {
      if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, credentials));
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!takeRate(this.rates, `register:${owner}`, 3)) return json({ error: 'provider registration rate limited' }, 429, allowedOrigin, true);
      const input = await body(request), models = [...new Set((Array.isArray(input.models) ? input.models : []).map(String).filter(model => MODELS.has(model)))];
      if (!models.length) return json({ error: 'choose at least one supported model' }, 400, allowedOrigin, true);
      const providerId = `mac_${randomUrlToken(9)}`, token = `dcp_${randomUrlToken(24)}`, name = String(input.name || '').trim().slice(0, 64) || 'My Mac';
      await this.state.storage.put(`compute:provider:${providerId}`, { id: providerId, owner, name, allowedModels: models, models: [], tokenHash: await sha256(token), createdAt: now, lastSeenAt: 0 });
      const referral = input.ref ? await this.referralAttribute(owner, input.ref, now) : null;
      await this.bumpMetric('provider:register');
      return json({ provider_id: providerId, provider_token: token, coordinator_url: 'https://lobby.getdasha.com/compute/api', models, note: 'Copy this token now. Dasha stores only its hash.', ...(referral?.ok ? { referral: 'attributed' } : {}) }, 201, allowedOrigin, true);
    }

    const providerMatch = path.match(/^\/compute\/api\/providers\/([A-Za-z0-9_-]{6,64})$/);
    if (providerMatch && request.method === 'DELETE') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request)), key = `compute:provider:${providerMatch[1]}`, provider = await this.state.storage.get(key);
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!provider || provider.owner !== owner) return json({ error: 'provider not found' }, 404, allowedOrigin, true);
      await this.state.storage.delete(key);
      for (const [jobKey, job] of await this.state.storage.list({ prefix: 'compute:job:' })) if (job.providerId === provider.id && job.status === 'leased') await this.state.storage.put(jobKey, { ...job, status: 'queued', providerId: null, leaseExpiresAt: null, ...(job.stream ? { chunks: [] } : {}) });
      return json({ ok: true }, 200, allowedOrigin, true);
    }

    if (path === '/compute/api/providers/verify' || path === '/compute/api/providers/verify/') {
      if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, credentials));
      const provider = await this.provider(request, await body(request));
      return provider ? json({ ok: true, provider_id: provider.id, name: provider.name, models: provider.allowedModels || provider.models || [] }) : json({ error: 'invalid provider token' }, 401);
    }

    if (path === '/compute/api/providers/heartbeat' || path === '/compute/api/providers/heartbeat/') {
      if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, credentials));
      const provider = await this.provider(request, await body(request));
      return provider ? json({ ok: true, provider_id: provider.id, name: provider.name, models: provider.allowedModels || provider.models || [] }) : json({ error: 'invalid provider token' }, 401);
    }

    if (path === '/compute/api/providers/poll' || path === '/compute/api/providers/poll/') {
      if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, credentials));
      const input = await body(request), provider = await this.provider(request, input);
      if (!provider) return json({ error: 'invalid provider token' }, 401);
      const firstOnline = !Number(provider.lastSeenAt || 0);
      provider.lastSeenAt = now;
      const kitVersion = String(input.version || '').trim().slice(0, 32);
      if (kitVersion) provider.kitVersion = kitVersion;
      provider.allowedModels = growAllowedModels(
        provider.allowedModels || provider.models || [],
        Array.isArray(input.models) ? input.models : [],
      );
      if (Array.isArray(input.models)) provider.models = [...new Set(input.models.map(String).filter(model => provider.allowedModels.includes(model)))];
      else provider.models ||= [];
      const hardware = providerHardware(input, provider.allowedModels);
      if (hardware) provider.hardware = hardware;
      provider.name = String(input.name || '').trim().slice(0, 64) || provider.name;
      await this.state.storage.put(`compute:provider:${provider.id}`, provider);
      if (firstOnline) await this.referralMilestone(provider.owner, 'm1', [{ to: 'referrer', cents: REF_M1_CENTS }], now);
      await this.prune(now);
      const jobs = [...(await this.state.storage.list({ prefix: 'compute:job:' })).values()].sort((a, b) => a.createdAt - b.createdAt);
      const job = jobs.find(candidate => candidate.status === 'queued' && provider.models.includes(candidate.model) && (candidate.route !== 'self' || provider.owner === candidate.owner));
      if (!job) return new Response(null, { status: 204, headers: SECURITY });
      job.status = 'leased'; job.providerId = provider.id; job.leasedAt = now; job.leaseExpiresAt = now + LEASE_MS; job.expiresAt = now + LEASE_MS + 60_000;
      await this.state.storage.put(`compute:job:${job.id}`, job);
      return json({ job: { id: job.id, model: job.model, messages: job.messages, max_tokens: job.maxTokens, temperature: job.temperature, stream: job.stream === true }, lease_seconds: LEASE_MS / 1000 });
    }

    const heartbeatMatch = path.match(/^\/compute\/api\/providers\/jobs\/([A-Za-z0-9_-]{6,64})\/heartbeat\/?$/);
    if (heartbeatMatch) {
      if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, credentials));
      const input = await body(request), provider = await this.provider(request, input), key = `compute:job:${heartbeatMatch[1]}`, job = await this.state.storage.get(key);
      if (!provider) return json({ error: 'invalid provider token' }, 401);
      if (!job || job.providerId !== provider.id) return json({ error: 'job unavailable' }, 409);
      if (job.status === 'cancelled') return json({ ok: true, cancelled: true });
      if (job.status !== 'leased' || Number(job.leaseExpiresAt) <= now) return json({ error: 'job unavailable or lease expired' }, 409);
      provider.lastSeenAt = now;
      await this.state.storage.put(`compute:provider:${provider.id}`, provider);
      await this.state.storage.put(key, { ...job, leaseExpiresAt: now + LEASE_MS, expiresAt: now + LEASE_MS + 60_000 });
      return json({ ok: true, cancelled: false, lease_seconds: LEASE_MS / 1000 });
    }

    const resultMatch = path.match(/^\/compute\/api\/providers\/jobs\/([A-Za-z0-9_-]{6,64})\/result$/);
    if (resultMatch && request.method === 'POST') {
      const input = await body(request, 24 * 1024), provider = await this.provider(request, input), key = `compute:job:${resultMatch[1]}`, job = await this.state.storage.get(key);
      if (!provider) return json({ error: 'invalid provider token' }, 401);
      if (!job || job.status !== 'leased' || job.providerId !== provider.id || Number(job.leaseExpiresAt) <= now) return json({ error: 'job unavailable or lease expired' }, 409);
      if (job.stream) return json({ error: 'stream jobs must use the chunk endpoint' }, 409);
      const answer = String(input.content || '').trim(), error = String(input.error || '').trim().slice(0, 300);
      if (!error && (!answer || answer.length > 20_000)) return json({ error: 'result must be 1–20000 characters' }, 400);
      provider.lastSeenAt = now; await this.state.storage.put(`compute:provider:${provider.id}`, provider);
      const usage = tokenUsage(input);
      let settlePatch = {};
      if (!error && job.route !== 'self') {
        const accrued = await accrueProviderEarn(this.state.storage, { providerId: provider.id, jobId: job.id, usage, now });
        if (accrued?.ok) {
          const settleCents = Math.max(0, Math.floor(Number(accrued.usdc_cents) || 0));
          if (settleCents > 0) settlePatch = { settle_cents: settleCents, settle_state: 'pending_operator' };
          await this.recordPaidInferenceSettle({
            owner: job.owner || null,
            engine: job.route === 'mixture' ? 'mixture' : 'community',
            usage,
            cents: settleCents,
            jobId: job.id,
            requestId: job.request_id || null,
            model: job.model,
            latencyMs: job.leasedAt ? now - job.leasedAt : null,
            ...honestLoopFields(job),
            replayKey: `job:${job.id}`,
            now,
          });
          await this.referralCheckM2(job.owner, now);
        }
      }
      await this.state.storage.put(key, { ...job, status: error ? 'failed' : 'complete', answer: error ? null : answer, error: error || null, usage, messages: null, completedAt: now, expiresAt: now + 10 * 60_000, ...settlePatch });
      await this.finishNight(job, error ? 'failed' : 'complete', error ? null : answer, error || null, now);
      await this.recordFactoryOutcome({ engine: job.route === 'mixture' ? 'mixture' : 'community', model: job.model, failed: Boolean(error) });
      return json({ accepted: true }, 202);
    }

    const chunkMatch = path.match(/^\/compute\/api\/providers\/jobs\/([A-Za-z0-9_-]{6,64})\/chunk$/);
    if (chunkMatch && request.method === 'POST') {
      const input = await body(request, 8192), provider = await this.provider(request, input), key = `compute:job:${chunkMatch[1]}`, job = await this.state.storage.get(key);
      if (!provider) return json({ error: 'invalid provider token' }, 401);
      if (!job || job.status !== 'leased' || !job.stream || job.providerId !== provider.id || Number(job.leaseExpiresAt) <= now) return json({ error: 'job unavailable or lease expired' }, 409);
      const delta = String(input.delta || '');
      if (delta && ((job.chunks || []).join('').length + delta.length > 20_000)) return json({ error: 'stream result exceeds 20000 characters' }, 400);
      provider.lastSeenAt = now;
      await this.state.storage.put(`compute:provider:${provider.id}`, provider);
      const rawError = String(input.error || '').trim().slice(0, 300);
      const chunks = !rawError && delta ? [...(job.chunks || []), delta] : job.chunks || [];
      let streamError = normalizeStreamProviderError(rawError);
      if (!streamError && input.done && !String(chunks.join('') || '').trim()) {
        streamError = 'empty completion';
      }
      if (!streamError && rawError) streamError = rawError.slice(0, 300);
      const usage = input.done ? tokenUsage(input) : job.usage;
      let settlePatch = {};
      if (!streamError && input.done && job.route !== 'self') {
        const accrued = await accrueProviderEarn(this.state.storage, { providerId: provider.id, jobId: job.id, usage, now });
        if (accrued?.ok) {
          const settleCents = Math.max(0, Math.floor(Number(accrued.usdc_cents) || 0));
          if (settleCents > 0) settlePatch = { settle_cents: settleCents, settle_state: 'pending_operator' };
          await this.recordPaidInferenceSettle({
            owner: job.owner || null,
            engine: job.route === 'mixture' ? 'mixture' : 'community',
            usage,
            cents: settleCents,
            jobId: job.id,
            requestId: job.request_id || null,
            model: job.model,
            latencyMs: job.leasedAt ? now - job.leasedAt : null,
            ...honestLoopFields(job),
            replayKey: `job:${job.id}`,
            now,
          });
          await this.referralCheckM2(job.owner, now);
        }
      }
      const failed = Boolean(streamError);
      const finished = failed || Boolean(input.done);
      await this.state.storage.put(key, { ...job, chunks: failed ? [] : chunks, status: failed ? 'failed' : input.done ? 'complete' : 'leased', error: streamError || null, usage: failed ? null : usage, messages: finished ? null : job.messages, completedAt: finished ? now : null, leaseExpiresAt: now + LEASE_MS, expiresAt: finished ? now + 10 * 60_000 : now + LEASE_MS + 60_000, ...settlePatch });
      if (finished) {
        await this.finishNight(job, failed ? 'failed' : 'complete', failed ? null : chunks.join(''), streamError || null, now);
        await this.recordFactoryOutcome({ engine: job.route === 'mixture' ? 'mixture' : 'community', model: job.model, failed });
      }
      return json({ accepted: true }, 202);
    }

    if ((path === '/compute/api/jobs' || path === '/compute/api/jobs/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, credentials));
      await this.prune(now);
      const jobs = [...(await this.state.storage.list({ prefix: 'compute:job:' })).values()]
        .filter(job => job.owner === owner && job.status !== 'cancelled' && Number(job.expiresAt) > now)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(job => ({
          id: job.id,
          status: job.status,
          model: job.model,
          expires_at: job.expiresAt,
        }));
      return maybeHead(request, json({ jobs }, 200, allowedOrigin, credentials));
    }

    if ((path === '/compute/api/jobs' || path === '/compute/api/jobs/') && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      const queued = await this.queueJob(owner, mergeRouteFromHeaders(await body(request, 12 * 1024), request), now);
      if (queued.error) return json({ error: queued.error }, queued.status, allowedOrigin, true);
      const job = queued.job;
      const honesty = effortHonestyFromJob(job);
      const effortHeaders = effortResponseHeaders(honesty);
      if (job.stream === true) {
        const expose = ['X-Dasha-Job', ...Object.keys(effortHeaders)].join(', ');
        return this.streamResponse(job, allowedOrigin, { 'X-Dasha-Job': job.id, ...effortHeaders, 'Access-Control-Expose-Headers': expose });
      }
      return json({ id: job.id, status: job.status, expires_at: job.expiresAt, ...dashaEffortExtension(honesty) }, 202, allowedOrigin, true, effortHeaders);
    }

    const jobMatch = path.match(/^\/compute\/api\/jobs\/([A-Za-z0-9_-]{6,64})\/?$/);
    if (jobMatch && (request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE')) {
      const owner = identity(await authSessionFromRequest(this.env, request)), key = `compute:job:${jobMatch[1]}`, job = await this.state.storage.get(key);
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, credentials));
      if (!job || job.owner !== owner) return maybeHead(request, json({ error: 'job not found' }, 404, allowedOrigin, credentials));
      if (request.method === 'DELETE') {
        if (!allowedOrigin) return originRequired();
        await cancelJob(this.state.storage, key, job, now);
        return json({ ok: true, prompt_deleted: true }, 200, allowedOrigin, true);
      }
      if (job.status === 'cancelled') return maybeHead(request, json({ error: 'job not found' }, 404, allowedOrigin, credentials));
      if (Number(job.expiresAt) <= now) { await this.state.storage.delete(key); return maybeHead(request, json({ error: 'job expired' }, 410, allowedOrigin, credentials)); }
      const queued = job.status === 'queued' ? [...(await this.state.storage.list({ prefix: 'compute:job:' })).values()].filter(candidate => candidate.status === 'queued' && candidate.model === job.model).sort((a, b) => a.createdAt - b.createdAt) : [];
      const queuePosition = queued.findIndex(candidate => candidate.id === job.id) + 1;
      const usage = job.usage && typeof job.usage === 'object' ? {
        prompt_tokens: Math.max(0, Math.floor(Number(job.usage.prompt_tokens) || 0)),
        completion_tokens: Math.max(0, Math.floor(Number(job.usage.completion_tokens) || 0)),
        total_tokens: Math.max(0, Math.floor(Number(job.usage.total_tokens) || 0)),
      } : null;
      const route = ['community', 'mixture', 'self'].includes(String(job.route || '')) ? String(job.route) : null;
      // jobs/:id settle only on complete — never invent pending/failed money.
      const settle = job.status === 'complete' ? publicJobSettle(job) : null;
      const freshProviders = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()];
      const measuredTps = measuredTokPerSecForModel(freshProviders, job.model, now);
      const receipt = publicPhase0Receipt(job, { tokensPerSecond: measuredTps });
      const honesty = effortHonestyFromJob(job);
      const loop = honestLoopFields(job);
      return maybeHead(request, json({
        id: job.id,
        status: job.status,
        model: job.model,
        answer: job.status === 'failed' ? null : (job.chunks || []).join('') || job.answer || null,
        error: job.error || null,
        provider: job.providerId || null,
        queue_position: queuePosition || null,
        expires_at: job.expiresAt,
        ...(usage && (usage.total_tokens > 0 || usage.prompt_tokens > 0 || usage.completion_tokens > 0) ? { usage } : {}),
        ...(route ? { route } : {}),
        ...(settle ? { settle } : {}),
        ...loop,
        ...(receipt ? { receipt } : {}),
        ...dashaEffortExtension(honesty),
      }, 200, allowedOrigin, credentials, effortResponseHeaders(honesty)));
    }

    if ((path === '/compute/api/sponsors' || path === '/compute/api/sponsors/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const pledges = [...(await this.state.storage.list({ prefix: 'compute:sponsor:' })).values()];
      const tipRows = [...(await this.state.storage.list({ prefix: 'compute:sponsor-pledge:' })).values()];
      return maybeHead(request, json(sponsorBoard(pledges, tipRows), 200, allowedOrigin || '*', credentials));
    }
    if ((path === '/compute/api/sponsors' || path === '/compute/api/sponsors/') && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const session = await authSessionFromRequest(this.env, request);
      const actor = sponsorActor(session);
      if (!actor) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!takeRate(this.rates, `sponsor:${actor.owner}`, 3)) return json({ error: 'sponsor rate limited' }, 429, allowedOrigin, true);
      const input = await body(request);
      const machine = COMPUTE_SPONSOR_MACHINES.find(row => row.id === String(input.machine || ''));
      if (!machine) return json({ error: 'pick a Mac' }, 400, allowedOrigin, true);
      const name = String(input.name || '').trim().slice(0, 40) || actor.fallback;
      if (name.length < 2) return json({ error: 'name the Mac' }, 400, allowedOrigin, true);
      const key = `compute:sponsor:${machine.id}`;
      const existing = await this.state.storage.get(key);
      if (existing) return json({ error: 'that Mac is already named' }, 409, allowedOrigin, true);
      await this.state.storage.put(key, { machine: machine.id, owner: actor.owner, name, handle: actor.handle, url: publicSponsorUrl(input.url), status: 'named', createdAt: now });
      const next = [...(await this.state.storage.list({ prefix: 'compute:sponsor:' })).values()];
      const tipRows = [...(await this.state.storage.list({ prefix: 'compute:sponsor-pledge:' })).values()];
      return json(sponsorBoard(next, tipRows), 201, allowedOrigin, true);
    }

    // --- Sponsor tip orders (Solana Pay; reuses credit lock/verify helpers; face cents) ---
    if ((path === '/compute/api/sponsors/orders' || path === '/compute/api/sponsors/orders/') && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const session = await authSessionFromRequest(this.env, request);
      const actor = sponsorActor(session);
      const ip = (request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown').slice(0, 64);
      const rateOwner = actor ? actor.owner : `ip:${ip || 'unknown'}`;
      if (!takeRate(this.rates, `sponsor-order:${rateOwner}`, 8)) return json({ error: 'rate limited' }, 429, allowedOrigin, true);
      const input = await body(request);
      const method = String(input.method || '').toLowerCase();
      const cents = tipCentsFromInput({ pack: input.pack, cents: input.cents });
      if (cents == null) return json({ error: 'pick an amount' }, 400, allowedOrigin, true);
      if (method !== 'usdc' && method !== 'dasha') return json({ error: 'pick usdc or dasha' }, 400, allowedOrigin, true);
      let machineId = 'network';
      const wantMachine = String(input.machine || '').trim();
      if (wantMachine && wantMachine !== 'network') {
        const mac = COMPUTE_SPONSOR_MACHINES.find(row => row.id === wantMachine);
        if (!mac) return json({ error: 'pick a Mac' }, 400, allowedOrigin, true);
        machineId = mac.id;
      }
      const locked = await lockTipAmount(method, cents, this.env);
      if (!locked.ok) return json({ error: locked.error || 'price unavailable' }, 503, allowedOrigin, true);
      const reference = await generateReference();
      const id = `spr_${randomUrlToken(12)}`;
      const nowMs = Date.now();
      const anonymous = !actor;
      const owner = actor ? actor.owner : `anon:${randomUrlToken(12)}`;
      const name = anonymous ? null : String(input.name || '').trim().slice(0, 40) || actor.fallback;
      const order = {
        id,
        kind: 'sponsor',
        owner,
        handle: actor?.handle || null,
        name,
        anonymous,
        machine: machineId,
        method,
        face_cents: locked.face_cents,
        charge_cents: locked.charge_cents,
        mint: locked.mint,
        dest: COMPUTE_SPONSOR_TREASURY,
        amountRaw: String(locked.amountRaw),
        amountUi: locked.amountUi,
        price_usd: locked.price_usd,
        reference,
        status: 'pending',
        signature: null,
        createdAt: nowMs,
        expiresAt: nowMs + CREDIT_ORDER_TTL_MS,
        paidAt: null,
      };
      await this.state.storage.put(`compute:sponsor-order:${id}`, order);
      const pay_url = solanaPayUrl({ dest: COMPUTE_SPONSOR_TREASURY, amount: locked.amountUi, mint: locked.mint, reference, label: 'Dasha Sponsor' });
      return json({
        id: order.id,
        status: order.status,
        kind: 'sponsor',
        machine: order.machine,
        method: order.method,
        face_cents: order.face_cents,
        charge_cents: order.charge_cents,
        dest: order.dest,
        mint: order.mint,
        amount: order.amountUi,
        amountRaw: order.amountRaw,
        reference: order.reference,
        pay_url,
        name: order.name,
        anonymous: !!order.anonymous,
        expires_at: order.expiresAt,
      }, 201, allowedOrigin, true);
    }

    const sponsorOrderMatch = path.match(/^\/compute\/api\/sponsors\/orders\/([A-Za-z0-9_-]+)\/?(confirm)?\/?$/);
    if (sponsorOrderMatch) {
      const orderId = sponsorOrderMatch[1];
      const isConfirm = sponsorOrderMatch[2] === 'confirm' || path.endsWith('/confirm') || path.endsWith('/confirm/');
      const key = `compute:sponsor-order:${orderId}`;
      let order = await this.state.storage.get(key);
      if (!order) return maybeHead(request, json({ error: 'order not found' }, 404, allowedOrigin, true));

      if (isConfirm) {
        if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, true));
        const input = await body(request);
        const result = await this.settleSponsorOrder(order, { signature: input.signature, now: Date.now() });
        if (result.error && result.status) return json({ error: result.error, status: order.status }, result.status, allowedOrigin, true);
        return json(result.body, 200, allowedOrigin, true);
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, true));
      const nowMs = Date.now();
      if (order.status === 'pending' && Number(order.expiresAt) <= nowMs) {
        order = { ...order, status: 'expired' };
        await this.state.storage.put(key, order);
      } else if (order.status === 'pending') {
        const settled = await this.settleSponsorOrder(order, { now: nowMs });
        if (settled.body?.status === 'funded' || settled.body?.status === 'paid') {
          return maybeHead(request, json(settled.body, 200, allowedOrigin, true));
        }
        order = await this.state.storage.get(key) || order;
      }
      return maybeHead(request, json({
        id: order.id,
        status: order.status === 'paid' ? 'funded' : order.status,
        kind: 'sponsor',
        machine: order.machine,
        method: order.method,
        face_cents: order.face_cents,
        charge_cents: order.charge_cents,
        dest: order.dest,
        mint: order.mint,
        amount: order.amountUi,
        reference: order.reference,
        signature: order.signature || null,
        name: order.name || null,
        anonymous: !!order.anonymous || String(order.owner || '').startsWith('anon:'),
        expires_at: order.expiresAt,
      }, 200, allowedOrigin, true));
    }

    // --- heads ladder (992/993): public chain read + /heads + /heads/archive ---
    if ((path === '/compute/api/chain' || path === '/compute/api/chain/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const receipts = await listChain(this.state.storage);
      return maybeHead(request, json({
        schema: 'settled.chain.v0',
        receipts,
      }, 200, '*', false, { 'Cache-Control': 'no-cache' }));
    }
    // --- Block 32: machine-readable receipt verdict for agents (mirrors /verify page) ---
    if ((path === '/compute/api/verify' || path === '/compute/api/verify/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const key = await headsSigningKey(this.env);
      if (!key) return maybeHead(request, json({ error: 'signing not configured' }, 503, '*'));
      const verifyNow = Date.now();
      const receipts = await listChain(this.state.storage);
      const heads = await listAllHeads(this.state.storage);
      const verdict = await anchoredVerdict(receipts, heads, { [key.signer]: key.pubPem }, HEAD_MAX_AGE_MS, verifyNow);
      const vurl = new URL(request.url);
      const query = String(vurl.searchParams.get('hash') || vurl.searchParams.get('job_id') || vurl.searchParams.get('request_id') || '').trim();
      const found = query ? receipts.find((r) => r.hash === query || r.job_id === query || (r.request_id && r.request_id === query)) || null : null;
      return maybeHead(request, json({
        schema: 'settled.verify.v0',
        verdict,
        chain: { length: receipts.length, tip: receipts.length ? receipts[receipts.length - 1].hash : 'GENESIS' },
        ...(query ? { query, found: !!found, ...(found ? { receipt: found } : {}) } : {}),
        checked_at: new Date(verifyNow).toISOString(),
      }, 200, '*', false, { 'Cache-Control': 'no-cache' }));
    }
    if ((path === '/heads' || path === '/heads/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const key = await headsSigningKey(this.env);
      if (!key) return maybeHead(request, json({ error: 'signing not configured' }, 503, '*'));
      const now = Date.now();
      // Lazy freshness top-up: cover the current tip when the freshest covering
      // head is older than the anchored window. Read-triggered, still honest:
      // a head only ever attests the real current tip at its own ts.
      const tip = await chainTip(this.state.storage);
      if (tip !== 'GENESIS') {
        const recent = await listHeads(this.state.storage, { sinceMs: now - HEAD_MAX_AGE_MS, now });
        if (!recent.some((h) => h.tip === tip)) {
          await appendHead(this.state.storage, await makeHead(key, tip, await headsTip(this.state.storage)));
        }
      }
      const heads = await listHeads(this.state.storage, { sinceMs: now - 86400000, now });
      return maybeHead(request, json(heads, 200, '*', false, { 'Cache-Control': 'no-cache' }));
    }
    const headsArchiveMatch = path.match(/^\/heads\/archive\/(\d{4}-\d{2}-\d{2})\.json$/);
    if (headsArchiveMatch && (request.method === 'GET' || request.method === 'HEAD')) {
      const key = await headsSigningKey(this.env);
      if (!key) return maybeHead(request, json({ error: 'signing not configured' }, 503, '*'));
      const day = await listHeadsForDay(this.state.storage, headsArchiveMatch[1]);
      if (day === null) return maybeHead(request, json({ error: 'bad date' }, 400, '*'));
      return maybeHead(request, json(day, 200, '*', false, { 'Cache-Control': 'public, max-age=3600' }));
    }

    // --- referral (tasks 16-17): account-bound code + stats ---
    if ((path === '/compute/api/referral/code' || path === '/compute/api/referral/code/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, true));
      const code = await this.referralEnsureCode(owner, now);
      if (!code) return maybeHead(request, json({ error: 'code unavailable' }, 503, allowedOrigin, true));
      const referees = Number(await this.state.storage.get(`compute:referral-count:${owner}`)) || 0;
      const month = await this.state.storage.get(`compute:refgrant:${owner}:${refMonthKey(now)}`);
      return maybeHead(request, json({
        schema: 'compute.referral.v0',
        code,
        url: `https://www.getdasha.com/compute?ref=${code}`,
        referees,
        granted_month_cents: Math.max(0, Math.floor(Number(month?.cents) || 0)),
        month_cap_cents: REF_MONTH_CAP_CENTS,
        terms: {
          provider_online_cents: REF_M1_CENTS,
          provider_jobs_50: { referrer_cents: REF_M2_REFERRER_CENTS, referee_cents: REF_M2_REFEREE_CENTS, jobs: REF_M2_JOBS },
          buyer_topup_min_cents: REF_BUYER_MIN_TOPUP_CENTS,
          buyer_cents: REF_BUYER_CENTS,
        },
      }, 200, allowedOrigin, true));
    }

    // --- provider earnings + payout preference (pending settle; no auto-chain) ---
    if ((path === '/compute/api/receipts' || path === '/compute/api/receipts/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) {
        return maybeHead(request, json({
          error: 'login required',
          schema: 'settled.receipts.v0',
          receipts: [],
          settled_24h: publicSettled24h(await sumSettled24h(this.state.storage, now))
        }, 401, allowedOrigin, true));
      }
      const receipts = await listReceiptsForOwner(this.state.storage, owner, { limit: 20 });
      return maybeHead(request, json({
        schema: 'settled.receipts.v0',
        receipts,
        settled_24h: publicSettled24h(await sumSettled24h(this.state.storage, now))
      }, 200, allowedOrigin, true));
    }
    if ((path === '/compute/api/provider/earnings' || path === '/compute/api/provider/earnings/') && (request.method === 'GET' || request.method === 'HEAD')) {
      let owner = identity(await authSessionFromRequest(this.env, request));
      let onlyProviderId = null;
      if (!owner) {
        // Kit CLI `dasha-compute earnings` (task 19): Bearer provider token + ?provider_id= scopes the view to that one Mac.
        const bearer = await this.provider(request, { provider_id: new URL(request.url).searchParams.get('provider_id') || '' });
        if (!bearer) return maybeHead(request, json({ error: 'login required', ...earningsCatalog(), payout_mode: PROVIDER_PAYOUT_MODE }, 401, allowedOrigin, true));
        owner = bearer.owner;
        onlyProviderId = bearer.id;
      }
      const mine = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(p => p && p.owner === owner && (!onlyProviderId || p.id === onlyProviderId));
      const providers = [];
      for (const p of mine) {
        const earn = normalizeEarnRow(await this.state.storage.get(`compute:provider-earn:${p.id}`));
        providers.push({ id: p.id, name: p.name, ...earn });
      }
      const pref = await this.state.storage.get(`compute:provider-payout-pref:${owner}`);
      const pending = [...(await this.state.storage.list({ prefix: 'compute:provider-payout:' })).values()]
        .filter(row => row && row.owner === owner && (row.status === 'pending' || row.status === 'paid'))
        .sort((a, b) => Number(b.paidAt || b.createdAt || 0) - Number(a.paidAt || a.createdAt || 0));
      return maybeHead(request, json(earningsCatalog({ providers, pref, pending }), 200, allowedOrigin, true));
    }

    if ((path === '/compute/api/provider/payout-pref' || path === '/compute/api/provider/payout-pref/') && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      const input = await body(request);
      const norm = normalizePayoutPref(input);
      if (!norm.ok) return json({ error: norm.error }, 400, allowedOrigin, true);
      const row = { method: norm.method, wallet: norm.wallet, updatedAt: now };
      await this.state.storage.put(`compute:provider-payout-pref:${owner}`, row);
      return json({ method: row.method, wallet: row.wallet, updated_at: row.updatedAt, payout_mode: PROVIDER_PAYOUT_MODE }, 200, allowedOrigin, true);
    }

    if ((path === '/compute/api/provider/payout' || path === '/compute/api/provider/payout/') && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!takeRate(this.rates, `provider-payout:${owner}`, 5)) return json({ error: 'rate limited' }, 429, allowedOrigin, true);
      const input = await body(request);
      const prefStored = await this.state.storage.get(`compute:provider-payout-pref:${owner}`);
      const method = input?.method || prefStored?.method;
      const wallet = input?.wallet || prefStored?.wallet;
      const cents = input?.cents != null ? input.cents : null;
      const result = await createPendingPayout(this.state.storage, {
        owner,
        method,
        wallet,
        cents,
        now,
        idFactory: () => `payout_${randomUrlToken(10)}`,
      });
      if (!result.ok) return json({ error: result.error, min_payout_cents: PROVIDER_MIN_PAYOUT_CENTS, payout_mode: PROVIDER_PAYOUT_MODE }, result.status || 400, allowedOrigin, true);
      const p = result.payout;
      await this.bumpMetric('provider:payout');
      return json({
        id: p.id,
        status: p.status,
        method: p.method,
        wallet: p.wallet,
        usdc_cents: p.usdc_cents,
        payout_cents: p.payout_cents,
        created_at: p.createdAt,
        payout_mode: PROVIDER_PAYOUT_MODE,
        note: p.note,
      }, 201, allowedOrigin, true);
    }

    // --- operator provider payout settle (secret header; not session) ---
    if ((path === '/compute/api/provider/payouts/pending' || path === '/compute/api/provider/payouts/pending/') && (request.method === 'GET' || request.method === 'HEAD')) {
      if (!computePayoutSecret(this.env)) {
        return maybeHead(request, json({ error: 'not configured' }, 503, allowedOrigin || '*', false));
      }
      if (!payoutSecretOk(this.env, extractPayoutSecret(request))) {
        return maybeHead(request, json({ error: 'unauthorized' }, 401, allowedOrigin || '*', false));
      }
      const payouts = await listPendingProviderPayouts(this.state.storage);
      return maybeHead(request, json({
        payouts,
        count: payouts.length,
        payout_mode: PROVIDER_PAYOUT_MODE,
        auto_send: autoSendUsdcEnabled(this.env),
      }, 200, allowedOrigin || '*', false));
    }

    if ((path === '/compute/api/provider/payout/settle' || path === '/compute/api/provider/payout/settle/') && request.method === 'POST') {
      if (!computePayoutSecret(this.env)) {
        return json({ error: 'not configured' }, 503, allowedOrigin || '*', false);
      }
      if (!payoutSecretOk(this.env, extractPayoutSecret(request))) {
        return json({ error: 'unauthorized' }, 401, allowedOrigin || '*', false);
      }
      if (!takeRate(this.rates, 'provider-payout-settle', 30)) {
        return json({ error: 'rate limited' }, 429, allowedOrigin || '*', false);
      }
      const input = await body(request);
      const payoutId = String(input?.payout_id || input?.id || '').trim();
      let signature = String(input?.signature || '').trim();
      const note = input?.note != null ? String(input.note) : null;

      if (!payoutId) return json({ error: 'payout_id required' }, 400, allowedOrigin || '*', false);

      const existing = await this.state.storage.get(`compute:provider-payout:${payoutId}`);
      if (!existing || typeof existing !== 'object') {
        return json({ error: 'payout not found' }, 404, allowedOrigin || '*', false);
      }

      // Optional auto-send: only USDC + explicit COMPUTE_PAYOUT_KEYPAIR (never faucet tip key).
      let auto = null;
      if (!signature && autoSendUsdcEnabled(this.env) && String(existing.method || '') === 'usdc') {
        const amountRaw = BigInt(usdcRawFromCents(existing.payout_cents ?? existing.usdc_cents));
        if (amountRaw <= 0n) return json({ error: 'invalid amount' }, 400, allowedOrigin || '*', false);
        const sent = await sendTipTransfer(this.env, {
          destOwner: existing.wallet,
          amountRaw,
          mint: PROVIDER_USDC_MINT,
          secret: computePayoutKeypair(this.env),
        });
        if (!sent.ok) {
          return json({
            error: sent.error || 'auto-send failed',
            detail: sent.detail || null,
            payout_mode: PROVIDER_PAYOUT_MODE,
            auto_send: true,
          }, 502, allowedOrigin || '*', false);
        }
        signature = sent.signature;
        auto = { signature: sent.signature, solscan: sent.solscan || solscanTxUrl(sent.signature) };
      }

      if (!signature) {
        // dasha (and usdc without keypair) — operator must supply chain signature
        return json({
          error: 'signature required',
          hint: String(existing.method) === 'dasha'
            ? 'dasha settle is mark-paid only in v1; send tokens then POST signature'
            : 'send USDC manually then POST signature, or set COMPUTE_PAYOUT_KEYPAIR for auto USDC',
          payout_mode: PROVIDER_PAYOUT_MODE,
          auto_send: autoSendUsdcEnabled(this.env),
        }, 400, allowedOrigin || '*', false);
      }
      if (!isValidSolanaTxSignature(signature)) {
        return json({ error: 'invalid signature' }, 400, allowedOrigin || '*', false);
      }

      const result = await markProviderPayoutPaid(this.state.storage, {
        payoutId,
        signature,
        note: note || (auto ? 'paid — Worker auto USDC send' : null),
        now,
      });
      if (!result.ok) {
        return json({ error: result.error, payout_mode: PROVIDER_PAYOUT_MODE }, result.status || 400, allowedOrigin || '*', false);
      }
      const pub = publicPayoutRow(result.payout);
      return json({
        ...pub,
        replay: !!result.replay,
        payout_mode: PROVIDER_PAYOUT_MODE,
        auto_send: !!auto,
        auto,
      }, 200, allowedOrigin || '*', false);
    }

    // --- prepaid credits (Solana USDC / $dasha; Stripe deferred) ---
    if ((path === '/compute/api/credits' || path === '/compute/api/credits/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required', ...creditsCatalog(null) }, 401, allowedOrigin, true));
      const bal = await this.state.storage.get(`compute:credit-balance:${owner}`);
      const balance_cents = Math.max(0, Math.floor(Number(bal?.cents) || 0));
      return maybeHead(request, json(creditsCatalog(balance_cents), 200, allowedOrigin, true));
    }

    if ((path === '/compute/api/credits/orders' || path === '/compute/api/credits/orders/') && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!takeRate(this.rates, `credit-order:${owner}`, 8)) return json({ error: 'rate limited' }, 429, allowedOrigin, true);
      const input = await body(request);
      const pack = packById(input.pack);
      const method = String(input.method || '').toLowerCase();
      if (!pack) return json({ error: 'pick a pack' }, 400, allowedOrigin, true);
      if (method !== 'usdc' && method !== 'dasha') return json({ error: 'pick usdc or dasha' }, 400, allowedOrigin, true);
      const locked = await lockPayAmount(method, pack, this.env);
      if (!locked.ok) return json({ error: locked.error || 'price unavailable' }, 503, allowedOrigin, true);
      const reference = await generateReference();
      const id = `crd_${randomUrlToken(12)}`;
      const now = Date.now();
      if (input.ref) await this.referralAttribute(owner, input.ref, now);
      const order = {
        id,
        owner,
        pack: pack.id,
        method,
        face_cents: locked.face_cents,
        charge_cents: locked.charge_cents,
        credits_cents: pack.cents,
        mint: locked.mint,
        dest: CREDIT_DEST,
        amountRaw: String(locked.amountRaw),
        amountUi: locked.amountUi,
        price_usd: locked.price_usd,
        reference,
        status: 'pending',
        signature: null,
        createdAt: now,
        expiresAt: now + CREDIT_ORDER_TTL_MS,
        paidAt: null,
      };
      await this.state.storage.put(`compute:credit-order:${id}`, order);
      await this.bumpMetric(`credits:order:${method}`);
      const pay_url = solanaPayUrl({ dest: CREDIT_DEST, amount: locked.amountUi, mint: locked.mint, reference, label: 'Dasha Compute' });
      return json({
        id: order.id,
        status: order.status,
        pack: order.pack,
        method: order.method,
        credits_cents: order.credits_cents,
        face_cents: order.face_cents,
        charge_cents: order.charge_cents,
        dest: order.dest,
        mint: order.mint,
        amount: order.amountUi,
        amountRaw: order.amountRaw,
        reference: order.reference,
        pay_url,
        expires_at: order.expiresAt,
        discounts: { usdc: CREDIT_DISCOUNTS.usdc, dasha: CREDIT_DISCOUNTS.dasha },
      }, 201, allowedOrigin, true);
    }

    if ((path === '/compute/api/credits/spend' || path === '/compute/api/credits/spend/') && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!takeRate(this.rates, `credit-spend:${owner}`, 30, 60_000)) return json({ error: 'rate limited' }, 429, allowedOrigin, true);
      const input = await body(request);
      // v1: fixed Hosted ask price only (no client-chosen amounts).
      const reason = String(input?.reason || 'hosted-ask').slice(0, 32);
      if (reason !== 'hosted-ask') return json({ error: 'bad reason' }, 400, allowedOrigin, true);
      const requestId = input?.request_id != null ? String(input.request_id).slice(0, 80) : '';
      const result = await this.debitCredits(owner, {
        cents: HOSTED_ASK_PRICE_CENTS,
        reason,
        requestId: requestId || null,
        now: Date.now(),
      });
      if (!result.ok) {
        return json({
          error: 'top up credits',
          balance_cents: result.balance_cents ?? 0,
          price_cents: HOSTED_ASK_PRICE_CENTS,
        }, 402, allowedOrigin, true);
      }
      return json({
        ok: true,
        charged_cents: result.charged_cents,
        balance_cents: result.balance_cents,
        price_cents: HOSTED_ASK_PRICE_CENTS,
        reason,
        replay: result.replay === true,
      }, 200, allowedOrigin, true);
    }

    if ((path === '/compute/api/credits/card/checkout' || path === '/compute/api/credits/card/checkout/') && request.method === 'POST') {
      if (!allowedOrigin) return originRequired();
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!takeRate(this.rates, `credit-card:${owner}`, 6)) return json({ error: 'rate limited' }, 429, allowedOrigin, true);
      if (!stripeConfigured(this.env)) return json({ error: 'card payments unavailable' }, 503, allowedOrigin, true);
      const input = await body(request);
      const pack = packById(input.pack);
      if (!pack) return json({ error: 'pick a pack' }, 400, allowedOrigin, true);
      const id = `crd_${randomUrlToken(12)}`;
      const now = Date.now();
      if (input.ref) await this.referralAttribute(owner, input.ref, now);
      const session = await createCardCheckoutSession(this.env, {
        orderId: id,
        pack,
        successUrl: `https://www.getdasha.com/compute?card_order=${id}#pay`,
        cancelUrl: 'https://www.getdasha.com/compute#pay',
      });
      if (!session.ok) return json({ error: `card checkout failed - ${session.error || 'try again'}`, provider: 'stripe' }, session.status === 400 ? 400 : 502, allowedOrigin, true);
      const order = {
        id,
        owner,
        pack: pack.id,
        method: 'card',
        face_cents: pack.cents,
        charge_cents: pack.cents,
        credits_cents: pack.cents,
        status: 'pending',
        stripe_session_id: session.session_id,
        checkout_url: session.url,
        createdAt: now,
        expiresAt: now + CREDIT_ORDER_TTL_MS,
        paidAt: null,
      };
      await this.state.storage.put(`compute:credit-order:${id}`, order);
      await this.bumpMetric('credits:order:card');
      return json({
        id: order.id,
        status: order.status,
        pack: order.pack,
        method: 'card',
        credits_cents: order.credits_cents,
        charge_cents: order.charge_cents,
        checkout_url: order.checkout_url,
        expires_at: order.expiresAt,
      }, 201, allowedOrigin, true);
    }

    if ((path === '/compute/api/credits/card/webhook' || path === '/compute/api/credits/card/webhook/') && request.method === 'POST') {
      // Stripe calls this; no session. Raw body is the signed payload - never parse before verify.
      if (!stripeWebhookConfigured(this.env)) return json({ error: 'card webhook unavailable' }, 503);
      const raw = await request.text();
      const verified = await verifyStripeSignature(this.env.STRIPE_WEBHOOK_SECRET, raw, request.headers.get('Stripe-Signature'));
      if (!verified.ok) return json({ error: verified.error }, verified.status || 400);
      let event = null;
      try { event = JSON.parse(raw); } catch { return json({ error: 'bad payload' }, 400); }
      if (event?.type === 'checkout.session.completed') {
        const session = event.data?.object || {};
        const orderId = String(session?.metadata?.order_id || '').trim();
        const order = orderId ? await this.state.storage.get(`compute:credit-order:${orderId}`) : null;
        if (order) {
          await this.settleCardOrder(order, { session, now: Date.now() });
        }
      }
      return json({ received: true }, 200);
    }

    const creditOrderMatch = path.match(/^\/compute\/api\/credits\/orders\/([A-Za-z0-9_-]+)\/?(confirm)?\/?$/);
    if (creditOrderMatch) {
      const orderId = creditOrderMatch[1];
      const isConfirm = creditOrderMatch[2] === 'confirm' || path.endsWith('/confirm') || path.endsWith('/confirm/');
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      const key = `compute:credit-order:${orderId}`;
      let order = await this.state.storage.get(key);
      if (!order || order.owner !== owner) return maybeHead(request, json({ error: 'order not found' }, 404, allowedOrigin, true));

      if (isConfirm) {
        if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, true));
        const input = await body(request);
        const result = order.method === 'card'
          ? await this.settleCardOrder(order, { now: Date.now() })
          : await this.settleCreditOrder(order, { signature: input.signature, now: Date.now() });
        if (result.error && result.status) return json({ error: result.error, status: order.status, balance_cents: result.balance_cents }, result.status, allowedOrigin, true);
        return json(result.body, 200, allowedOrigin, true);
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, true));
      const now = Date.now();
      if (order.status === 'pending' && Number(order.expiresAt) <= now) {
        order = { ...order, status: 'expired' };
        await this.state.storage.put(key, order);
      } else if (order.status === 'pending' && order.method === 'card') {
        const settled = await this.settleCardOrder(order, { now });
        if (settled.body?.status === 'paid') {
          return maybeHead(request, json(settled.body, 200, allowedOrigin, true));
        }
        order = await this.state.storage.get(key) || order;
      } else if (order.status === 'pending') {
        const settled = await this.settleCreditOrder(order, { now });
        if (settled.body?.status === 'paid') {
          return maybeHead(request, json(settled.body, 200, allowedOrigin, true));
        }
        order = await this.state.storage.get(key) || order;
      }
      const bal = await this.state.storage.get(`compute:credit-balance:${owner}`);
      const balance_cents = order.status === 'paid' ? Math.max(0, Math.floor(Number(bal?.cents) || 0)) : undefined;
      return maybeHead(request, json({
        id: order.id,
        status: order.status,
        pack: order.pack,
        method: order.method,
        credits_cents: order.credits_cents,
        charge_cents: order.charge_cents,
        dest: order.dest,
        mint: order.mint,
        amount: order.amountUi,
        reference: order.reference,
        signature: order.signature || null,
        checkout_url: order.method === 'card' ? order.checkout_url || null : undefined,
        expires_at: order.expiresAt,
        ...(balance_cents != null ? { balance_cents } : {}),
      }, 200, allowedOrigin, true));
    }

    if ((path === '/compute/api/v1' || path === '/compute/api/v1/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return computeV1Gateway(request, allowedOrigin, credentials);
    }

    return json({ error: 'not found' }, 404, allowedOrigin, credentials);
  }

  async debitCredits(owner, { cents = HOSTED_ASK_PRICE_CENTS, reason = 'hosted-ask', requestId = null, now = Date.now() } = {}) {
    const who = String(owner || '').trim();
    if (!who) return { ok: false, error: 'login required', balance_cents: 0 };
    const balKey = `compute:credit-balance:${who}`;
    const readBal = async () => Math.max(0, Math.floor(Number((await this.state.storage.get(balKey))?.cents) || 0));
    const rid = requestId ? String(requestId).slice(0, 80) : '';
    if (rid) {
      const spendKey = `compute:credit-spend:${who}:${rid}`;
      const prior = await this.state.storage.get(spendKey);
      if (prior && Number(prior.cents) > 0) {
        return { ok: true, replay: true, charged_cents: Math.floor(Number(prior.cents) || 0), balance_cents: await readBal(), reason: prior.reason || reason };
      }
    }
    const prev = await readBal();
    const applied = applyCreditDebit(prev, cents);
    if (!applied.ok) return applied;
    await this.state.storage.put(balKey, { owner: who, cents: applied.balance_cents, updatedAt: now });
    if (rid) {
      await this.state.storage.put(`compute:credit-spend:${who}:${rid}`, { cents: applied.charged_cents, reason, at: now });
    }
    // Minimal ledger row (optional trace).
    await this.state.storage.put(`compute:credit-ledger:${who}:${now}:${rid || randomUrlToken(6)}`, {
      owner: who,
      cents: -applied.charged_cents,
      reason,
      request_id: rid || null,
      balance_cents: applied.balance_cents,
      at: now,
    });
    return { ok: true, replay: false, charged_cents: applied.charged_cents, balance_cents: applied.balance_cents, reason };
  }

  async settleSponsorOrder(order, { signature = null, now = Date.now() } = {}) {
    const key = `compute:sponsor-order:${order.id}`;
    const dest = order.dest || COMPUTE_SPONSOR_TREASURY;

    if (order.status === 'funded' || order.status === 'paid') {
      return {
        body: {
          id: order.id,
          status: 'funded',
          kind: 'sponsor',
          face_cents: order.face_cents,
          machine: order.machine,
          name: order.name || null,
          signature: order.signature,
        },
      };
    }
    if (order.status === 'expired' || Number(order.expiresAt) <= now) {
      if (order.status !== 'expired') {
        order = { ...order, status: 'expired' };
        await this.state.storage.put(key, order);
      }
      return { error: 'order expired', status: 410 };
    }

    let sig = String(signature || '').trim() || null;
    let check = null;
    if (sig) {
      const tx = await loadTxBySignature(this.env, sig);
      if (!tx) return { error: 'signature not found', status: 404 };
      check = verifyCreditTx(tx, {
        dest,
        mint: order.mint,
        amountRaw: order.amountRaw,
        reference: order.reference,
      });
      if (!check.ok) return { error: check.error || 'payment miss', status: 400 };
    } else {
      const found = await findCreditPayment(this.env, {
        reference: order.reference,
        dest,
        mint: order.mint,
        amountRaw: order.amountRaw,
      });
      if (!found.ok) {
        return { body: { id: order.id, status: 'pending', kind: 'sponsor', face_cents: order.face_cents, reference: order.reference, expires_at: order.expiresAt } };
      }
      sig = found.signature;
      check = found;
    }

    const sigKey = `compute:sponsor-sig:${sig}`;
    const prior = await this.state.storage.get(sigKey);
    if (prior && prior.orderId !== order.id) {
      return { error: 'signature already used', status: 409 };
    }

    const fresh = await this.state.storage.get(key);
    if (!fresh || fresh.owner !== order.owner) return { error: 'order not found', status: 404 };
    if (fresh.status === 'funded' || fresh.status === 'paid') {
      return {
        body: {
          id: fresh.id,
          status: 'funded',
          kind: 'sponsor',
          face_cents: fresh.face_cents,
          machine: fresh.machine,
          name: fresh.name || null,
          signature: fresh.signature,
        },
      };
    }

    const cents = Math.floor(Number(fresh.face_cents) || 0);
    const paid = { ...fresh, status: 'funded', signature: sig, paidAt: now };
    const pledge = {
      id: fresh.id,
      owner: fresh.owner,
      handle: fresh.handle || null,
      name: fresh.name || null,
      anonymous: !!fresh.anonymous || String(fresh.owner || '').startsWith('anon:'),
      machine: fresh.machine || 'network',
      method: fresh.method,
      cents,
      mint: fresh.mint,
      dest,
      signature: sig,
      status: 'funded',
      createdAt: fresh.createdAt,
      paidAt: now,
    };
    await this.state.storage.put(key, paid);
    await this.state.storage.put(`compute:sponsor-pledge:${fresh.id}`, pledge);
    await this.state.storage.put(sigKey, { orderId: fresh.id, owner: fresh.owner, at: now });

    if (pledge.machine && pledge.machine !== 'network') {
      const macKey = `compute:sponsor:${pledge.machine}`;
      const existing = await this.state.storage.get(macKey);
      if (existing) {
        const nextCents = Math.floor(Number(existing.cents) || 0) + cents;
        await this.state.storage.put(macKey, { ...existing, status: 'funded', cents: nextCents });
      } else if (pledge.name) {
        await this.state.storage.put(macKey, {
          machine: pledge.machine,
          owner: pledge.owner,
          name: pledge.name,
          handle: pledge.handle,
          url: null,
          status: 'funded',
          cents,
          createdAt: now,
        });
      }
    }

    const pledges = [...(await this.state.storage.list({ prefix: 'compute:sponsor:' })).values()];
    const tipRows = [...(await this.state.storage.list({ prefix: 'compute:sponsor-pledge:' })).values()];
    return {
      body: {
        id: paid.id,
        status: 'funded',
        kind: 'sponsor',
        face_cents: cents,
        machine: paid.machine,
        name: paid.name || null,
        signature: sig,
        board: sponsorBoard(pledges, tipRows),
      },
    };
  }

  async settleCreditOrder(order, { signature = null, now = Date.now() } = {}) {
    const key = `compute:credit-order:${order.id}`;
    const balKey = `compute:credit-balance:${order.owner}`;
    const readBal = async () => Math.max(0, Math.floor(Number((await this.state.storage.get(balKey))?.cents) || 0));

    if (order.status === 'paid') {
      return { body: { id: order.id, status: 'paid', credits_cents: order.credits_cents, signature: order.signature, balance_cents: await readBal() } };
    }
    if (order.status === 'expired' || Number(order.expiresAt) <= now) {
      if (order.status !== 'expired') {
        order = { ...order, status: 'expired' };
        await this.state.storage.put(key, order);
      }
      return { error: 'order expired', status: 410, balance_cents: await readBal() };
    }

    let sig = String(signature || '').trim() || null;
    let check = null;
    if (sig) {
      const tx = await loadTxBySignature(this.env, sig);
      if (!tx) return { error: 'signature not found', status: 404, balance_cents: await readBal() };
      check = verifyCreditTx(tx, {
        dest: order.dest || CREDIT_DEST,
        mint: order.mint,
        amountRaw: order.amountRaw,
        reference: order.reference,
      });
      if (!check.ok) return { error: check.error || 'payment miss', status: 400, balance_cents: await readBal() };
    } else {
      const found = await findCreditPayment(this.env, {
        reference: order.reference,
        dest: order.dest || CREDIT_DEST,
        mint: order.mint,
        amountRaw: order.amountRaw,
      });
      if (!found.ok) {
        return { body: { id: order.id, status: 'pending', credits_cents: order.credits_cents, reference: order.reference, expires_at: order.expiresAt } };
      }
      sig = found.signature;
      check = found;
    }

    const sigKey = `compute:credit-sig:${sig}`;
    const prior = await this.state.storage.get(sigKey);
    if (prior && prior.orderId !== order.id) {
      return { error: 'signature already used', status: 409, balance_cents: await readBal() };
    }

    // Re-read order for race; credit once
    const fresh = await this.state.storage.get(key);
    if (!fresh || fresh.owner !== order.owner) return { error: 'order not found', status: 404 };
    if (fresh.status === 'paid') {
      return { body: { id: fresh.id, status: 'paid', credits_cents: fresh.credits_cents, signature: fresh.signature, balance_cents: await readBal() } };
    }

    const prevBal = await readBal();
    const nextBal = prevBal + Math.floor(Number(fresh.credits_cents) || 0);
    const paid = { ...fresh, status: 'paid', signature: sig, paidAt: now };
    await this.state.storage.put(key, paid);
    await this.state.storage.put(balKey, { owner: fresh.owner, cents: nextBal, updatedAt: now });
    await this.state.storage.put(sigKey, { orderId: fresh.id, owner: fresh.owner, at: now });
    await this.bumpMetric(`credits:settled:${paid.method || 'crypto'}`);
    await this.referralCheckBuyer(paid.owner, paid.credits_cents, now);

    return {
      body: {
        id: paid.id,
        status: 'paid',
        credits_cents: paid.credits_cents,
        signature: sig,
        balance_cents: nextBal,
      },
    };
  }

  /** Card settle: Stripe session is the proof. Idempotent - webhook + return-poll can race. */
  async settleCardOrder(order, { session = null, now = Date.now() } = {}) {
    const key = `compute:credit-order:${order.id}`;
    const balKey = `compute:credit-balance:${order.owner}`;
    const readBal = async () => Math.max(0, Math.floor(Number((await this.state.storage.get(balKey))?.cents) || 0));

    if (order.status === 'paid') {
      return { body: { id: order.id, status: 'paid', credits_cents: order.credits_cents, signature: order.signature, balance_cents: await readBal() } };
    }
    if (order.status === 'expired' || Number(order.expiresAt) <= now) {
      if (order.status !== 'expired') {
        order = { ...order, status: 'expired' };
        await this.state.storage.put(key, order);
      }
      return { error: 'order expired', status: 410, balance_cents: await readBal() };
    }

    let settled = session && typeof session === 'object' ? session : null;
    if (!settled) {
      if (!stripeConfigured(this.env)) return { body: { id: order.id, status: 'pending', credits_cents: order.credits_cents, expires_at: order.expiresAt } };
      const got = await retrieveCardSession(this.env, order.stripe_session_id);
      if (!got.ok) return { body: { id: order.id, status: 'pending', credits_cents: order.credits_cents, expires_at: order.expiresAt } };
      settled = got.session;
    }
    const pack = packById(order.pack);
    const match = sessionSettlesOrder(settled, order, pack);
    if (!match.ok) {
      if (match.pending) return { body: { id: order.id, status: 'pending', credits_cents: order.credits_cents, expires_at: order.expiresAt } };
      return { error: match.error || 'session mismatch', status: 400, balance_cents: await readBal() };
    }

    const sig = `card:${settled.id}`;
    const sigKey = `compute:credit-sig:${sig}`;
    const prior = await this.state.storage.get(sigKey);
    if (prior && prior.orderId !== order.id) {
      return { error: 'session already used', status: 409, balance_cents: await readBal() };
    }

    const fresh = await this.state.storage.get(key);
    if (!fresh || fresh.owner !== order.owner) return { error: 'order not found', status: 404 };
    if (fresh.status === 'paid') {
      return { body: { id: fresh.id, status: 'paid', credits_cents: fresh.credits_cents, signature: fresh.signature, balance_cents: await readBal() } };
    }

    const prevBal = await readBal();
    const nextBal = prevBal + Math.floor(Number(fresh.credits_cents) || 0);
    const paid = { ...fresh, status: 'paid', signature: sig, paidAt: now };
    await this.state.storage.put(key, paid);
    await this.state.storage.put(balKey, { owner: fresh.owner, cents: nextBal, updatedAt: now });
    await this.state.storage.put(sigKey, { orderId: fresh.id, owner: fresh.owner, at: now });
    await this.bumpMetric(`credits:settled:${paid.method || 'crypto'}`);
    await this.referralCheckBuyer(paid.owner, paid.credits_cents, now);

    return {
      body: {
        id: paid.id,
        status: 'paid',
        credits_cents: paid.credits_cents,
        signature: sig,
        balance_cents: nextBal,
      },
    };
  }
}


async function bumpHostedFactory(env, { failed = false, settled = null } = {}) {
  try {
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    if (!stub) return;
    await stub.fetch(new Request('https://lobby.getdasha.com/compute/api/factory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'hosted-chat',
        failed: failed === true,
        ...(settled && typeof settled === 'object' ? { settled } : {})
      })
    }));
  } catch {}
}

async function spendHostedAskCredits(env, request, { requestId = null } = {}) {
  const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
  if (!stub) return { ok: false, error: 'top up credits', status: 402, balance_cents: 0 };
  const origin = request.headers.get('Origin') || 'https://www.getdasha.com';
  try {
    const res = await stub.fetch(new Request('https://lobby.getdasha.com/compute/api/credits/spend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: request.headers.get('Cookie') || request.headers.get('cookie') || '',
        origin,
        Origin: origin,
      },
      body: JSON.stringify({
        reason: 'hosted-ask',
        request_id: requestId || undefined,
      }),
    }));
    const data = await res.json().catch(() => ({}));
    if (res.status === 200 && data?.ok) {
      return {
        ok: true,
        balance_cents: Math.max(0, Math.floor(Number(data.balance_cents) || 0)),
        charged_cents: Math.max(0, Math.floor(Number(data.charged_cents) || 0)),
        replay: data.replay === true,
      };
    }
    return {
      ok: false,
      error: String(data?.error || 'top up credits').slice(0, 80),
      status: res.status === 402 ? 402 : (res.status === 401 ? 401 : 402),
      balance_cents: Math.max(0, Math.floor(Number(data?.balance_cents) || 0)),
    };
  } catch {
    return { ok: false, error: 'top up credits', status: 402, balance_cents: 0 };
  }
}

export async function computeApi(request, env, allowedOrigin) {
  const path = computeApiPathname(new URL(request.url).pathname), credentials = Boolean(allowedOrigin);
  const guestProbe = computeGuestKeyResponse(request);
  if (guestProbe) return guestProbe;
  if ((path === '/compute/api' || path === '/compute/api/' || path === '/compute/api/status' || path === '/compute/api/status/') && (request.method === 'GET' || request.method === 'HEAD')) {
    const res = json(computeApiRootBody(env), 200, allowedOrigin || '*', credentials);
    return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
  }
  if (isComputeApiHealthzPath(path) && (request.method === 'GET' || request.method === 'HEAD')) {
    return maybeHead(request, json({ ok: true, service: 'dasha-compute', version: '0.3.1' }, 200, allowedOrigin || '*', credentials));
  }
  if ((path === '/compute/api/factory' || path === '/compute/api/factory/') && (request.method === 'GET' || request.method === 'HEAD')) {
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    if (stub) return stub.fetch(request);
    return maybeHead(request, json({
      schema: 'factory.compute.v0',
      generated_at: new Date().toISOString(),
      jobs: { hosted: 0, community: 0, mixture: 0, failed: 0 },
      models: {},
      providers_online_latest: 0,
      settled_24h: { tokens: 0, jobs: 0, cents: 0 },
      note: 'counters only; prompts not included; settled_24h = paid-inference only',
    }, 200, allowedOrigin || '*', credentials));
  }
  if ((path === '/compute/api/v1' || path === '/compute/api/v1/') && (request.method === 'GET' || request.method === 'HEAD')) {
    return computeV1Gateway(request, allowedOrigin, credentials);
  }
  if ((path === '/compute/api/sponsors' || path === '/compute/api/sponsors/') && (request.method === 'GET' || request.method === 'HEAD')) {
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    if (stub) return stub.fetch(request);
    return maybeHead(request, json(sponsorBoard([]), 200, allowedOrigin || '*', credentials));
  }
  if ((path === '/compute/api/credits' || path === '/compute/api/credits/') && (request.method === 'GET' || request.method === 'HEAD')) {
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    if (stub) return stub.fetch(request);
    return maybeHead(request, json({ error: 'login required', ...creditsCatalog(null) }, 401, allowedOrigin, Boolean(allowedOrigin)));
  }
  if (path === '/compute/api/event' || path === '/compute/api/event/' || path === '/compute/api/metrics' || path === '/compute/api/metrics/' || path === '/compute/api/chain' || path === '/compute/api/chain/' || path === '/compute/api/verify' || path === '/compute/api/verify/' || path === '/compute/api/factory' || path === '/compute/api/factory/' || path === '/compute/api/network' || path === '/compute/api/network/' || path.startsWith('/compute/api/sponsors') || path.startsWith('/compute/api/providers/') || path === '/compute/api/providers' || path.startsWith('/compute/api/keys') || path.startsWith('/compute/api/guest-keys') || path.startsWith('/compute/api/night') || path.startsWith('/compute/api/credits') || path.startsWith('/compute/api/provider/') || path.startsWith('/compute/api/receipts') || path.startsWith('/compute/api/referral') || path === '/compute/api/v1' || path === '/compute/api/v1/' || path.startsWith('/compute/api/v1/') || path === '/compute/api/jobs' || path === '/compute/api/jobs/' || /^\/compute\/api\/jobs\/[A-Za-z0-9_-]+\/?$/.test(path)) {
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    return stub ? stub.fetch(request) : json({ error: 'community network unavailable' }, 503, allowedOrigin, credentials);
  }
  if (path !== '/compute/api/chat' && path !== '/compute/api/chat/') return json({ error: 'not found' }, 404, allowedOrigin, credentials);
  if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, credentials));
  if (!allowedOrigin) return originRequired();
  if (!env.AI) return json({ error: 'hosted demo unavailable', code: 'hosted_cut' }, 503, allowedOrigin, true);
  const session = await authSessionFromRequest(env, request), owner = identity(session);
  if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
  const input = await body(request, 12 * 1024), messages = chatMessages(input);
  if (!messages) return json({ error: 'send 1–12 user/assistant messages, max 2,000 characters each and 6,000 total' }, 400, allowedOrigin, true);
  const parsedEffort = parseReasoningEffort(input);
  if (!parsedEffort.ok) return json({ error: parsedEffort.error }, 400, allowedOrigin, true);
  const hostedHonesty = effortHonesty({ effort: parsedEffort.effort, route: 'hosted' });
  const hostedEffortKnob = hostedReasoningEffortInput(parsedEffort.effort);
  let creditBalanceHeader = null;
  let hostedSpendId = null;
  let hostedChargedCents = 0;
  if (!takeRate(hostedRates, owner, 3, 10 * 60_000)) {
    // Free floor exhausted → prepaid credits extend Hosted Ask (fail closed if insufficient).
    hostedSpendId = `hosted_${randomUrlToken(12)}`;
    const spent = await spendHostedAskCredits(env, request, { requestId: hostedSpendId });
    if (!spent.ok) {
      return json({
        error: spent.error || 'top up credits',
        balance_cents: spent.balance_cents ?? 0,
        price_cents: HOSTED_ASK_PRICE_CENTS,
      }, spent.status || 402, allowedOrigin, true, dashaChatSpendHeaders({ route: 'hosted', model: 'gpt-oss-20b' }));
    }
    creditBalanceHeader = String(spent.balance_cents);
    hostedChargedCents = Math.max(0, Math.floor(Number(spent.charged_cents) || HOSTED_ASK_PRICE_CENTS));
  }
  const hostedSettledPayload = (usage) => hostedSpendId && hostedChargedCents > 0 ? {
    paid: true,
    owner,
    usage: usage || null,
    cents: hostedChargedCents,
    request_id: hostedSpendId,
    replay_key: `hosted:${hostedSpendId}`
  } : null;
  const system = { role: 'system', content: 'Answer directly and concisely. Do not claim to be running on a community Mac; this hosted demo uses Cloudflare Workers AI.' };
  try {
    if (input.stream === true) {
      const run = await env.AI.run('@cf/openai/gpt-oss-20b', { stream: true, messages: [system, ...messages], max_tokens: 256, temperature: 0.6, ...hostedEffortKnob });
      const encoder = new TextEncoder();
      const headers = { ...SECURITY, ...cors(allowedOrigin, true), 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', ...dashaChatSpendHeaders({ route: 'hosted', model: 'gpt-oss-20b', spendCents: hostedChargedCents }), ...effortResponseHeaders(hostedHonesty), ...(creditBalanceHeader != null ? { 'X-Dasha-Balance-Cents': creditBalanceHeader } : {}) };
      let completionText = '';
      let upstreamUsage = null;
      const approxTokens = (text) => Math.max(0, Math.ceil(String(text || '').length / 4));
      const hostedUsage = () => {
        if (upstreamUsage) return tokenUsage({ usage: upstreamUsage });
        const prompt_tokens = approxTokens([system.content, ...messages.map((m) => `${m.role}:${m.content}`)].join('\n'));
        const completion_tokens = approxTokens(completionText);
        return tokenUsage({ usage: { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens } });
      };
      const emitDelta = (controller, content) => {
        if (!content) return;
        completionText += content;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`));
      };
      const emitDone = (controller, failed = false) => {
        const usage = failed ? null : hostedUsage();
        if (!failed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage, ...dashaEffortExtension(hostedHonesty) })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        bumpHostedFactory(env, { failed: Boolean(failed), settled: failed ? null : hostedSettledPayload(usage) });
      };
      const emitError = (controller, message) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { message, type: 'server_error', code: 'hosted_cut' } })}\n\n`));
        emitDone(controller, true);
      };
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const flushPayload = (payload) => {
              if (payload == null) return false;
              if (payload === '[DONE]') { emitDone(controller); return true; }
              if (typeof payload === 'string') {
                const trimmed = payload.trim();
                if (!trimmed) return false;
                if (trimmed === '[DONE]') { emitDone(controller); return true; }
                try { return flushPayload(JSON.parse(trimmed)); } catch { emitDelta(controller, trimmed); return false; }
              }
              if (payload.error) { emitError(controller, payload.error.message || payload.error || 'model request failed; try again'); return true; }
              if (payload.usage && typeof payload.usage === 'object') upstreamUsage = payload.usage;
              const content = typeof payload?.choices?.[0]?.delta?.content === 'string' ? payload.choices[0].delta.content
                : typeof payload?.choices?.[0]?.delta === 'string' ? payload.choices[0].delta
                : typeof payload?.response === 'string' ? payload.response
                : typeof payload?.result?.response === 'string' ? payload.result.response
                : typeof payload?.delta === 'string' ? payload.delta
                : '';
              emitDelta(controller, content);
              return false;
            };
            if (run && typeof run.getReader === 'function') {
              const reader = run.getReader();
              const decoder = new TextDecoder();
              let buf = '';
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value instanceof Uint8Array || typeof value === 'string') {
                  buf += typeof value === 'string' ? value : decoder.decode(value, { stream: true });
                  const parts = buf.split(/\n\n/);
                  buf = parts.pop() || '';
                  for (const part of parts) {
                    for (const line of part.split(/\n/)) {
                      if (!line.startsWith('data:')) continue;
                      const raw = line.slice(5).trimStart();
                      if (flushPayload(raw === '' ? null : raw)) return;
                    }
                  }
                } else if (flushPayload(value)) return;
              }
              if (buf.trim()) {
                for (const line of buf.split(/\n/)) {
                  if (!line.startsWith('data:')) continue;
                  const raw = line.slice(5).trimStart();
                  if (flushPayload(raw === '' ? null : raw)) return;
                }
              }
              emitDone(controller);
              return;
            }
            if (run && typeof run[Symbol.asyncIterator] === 'function') {
              for await (const chunk of run) {
                if (flushPayload(chunk)) return;
              }
              emitDone(controller);
              return;
            }
            const answer = String(run?.response || run?.result?.response || run?.choices?.[0]?.message?.content || '').trim();
            if (!answer) throw new Error('empty model response');
            emitDelta(controller, answer);
            emitDone(controller);
          } catch {
            try { emitError(controller, 'model request failed; try again'); } catch {}
          }
        },
      });
      return new Response(stream, { headers });
    }
    const result = await env.AI.run('@cf/openai/gpt-oss-20b', { messages: [system, ...messages], max_tokens: 256, temperature: 0.6, ...hostedEffortKnob });
    const answer = String(result?.response || result?.result?.response || result?.choices?.[0]?.message?.content || '').trim();
    if (!answer) throw new Error('empty model response');
    const approxTokens = (t) => Math.max(0, Math.ceil(String(t || '').length / 4));
    const prompt_tokens = approxTokens([system.content, ...messages.map((m) => `${m.role}:${m.content}`)].join('\n'));
    const completion_tokens = approxTokens(answer);
    const usage = tokenUsage({ usage: { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens } });
    await bumpHostedFactory(env, { failed: false, settled: hostedSettledPayload(usage) });
    return json({ answer, model: 'gpt-oss-20b', provider: 'Cloudflare Workers AI', stored: false, usage, ...hostedEffortFace(hostedHonesty), ...(creditBalanceHeader != null ? { balance_cents: Number(creditBalanceHeader) } : {}) }, 200, allowedOrigin, true, { ...dashaChatSpendHeaders({ route: 'hosted', model: 'gpt-oss-20b', spendCents: hostedChargedCents }), ...effortResponseHeaders(hostedHonesty), ...(creditBalanceHeader != null ? { 'X-Dasha-Balance-Cents': creditBalanceHeader } : {}) });
  } catch {
    await bumpHostedFactory(env, { failed: true });
    return json({ error: 'model request failed; try again', code: 'hosted_cut' }, 502, allowedOrigin, true, dashaChatSpendHeaders({ route: 'hosted', model: 'gpt-oss-20b', spendCents: hostedChargedCents }));
  }
}
