#!/usr/bin/env node
/** Fine-tune data pipeline (Phases 4/5/6): dataset determinism, session-level
 *  split integrity, dedup, PII scrub, eval gate authority order, registry
 *  access control, serving seam, and malicious-input rejection. */
import assert from 'node:assert/strict';
import {
  buildAdapterRecord,
  buildDataset,
  canAccessAdapter,
  DatasetError,
  DATASET_LIMITS,
  dedupeExamples,
  gateVerdict,
  mintDatasetRef,
  parseSessions,
  qualityFilter,
  replayMix,
  resolveAdapterForEngine,
  scoreEvalResponses,
  scrubPiiText,
  seededRng,
  splitSessions,
  validateDatasetParams,
  verifyExample,
} from './dasha-compute-finetune-data.mjs';
import { getEval, listEvals } from './dasha-compute-finetune-evals/index.mjs';
import { validateTuneResult } from './dasha-compute-network.mjs';

/* ---------- fixtures ---------- */

function session(id, texts) {
  const messages = [];
  texts.forEach(([role, content], i) => messages.push({ role, content: `${content} (session ${id} turn ${i})` }));
  return JSON.stringify({ session_id: id, messages });
}

function sessionsJsonl(n, seed = 1) {
  const rng = seededRng(seed);
  const corpus = [
    ['pruning apple trees in winter', 'Cut dead wood first, then crossing branches, always making clean cuts just outside the branch collar so the tree heals quickly.'],
    ['fermenting kimchi at home', 'Salt the napa cabbage overnight, rinse thoroughly, then massage in gochugaru, garlic, ginger, and fish sauce before packing jars.'],
    ['restoring cast iron skillets', 'Strip rust with vinegar and steel wool, dry completely on heat, then apply whisper-thin coats of flaxseed oil baked past smoke point.'],
    ['planning a three-day backpacking route', 'Budget ten miles a day with a bailout option each evening, cache water where the map shows dry stretches, and tell someone your plan.'],
    ['learning touch typing quickly', 'Anchor fingers on home row, drill the weakest finger daily, and resist looking down even when it slows you at first.'],
    ['reading sheet music for piano', 'Learn the bass and treble clefs separately, clap rhythms before playing them, and practice hands apart until each is automatic.'],
    ['composting kitchen scraps', 'Balance greens and browns roughly one to three, keep the pile damp as a wrung sponge, and turn it whenever it smells sour.'],
    ['baking croissants from scratch', 'Laminate cold butter in precise thirds, rest the dough overnight between folds, and proof until the layers visibly separate.'],
    ['birdwatching in coastal wetlands', 'Arrive at dawn when waders feed, scan mudflats slowly with binoculars, and learn calls before plumage since reeds hide birds.'],
    ['kettlebell swing fundamentals', 'Hinge at the hips not the knees, snap the glutes to float the bell, and keep arms loose like ropes through the whole arc.'],
    ['writing haiku in English', 'Capture one concrete image, cut every abstract word, and let the seasonal reference do the emotional work silently.'],
    ['setting up a home mesh network', 'Place nodes within two rooms of each other, wire the backhaul where possible, and separate IoT devices onto their own SSID.'],
    ['sourdough starter maintenance', 'Feed equal weights flour and water daily at room temperature, watch for predictable doubling, and refrigerate only once mature.'],
    ['basic git rebase workflows', 'Rebase private branches onto fresh main, resolve each conflict in context, and never rewrite commits others have pulled.'],
    ['watering indoor monstera plants', 'Water deeply when the top two inches dry out, empty the saucer so roots never sit wet, and mist only in very dry air.'],
    ['intro to the Italian opening', 'Develop knights before bishops, castle early for king safety, and avoid moving the same piece twice in the opening.'],
  ];
  const lines = [];
  for (let i = 0; i < n; i++) {
    const [topic, detail] = corpus[Math.floor(rng() * corpus.length)];
    const uniq = Math.floor(rng() * 1e9).toString(36);
    lines.push(session(`s${i}`, [
      ['user', `Teach me about ${topic}; I'm a beginner and want the key ideas (${uniq})`],
      ['assistant', `${detail} One more thing beginners miss about ${topic}: keep a small log tagged ${uniq} so you can see what actually helped.`],
      ['user', `What's the single biggest mistake people make with ${topic}?`],
      ['assistant', `Rushing. With ${topic}, patience beats intensity — small consistent effort over weeks outperforms any weekend cram session.`],
    ]));
  }
  return lines.join('\n');
}

const PARAMS = { seed: 42, eval_split: 0.2, replay_mix_ratio: 0.2, max_examples: 10000 };

/* ---------- determinism ---------- */

const a = buildDataset(sessionsJsonl(60), PARAMS);
const b = buildDataset(sessionsJsonl(60), PARAMS);
assert.equal(a.train, b.train, 'train split deterministic');
assert.equal(a.valid, b.valid, 'valid split deterministic');
{
  const strip = (m) => { const { created_at, ...rest } = m; return rest; };
  assert.deepEqual(strip(a.manifest), strip(b.manifest), 'manifest deterministic (minus created_at)');
}
assert.ok(a.manifest.train_examples > 0 && a.manifest.valid_examples > 0);
assert.ok(a.manifest.dedup_exact + a.manifest.dedup_near >= 0, 'dedup stats reported');
// Dedicated near-dup behavior is unit-tested below with controlled inputs;
// the synthetic fixture is intentionally repetitive, so heavy near-dedup
// here is correct, not a bug.

const c = buildDataset(sessionsJsonl(60), { ...PARAMS, seed: 43 });
assert.notEqual(a.manifest.valid_hash, c.manifest.valid_hash, 'different seed → different split');

/* ---------- session-level split integrity ---------- */

function sessionIds(jsonl) {
  // replay examples carry replay_N ids; original sessions keep sN
  return jsonl.trim().split('\n').map((l) => JSON.parse(l).messages[0]?.content?.match(/session (\S+) turn/)?.[1]).filter(Boolean);
}
{
  const trainIds = new Set(sessionIds(a.train).filter((id) => !id.startsWith('replay_')));
  const validIds = new Set(sessionIds(a.valid));
  for (const id of validIds) assert.ok(!trainIds.has(id), `session ${id} leaked across the split`);
  assert.ok(validIds.size >= 1, 'valid split non-empty');
  // eval split ratio respected at the session level (±1 session), measured
  // against sessions that survived filtering + dedup
  const totalSessions = a.manifest.train_sessions + a.manifest.valid_sessions;
  assert.ok(Math.abs(validIds.size / totalSessions - 0.2) < 0.15, 'eval split ratio sane');
}

/* ---------- dedup ---------- */

{
  const base = { session_id: 'x', messages: [{ role: 'user', content: 'hello world this is a test message about gardening' }, { role: 'assistant', content: 'here is a detailed answer about gardening with many words' }] };
  const exact = { ...base, session_id: 'y' };
  const near = { session_id: 'z', messages: [{ role: 'user', content: 'hello world this is a test message about gardening!' }, { role: 'assistant', content: 'here is a detailed answer about gardening with many words.' }] };
  const different = { session_id: 'w', messages: [{ role: 'user', content: 'quantum chromodynamics lattice gauge theory explained' }, { role: 'assistant', content: 'a completely different response about particle physics indeed' }] };
  const { kept, exact: e, near: n } = dedupeExamples([base, exact, near, different], null);
  assert.equal(kept.length, 2, 'exact + near dup removed, distinct kept');
  assert.equal(e, 1, 'exact count');
  assert.equal(n, 1, 'near count');
}

/* ---------- PII scrub ---------- */

{
  const { text, redactions } = scrubPiiText('Contact jane@example.com or call 415-555-0132, ssn 123-45-6789.');
  assert.ok(!text.includes('jane@example.com') && text.includes('[REDACTED_EMAIL]'));
  assert.ok(!text.includes('415-555-0132') && text.includes('[REDACTED_PHONE]'));
  assert.ok(!text.includes('123-45-6789') && text.includes('[REDACTED_SSN]'));
  assert.equal(redactions.email, 1);
  assert.equal(redactions.phone, 1);
  assert.equal(redactions.ssn, 1);
  // clean text untouched
  const clean = scrubPiiText('The quick brown fox jumps over the lazy dog.');
  assert.equal(clean.text, 'The quick brown fox jumps over the lazy dog.');
  assert.deepEqual(clean.redactions, {});
}

/* ---------- quality filter / verify ---------- */

{
  const { kept, dropped } = qualityFilter([
    { session_id: 'ok', messages: [{ role: 'user', content: 'explain photosynthesis thoroughly please' }, { role: 'assistant', content: 'plants convert light energy into chemical energy through chlorophyll in a wonderful process' }] },
    { session_id: 'nouser', messages: [{ role: 'assistant', content: 'an answer with no question at all here' }] },
    { session_id: 'tiny', messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }] },
  ], null);
  assert.equal(kept.length, 1);
  assert.equal(dropped, 2);
  assert.equal(verifyExample({ messages: [{ role: 'user', content: 'q' }] }), 'no assistant content to learn (mask_prompt would mask everything)');
  assert.equal(verifyExample({ messages: [{ role: 'assistant', content: 'a solid answer here' }] }), null);
}

/* ---------- malicious input rejection ---------- */

assert.throws(() => buildDataset('', PARAMS), /no parseable sessions/, 'empty input rejected');
assert.throws(() => buildDataset('not json\n{bad', PARAMS), /no parseable sessions/, 'garbage rejected');
assert.throws(() => buildDataset(sessionsJsonl(10), { ...PARAMS, eval_split: 0.9 }), /eval_split/, 'bad eval_split rejected');
assert.throws(() => buildDataset(sessionsJsonl(10), { ...PARAMS, replay_mix_ratio: 0.99 }), /replay_mix_ratio/, 'bad replay ratio rejected');
assert.throws(() => buildDataset(sessionsJsonl(10), { ...PARAMS, seed: 1.5 }), /seed/, 'non-integer seed rejected');
assert.throws(() => buildDataset('x'.repeat(DATASET_LIMITS.maxInputBytes + 1), PARAMS), /exceeds/, 'oversized input rejected');
assert.throws(() => validateDatasetParams({ max_examples: 1 }), /max_examples/, 'tiny max_examples rejected');
// malformed lines are dropped, not fatal
{
  const mixed = sessionsJsonl(5) + '\n{broken json\n' + JSON.stringify({ no_messages: true });
  const { sessions, dropped } = parseSessions(mixed);
  assert.equal(sessions.length, 5);
  assert.equal(dropped, 2);
}

/* ---------- replay mix ---------- */

{
  const train = Array.from({ length: 20 }, (_, i) => ({ session_id: `s${i}`, messages: [] }));
  const { mixed, replayAdded } = replayMix(train, 0.2, 7);
  assert.equal(replayAdded, 4);
  assert.equal(mixed.length, 24);
  const again = replayMix(train, 0.2, 7);
  assert.deepEqual(mixed.map((m) => m.session_id), again.mixed.map((m) => m.session_id), 'replay deterministic');
}

/* ---------- eval registry ---------- */

{
  assert.ok(getEval('retention-gk'), 'retention eval registered');
  assert.ok(getEval('task-conciseness'), 'task eval registered');
  assert.equal(getEval('nope'), null, 'unknown eval null');
  assert.ok(listEvals().length >= 2);
  // generative probes: no multiple-choice options anywhere
  for (const e of listEvals()) {
    const def = getEval(e.id);
    for (const p of def.prompts) {
      assert.ok(!/^[A-D]\)/m.test(p.prompt), 'no multiple-choice options');
      assert.ok(['exact', 'regex'].includes(p.judge.type), 'judge is exact|regex');
    }
  }
}

/* ---------- scoring ---------- */

{
  const def = getEval('retention-gk');
  const responses = def.prompts.slice(0, 4).map((p) => ({ prompt_id: p.id, response: p.id === 'gk-02' ? 'definitely 61' : 'PARIS is the capital! It is great.' }));
  const scored = scoreEvalResponses(def, responses);
  assert.equal(scored.scored, 4);
  assert.ok(scored.score < 100 && scored.score > 0, 'partial credit works');
  assert.equal(scored.details.find((d) => d.prompt_id === 'gk-02').pass, false);
}

/* ---------- gate verdict: authority order ---------- */

// perplexity regression beyond the guardrail → fail (and never "improved")
{
  const v = gateVerdict({ result: { test_perplexity: 20, baseline: { test_perplexity: 10 } } });
  assert.equal(v.verdict, 'fail');
  assert.ok(v.reasons.some((r) => /perplexity regressed/.test(r)));
  assert.equal(v.eval_delta.perplexity_improved, false);
}
// perplexity improvement alone → pass but NO "improved" claim language
{
  const v = gateVerdict({ result: { test_perplexity: 8, baseline: { test_perplexity: 10 } } });
  assert.equal(v.verdict, 'pass');
  assert.ok(!v.reasons.some((r) => /improved/i.test(r) && !/perplexity_improved/.test(r) || /adapter is better/i.test(r)), 'no improvement claims');
  assert.equal(v.eval_delta.perplexity_improved, true);
}
// retention tax > 15pp → fail (blocking), even with good perplexity
{
  const v = gateVerdict({ result: { test_perplexity: 9, baseline: { test_perplexity: 10 }, eval_report: { retention: { base_score: 90, adapter_score: 70 } } } });
  assert.equal(v.verdict, 'fail');
  assert.ok(v.reasons.some((r) => /retention tax/.test(r)));
}
// retention tax 8–15pp → needs_review
{
  const v = gateVerdict({ result: { test_perplexity: 9, baseline: { test_perplexity: 10 }, eval_report: { retention: { base_score: 90, adapter_score: 80 } } } });
  assert.equal(v.verdict, 'needs_review');
}
// small-sample task eval → advisory only, not primary
{
  const v = gateVerdict({ result: { test_perplexity: 9, baseline: { test_perplexity: 10 }, eval_report: { task_evals: [{ id: 'task-conciseness', base_score: 50, adapter_score: 80, items: 3 }] } } });
  assert.equal(v.verdict, 'pass');
  assert.ok(v.reasons.some((r) => /advisory only/.test(r)));
  assert.ok(!('task_ab' in v.eval_delta), 'small sample not counted as task A/B');
}
// counted task A/B reported with deltas
{
  const v = gateVerdict({ result: { test_perplexity: 9, baseline: { test_perplexity: 10 }, eval_report: { task_evals: [{ id: 'task-conciseness', base_score: 50, adapter_score: 80, items: 12 }] } } });
  assert.equal(v.verdict, 'pass');
  assert.equal(v.eval_delta.task_ab[0].delta, 30);
}
// judge is advisory only — never the sole signal
{
  const v = gateVerdict({ result: { test_perplexity: 9, baseline: { test_perplexity: 10 }, eval_report: { judge: { note: 'adapter wins 9/10 pairwise' } } } });
  assert.equal(v.verdict, 'pass');
  assert.ok(v.reasons.some((r) => /advisory/.test(r)));
}
// nothing to gate on → needs_review, not pass
{
  const v = gateVerdict({ result: {} });
  assert.equal(v.verdict, 'needs_review');
}

/* ---------- eval_report validation in the result contract ---------- */

{
  const job = { spec_hash: 'h', engine: 'mlx', spec: { iters: 100 } };
  const good = { status: 'complete', spec_hash: 'h', engine: 'mlx', iters_done: 10, adapter_ref: 'adapter_x', eval_report: { task_evals: [{ id: 'retention-gk', base_score: 80, adapter_score: 85, items: 20 }] } };
  assert.equal(validateTuneResult(good, job).ok, true, 'known eval id accepted');
  const badId = { ...good, eval_report: { task_evals: [{ id: 'evil-eval', base_score: 0, adapter_score: 100, items: 20 }] } };
  assert.equal(validateTuneResult(badId, job).ok, false, 'unknown eval id rejected');
  const badScore = { ...good, eval_report: { task_evals: [{ id: 'retention-gk', base_score: 'lots', adapter_score: 85, items: 20 }] } };
  assert.equal(validateTuneResult(badScore, job).ok, false, 'non-finite score rejected');
}

/* ---------- registry access control ---------- */

{
  const adapter = buildAdapterRecord({
    ref: 'adapter_x', job: { base_model: 'qwen3-8b', dataset_ref: 'ds_a', spec_hash: 'h', owner: 'alice', privacy: 'network', engine: 'mlx' },
    task: null, result: null, gate: { verdict: 'pass', reasons: [] },
  });
  assert.equal(adapter.status, 'evaluated');
  assert.equal(adapter.published, false, 'private by default');
  assert.equal(adapter.quantization, '4bit');
  assert.ok(canAccessAdapter(adapter, { requester: 'alice' }), 'owner always');
  assert.ok(!canAccessAdapter(adapter, { requester: 'bob' }), 'stranger denied while unpublished');
  assert.ok(canAccessAdapter({ ...adapter, published: true }, { requester: 'bob' }), 'published network adapter servable');
  assert.ok(!canAccessAdapter({ ...adapter, published: true, privacy: 'trusted' }, { requester: 'bob' }), 'published but trusted-privacy still gated');
  assert.ok(canAccessAdapter({ ...adapter, privacy: 'trusted' }, { providerTier: 'trusted' }), 'trusted tier provider ok');
  assert.ok(!canAccessAdapter({ ...adapter, privacy: 'local' }, { providerTier: 'trusted' }), 'local never leaves owner');
  assert.ok(!canAccessAdapter(null, { requester: 'alice' }), 'null adapter denied');
  const failed = buildAdapterRecord({ ref: 'adapter_y', job: { owner: 'alice' }, task: null, result: null, gate: { verdict: 'fail', reasons: ['x'] } });
  assert.equal(failed.status, 'quarantined', 'failed gate → quarantined');
}

/* ---------- serving seam ---------- */

{
  const evaluated = { ref: 'adapter_x', engine: 'mlx', status: 'evaluated' };
  const cuda = resolveAdapterForEngine({ ...evaluated, engine: 'cuda' }, 'cuda');
  assert.equal(cuda.status, 'servable', 'PEFT canonical serves on cuda directly');
  assert.equal(cuda.format, 'peft-safetensors');
  const mlx = resolveAdapterForEngine(evaluated, 'mlx');
  assert.equal(mlx.status, 'needs_conversion', 'mlx needs boundary conversion');
  assert.equal(mlx.from, 'peft-safetensors');
  assert.equal(mlx.to, 'mlx-lm-adapter');
  assert.equal(resolveAdapterForEngine({ ...evaluated, status: 'pending_eval' }, 'cuda').status, 'blocked', 'unevaluated blocked');
  assert.equal(resolveAdapterForEngine({ ...evaluated, status: 'quarantined' }, 'cuda').status, 'blocked', 'quarantined blocked');
  assert.equal(resolveAdapterForEngine({ ...evaluated, engine: 'cuda' }, 'mlx').status, 'blocked', 'cross-engine serve refused');
  assert.equal(resolveAdapterForEngine({ ref: 'adapter_x', status: 'evaluated' }, 'tpu').status, 'unknown');
}

/* ---------- misc ---------- */

{
  const r1 = mintDatasetRef();
  const r2 = mintDatasetRef();
  assert.ok(/^ds_[A-Za-z0-9_-]{9}$/.test(r1));
  assert.notEqual(r1, r2);
  const rng1 = seededRng(5), rng2 = seededRng(5);
  assert.equal(rng1(), rng2(), 'rng deterministic');
}

console.log('dasha-compute-finetune-data: PASS');
