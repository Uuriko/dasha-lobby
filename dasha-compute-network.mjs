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

export { HOSTED_ASK_PRICE_CENTS };

const MODELS = new Set(['qwen3-8b', 'gemma3-12b', 'gpt-oss-20b', 'qwen3-30b-a3b', 'gemma3-27b', 'gpt-oss-120b']);
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

function maybeHead(request, res) {
  return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
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


function computeV1Gateway(request, allowedOrigin, credentials) {
  const res = json({
    object: 'gateway',
    service: 'dasha-compute',
    version: '0.3.0',
    auth: 'bearer',
    models: '/compute/api/v1/models',
    chat_completions: '/compute/api/v1/chat/completions',
    network: '/compute/api/v1/network',
    healthz: '/compute/api/healthz',
    // OpenRouter apply bar + Hosted UI parity: usage on stream stop + non-stream JSON.
    usage: {
      chat_completions: 'OpenAI-style usage on non-stream JSON and on the SSE final finish_reason=stop chunk',
      hosted_chat: 'POST /compute/api/chat SSE emits usage on the final stop chunk (Hosted UI)',
    },
  }, 200, allowedOrigin || '*', credentials);
  return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
}

function openaiError(message, status = 400, type = 'invalid_request_error') {
  return json({ error: { message, type, code: null } }, status);
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
  return '';
}

function takeRate(rates, key, max, windowMs = 60_000) {
  const now = Date.now(), recent = (rates.get(key) || []).filter(at => now - at < windowMs);
  if (recent.length >= max) return false;
  recent.push(now); rates.set(key, recent); return true;
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
  if (hdr && !next.route) next.route = hdr;
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
      else if (job.status === 'leased' && Number(job.leaseExpiresAt) <= now) await this.state.storage.put(key, { ...job, status: 'queued', providerId: null, leaseExpiresAt: null, ...(job.stream ? { chunks: [] } : {}) });
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
      const job = { id: `job_${randomUrlToken(9)}`, nightId: task.id, nightStep: Number(task.stepIndex || 0), owner: task.owner, model: task.model, messages: [{ role: 'system', content: NIGHT_TEMPLATES[task.template] }, { role: 'user', content: nightStepPrompt(task) }], maxTokens: 2048, temperature: 0.4, stream: false, status: 'queued', providerId: null, createdAt: now, expiresAt: now + NIGHT_JOB_TTL_MS };
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

  async factoryPayload(now = Date.now()) {
    await this.prune(now);
    const counters = await this.loadFactoryCounters();
    const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
    return {
      schema: 'factory.compute.v0',
      generated_at: new Date(now).toISOString(),
      jobs: counters.jobs,
      models: counters.models,
      providers_online_latest: providers.length,
      note: 'counters only; prompts not included',
    };
  }

  async apiKey(request) {
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
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
    const messages = chatMessages(input), model = String(input.model || '');
    if (!messages) return { error: 'send 1–12 user/assistant messages, max 2,000 characters each and 6,000 total', status: 400 };
    if (!MODELS.has(model)) return { error: 'unsupported model', status: 400 };
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
    const job = { id: `job_${randomUrlToken(9)}`, owner, model, route, messages, maxTokens: Math.max(1, Math.min(4096, Number(input.max_tokens) || 512)), temperature: Number.isFinite(requestedTemperature) ? Math.max(0, Math.min(2, requestedTemperature)) : 0.6, stream, ...(stream ? { chunks: [] } : {}), status: 'queued', providerId: null, createdAt: now, expiresAt: now + JOB_TTL_MS };
    await this.state.storage.put(`compute:job:${job.id}`, job);
    return { job };
  }

  streamResponse(job, origin = null, extra = {}) {
    const encoder = new TextEncoder(), storage = this.state.storage, key = `compute:job:${job.id}`;
    let stopped = false;
    return new Response(new ReadableStream({ async start(controller) {
      let sent = 0;
      const emit = value => controller.enqueue(encoder.encode(`data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`));
      while (!stopped) {
        const current = await storage.get(key);
        if (stopped) return;
        if (!current) { emit({ error: { message: 'job expired', type: 'server_error', code: null } }); emit('[DONE]'); controller.close(); return; }
        if (Number(current.expiresAt) <= Date.now()) break;
        for (const delta of (current.chunks || []).slice(sent)) emit({ id: `chatcmpl_${job.id.slice(4)}`, object: 'chat.completion.chunk', created: Math.floor(job.createdAt / 1000), model: job.model, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }] });
        sent = (current.chunks || []).length;
        if (current.status === 'complete') {
          emit({ id: `chatcmpl_${job.id.slice(4)}`, object: 'chat.completion.chunk', created: Math.floor(job.createdAt / 1000), model: job.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: current.usage || tokenUsage({}) });
          emit('[DONE]');
          controller.close();
          return;
        }
        if (current.status === 'failed' || current.status === 'cancelled') { emit({ error: { message: current.error || 'job cancelled', type: 'server_error', code: null } }); emit('[DONE]'); controller.close(); return; }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (stopped) return;
      emit({ error: { message: 'request timed out', type: 'server_error', code: null } });
      emit('[DONE]');
      controller.close();
    }, async cancel() {
      stopped = true;
      const current = await storage.get(key);
      if (current) await cancelJob(storage, key, current);
    } }), { headers: { ...SECURITY, ...cors(origin, Boolean(origin)), 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', ...extra } });
  }

  async fetch(request, allowedOrigin) {
    const path = new URL(request.url).pathname, now = Date.now(), credentials = Boolean(allowedOrigin);
    if ((path === '/compute/api' || path === '/compute/api/' || path === '/compute/api/status' || path === '/compute/api/status/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const res = json({ live: Boolean(this.env.AI), model: 'gpt-oss-20b', login_required: true, limit: '3 free / 10 min · then credits', usage: 'v1 chat/completions + Hosted /compute/api/chat SSE: OpenAI-style usage on final stop chunk (see /compute/api/v1)' }, 200, allowedOrigin || '*', credentials);
      return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
    }
    if ((path === '/compute/api/healthz' || path === '/compute/api/healthz/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return maybeHead(request, json({ ok: true, service: 'dasha-compute', version: '0.3.0' }, 200, allowedOrigin || '*', credentials));
    }
    if ((path === '/compute/api/night' || path === '/compute/api/night/') && (request.method === 'GET' || request.method === 'HEAD' || request.method === 'POST')) {
      if (!allowedOrigin) return maybeHead(request, json({ error: 'origin required' }, 403));
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
      if (!allowedOrigin) return maybeHead(request, json({ error: 'origin required' }, 403));
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, true));
      const tasks = [...(await this.state.storage.list({ prefix: 'compute:night:' })).values()].filter(task => task.owner === owner);
      const artifacts = tasks.flatMap(task => (task.artifacts || []).map(artifact => ({ task_id: task.id, title: task.title, ...artifact }))).sort((a, b) => b.completed_at - a.completed_at).slice(0, 20);
      return maybeHead(request, json({ generated_at: now, artifacts }, 200, allowedOrigin, true));
    }

    const nightRunMatch = path.match(/^\/compute\/api\/night\/(night_[A-Za-z0-9_-]{12})\/run$/);
    if (nightRunMatch && request.method === 'POST') {
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
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
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
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
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
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
      if (!allowedOrigin) return maybeHead(request, json({ error: 'origin required' }, 403));
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
      return json({
        id, name, api_key: token,
        limit_cents: limitCents, limit_reset: limitReset, spend_cents: 0,
        limit_remaining_cents: limitCents == null ? null : limitCents,
        note: 'Copy this key now. Dasha stores only its hash.',
      }, 201, allowedOrigin, true);
    }

    const keyMatch = path.match(/^\/compute\/api\/keys\/(key_[A-Za-z0-9_-]{12})$/);
    if (keyMatch && request.method === 'DELETE') {
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
      const owner = identity(await authSessionFromRequest(this.env, request)), key = await this.state.storage.get(`compute:api-key:${keyMatch[1]}`);
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!key || key.owner !== owner) return json({ error: 'API key not found' }, 404, allowedOrigin, true);
      await this.state.storage.delete(`compute:api-key:${key.id}`);
      return json({ ok: true }, 200, allowedOrigin, true);
    }

    if ((path === '/compute/api/v1/models' || path === '/compute/api/v1/models/') && (request.method === 'GET' || request.method === 'HEAD')) {
      if (!await this.apiKey(request)) return maybeHead(request, openaiError('invalid API key', 401, 'authentication_error'));
      await this.prune(now);
      const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
      const models = [...new Set(providers.flatMap(provider => provider.models || []))];
      return maybeHead(request, json({ object: 'list', data: models.map(id => ({ id, object: 'model', created: 0, owned_by: 'dasha-community' })) }));
    }

    const modelRetrieve = path.match(/^\/compute\/api\/v1\/models\/([A-Za-z0-9._-]+)\/?$/);
    if (modelRetrieve && (request.method === 'GET' || request.method === 'HEAD')) {
      if (!await this.apiKey(request)) return maybeHead(request, openaiError('invalid API key', 401, 'authentication_error'));
      await this.prune(now);
      const id = modelRetrieve[1];
      const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
      const models = [...new Set(providers.flatMap(provider => provider.models || []))];
      if (!models.includes(id)) return maybeHead(request, openaiError(`The model '${id}' does not exist`, 404, 'invalid_request_error'));
      return maybeHead(request, json({ id, object: 'model', created: 0, owned_by: 'dasha-community' }));
    }

    if ((path === '/compute/api/v1/embeddings' || path === '/compute/api/v1/embeddings/') && request.method === 'POST') {
      if (!await this.apiKey(request)) return openaiError('invalid API key', 401, 'authentication_error');
      return openaiError('embeddings are not supported; use POST /v1/chat/completions', 400, 'invalid_request_error');
    }

    if ((path === '/compute/api/v1/embeddings' || path === '/compute/api/v1/embeddings/') && request.method !== 'OPTIONS') {
      if (!await this.apiKey(request)) return maybeHead(request, openaiError('invalid API key', 401, 'authentication_error'));
      return maybeHead(request, openaiError('Only POST is supported. Use POST /v1/embeddings', 405, 'invalid_request_error'));
    }

    if ((path === '/compute/api/v1/completions' || path === '/compute/api/v1/completions/') && request.method === 'POST') {
      if (!await this.apiKey(request)) return openaiError('invalid API key', 401, 'authentication_error');
      return openaiError('legacy completions are not supported; use POST /v1/chat/completions', 400, 'invalid_request_error');
    }

    if ((path === '/compute/api/v1/completions' || path === '/compute/api/v1/completions/') && request.method !== 'OPTIONS') {
      if (!await this.apiKey(request)) return maybeHead(request, openaiError('invalid API key', 401, 'authentication_error'));
      return maybeHead(request, openaiError('Only POST is supported. Use POST /v1/completions', 405, 'invalid_request_error'));
    }

    if ((path === '/compute/api/v1/responses' || path === '/compute/api/v1/responses/') && request.method === 'POST') {
      if (!await this.apiKey(request)) return openaiError('invalid API key', 401, 'authentication_error');
      return openaiError('responses are not supported; use POST /v1/chat/completions', 400, 'invalid_request_error');
    }

    if ((path === '/compute/api/v1/responses' || path === '/compute/api/v1/responses/') && request.method !== 'OPTIONS') {
      if (!await this.apiKey(request)) return maybeHead(request, openaiError('invalid API key', 401, 'authentication_error'));
      return maybeHead(request, openaiError('Only POST is supported. Use POST /v1/responses', 405, 'invalid_request_error'));
    }

    if ((path === '/compute/api/v1/chat/completions' || path === '/compute/api/v1/chat/completions/') && request.method === 'POST') {
      const key = await this.apiKey(request);
      if (!key) return openaiError('invalid API key', 401, 'authentication_error');
      // v1: flat HOSTED_ASK_PRICE_CENTS per successful API chat queue (community/mixture). Self-route free (own Mac). Hard key cap.
      const input = mergeRouteFromHeaders(await body(request, 12 * 1024), request);
      await this.prune(now);
      const providersPeek = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()];
      const peek = resolveJobRoute(key.owner, input, providersPeek, now);
      if (peek.route !== 'self') {
        const gate = await this.chargeApiKeySpend(key, HOSTED_ASK_PRICE_CENTS, now, { checkOnly: true });
        if (!gate.ok) return openaiError(gate.error || 'key spend limit reached', gate.status || 402, 'invalid_request_error');
      }
      const queued = await this.queueJob(key.owner, input, now);
      if (queued.error) return openaiError(queued.error, queued.status, queued.status >= 500 ? 'server_error' : 'invalid_request_error');
      if (queued.job.route !== 'self') {
        const spend = await this.chargeApiKeySpend(key, HOSTED_ASK_PRICE_CENTS, now);
        if (!spend.ok) {
          await this.state.storage.delete(`compute:job:${queued.job.id}`);
          return openaiError(spend.error || 'key spend limit reached', spend.status || 402, 'invalid_request_error');
        }
      }
      if (input.stream) return this.streamResponse(queued.job);
      while (!request.signal.aborted) {
        const job = await this.state.storage.get(`compute:job:${queued.job.id}`);
        if (!job) return openaiError('job expired', 410, 'server_error');
        if (Number(job.expiresAt) <= Date.now()) break;
        if (job.status === 'complete') return json({ id: `chatcmpl_${job.id.slice(4)}`, object: 'chat.completion', created: Math.floor(job.createdAt / 1000), model: job.model, choices: [{ index: 0, message: { role: 'assistant', content: job.answer }, finish_reason: 'stop' }], usage: job.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } });
        if (job.status === 'failed') return openaiError(job.error || 'provider failed', 502, 'server_error');
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      await this.state.storage.delete(`compute:job:${queued.job.id}`);
      return openaiError(request.signal.aborted ? 'request cancelled' : 'request timed out', request.signal.aborted ? 499 : 504, 'server_error');
    }

    if ((path === '/compute/api/v1/chat/completions' || path === '/compute/api/v1/chat/completions/') && request.method !== 'OPTIONS') {
      if (!await this.apiKey(request)) return openaiError('invalid API key', 401, 'authentication_error');
      return openaiError('Only POST is supported. Use POST /v1/chat/completions', 405, 'invalid_request_error');
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
      return json({ ok: true }, 202, allowedOrigin, credentials);
    }

    if ((path === '/compute/api/network' || path === '/compute/api/network/' || path === '/compute/api/v1/network' || path === '/compute/api/v1/network/') && (request.method === 'GET' || request.method === 'HEAD')) {
      await this.prune(now);
      const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => now - Number(provider.lastSeenAt || 0) < FRESH_MS);
      const jobs = [...(await this.state.storage.list({ prefix: 'compute:job:' })).values()];
      const models = [...new Set(providers.flatMap(provider => provider.models || []))];
      const capacity = models.map(model => {
        const serving = providers.filter(provider => provider.models?.includes(model)), measured = serving.map(provider => provider.hardware?.benchmarks?.find(row => row.model === model)?.tokens_per_second).filter(Number.isFinite);
        return { model, providers: serving.length, measured_providers: measured.length, tokens_per_second: Math.round(measured.reduce((sum, value) => sum + value, 0) * 100) / 100 };
      });
      return maybeHead(request, json({ providers_online: providers.length, models_available: models, capacity, jobs_queued: jobs.filter(job => job.status === 'queued').length }, 200, allowedOrigin || '*', credentials));
    }

    if ((path === '/compute/api/providers' || path === '/compute/api/providers/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, credentials));
      const providers = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(provider => provider.owner === owner).map(provider => ({ id: provider.id, name: provider.name, models: provider.models || [], allowed_models: provider.allowedModels || provider.models || [], hardware: provider.hardware || null, created_at: provider.createdAt, last_seen_at: provider.lastSeenAt || null, online: now - Number(provider.lastSeenAt || 0) < FRESH_MS }));
      return maybeHead(request, json({ providers }, 200, allowedOrigin, credentials));
    }

    if (path === '/compute/api/providers/register' || path === '/compute/api/providers/register/') {
      if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, credentials));
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!takeRate(this.rates, `register:${owner}`, 3)) return json({ error: 'provider registration rate limited' }, 429, allowedOrigin, true);
      const input = await body(request), models = [...new Set((Array.isArray(input.models) ? input.models : []).map(String).filter(model => MODELS.has(model)))];
      if (!models.length) return json({ error: 'choose at least one supported model' }, 400, allowedOrigin, true);
      const providerId = `mac_${randomUrlToken(9)}`, token = `dcp_${randomUrlToken(24)}`, name = String(input.name || '').trim().slice(0, 64) || 'My Mac';
      await this.state.storage.put(`compute:provider:${providerId}`, { id: providerId, owner, name, allowedModels: models, models: [], tokenHash: await sha256(token), createdAt: now, lastSeenAt: 0 });
      return json({ provider_id: providerId, provider_token: token, coordinator_url: 'https://lobby.getdasha.com/compute/api', models, note: 'Copy this token now. Dasha stores only its hash.' }, 201, allowedOrigin, true);
    }

    const providerMatch = path.match(/^\/compute\/api\/providers\/([A-Za-z0-9_-]{6,64})$/);
    if (providerMatch && request.method === 'DELETE') {
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
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
      provider.lastSeenAt = now;
      provider.allowedModels ||= provider.models || [];
      if (Array.isArray(input.models)) provider.models = [...new Set(input.models.map(String).filter(model => provider.allowedModels.includes(model)))];
      else provider.models ||= [];
      const hardware = providerHardware(input, provider.allowedModels);
      if (hardware) provider.hardware = hardware;
      provider.name = String(input.name || '').trim().slice(0, 64) || provider.name;
      await this.state.storage.put(`compute:provider:${provider.id}`, provider);
      await this.prune(now);
      const jobs = [...(await this.state.storage.list({ prefix: 'compute:job:' })).values()].sort((a, b) => a.createdAt - b.createdAt);
      const job = jobs.find(candidate => candidate.status === 'queued' && provider.models.includes(candidate.model) && (candidate.route !== 'self' || provider.owner === candidate.owner));
      if (!job) return new Response(null, { status: 204, headers: SECURITY });
      job.status = 'leased'; job.providerId = provider.id; job.leaseExpiresAt = now + LEASE_MS; job.expiresAt = now + LEASE_MS + 60_000;
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
      await this.state.storage.put(key, { ...job, status: error ? 'failed' : 'complete', answer: error ? null : answer, error: error || null, usage, messages: null, completedAt: now, expiresAt: now + 10 * 60_000 });
      await this.finishNight(job, error ? 'failed' : 'complete', error ? null : answer, error || null, now);
      await this.recordFactoryOutcome({ engine: job.route === 'mixture' ? 'mixture' : 'community', model: job.model, failed: Boolean(error) });
      if (!error && job.route !== 'self') await accrueProviderEarn(this.state.storage, { providerId: provider.id, jobId: job.id, usage, now });
      return json({ accepted: true }, 202);
    }

    const chunkMatch = path.match(/^\/compute\/api\/providers\/jobs\/([A-Za-z0-9_-]{6,64})\/chunk$/);
    if (chunkMatch && request.method === 'POST') {
      const input = await body(request, 8192), provider = await this.provider(request, input), key = `compute:job:${chunkMatch[1]}`, job = await this.state.storage.get(key);
      if (!provider) return json({ error: 'invalid provider token' }, 401);
      if (!job || job.status !== 'leased' || !job.stream || job.providerId !== provider.id || Number(job.leaseExpiresAt) <= now) return json({ error: 'job unavailable or lease expired' }, 409);
      const error = String(input.error || '').trim().slice(0, 300), delta = String(input.delta || '');
      if (delta && ((job.chunks || []).join('').length + delta.length > 20_000)) return json({ error: 'stream result exceeds 20000 characters' }, 400);
      provider.lastSeenAt = now;
      await this.state.storage.put(`compute:provider:${provider.id}`, provider);
      const chunks = delta ? [...(job.chunks || []), delta] : job.chunks || [];
      const usage = input.done ? tokenUsage(input) : job.usage;
      await this.state.storage.put(key, { ...job, chunks, status: error ? 'failed' : input.done ? 'complete' : 'leased', error: error || null, usage, messages: error || input.done ? null : job.messages, completedAt: error || input.done ? now : null, leaseExpiresAt: now + LEASE_MS, expiresAt: error || input.done ? now + 10 * 60_000 : now + LEASE_MS + 60_000 });
      if (error || input.done) {
        await this.finishNight(job, error ? 'failed' : 'complete', error ? null : chunks.join(''), error || null, now);
        await this.recordFactoryOutcome({ engine: job.route === 'mixture' ? 'mixture' : 'community', model: job.model, failed: Boolean(error) });
        if (!error && input.done && job.route !== 'self') await accrueProviderEarn(this.state.storage, { providerId: provider.id, jobId: job.id, usage, now });
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
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      const queued = await this.queueJob(owner, mergeRouteFromHeaders(await body(request, 12 * 1024), request), now);
      if (queued.error) return json({ error: queued.error }, queued.status, allowedOrigin, true);
      const job = queued.job;
      if (job.stream === true) return this.streamResponse(job, allowedOrigin, { 'X-Dasha-Job': job.id, 'Access-Control-Expose-Headers': 'X-Dasha-Job' });
      return json({ id: job.id, status: job.status, expires_at: job.expiresAt }, 202, allowedOrigin, true);
    }

    const jobMatch = path.match(/^\/compute\/api\/jobs\/([A-Za-z0-9_-]{6,64})\/?$/);
    if (jobMatch && (request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE')) {
      const owner = identity(await authSessionFromRequest(this.env, request)), key = `compute:job:${jobMatch[1]}`, job = await this.state.storage.get(key);
      if (!owner) return maybeHead(request, json({ error: 'login required' }, 401, allowedOrigin, credentials));
      if (!job || job.owner !== owner) return maybeHead(request, json({ error: 'job not found' }, 404, allowedOrigin, credentials));
      if (request.method === 'DELETE') {
        if (!allowedOrigin) return json({ error: 'origin required' }, 403);
        await cancelJob(this.state.storage, key, job, now);
        return json({ ok: true, prompt_deleted: true }, 200, allowedOrigin, true);
      }
      if (job.status === 'cancelled') return maybeHead(request, json({ error: 'job not found' }, 404, allowedOrigin, credentials));
      if (Number(job.expiresAt) <= now) { await this.state.storage.delete(key); return maybeHead(request, json({ error: 'job expired' }, 410, allowedOrigin, credentials)); }
      const queued = job.status === 'queued' ? [...(await this.state.storage.list({ prefix: 'compute:job:' })).values()].filter(candidate => candidate.status === 'queued' && candidate.model === job.model).sort((a, b) => a.createdAt - b.createdAt) : [];
      const queuePosition = queued.findIndex(candidate => candidate.id === job.id) + 1;
      return maybeHead(request, json({ id: job.id, status: job.status, model: job.model, answer: (job.chunks || []).join('') || job.answer || null, error: job.error || null, provider: job.providerId || null, queue_position: queuePosition || null, expires_at: job.expiresAt }, 200, allowedOrigin, credentials));
    }

    if ((path === '/compute/api/sponsors' || path === '/compute/api/sponsors/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const pledges = [...(await this.state.storage.list({ prefix: 'compute:sponsor:' })).values()];
      const tipRows = [...(await this.state.storage.list({ prefix: 'compute:sponsor-pledge:' })).values()];
      return maybeHead(request, json(sponsorBoard(pledges, tipRows), 200, allowedOrigin || '*', credentials));
    }
    if ((path === '/compute/api/sponsors' || path === '/compute/api/sponsors/') && request.method === 'POST') {
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
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
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
      const session = await authSessionFromRequest(this.env, request);
      const actor = sponsorActor(session);
      if (!actor) return json({ error: 'login required' }, 401, allowedOrigin, true);
      if (!takeRate(this.rates, `sponsor-order:${actor.owner}`, 8)) return json({ error: 'rate limited' }, 429, allowedOrigin, true);
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
      const name = String(input.name || '').trim().slice(0, 40) || actor.fallback;
      const order = {
        id,
        kind: 'sponsor',
        owner: actor.owner,
        handle: actor.handle,
        name,
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
        expires_at: order.expiresAt,
      }, 201, allowedOrigin, true);
    }

    const sponsorOrderMatch = path.match(/^\/compute\/api\/sponsors\/orders\/([A-Za-z0-9_-]+)\/?(confirm)?\/?$/);
    if (sponsorOrderMatch) {
      const orderId = sponsorOrderMatch[1];
      const isConfirm = sponsorOrderMatch[2] === 'confirm' || path.endsWith('/confirm') || path.endsWith('/confirm/');
      const session = await authSessionFromRequest(this.env, request);
      const actor = sponsorActor(session);
      if (!actor) return json({ error: 'login required' }, 401, allowedOrigin, true);
      const key = `compute:sponsor-order:${orderId}`;
      let order = await this.state.storage.get(key);
      if (!order || order.owner !== actor.owner) return maybeHead(request, json({ error: 'order not found' }, 404, allowedOrigin, true));

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
        expires_at: order.expiresAt,
      }, 200, allowedOrigin, true));
    }

    // --- provider earnings + payout preference (pending settle; no auto-chain) ---
    if ((path === '/compute/api/provider/earnings' || path === '/compute/api/provider/earnings/') && (request.method === 'GET' || request.method === 'HEAD')) {
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return maybeHead(request, json({ error: 'login required', ...earningsCatalog(), payout_mode: PROVIDER_PAYOUT_MODE }, 401, allowedOrigin, true));
      const mine = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(p => p && p.owner === owner);
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
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
      const owner = identity(await authSessionFromRequest(this.env, request));
      if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
      const mine = [...(await this.state.storage.list({ prefix: 'compute:provider:' })).values()].filter(p => p && p.owner === owner);
      if (!mine.length) return json({ error: 'register a Mac first' }, 400, allowedOrigin, true);
      const input = await body(request);
      const norm = normalizePayoutPref(input);
      if (!norm.ok) return json({ error: norm.error }, 400, allowedOrigin, true);
      const row = { method: norm.method, wallet: norm.wallet, updatedAt: now };
      await this.state.storage.put(`compute:provider-payout-pref:${owner}`, row);
      return json({ method: row.method, wallet: row.wallet, updated_at: row.updatedAt, payout_mode: PROVIDER_PAYOUT_MODE }, 200, allowedOrigin, true);
    }

    if ((path === '/compute/api/provider/payout' || path === '/compute/api/provider/payout/') && request.method === 'POST') {
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
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
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
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
      if (!allowedOrigin) return json({ error: 'origin required' }, 403);
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
        const result = await this.settleCreditOrder(order, { signature: input.signature, now: Date.now() });
        if (result.error && result.status) return json({ error: result.error, status: order.status, balance_cents: result.balance_cents }, result.status, allowedOrigin, true);
        return json(result.body, 200, allowedOrigin, true);
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, true));
      const now = Date.now();
      if (order.status === 'pending' && Number(order.expiresAt) <= now) {
        order = { ...order, status: 'expired' };
        await this.state.storage.put(key, order);
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
      if (!existing) {
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
      } else if (existing.status !== 'funded') {
        await this.state.storage.put(macKey, { ...existing, status: 'funded', cents: Math.floor(Number(existing.cents) || 0) + cents });
      } else {
        await this.state.storage.put(macKey, { ...existing, cents: Math.floor(Number(existing.cents) || 0) + cents });
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


async function bumpHostedFactory(env, { failed = false } = {}) {
  try {
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    if (!stub) return;
    await stub.fetch(new Request('https://lobby.getdasha.com/compute/api/factory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'hosted-chat', failed: failed === true }),
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
  const path = new URL(request.url).pathname, credentials = Boolean(allowedOrigin);
  if ((path === '/compute/api' || path === '/compute/api/' || path === '/compute/api/status' || path === '/compute/api/status/') && (request.method === 'GET' || request.method === 'HEAD')) {
    const res = json({ live: Boolean(env.AI), model: 'gpt-oss-20b', login_required: true, limit: '3 free / 10 min · then credits', usage: 'v1 chat/completions + Hosted /compute/api/chat SSE: OpenAI-style usage on final stop chunk (see /compute/api/v1)' }, 200, allowedOrigin || '*', credentials);
    return request.method === 'HEAD' ? new Response(null, { status: res.status, headers: res.headers }) : res;
  }
  if ((path === '/compute/api/healthz' || path === '/compute/api/healthz/') && (request.method === 'GET' || request.method === 'HEAD')) {
    return maybeHead(request, json({ ok: true, service: 'dasha-compute', version: '0.3.0' }, 200, allowedOrigin || '*', credentials));
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
      note: 'counters only; prompts not included',
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
  if (path === '/compute/api/factory' || path === '/compute/api/factory/' || path === '/compute/api/network' || path === '/compute/api/network/' || path.startsWith('/compute/api/sponsors') || path.startsWith('/compute/api/providers/') || path === '/compute/api/providers' || path.startsWith('/compute/api/keys') || path.startsWith('/compute/api/night') || path.startsWith('/compute/api/credits') || path.startsWith('/compute/api/provider/') || path === '/compute/api/v1' || path === '/compute/api/v1/' || path.startsWith('/compute/api/v1/') || path === '/compute/api/jobs' || path === '/compute/api/jobs/' || /^\/compute\/api\/jobs\/[A-Za-z0-9_-]+\/?$/.test(path)) {
    const stub = env?.LOBBY?.get(env.LOBBY.idFromName('public'));
    return stub ? stub.fetch(request) : json({ error: 'community network unavailable' }, 503, allowedOrigin, credentials);
  }
  if (path !== '/compute/api/chat' && path !== '/compute/api/chat/') return json({ error: 'not found' }, 404, allowedOrigin, credentials);
  if (request.method !== 'POST') return maybeHead(request, json({ error: 'method not allowed' }, 405, allowedOrigin, credentials));
  if (!allowedOrigin) return json({ error: 'origin required' }, 403);
  if (!env.AI) return json({ error: 'hosted demo unavailable' }, 503, allowedOrigin, true);
  const session = await authSessionFromRequest(env, request), owner = identity(session);
  if (!owner) return json({ error: 'login required' }, 401, allowedOrigin, true);
  const input = await body(request, 12 * 1024), messages = chatMessages(input);
  if (!messages) return json({ error: 'send 1–12 user/assistant messages, max 2,000 characters each and 6,000 total' }, 400, allowedOrigin, true);
  let creditBalanceHeader = null;
  if (!takeRate(hostedRates, owner, 3, 10 * 60_000)) {
    // Free floor exhausted → prepaid credits extend Hosted Ask (fail closed if insufficient).
    const spendId = `hosted_${randomUrlToken(12)}`;
    const spent = await spendHostedAskCredits(env, request, { requestId: spendId });
    if (!spent.ok) {
      return json({
        error: spent.error || 'top up credits',
        balance_cents: spent.balance_cents ?? 0,
        price_cents: HOSTED_ASK_PRICE_CENTS,
      }, spent.status || 402, allowedOrigin, true);
    }
    creditBalanceHeader = String(spent.balance_cents);
  }
  const system = { role: 'system', content: 'Answer directly and concisely. Do not claim to be running on a community Mac; this hosted demo uses Cloudflare Workers AI.' };
  try {
    if (input.stream === true) {
      const run = await env.AI.run('@cf/openai/gpt-oss-20b', { stream: true, messages: [system, ...messages], max_tokens: 256, temperature: 0.6 });
      const encoder = new TextEncoder();
      const headers = { ...SECURITY, ...cors(allowedOrigin, true), 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Dasha-Model': 'gpt-oss-20b', ...(creditBalanceHeader != null ? { 'X-Dasha-Balance-Cents': creditBalanceHeader } : {}) };
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
        // OpenAI-style usage on final stop chunk (parity with /v1/chat/completions SSE).
        if (!failed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: hostedUsage() })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        bumpHostedFactory(env, { failed: Boolean(failed) });
      };
      const emitError = (controller, message) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: { message } })}\n\n`));
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
    const result = await env.AI.run('@cf/openai/gpt-oss-20b', { messages: [system, ...messages], max_tokens: 256, temperature: 0.6 });
    const answer = String(result?.response || result?.result?.response || result?.choices?.[0]?.message?.content || '').trim();
    if (!answer) throw new Error('empty model response');
    await bumpHostedFactory(env, { failed: false });
    return json({ answer, model: 'gpt-oss-20b', provider: 'Cloudflare Workers AI', stored: false, ...(creditBalanceHeader != null ? { balance_cents: Number(creditBalanceHeader) } : {}) }, 200, allowedOrigin, true, { 'X-Dasha-Model': 'gpt-oss-20b', ...(creditBalanceHeader != null ? { 'X-Dasha-Balance-Cents': creditBalanceHeader } : {}) });
  } catch {
    await bumpHostedFactory(env, { failed: true });
    return json({ error: 'model request failed; try again' }, 502, allowedOrigin, true);
  }
}
