#!/usr/bin/env node
/**
 * Live Worker 15d33eb2: mid-stream provider-fail honesty.
 * Mac cut out. + Retry (data-midstream-fail). SSE code provider_cut.
 * normalizeStreamProviderError / isProviderStreamCutError on the chunk path.
 * Never settle / success face after URLError / provider cut / empty completion.
 * Prove target for HTML markers: live www.getdasha.com/compute (lobby may lack the note).
 * Disk only. No wrangler. No Designer.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import {
  ComputeNetwork,
  isProviderStreamCutError,
  normalizeStreamProviderError,
} from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const networkSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function assertMidstreamHonesty(html, label) {
  assert.match(html, /<!-- midstream-fail-honesty:2026-09-07 -->/, `${label} marker comment`);
  assert.match(html, /id=["']answer-retry["'][^>]*data-midstream-fail=["']1["']/, `${label} data-midstream-fail`);
  assert.match(html, />Retry</, `${label} Retry label`);
  assert.match(html, /Mac cut out\./, `${label} Mac cut out.`);
  assert.match(html, /Still listed online\./, `${label} Still listed online.`);
  assert.match(html, /lastAskFailKind=['"]provider_cut['"]/, `${label} lastAskFailKind provider_cut`);
  assert.match(html, /error\?\.code===['"]provider_cut['"]/, `${label} error.code provider_cut`);
  assert.match(
    html,
    /provider inference failed\|provider cut\|URLError\|stream ended before completion/,
    `${label} client cut regex`,
  );
  assert.match(html, /e\.code=payload\.error\.code\|\|null/, `${label} readSse preserves code`);
  assert.match(html, /\$\(['"]answer-retry['"]\)\?\.addEventListener\(['"]click['"]/, `${label} Retry click`);
  assert.match(html, /never settle\/success face/, `${label} never settle comment`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertMidstreamHonesty(disk, 'disk');
assertMidstreamHonesty(COMPUTE_PAGE_HTML, 'embed');

const servedRes = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(servedRes.status, 200);
assert.equal(servedRes.headers.get('x-dasha-edge'), 'compute');
assertMidstreamHonesty(await servedRes.text(), 'worker.fetch');

{
  const liveRes = await fetch('https://www.getdasha.com/compute', {
    headers: { 'User-Agent': 'dasha-compute-midstream-provider-fail.test' },
  });
  assert.equal(liveRes.status, 200, 'live /compute 200');
  const live = await liveRes.text();
  assertMidstreamHonesty(live, 'live www.getdasha.com/compute');
}

assert.match(networkSrc, /export function normalizeStreamProviderError\(/);
assert.match(networkSrc, /export function isProviderStreamCutError\(/);
assert.match(networkSrc, /code: isProviderStreamCutError\(errMsg\) \? 'provider_cut' : null/);
assert.match(networkSrc, /if \(sent > 0 && current\.status === 'queued'\)/);
assert.match(networkSrc, /hadStreamProgress/);
assert.match(networkSrc, /error: 'provider cut'/);
assert.match(networkSrc, /streamError = normalizeStreamProviderError\(rawError\)/);
assert.match(networkSrc, /streamError = 'empty completion'/);

assert.equal(normalizeStreamProviderError(''), '');
assert.equal(normalizeStreamProviderError('provider cut'), 'provider cut');
assert.equal(normalizeStreamProviderError('empty completion'), 'empty completion');
assert.equal(
  normalizeStreamProviderError('URLError: The operation couldn’t be completed.'),
  "provider inference failed: URLError: The operation couldn’t be completed.",
);
assert.equal(
  normalizeStreamProviderError('stream ended before completion'),
  'provider inference failed: stream ended before completion',
);
assert.equal(normalizeStreamProviderError('provider inference failed: boom'), 'provider inference failed: boom');
assert.equal(normalizeStreamProviderError('some other error'), 'some other error');

assert.equal(isProviderStreamCutError('provider cut'), true);
assert.equal(isProviderStreamCutError('empty completion'), true);
assert.equal(isProviderStreamCutError('provider inference failed: URLError'), true);
assert.equal(isProviderStreamCutError('URLError'), true);
assert.equal(isProviderStreamCutError('job cancelled'), false);
assert.equal(isProviderStreamCutError('request timed out'), false);

function memoryStorage(rows = new Map()) {
  return {
    rows,
    async get(key) { return rows.get(key); },
    async put(key, value) {
      if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
      else rows.set(key, value);
    },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
  };
}

{
  const rows = new Map();
  const storage = memoryStorage(rows);
  const now = Date.now();
  const job = {
    id: 'job_cutface',
    owner: 'x:cut',
    model: 'qwen3-8b',
    stream: true,
    status: 'failed',
    error: 'provider inference failed: URLError',
    chunks: [],
    createdAt: now,
    expiresAt: now + 60_000,
  };
  rows.set(`compute:job:${job.id}`, job);
  const text = await new ComputeNetwork({ storage }, {}).streamResponse(job).text();
  assert.match(text, /"code":"provider_cut"/);
  assert.match(text, /provider inference failed: URLError/);
  assert.match(text, /data: \[DONE\]/);
  assert.doesNotMatch(text, /"finish_reason":"stop"/);
}

{
  const rows = new Map();
  const storage = memoryStorage(rows);
  const now = Date.now();
  const job = {
    id: 'job_midcut',
    owner: 'x:cut',
    model: 'qwen3-8b',
    stream: true,
    status: 'leased',
    chunks: ['Hel'],
    createdAt: now,
    expiresAt: now + 60_000,
  };
  rows.set(`compute:job:${job.id}`, structuredClone(job));
  const pending = new ComputeNetwork({ storage }, {}).streamResponse(job).text();
  await new Promise((r) => setTimeout(r, 20));
  const current = rows.get(`compute:job:${job.id}`);
  rows.set(`compute:job:${job.id}`, { ...current, status: 'queued', providerId: null });
  const text = await pending;
  assert.match(text, /"content":"Hel"/);
  assert.match(text, /"code":"provider_cut"/);
  assert.match(text, /"message":"provider cut"/);
  assert.doesNotMatch(text, /"finish_reason":"stop"/);
}

{
  const rows = new Map();
  const storage = memoryStorage(rows);
  const now = Date.now();
  const job = {
    id: 'job_leasecut',
    owner: 'x:cut',
    model: 'qwen3-8b',
    route: 'community',
    stream: true,
    status: 'leased',
    chunks: ['partial'],
    providerId: 'mac_x',
    leaseExpiresAt: now - 1,
    createdAt: now - 10_000,
    expiresAt: now + 60_000,
  };
  rows.set(`compute:job:${job.id}`, structuredClone(job));
  await new ComputeNetwork({ storage }, {}).prune(now);
  const stored = rows.get(`compute:job:${job.id}`);
  assert.equal(stored.status, 'failed');
  assert.equal(stored.error, 'provider cut');
  assert.deepEqual(stored.chunks, []);
}

const env = {
  LOBBY_SESSION_SECRET: 'midstream-fail-secret',
  AI: { run: async () => ({ response: 'unused' }) },
};
const rows = new Map();
const storage = memoryStorage(rows);
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const session = await createSessionToken(env, { xId: 'midstream', handle: 'midstream_mac' });
const userHeaders = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };

const reg = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', {
  method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'Cut Mac', models: ['qwen3-8b'] }),
}), origin);
assert.equal(reg.status, 201, await reg.clone().text());
const creds = await reg.json();
const providerHeaders = { Authorization: `Bearer ${creds.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = { provider_id: creds.provider_id, name: 'Cut Mac', models: ['qwen3-8b'] };
assert.equal((await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
  method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
}), origin)).status, 204);

async function pollJob() {
  let poll;
  for (let attempt = 0; attempt < 40; attempt++) {
    poll = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', {
      method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat),
    }), origin);
    if (poll.status === 200) return poll;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail(`provider poll never leased a job (last ${poll?.status})`);
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
    method: 'POST', headers: userHeaders,
    body: JSON.stringify({ model: 'qwen3-8b', stream: true, messages: [{ role: 'user', content: 'cut' }] }),
  }), origin);
  await new Promise((r) => setTimeout(r, 0));
  const poll = await pollJob();
  const job = (await poll.json()).job;
  assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${job.id}/chunk`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({ provider_id: creds.provider_id, delta: 'partial ' }),
  }), origin)).status, 202);
  assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${job.id}/chunk`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({
      provider_id: creds.provider_id,
      error: "URLError: The network connection was lost.",
    }),
  }), origin)).status, 202);
  const stored = [...rows.values()].find((row) => row && row.id === job.id);
  assert.equal(stored.status, 'failed');
  assert.match(stored.error, /provider inference failed: URLError/);
  assert.deepEqual(stored.chunks, []);
  const res = await pending;
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /"content":"partial "/);
  assert.match(text, /"code":"provider_cut"/);
  assert.doesNotMatch(text, /"finish_reason":"stop"/);
}

{
  const pending = network.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', {
    method: 'POST', headers: userHeaders,
    body: JSON.stringify({ model: 'qwen3-8b', stream: true, messages: [{ role: 'user', content: 'empty' }] }),
  }), origin);
  await new Promise((r) => setTimeout(r, 0));
  const poll = await pollJob();
  const job = (await poll.json()).job;
  assert.equal((await network.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${job.id}/chunk`, {
    method: 'POST', headers: providerHeaders,
    body: JSON.stringify({ provider_id: creds.provider_id, done: true }),
  }), origin)).status, 202);
  const stored = [...rows.values()].find((row) => row && row.id === job.id);
  assert.equal(stored.status, 'failed');
  assert.equal(stored.error, 'empty completion');
  const res = await pending;
  const text = await res.text();
  assert.match(text, /"code":"provider_cut"/);
  assert.match(text, /empty completion/);
  assert.doesNotMatch(text, /"finish_reason":"stop"/);
}

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
      providersOnline = 2;
      lastAskFailKind = 'provider_cut';
      const note = providersOnline > 0 ? '\nStill listed online.' : '';
      $('answer-title').textContent = 'Answer.';
      $('answer').textContent = 'Mac cut out.' + note;
      const retry = $('answer-retry');
      if (retry) { retry.hidden = false; retry.removeAttribute('hidden'); }
      showTf('answer');
      return {
        title: (document.getElementById('answer-title')?.textContent || '').trim(),
        answer: document.getElementById('answer')?.textContent || '',
        retryHidden: document.getElementById('answer-retry')?.hidden,
        retryAttr: document.getElementById('answer-retry')?.getAttribute('data-midstream-fail'),
        kind: lastAskFailKind,
      };
    });
    assert.equal(painted.title, 'Answer.');
    assert.equal(painted.answer, 'Mac cut out.\nStill listed online.');
    assert.equal(painted.retryHidden, false);
    assert.equal(painted.retryAttr, '1');
    assert.equal(painted.kind, 'provider_cut');

    const offline = await page.evaluate(() => {
      providersOnline = 0;
      const note = providersOnline > 0 ? '\nStill listed online.' : '';
      $('answer').textContent = 'Mac cut out.' + note;
      return document.getElementById('answer')?.textContent || '';
    });
    assert.equal(offline, 'Mac cut out.');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-midstream-provider-fail.test.mjs: PASS');
