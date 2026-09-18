// Unit tests: Resend failure classification + bounded retry queue.
// Imports only dasha-mail-resend.mjs (no external deps); the fetch to
// api.resend.com is stubbed. No real sends.
import assert from 'node:assert/strict';
import {
  classifyResendFailure,
  enqueueMailRetry,
  mailRetryDelayMs,
  pumpMailRetryQueue,
  sendResendMail,
  MAIL_FAILURE_CONFIG,
  MAIL_FAILURE_PROVIDER_REJECTION,
  MAIL_FAILURE_TRANSIENT,
  MAIL_RETRY_KEY,
  MAIL_RETRY_MAX_ATTEMPTS,
  MAIL_RETRY_MAX_ENTRIES,
  MAIL_RETRY_TTL_MS,
} from './dasha-mail-resend.mjs';

const PII_EMAIL = 'very-private-person@example.com';

// ---- classification ----
assert.deepEqual(classifyResendFailure({ status: 401, error: 'invalid_api_key' }), { kind: MAIL_FAILURE_CONFIG, retryable: false }, '401 = config');
assert.deepEqual(classifyResendFailure({ status: 422, error: "The `from` address does not match a verified domain" }), { kind: MAIL_FAILURE_CONFIG, retryable: false }, '422 unverified from = config');
assert.deepEqual(classifyResendFailure({ status: 403, error: 'domain not verified for sending' }), { kind: MAIL_FAILURE_CONFIG, retryable: false }, '403 domain = config');
assert.deepEqual(classifyResendFailure({ status: 400, error: 'Invalid `to` email address' }), { kind: MAIL_FAILURE_PROVIDER_REJECTION, retryable: false }, '400 bad recipient = provider-rejection');
assert.deepEqual(classifyResendFailure({ status: 422, error: 'validation_error' }), { kind: MAIL_FAILURE_PROVIDER_REJECTION, retryable: false }, '422 validation = provider-rejection');
assert.deepEqual(classifyResendFailure({ status: 429, error: 'rate_limit_exceeded' }), { kind: MAIL_FAILURE_TRANSIENT, retryable: true }, '429 = transient');
assert.deepEqual(classifyResendFailure({ status: 500, error: 'application_error' }), { kind: MAIL_FAILURE_TRANSIENT, retryable: true }, '500 = transient');
assert.deepEqual(classifyResendFailure({ status: 502, error: 'Bad Gateway' }), { kind: MAIL_FAILURE_TRANSIENT, retryable: true }, '502 = transient');
assert.deepEqual(classifyResendFailure({ status: 0, error: 'fetch failed' }), { kind: MAIL_FAILURE_TRANSIENT, retryable: true }, 'network = transient');
console.log('classification: ok');

// ---- backoff shape ----
assert.deepEqual([0, 1, 2, 3, 4].map(mailRetryDelayMs), [30_000, 60_000, 120_000, 240_000, 480_000], 'backoff doubles');
assert.ok(mailRetryDelayMs(99) <= 30 * 60_000, 'backoff capped');
console.log('backoff: ok');

// ---- fake storage ----
function makeStorage() {
  const rows = new Map();
  return {
    rows,
    async get(k) { return rows.get(k); },
    async put(k, v) { rows.set(k, v); },
    async delete(k) { rows.delete(k); },
  };
}
const baseEntry = {
  to: [PII_EMAIL],
  subject: 'Your Dasha sign-in code',
  text: 'Your Dasha sign-in code is 123456.',
  idempotencyKey: 'email-login/nonce-1',
  kind: 'email-login',
};

// ---- enqueue validation ----
{
  const s = makeStorage();
  assert.deepEqual((await enqueueMailRetry(s, { ...baseEntry, idempotencyKey: '' })).queued, false, 'idempotency required');
  assert.deepEqual((await enqueueMailRetry(s, { ...baseEntry, to: [] })).queued, false, 'to required');
  assert.deepEqual((await enqueueMailRetry(s, { ...baseEntry, text: undefined })).queued, false, 'body required');
  assert.deepEqual((await enqueueMailRetry(null, baseEntry)).queued, false, 'no storage');
  const ok = await enqueueMailRetry(s, baseEntry, 1_000);
  assert.equal(ok.queued, true, 'queued');
  const dup = await enqueueMailRetry(s, baseEntry, 2_000);
  assert.equal(dup.queued, true, 'dedupe by idempotency key');
  assert.equal(dup.deduped, true, 'dup flagged');
  assert.equal(s.rows.get(MAIL_RETRY_KEY).length, 1, 'no duplicate entry');
  const q = s.rows.get(MAIL_RETRY_KEY)[0];
  assert.equal(q.attempts, 0, 'attempts start at 0');
  assert.equal(q.nextAt, 1_000 + 30_000, 'first backoff 30s');
}
console.log('enqueue validation: ok');

// ---- queue bound: 200 entries max ----
{
  const s = makeStorage();
  for (let i = 0; i < MAIL_RETRY_MAX_ENTRIES; i++) {
    const r = await enqueueMailRetry(s, { ...baseEntry, idempotencyKey: `k-${i}`, to: [`u${i}@example.com`] }, 1_000);
    assert.equal(r.queued, true, `fill ${i}`);
  }
  const full = await enqueueMailRetry(s, { ...baseEntry, idempotencyKey: 'k-overflow' }, 1_000);
  assert.deepEqual(full, { queued: false, reason: 'queue-full' }, 'bounded at 200');
}
console.log('queue bound: ok');

// ---- pump: transient -> delivered, observability without PII ----
{
  const s = makeStorage();
  const logs = [];
  const realInfo = console.info, realWarn = console.warn;
  console.info = (m) => logs.push(String(m)); console.warn = (m) => logs.push(String(m));
  const bumped = [];
  await enqueueMailRetry(s, baseEntry, 1_000);
  let delivered = null;
  const stats = await pumpMailRetryQueue({
    storage: s,
    env: {},
    now: 1_000 + 30_000 + 1,
    send: async (e, o) => {
      assert.deepEqual(o.to, [PII_EMAIL], 'send gets recipient');
      assert.equal(o.idempotencyKey, 'email-login/nonce-1', 'same idempotency key on retry');
      return { ok: true, id: 'mail_retry_1', provider: 'resend' };
    },
    onDelivered: async (entry) => { delivered = entry; },
    bump: (n) => bumped.push(n),
  });
  console.info = realInfo; console.warn = realWarn;
  assert.deepEqual(stats, { checked: 1, due: 1, sent: 1, requeued: 0, dropped: 0, pending: 0 }, 'delivered stats');
  assert.ok(delivered && delivered.id, 'onDelivered fired');
  assert.equal(s.rows.has(MAIL_RETRY_KEY), false, 'queue cleared after delivery');
  assert.ok(bumped.includes('mail:send:ok'), 'send ok metric');
  assert.ok(!logs.join('\n').includes(PII_EMAIL), 'no PII in logs');
  assert.ok(!bumped.join('\n').includes(PII_EMAIL), 'no PII in metric names');
}
console.log('pump deliver: ok');

// ---- pump: transient failure -> requeued with backoff; then exhausted -> dead ----
{
  const s = makeStorage();
  const bumped = [];
  await enqueueMailRetry(s, baseEntry, 1_000);
  const fail = { ok: false, error: 'down', status: 500, provider: 'resend', failure: { kind: MAIL_FAILURE_TRANSIENT, retryable: true } };
  let now = 1_000 + 30_001;
  for (let a = 1; a < MAIL_RETRY_MAX_ATTEMPTS; a++) {
    const st = await pumpMailRetryQueue({
      storage: s, env: {}, now,
      send: async () => fail,
      bump: (n) => bumped.push(n),
    });
    assert.equal(st.requeued, 1, `attempt ${a} requeued`);
    assert.equal(s.rows.get(MAIL_RETRY_KEY)[0].attempts, a, `attempts=${a}`);
    now = s.rows.get(MAIL_RETRY_KEY)[0].nextAt + 1;
  }
  const last = await pumpMailRetryQueue({ storage: s, env: {}, now, send: async () => fail, bump: (n) => bumped.push(n) });
  assert.equal(last.dropped, 1, 'dead after max attempts');
  assert.equal(last.pending, 0, 'queue empty');
  assert.ok(bumped.includes('mail:retry:dead'), 'dead metric');
  // backoff grew: check the requeue delays were increasing
  assert.ok(bumped.filter((n) => n === 'mail:retry:requeued').length === MAIL_RETRY_MAX_ATTEMPTS - 1, 'requeued each attempt');
}
console.log('pump backoff+exhaustion: ok');

// ---- pump: non-retryable failure -> dropped immediately ----
{
  const s = makeStorage();
  const bumped = [];
  await enqueueMailRetry(s, baseEntry, 1_000);
  const st = await pumpMailRetryQueue({
    storage: s, env: {}, now: 1_000 + 31_000,
    send: async () => ({ ok: false, error: 'invalid `to`', status: 400, provider: 'resend', failure: { kind: MAIL_FAILURE_PROVIDER_REJECTION, retryable: false } }),
    bump: (n) => bumped.push(n),
  });
  assert.equal(st.dropped, 1, 'provider-rejection dropped');
  assert.equal(st.requeued, 0, 'not requeued');
}
console.log('pump non-retryable: ok');

// ---- pump: superseded entry skipped ----
{
  const s = makeStorage();
  const bumped = [];
  await enqueueMailRetry(s, { ...baseEntry, email: PII_EMAIL, payload: { login: { nonce: 'old' } } }, 1_000);
  const st = await pumpMailRetryQueue({
    storage: s, env: {}, now: 1_000 + 31_000,
    send: async () => { throw new Error('must not send superseded'); },
    shouldSkip: async () => true,
    bump: (n) => bumped.push(n),
  });
  assert.equal(st.dropped, 1, 'superseded dropped');
  assert.ok(bumped.includes('mail:retry:superseded'), 'superseded metric');
}
console.log('pump supersede: ok');

// ---- pump: TTL expiry pruned ----
{
  const s = makeStorage();
  const bumped = [];
  await enqueueMailRetry(s, baseEntry, 1_000);
  const st = await pumpMailRetryQueue({
    storage: s, env: {}, now: 1_000 + MAIL_RETRY_TTL_MS + 1,
    send: async () => { throw new Error('must not send expired'); },
    bump: (n) => bumped.push(n),
  });
  assert.equal(st.dropped, 1, 'expired dropped');
  assert.ok(bumped.includes('mail:retry:expired'), 'expired metric');
}
console.log('pump TTL: ok');

// ---- sendResendMail failure shapes carry classification ----
{
  const realFetch = globalThis.fetch;
  // network throw -> transient
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  let r = await sendResendMail({ RESEND_API_KEY: 're_x' }, { to: PII_EMAIL, subject: 's', text: 'b', idempotencyKey: 'k' });
  assert.deepEqual(r.failure, { kind: MAIL_FAILURE_TRANSIENT, retryable: true }, 'network = transient');
  // 401 -> config
  globalThis.fetch = async () => new Response(JSON.stringify({ name: 'invalid_api_key' }), { status: 401 });
  r = await sendResendMail({ RESEND_API_KEY: 're_x' }, { to: PII_EMAIL, subject: 's', text: 'b' });
  assert.deepEqual(r.failure, { kind: MAIL_FAILURE_CONFIG, retryable: false }, '401 = config');
  // 429 -> transient
  globalThis.fetch = async () => new Response(JSON.stringify({ name: 'rate_limit_exceeded' }), { status: 429 });
  r = await sendResendMail({ RESEND_API_KEY: 're_x' }, { to: PII_EMAIL, subject: 's', text: 'b' });
  assert.deepEqual(r.failure, { kind: MAIL_FAILURE_TRANSIENT, retryable: true }, '429 = transient');
  // 400 validation -> provider-rejection
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Invalid `to` field' }), { status: 400 });
  r = await sendResendMail({ RESEND_API_KEY: 're_x' }, { to: PII_EMAIL, subject: 's', text: 'b' });
  assert.deepEqual(r.failure, { kind: MAIL_FAILURE_PROVIDER_REJECTION, retryable: false }, '400 = provider-rejection');
  // success unchanged
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'mail_1' }), { status: 200 });
  r = await sendResendMail({ RESEND_API_KEY: 're_x' }, { to: PII_EMAIL, subject: 's', text: 'b' });
  assert.deepEqual(r, { ok: true, id: 'mail_1', provider: 'resend' }, 'success shape unchanged');
  // missing key -> config, no fetch
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; throw new Error('nope'); };
  r = await sendResendMail({}, { to: PII_EMAIL, subject: 's', text: 'b' });
  assert.deepEqual(r.failure, { kind: MAIL_FAILURE_CONFIG, retryable: false }, 'missing key = config');
  assert.equal(fetched, false, 'no fetch without key');
  globalThis.fetch = realFetch;
}
console.log('sendResendMail failure shapes: ok');

console.log('dasha-mail-resend-retry.test.mjs: all assertions passed');
