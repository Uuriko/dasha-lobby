/**
 * dasha-compute-finetune-data.mjs — Phase 4/5/6 server-side fine-tuning support.
 *
 * Pure functions (no Durable Object access): safe to import from the worker
 * and from node tests. The worker wires these into HTTP endpoints in
 * dasha-compute-network.mjs.
 *
 *   Phase 4 — dataset pipeline: room sessions JSONL → train/valid JSONL +
 *             dataset_manifest.json. Deterministic given seed.
 *   Phase 5 — evaluation gate: base-vs-adapter verdict with the authority
 *             order task A/B > retention > perplexity (guardrail) > judge
 *             (advisory). Never claims "improved" from perplexity alone.
 *   Phase 6 — adapter registry: record shape, access control, and the
 *             engine serving seam (PEFT canonical → mlx conversion marker).
 *
 * Trust model: the coordinator is trusted; provider datasets are visible in
 * the clear to the provider that trains them (disclosed in the privacy
 * tiers). This module never executes user code — params only.
 */

export class DatasetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatasetError';
  }
}

/* ------------------------------------------------------------------ */
/* Small deterministic primitives                                       */
/* ------------------------------------------------------------------ */

/** mulberry32 — deterministic seeded RNG for shuffle/sampling. */
export function seededRng(seed) {
  let a = (Number(seed) | 0) >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 64-bit hex. Change-detection hashing only — NOT a security pin
 *  (spec_hash stays sha256). Sync so the pipeline stays pure. */
export function fnv1a64Hex(text) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

/** 64-bit simhash over char trigrams (FNV-1a per feature). */
export function simhash64(text) {
  const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const vec = new Array(64).fill(0);
  const mask = 0xffffffffffffffffn;
  const prime = 0x100000001b3n;
  for (let i = 0; i + 3 <= norm.length; i++) {
    const tri = norm.slice(i, i + 3);
    let h = 0xcbf29ce484222325n;
    for (let j = 0; j < tri.length; j++) { h ^= BigInt(tri.charCodeAt(j)); h = (h * prime) & mask; }
    for (let b = 0; b < 64; b++) vec[b] += (h & (1n << BigInt(b))) ? 1 : -1;
  }
  let out = 0n;
  for (let b = 0; b < 64; b++) if (vec[b] > 0) out |= (1n << BigInt(b));
  return out;
}

export function hammingDistance64(a, b) {
  let x = a ^ b, n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

export function mintDatasetRef(randomBytes) {
  const bytes = randomBytes || crypto.getRandomValues(new Uint8Array(9));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let s = '';
  for (const byte of bytes) s += alphabet[byte % 64];
  return `ds_${s}`;
}

/* ------------------------------------------------------------------ */
/* Phase 4 — dataset pipeline                                           */
/* ------------------------------------------------------------------ */

export const DATASET_LIMITS = {
  maxInputBytes: 50 * 1024 * 1024,
  maxSessions: 100_000,
  maxExamples: 200_000,
  maxCharsPerExample: 200_000,
  minCharsPerExample: 40,
  timeoutMs: 30_000,
};

const DATASET_PARAM_DEFAULTS = {
  seed: 0,
  eval_split: 0.1,
  replay_mix_ratio: 0.2,
  max_examples: 50_000,
  pii_scrub: true,
  timeout_ms: DATASET_LIMITS.timeoutMs,
};

export function validateDatasetParams(params) {
  const src = params && typeof params === 'object' ? params : {};
  const bad = (field, error) => { throw new DatasetError(`${field}: ${error}`); };
  const seed = Number(src.seed ?? DATASET_PARAM_DEFAULTS.seed);
  if (!Number.isInteger(seed) || Math.abs(seed) > 2147483647) bad('seed', 'must be an integer');
  const eval_split = Number(src.eval_split ?? DATASET_PARAM_DEFAULTS.eval_split);
  if (!Number.isFinite(eval_split) || eval_split < 0.05 || eval_split > 0.2) bad('eval_split', 'must be 0.05..0.2');
  const replay_mix_ratio = Number(src.replay_mix_ratio ?? DATASET_PARAM_DEFAULTS.replay_mix_ratio);
  if (!Number.isFinite(replay_mix_ratio) || replay_mix_ratio < 0 || replay_mix_ratio > 0.5) bad('replay_mix_ratio', 'must be 0..0.5');
  const max_examples = Number(src.max_examples ?? DATASET_PARAM_DEFAULTS.max_examples);
  if (!Number.isInteger(max_examples) || max_examples < 10 || max_examples > DATASET_LIMITS.maxExamples) bad('max_examples', `must be an integer 10..${DATASET_LIMITS.maxExamples}`);
  const timeout_ms = Number(src.timeout_ms ?? DATASET_PARAM_DEFAULTS.timeout_ms);
  if (!Number.isInteger(timeout_ms) || timeout_ms < 1000 || timeout_ms > 120_000) bad('timeout_ms', 'must be an integer 1000..120000');
  return { seed, eval_split, replay_mix_ratio, max_examples, pii_scrub: src.pii_scrub !== false, timeout_ms };
}

/** Parse sessions JSONL. One session per line:
 *  {"session_id":"s1","messages":[{"role":"user|assistant|system","content":"..."}]}
 *  Malformed lines are counted and dropped, never fatal. */
export function parseSessions(jsonl) {
  const sessions = [];
  let dropped = 0;
  for (const line of String(jsonl || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj = null;
    try { obj = JSON.parse(trimmed); } catch { dropped++; continue; }
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.messages)) { dropped++; continue; }
    const session_id = String(obj.session_id || '').slice(0, 128) || `anon_${sessions.length}`;
    const messages = [];
    let ok = true;
    for (const m of obj.messages) {
      if (!m || typeof m !== 'object') { ok = false; break; }
      const role = String(m.role || '');
      if (!['user', 'assistant', 'system'].includes(role)) { ok = false; break; }
      messages.push({ role, content: String(m.content ?? '') });
    }
    if (!ok || messages.length === 0) { dropped++; continue; }
    sessions.push({ session_id, messages });
  }
  return { sessions, dropped };
}

/** Quality filter: needs a user turn and an assistant turn, sane length,
 *  and a language-sanity heuristic (unicode-aware word tokens). */
export function qualityFilter(sessions, deadline) {
  const kept = [];
  let dropped = 0;
  for (const s of sessions) {
    if (deadline && Date.now() > deadline) throw new DatasetError('timeout: quality filtering exceeded the time budget');
    const hasUser = s.messages.some((m) => m.role === 'user' && m.content.trim());
    const hasAssistant = s.messages.some((m) => m.role === 'assistant' && m.content.trim());
    const chars = s.messages.reduce((n, m) => n + m.content.length, 0);
    const words = s.messages.flatMap((m) => m.content.match(/\p{L}[\p{L}\p{N}'-]*/gu) || []);
    const avgWordLen = words.length ? words.join('').length / words.length : 99;
    if (!hasUser || !hasAssistant) { dropped++; continue; }
    if (chars < DATASET_LIMITS.minCharsPerExample || chars > DATASET_LIMITS.maxCharsPerExample) { dropped++; continue; }
    if (words.length < 5 || avgWordLen > 30) { dropped++; continue; }
    kept.push(s);
  }
  return { kept, dropped };
}

const exampleText = (ex) => ex.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
const normalizeText = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();

/** Exact (normalized-hash) + near (simhash, hamming ≤ 3) dedup. */
export function dedupeExamples(examples, deadline) {
  const seenExact = new Set();
  const seenSim = [];
  const kept = [];
  let exact = 0, near = 0;
  for (const ex of examples) {
    if (deadline && Date.now() > deadline) throw new DatasetError('timeout: dedup exceeded the time budget');
    const text = exampleText(ex);
    const key = fnv1a64Hex(normalizeText(text));
    if (seenExact.has(key)) { exact++; continue; }
    const sig = simhash64(text);
    let isNear = false;
    for (const prev of seenSim) {
      if (hammingDistance64(sig, prev) <= 3) { isNear = true; break; }
    }
    if (isNear) { near++; continue; }
    seenExact.add(key);
    seenSim.push(sig);
    kept.push(ex);
  }
  return { kept, exact, near };
}

/* PII scrub — regex + label pass, default ON. Documented seam: swap
 * `scrubPiiText` for Presidio (or another NER service) in production;
 * the signature ({text, redactions}) stays the same. */
const PII_PATTERNS = [
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]'],
  ['phone', /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[REDACTED_PHONE]'],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]'],
  ['card', /\b(?:\d[ -]?){13,19}\b/g, '[REDACTED_CARD]'],
  ['ipv4', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]'],
];

export function scrubPiiText(text) {
  let out = String(text);
  const redactions = {};
  for (const [label, re, replacement] of PII_PATTERNS) {
    // Avoid card-pattern false positives on short digit runs already handled.
    const matches = out.match(re);
    if (matches) {
      // card pattern: keep only runs with ≥13 digits once separators removed
      const kept = label === 'card'
        ? matches.filter((m) => m.replace(/\D/g, '').length >= 13)
        : matches;
      if (kept.length) {
        redactions[label] = (redactions[label] || 0) + kept.length;
        for (const m of kept) out = out.split(m).join(replacement);
      }
    }
  }
  return { text: out, redactions };
}

export function scrubPiiExamples(examples, deadline) {
  const redactions = {};
  const scrubbed = examples.map((ex) => {
    if (deadline && Date.now() > deadline) throw new DatasetError('timeout: PII scrub exceeded the time budget');
    const messages = ex.messages.map((m) => {
      const r = scrubPiiText(m.content);
      for (const [k, v] of Object.entries(r.redactions)) redactions[k] = (redactions[k] || 0) + v;
      return { role: m.role, content: r.text };
    });
    return { ...ex, messages };
  });
  return { scrubbed, redactions };
}

/** Session-level split: whole sessions go to train or valid, never both.
 *  Deterministic under seed. */
export function splitSessions(examples, evalSplit, seed, deadline) {
  const bySession = new Map();
  for (const ex of examples) {
    const id = ex.session_id || 'anon';
    if (!bySession.has(id)) bySession.set(id, []);
    bySession.get(id).push(ex);
  }
  const ids = [...bySession.keys()];
  const rng = seededRng(seed);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const validCount = Math.max(1, Math.round(ids.length * evalSplit));
  const validIds = new Set(ids.slice(0, validCount));
  const train = [], valid = [];
  for (const ex of examples) {
    if (deadline && Date.now() > deadline) throw new DatasetError('timeout: split exceeded the time budget');
    (validIds.has(ex.session_id || 'anon') ? valid : train).push(ex);
  }
  return { train, valid, validSessions: validIds.size, trainSessions: ids.length - validIds.size };
}

/** Built-in generic replay pool (v1 placeholder — operators can swap this
 *  for a real general-instruction corpus). Blended into train at the
 *  requested ratio so fine-tuning doesn't nuke general ability. */
export const REPLAY_POOL = [
  { role: 'user', content: 'Explain what a haiku is.' },
  { role: 'assistant', content: 'A haiku is a short Japanese poem with three lines of 5, 7, and 5 syllables, often about nature or a fleeting moment.' },
  { role: 'user', content: 'What is 12 times 12?' },
  { role: 'assistant', content: '144.' },
  { role: 'user', content: 'Summarize the water cycle in one sentence.' },
  { role: 'assistant', content: 'Water evaporates from surfaces, condenses into clouds, and falls back as precipitation in a continuous cycle.' },
  { role: 'user', content: 'How do I boil an egg?' },
  { role: 'assistant', content: 'Place eggs in cold water, bring to a boil, then simmer 6-7 minutes for soft yolks or 10-12 for hard, and cool in ice water.' },
  { role: 'user', content: 'What is the capital of Japan?' },
  { role: 'assistant', content: 'Tokyo.' },
  { role: 'user', content: 'Write a polite decline to a meeting invite.' },
  { role: 'assistant', content: 'Thanks for the invite — I can\'t make this one, but please send notes and loop me in if anything needs my input.' },
];

export function replayMix(train, ratio, seed) {
  if (!(ratio > 0)) return { mixed: train, replayAdded: 0 };
  const target = Math.round(train.length * ratio);
  const rng = seededRng(seed ^ 0x9e3779b9);
  const mixed = train.slice();
  for (let i = 0; i < target; i++) {
    const pair = Math.floor(rng() * (REPLAY_POOL.length / 2));
    mixed.push({
      session_id: `replay_${i}`,
      messages: [REPLAY_POOL[pair * 2], REPLAY_POOL[pair * 2 + 1]],
      replay: true,
    });
  }
  // Deterministic interleave: shuffle with a second seeded pass.
  for (let i = mixed.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
  }
  return { mixed, replayAdded: target };
}

/** Format-contract check: the trainer masks everything except assistant
 *  turns (mask_prompt) and terminates on EOS. Verify the contract holds:
 *  every example has learnable assistant content, string-only fields. */
export function verifyExample(example) {
  if (!example || !Array.isArray(example.messages) || example.messages.length === 0) return 'no messages';
  let learnable = 0;
  for (const m of example.messages) {
    if (typeof m.role !== 'string' || typeof m.content !== 'string') return 'non-string field';
    if (!['user', 'assistant', 'system'].includes(m.role)) return `bad role ${m.role}`;
    if (m.role === 'assistant' && m.content.trim()) learnable++;
  }
  if (!learnable) return 'no assistant content to learn (mask_prompt would mask everything)';
  return null;
}

export function verifyExamples(examples, deadline) {
  let bad = 0;
  const kept = [];
  for (const ex of examples) {
    if (deadline && Date.now() > deadline) throw new DatasetError('timeout: verification exceeded the time budget');
    if (verifyExample(ex)) { bad++; continue; }
    kept.push(ex);
  }
  return { kept, bad };
}

const toJsonl = (examples) => examples.map((ex) => JSON.stringify({ messages: ex.messages })).join('\n') + '\n';

/** Full pipeline: sessions JSONL → {train, valid, manifest}. Deterministic
 *  given (input, params). Throws DatasetError on limit/timeout violations. */
export function buildDataset(sessionsJsonl, rawParams) {
  const params = validateDatasetParams(rawParams);
  const bytes = new TextEncoder().encode(String(sessionsJsonl || '')).length;
  if (bytes > DATASET_LIMITS.maxInputBytes) throw new DatasetError(`input: exceeds ${DATASET_LIMITS.maxInputBytes} byte limit`);
  const deadline = Date.now() + params.timeout_ms;

  const { sessions, dropped: droppedParse } = parseSessions(sessionsJsonl);
  if (sessions.length === 0) throw new DatasetError('input: no parseable sessions');
  if (sessions.length > DATASET_LIMITS.maxSessions) throw new DatasetError(`input: exceeds ${DATASET_LIMITS.maxSessions} session limit`);

  const { kept: quality, dropped: droppedQuality } = qualityFilter(sessions, deadline);
  if (quality.length === 0) throw new DatasetError('input: no sessions survived quality filtering');

  const { kept: deduped, exact: dedupExact, near: dedupNear } = dedupeExamples(quality, deadline);

  const { scrubbed, redactions } = params.pii_scrub
    ? scrubPiiExamples(deduped, deadline)
    : { scrubbed: deduped, redactions: {} };

  const { kept: verified, bad: droppedVerify } = verifyExamples(scrubbed, deadline);
  if (verified.length === 0) throw new DatasetError('input: no examples survived verification');

  const { train, valid, validSessions, trainSessions } =
    splitSessions(verified, params.eval_split, params.seed, deadline);

  const { mixed: trainMixed, replayAdded } = replayMix(train, params.replay_mix_ratio, params.seed);

  const finalTrain = trainMixed.slice(0, params.max_examples);
  const trainJsonl = toJsonl(finalTrain);
  const validJsonl = toJsonl(valid);

  const manifest = {
    version: 1,
    seed: params.seed,
    eval_split: params.eval_split,
    replay_mix_ratio: params.replay_mix_ratio,
    pii_scrub: params.pii_scrub,
    sessions_in: sessions.length,
    dropped_parse: droppedParse,
    dropped_quality: droppedQuality,
    dedup_exact: dedupExact,
    dedup_near: dedupNear,
    dropped_verify: droppedVerify,
    pii_redactions: redactions,
    train_sessions: trainSessions,
    valid_sessions: validSessions,
    train_examples: finalTrain.length,
    valid_examples: valid.length,
    replay_examples: replayAdded,
    train_hash: fnv1a64Hex(trainJsonl),
    valid_hash: fnv1a64Hex(validJsonl),
    eval_split_hash: fnv1a64Hex(validJsonl),
    created_at: Date.now(),
  };
  return { train: trainJsonl, valid: validJsonl, manifest };
}

/* ------------------------------------------------------------------ */
/* Phase 5 — evaluation gate                                            */
/*                                                                     */
/* Authority order (per the academic survey + spec):                    */
/*   task A/B (primary, ground truth) > retention subset (blocking on  */
/*   large tax) > perplexity (guardrail only — can invert; never a      */
/*   claim of improvement) > LLM judge (advisory only, never the sole  */
/*   signal).                                                          */
/* ------------------------------------------------------------------ */

export const EVAL_GATE_THRESHOLDS = {
  /** adapter perplexity may not regress more than this vs baseline */
  maxPerplexityRegression: 0.25,
  /** retention tax (base score − adapter score, in points) that fails */
  retentionFailTax: 15,
  /** retention tax that triggers human review */
  retentionReviewTax: 8,
  /** minimum scored items for a task eval to count */
  minTaskEvalItems: 10,
};

/**
 * Score one eval definition against model responses.
 * evalDef: { id, prompts: [{ id, prompt, judge: {type:'exact',answers:[...]} |
 *                                    {type:'regex', pattern} }] }
 * responses: [{ prompt_id, response }]
 * Returns { id, scored, total, score (0..100), details }.
 */
export function scoreEvalResponses(evalDef, responses) {
  const byId = new Map((responses || []).map((r) => [r.prompt_id, String(r.response ?? '')]));
  let scored = 0, total = 0;
  const details = [];
  for (const p of evalDef.prompts || []) {
    total++;
    const response = byId.get(p.id);
    if (response == null) { details.push({ prompt_id: p.id, judged: false }); continue; }
    const judge = p.judge || {};
    let pass = false;
    if (judge.type === 'exact') {
      const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
      const r = norm(response);
      pass = (judge.answers || []).some((a) => r.includes(norm(String(a))));
    } else if (judge.type === 'regex') {
      try { pass = new RegExp(judge.pattern, 'i').test(response); }
      catch { pass = false; }
    }
    scored++;
    details.push({ prompt_id: p.id, judged: true, pass });
  }
  const passed = details.filter((d) => d.pass).length;
  return { id: evalDef.id, scored, total, score: scored ? (100 * passed) / scored : null, details };
}

/**
 * Gate verdict from a completed training result.
 * Input: { result } where result carries the provider-reported fields
 * (test_perplexity, baseline, eval_report: { task_evals: [{id, base_score,
 * adapter_score, items}], retention: {base_score, adapter_score, items},
 * judge: {note, consistent_wins} }).
 * Never claims "improved" from perplexity alone.
 */
export function gateVerdict({ result } = {}) {
  const reasons = [];
  const r = result || {};
  const baselinePpl = Number(r.baseline?.test_perplexity);
  const adapterPpl = Number(r.test_perplexity);
  const evalReport = r.eval_report && typeof r.eval_report === 'object' ? r.eval_report : null;

  let perplexityImproved = null;
  if (Number.isFinite(baselinePpl) && Number.isFinite(adapterPpl) && baselinePpl > 0) {
    const regression = (adapterPpl - baselinePpl) / baselinePpl;
    perplexityImproved = adapterPpl < baselinePpl;
    if (regression > EVAL_GATE_THRESHOLDS.maxPerplexityRegression) {
      return {
        verdict: 'fail',
        reasons: [...reasons, `perplexity regressed ${(100 * regression).toFixed(1)}% beyond the ${(100 * EVAL_GATE_THRESHOLDS.maxPerplexityRegression).toFixed(0)}% guardrail`],
        eval_delta: { perplexity_improved: false, perplexity_regression: regression },
      };
    }
    reasons.push(`perplexity guardrail held (baseline ${baselinePpl.toFixed(2)} → adapter ${adapterPpl.toFixed(2)})`);
  }

  // Retention subset — blocking on large tax (generative probes, not MC).
  let retentionTax = null;
  const retention = evalReport?.retention;
  if (retention && Number.isFinite(retention.base_score) && Number.isFinite(retention.adapter_score)) {
    retentionTax = retention.base_score - retention.adapter_score;
    if (retentionTax > EVAL_GATE_THRESHOLDS.retentionFailTax) {
      return {
        verdict: 'fail',
        reasons: [...reasons, `retention tax ${retentionTax.toFixed(1)}pp exceeds the ${EVAL_GATE_THRESHOLDS.retentionFailTax}pp fail threshold (catastrophic forgetting)`],
        eval_delta: { perplexity_improved: !!perplexityImproved, retention_tax: retentionTax },
      };
    }
    if (retentionTax > EVAL_GATE_THRESHOLDS.retentionReviewTax) {
      return {
        verdict: 'needs_review',
        reasons: [...reasons, `retention tax ${retentionTax.toFixed(1)}pp above the ${EVAL_GATE_THRESHOLDS.retentionReviewTax}pp review threshold`],
        eval_delta: { perplexity_improved: !!perplexityImproved, retention_tax: retentionTax },
      };
    }
    reasons.push(`retention tax ${retentionTax.toFixed(1)}pp within bounds`);
  }

  // Task A/B — primary signal, reported with the data; never auto-fail on
  // small samples, just reported (ground truth for the owner).
  let taskDelta = null;
  const taskEvals = Array.isArray(evalReport?.task_evals) ? evalReport.task_evals : [];
  const counted = taskEvals.filter((e) => Number(e.items) >= EVAL_GATE_THRESHOLDS.minTaskEvalItems
    && Number.isFinite(e.base_score) && Number.isFinite(e.adapter_score));
  if (counted.length) {
    taskDelta = counted.map((e) => ({
      id: String(e.id), base_score: e.base_score, adapter_score: e.adapter_score,
      delta: e.adapter_score - e.base_score, items: e.items,
    }));
    reasons.push(`task A/B over ${counted.length} eval(s): ` + taskDelta.map((t) => `${t.id} ${t.delta >= 0 ? '+' : ''}${t.delta.toFixed(1)}pp`).join(', '));
  } else if (taskEvals.length) {
    reasons.push('task evals reported but below the minimum item count — treated as advisory only');
  }

  // LLM judge — advisory only, never the sole signal.
  if (evalReport?.judge) {
    reasons.push(`judge advisory noted (${String(evalReport.judge.note || 'no note').slice(0, 120)}) — not a gate signal`);
  }

  if (!evalReport && !Number.isFinite(adapterPpl)) {
    return { verdict: 'needs_review', reasons: ['no eval report and no perplexity — nothing to gate on'], eval_delta: {} };
  }
  return {
    verdict: 'pass',
    reasons,
    eval_delta: {
      ...(perplexityImproved != null ? { perplexity_improved: perplexityImproved } : {}),
      ...(retentionTax != null ? { retention_tax: retentionTax } : {}),
      ...(taskDelta ? { task_ab: taskDelta } : {}),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Phase 6 — adapter registry                                           */
/* ------------------------------------------------------------------ */

/**
 * Build the registry record for a completed training. The adapter blob
 * itself is stored under compute:adapter-blob:{ref}; this is the metadata.
 */
export function buildAdapterRecord({ ref, job, task, result, gate }) {
  const now = Date.now();
  return {
    ref,
    base_model: job?.base_model || task?.base_model || null,
    quantization: '4bit', // v1: QLoRA on 4-bit bases; pinned with the triple
    engine: job?.engine || result?.engine || task?.engine || null,
    spec_hash: job?.spec_hash || task?.spec_hash || null,
    dataset_ref: job?.dataset_ref || task?.dataset_ref || null,
    eval_split_hash: job?.eval_split_hash || task?.eval_split_hash || null,
    eval_report: result?.eval_report || null,
    gate_verdict: gate?.verdict || null,
    gate_reasons: gate?.reasons || [],
    owner: job?.owner || task?.owner || null,
    provider_id: job?.providerId || task?.providerId || null,
    privacy: job?.privacy || task?.privacy || 'network',
    published: false, // private by default; explicit owner publish required
    status: gate?.verdict === 'fail' ? 'quarantined' : 'evaluated',
    created_at: now,
  };
}

/**
 * Access control for adapter download/serving.
 * - owner: always
 * - published + privacy 'network': anyone (servable to others)
 * - provider with trusted tier: 'trusted'-privacy adapters
 * Private by default: unpublished adapters serve only to the owner.
 */
export function canAccessAdapter(adapter, { requester = null, providerTier = null } = {}) {
  if (!adapter || typeof adapter !== 'object') return false;
  if (requester && adapter.owner && requester === adapter.owner) return true;
  if (adapter.published === true && adapter.privacy === 'network') return true;
  if (providerTier === 'trusted' && (adapter.privacy === 'trusted' || adapter.privacy === 'network')) return true;
  return false;
}

/**
 * Serving seam: which artifact can actually serve on which engine.
 * Canonical stored artifact is PEFT-format safetensors. mlx-lm's native
 * adapter format differs → conversion required at the MLX boundary
 * (numerically lossless key/shape remap). vLLM reads PEFT natively.
 * No serving infra here — the seam only.
 */
export function resolveAdapterForEngine(adapter, engine) {
  const eng = String(engine || '').toLowerCase();
  if (!adapter || !eng) return { status: 'unknown', note: 'adapter or engine missing' };
  if (adapter.status === 'quarantined') {
    return { status: 'blocked', note: 'adapter failed the eval gate and is quarantined' };
  }
  if (adapter.status !== 'evaluated') {
    return { status: 'blocked', note: 'adapter has no eval report — deployment requires evaluation, not just completion' };
  }
  if (adapter.engine && adapter.engine !== eng) {
    return {
      status: 'blocked',
      note: `adapter trained on ${adapter.engine}; eval deltas are only valid within-engine — refusing cross-engine serve`,
    };
  }
  if (eng === 'cuda') {
    return { status: 'servable', artifact: `adapter-blob:${adapter.ref}`, format: 'peft-safetensors', note: 'vLLM multi-adapter reads PEFT natively' };
  }
  if (eng === 'mlx') {
    return {
      status: 'needs_conversion',
      artifact: `adapter-blob:${adapter.ref}`,
      from: 'peft-safetensors',
      to: 'mlx-lm-adapter',
      note: 'convert at the MLX serving boundary (transposed weights, key remap — numerically lossless) before serving with mlx-lm',
    };
  }
  return { status: 'unknown', note: `no serving path defined for engine ${eng}` };
}
