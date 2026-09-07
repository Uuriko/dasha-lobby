#!/usr/bin/env node
/**
 * Live Worker be6687f5: USDC/$dasha settle+billing honesty.
 * /compute/api (+ /v1) billing → prepaid via USDC/$dasha · no card;
 * Ask receipt N¢ USDC / Hosted $0.05 credits;
 * jobs/:id settle only on complete; empty-fail clears money;
 * x402 stays flag_off.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import {
  ComputeNetwork,
  publicJobSettle,
  X402_BILLING_DOCS,
  x402BillingDocsLine,
} from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const networkSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

assert.equal(X402_BILLING_DOCS, 'flag_off');
assert.equal(x402BillingDocsLine({}), 'flag_off');
assert.equal(x402BillingDocsLine({ COMPUTE_X402_POC: '0' }), 'flag_off');
assert.equal(x402BillingDocsLine({ COMPUTE_X402_POC: '1' }), 'flag_on_stub');

function assertPageHonesty(html, label) {
  assert.match(html, /function settleFieldsFrom\(/, `${label} settleFieldsFrom`);
  assert.match(html, /lastSseSettle=null/, `${label} lastSseSettle`);
  assert.match(html, /never invent cents/, `${label} never invent cents`);
  assert.match(html, /settle only from final SSE settle object/, `${label} settle only from SSE/job`);
  assert.match(html, /empty-fail|empty completion|Never paint settle success on empty\/fail/, `${label} empty-fail clears money`);
  assert.match(html, /clearAnswerMoney\(\)/, `${label} clearAnswerMoney`);
  assert.match(html, /const emptyFail=\/empty completion\/i/, `${label} emptyFail catch`);
  assert.match(html, /USDC\/\$dasha cents only on real complete/, `${label} USDC/$dasha only on complete`);
  assert.match(html, /settleCents\+'\\u00a2 USDC'|settleCents\+'¢ USDC'/, `${label} N¢ USDC`);
  assert.match(html, /formatUsdCents\(cents\)\+' credits'/, `${label} Hosted $0.05 credits`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertPageHonesty(disk, 'disk');
assertPageHonesty(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assertPageHonesty(await served.text(), 'worker.fetch');

assert.match(networkSrc, /Prepaid credits via USDC\/\$dasha \(\$0\.05\/job\)/);
assert.match(networkSrc, /no card/);
assert.match(networkSrc, /x402: x402BillingDocsLine|x402: X402_BILLING_DOCS/);
assert.match(networkSrc, /jobs\/:id settle only on complete/);
assert.match(networkSrc, /streamError = 'empty completion'/);
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/);

assert.deepEqual(publicJobSettle({ settle_cents: 6, settle_state: 'pending_operator' }), { cents: 6, state: 'pending_operator' });
assert.equal(publicJobSettle({ settle_cents: 6 }), null);
assert.equal(publicJobSettle({ settle_state: 'pending_operator' }), null);
assert.equal(publicJobSettle({ settle_cents: 0, settle_state: 'pending_operator' }), null);

const env = { LOBBY_SESSION_SECRET: 'usdc-billing-honesty-secret', AI: { run: async () => ({ response: 'ok' }) } };
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const now = Date.now();
const session = await createSessionToken(env, { xId: 'usdc-owner', handle: 'usdc_rx' });
const cookie = { Cookie: `${COOKIE}=${session}` };
const origin = 'https://www.getdasha.com';
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const gw = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1'));
assert.equal(gw.status, 200);
const gateway = await gw.json();
assert.match(gateway.billing.chat_completions, /Prepaid credits via USDC\/\$dasha \(\$0\.05\/job\)/);
assert.match(gateway.billing.chat_completions, /no card/);
assert.equal(gateway.billing.x402, 'flag_off');
assert.equal('keys' in gateway.billing, false, 'v1 billing omits keys (root has keys)');

const rootApi = await network.fetch(new Request('https://lobby.getdasha.com/compute/api'));
const rootBody = await rootApi.json();
assert.match(rootBody.billing.chat_completions, /USDC\/\$dasha/);
assert.match(rootBody.billing.keys, /\$5\/month/);
assert.equal(rootBody.billing.x402, 'flag_off');

const completeId = 'job_complete_settle';
await storage.put(`compute:job:${completeId}`, {
  id: completeId, owner: 'x:usdc-owner', status: 'complete', model: 'qwen3-8b',
  route: 'community', answer: 'hi',
  usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },
  settle_cents: 6, settle_state: 'pending_operator',
  createdAt: now, expiresAt: now + 5 * 60_000, providerId: 'mac_1',
});
const complete = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${completeId}`, { headers: cookie }))).json();
assert.deepEqual(complete.settle, { cents: 6, state: 'pending_operator' });

const queuedId = 'job_queued_settle';
await storage.put(`compute:job:${queuedId}`, {
  id: queuedId, owner: 'x:usdc-owner', status: 'queued', model: 'qwen3-8b',
  settle_cents: 6, settle_state: 'pending_operator',
  createdAt: now, expiresAt: now + 5 * 60_000,
});
const queued = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${queuedId}`, { headers: cookie }))).json();
assert.equal('settle' in queued, false, 'queued job omits settle even if stamped');

const failedId = 'job_failed_settle';
await storage.put(`compute:job:${failedId}`, {
  id: failedId, owner: 'x:usdc-owner', status: 'failed', model: 'qwen3-8b',
  route: 'community', error: 'empty completion',
  settle_cents: 6, settle_state: 'pending_operator',
  createdAt: now, expiresAt: now + 5 * 60_000,
});
const failed = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${failedId}`, { headers: cookie }))).json();
assert.equal('settle' in failed, false, 'failed job omits settle');
assert.equal(failed.answer, null, 'failed job clears answer');

const register = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'USDC Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(register.status, 201);
const credentials = await register.json();
const providerHeaders = { Authorization: `Bearer ${credentials.provider_token}`, 'Content-Type': 'application/json' };

const accrueId = 'job_accrue_ok';
await storage.put(`compute:job:${accrueId}`, {
  id: accrueId, owner: 'x:usdc-owner', model: 'qwen3-8b', route: 'community', stream: false,
  status: 'leased', providerId: credentials.provider_id,
  leaseExpiresAt: now + 60_000, expiresAt: now + 120_000, createdAt: now, messages: null,
});
assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${accrueId}/result`, {
  method: 'POST', headers: providerHeaders,
  body: JSON.stringify({
    provider_id: credentials.provider_id,
    content: 'accrue then stamp',
    usage: { prompt_tokens: 10, completion_tokens: 1000, total_tokens: 1010 },
  }),
}), origin)).status, 202);
const accruedJob = await storage.get(`compute:job:${accrueId}`);
assert.equal(accruedJob.status, 'complete');
assert.equal(accruedJob.settle_cents, 6);
assert.equal(accruedJob.settle_state, 'pending_operator');
assert.deepEqual((await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${accrueId}`, { headers: cookie }))).json()).settle, { cents: 6, state: 'pending_operator' });

const emptyId = 'job_empty_stream';
await storage.put(`compute:job:${emptyId}`, {
  id: emptyId, owner: 'x:usdc-owner', model: 'qwen3-8b', route: 'community', stream: true,
  status: 'leased', providerId: credentials.provider_id, chunks: [],
  leaseExpiresAt: now + 60_000, expiresAt: now + 120_000, createdAt: now, messages: null,
});
assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${emptyId}/chunk`, {
  method: 'POST', headers: providerHeaders,
  body: JSON.stringify({ provider_id: credentials.provider_id, delta: '', done: true }),
}), origin)).status, 202);
const emptyJob = await storage.get(`compute:job:${emptyId}`);
assert.equal(emptyJob.status, 'failed');
assert.equal(emptyJob.error, 'empty completion');
assert.equal('settle_cents' in emptyJob, false, 'empty-fail does not stamp settle');
const emptyGet = await (await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${emptyId}`, { headers: cookie }))).json();
assert.equal('settle' in emptyGet, false, 'empty-fail GET omits settle');

const lobby = {
  idFromName: () => 'public',
  get: () => ({ fetch: (request) => network.fetch(request) }),
};
const workerEnv = { ...env, LOBBY: lobby };
const viaWorker = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1'), workerEnv);
assert.equal(viaWorker.status, 200);
const viaGw = await viaWorker.json();
assert.equal(viaGw.billing.x402, 'flag_off');
assert.match(viaGw.billing.chat_completions, /no card/);

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const painted = await page.evaluate(() => {
      const read = () => {
        const el = document.getElementById('answer-receipt');
        return { hidden: el?.hidden === true, text: (el?.textContent || '').trim() };
      };
      const run = (receipt) => {
        lastPaidReceipt = receipt;
        paintAnswerReceipt();
        return read();
      };
      lastPaidReceipt = { tokens: 40, cents: 100, engine: 'community', job_id: 'job_abc123xyz', model: 'gemma3-27b', settle_cents: 6, settle_state: 'pending_operator' };
      paintAnswerReceipt();
      const pending = read();
      lastPaidReceipt = { tokens: 33, cents: 5, engine: 'hosted', settle_cents: 5, settle_state: 'settled' };
      paintAnswerReceipt();
      const hosted = read();
      lastPaidReceipt = { tokens: 12, cents: 6, engine: 'community', job_id: 'job_fail', model: 'qwen3-8b', settle_cents: 6, settle_state: 'pending_operator' };
      paintAnswerReceipt();
      clearAnswerMoney();
      const cleared = read();
      return {
        fromFn: settleFieldsFrom({ cents: 6, state: 'pending_operator' }),
        pending,
        hosted,
        cleared,
      };
    });

    assert.deepEqual(painted.fromFn, { settle_cents: 6, settle_state: 'pending_operator' });
    assert.equal(painted.pending.text, 'Community · gemma3-27b · 40 tok · job_abc123xyz · 6¢ USDC · pending operator settle');
    assert.equal(painted.hosted.text, 'Settled · 33 tok · $0.05 credits');
    assert.equal(painted.cleared.hidden, true, 'empty-fail / clearAnswerMoney hides receipt');
    assert.equal(painted.cleared.text, '');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-usdc-billing-honesty: PASS');
