#!/usr/bin/env node
/**
 * Honesty-floor canary — reconstruct of ship-tree dasha-compute-canary-suite.test.mjs.
 * Box ship-src was not mounted; pins live www.getdasha.com/compute markers +
 * disk Worker contracts already on this tree.
 *
 * Floor: network · factory settled_24h · presence/act · midstream-fail ·
 * provide one-door · honesty enrolled · phase0 · x402 flag_off · privacy/studio.
 *
 * Test-only. No wrangler. No Designer. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const diskHtml = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const networkSrc = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
assert.equal(diskHtml, COMPUTE_PAGE_HTML, 'html ↔ page.mjs sync');
assert.doesNotMatch(diskHtml, /plugin\.jup\.ag/);
assert.doesNotMatch(networkSrc, /plugin\.jup\.ag/);

const ZERO_SETTLED = { tokens: 0, jobs: 0, cents: 0 };
const LIVE_HOST = 'https://www.getdasha.com';
const UA = 'dasha-compute-canary-suite.test';

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

function assertSettled24h(body, label, { allowNonZero = false } = {}) {
  assert.ok(body && typeof body === 'object', `${label} object`);
  const s = body.settled_24h;
  assert.ok(s && typeof s === 'object', `${label} settled_24h`);
  for (const key of ['tokens', 'jobs', 'cents']) {
    assert.equal(typeof s[key], 'number', `${label} settled_24h.${key}`);
    assert.ok(Number.isFinite(s[key]) && s[key] >= 0, `${label} settled_24h.${key} >= 0`);
  }
  if (!allowNonZero) assert.deepEqual(s, ZERO_SETTLED, `${label} honest zero settled_24h`);
}

function assertNetworkShape(body, label, { empty = false } = {}) {
  assert.equal(typeof body.providers_online, 'number', `${label} providers_online`);
  assert.ok(Number.isInteger(body.providers_online) && body.providers_online >= 0, `${label} providers_online int`);
  assert.ok(Array.isArray(body.models_available), `${label} models_available`);
  assert.ok(Array.isArray(body.capacity), `${label} capacity`);
  assert.equal(typeof body.jobs_queued, 'number', `${label} jobs_queued`);
  if (empty) {
    assert.equal(body.providers_online, 0, `${label} empty fleet`);
    assert.deepEqual(body.models_available, [], `${label} no invented models`);
    assert.deepEqual(body.capacity, [], `${label} no invented capacity`);
    assert.equal(body.jobs_queued, 0, `${label} no invented queue`);
  }
}

function assertHonestyFloorHtml(html, label) {
  // presence / Act tape
  assert.match(html, /id=["']presence-act-boot["']/, `${label} presence-act-boot`);
  assert.match(html, /id=["']presence-community["'][^>]*>No Mac advertising</, `${label} No Mac advertising`);
  assert.match(html, /id=["']presence-enrolled-boot["']/, `${label} presence-enrolled-boot`);
  assert.match(html, /id=["']act-tape-boot["']/, `${label} act-tape-boot`);
  assert.match(html, /id=["']presence-strip["']/, `${label} presence-strip`);
  assert.match(html, /id=["']act-tape["']/, `${label} act-tape`);
  assert.match(html, /function paintPresenceActBoot\(/, `${label} paintPresenceActBoot`);
  assert.match(html, /Community advertising ≠ OCM enrolled/, `${label} advertising ≠ enrolled`);

  // midstream-fail
  assert.match(html, /<!-- midstream-fail-honesty:2026-09-07 -->/, `${label} midstream marker`);
  assert.match(html, /id=["']answer-retry["'][^>]*data-midstream-fail=["']1["']/, `${label} data-midstream-fail`);
  assert.match(html, /Mac cut out\./, `${label} Mac cut out.`);
  assert.match(html, /Still listed online\./, `${label} Still listed online.`);

  // provide one-door
  assert.match(
    html,
    /id=["']provide-ocm-fine["'][^>]*>Community kit · one Register → Setup · soft doctor warns only\.</,
    `${label} #provide-ocm-fine`,
  );
  assert.match(
    html,
    /id=["']provide-ocm-status["'][^>]*href=["']\/compute\/ocm\/status["']/,
    `${label} #provide-ocm-status`,
  );
  assert.match(html, /id=["']register-provider["']/, `${label} Register CTA`);
  assert.doesNotMatch(html, /id=["']provide-ocm-host["']/, `${label} no #provide-ocm-host`);
  assert.doesNotMatch(html, /paste-ocm_host_/, `${label} no paste-ocm_host_`);

  // honesty enrolled ≠ advertising
  assert.match(html, /id=["']honesty-enrolled["']/, `${label} honesty-enrolled`);
  assert.match(html, /id=["']honesty-enrolled-sep["']/, `${label} honesty-enrolled-sep`);
  assert.match(html, /id=["']honesty-macs["'][^>]*>No Mac online</, `${label} honesty-macs`);
  assert.match(html, /never pad enrolled OCM/, `${label} never pad enrolled`);

  // phase0 receipt
  assert.match(html, /function honestyFieldsFrom\(/, `${label} honestyFieldsFrom`);
  assert.match(html, /id=["']answer-receipt-note["']/, `${label} answer-receipt-note`);
  assert.match(html, /no enclave · attestation N\/A/, `${label} no enclave copy`);
  assert.match(html, /attestation always null/, `${label} attestation always null`);
  assert.doesNotMatch(html, /Caution-verifiable/, `${label} no Caution-verifiable`);

  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /\/room|Project Room/, `${label} no Project Room`);
}

function assertDiskHonestyContracts(html, label) {
  // Contracts already on this tree (sibling honesty-panel / settled-ui).
  assert.match(html, /id=["']honesty-panel["']/, `${label} honesty-panel`);
  assert.match(html, /id=["']honesty-macs["'][^>]*>No Mac online</, `${label} honesty-macs`);
  assert.match(html, /id=["']honesty-settled["'][^>]*>0 tok · 24h</, `${label} honesty-settled`);
  assert.match(html, /id=["']settled-24h["']/, `${label} settled-24h`);
  assert.match(html, /\/compute\/api\/network/, `${label} network fetch`);
  assert.match(html, /\/compute\/api\/factory/, `${label} factory fetch`);
  assert.match(html, /function formatSettledLine\(/, `${label} formatSettledLine`);
  assert.match(html, /never pad enrolled OCM/, `${label} never pad enrolled`);
  assert.match(html, /Advertising only \(providers_online\)/, `${label} advertising only`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /\/room|Project Room/, `${label} no Project Room`);
}

async function liveFetch(path, init = {}) {
  const res = await fetch(`${LIVE_HOST}${path}`, {
    redirect: 'manual',
    headers: { 'User-Agent': UA, Accept: init.accept || '*/*', ...init.headers },
    signal: AbortSignal.timeout(12_000),
  });
  return res;
}

// --- disk: network empty zeros ---
{
  const rows = new Map();
  const network = new ComputeNetwork({ storage: memoryStorage(rows) }, {
    AI: { run: async () => ({ response: 'ok' }) },
    LOBBY_SESSION_SECRET: 'canary-suite-secret',
  });
  const net = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/network'));
  assert.equal(net.status, 200, 'disk network 200');
  assertNetworkShape(await net.json(), 'disk network', { empty: true });
  assert.equal([...rows.keys()].some((k) => k.startsWith('compute:provider:')), false, 'disk must not invent Macs');

  const v1 = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/network/'));
  assert.equal(v1.status, 200, 'disk v1/network 200');
  assertNetworkShape(await v1.json(), 'disk v1/network', { empty: true });
}

// --- disk: factory settled_24h honest zeros ---
{
  const network = new ComputeNetwork({ storage: memoryStorage() }, {
    AI: { run: async () => ({ response: 'ok' }) },
    LOBBY_SESSION_SECRET: 'canary-suite-factory',
  });
  const fac = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/factory'));
  assert.equal(fac.status, 200, 'disk factory 200');
  const body = await fac.json();
  assert.equal(body.schema, 'factory.compute.v0', 'disk factory schema');
  assert.deepEqual(body.jobs, { hosted: 0, community: 0, mixture: 0, failed: 0 }, 'disk factory honest zero jobs');
  assertSettled24h(body, 'disk factory');
  assert.match(body.note || '', /settled_24h = paid-inference only/);
  assert.doesNotMatch(JSON.stringify(body), /"prompt"|"messages"/);
}

// --- disk: privacy 200 / studio 308 ---
{
  const privacy = await worker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(privacy.status, 200, 'disk /privacy 200');
  assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  const privacyHtml = await privacy.text();
  assert.match(privacyHtml, /<h1>Privacy<\/h1>/);
  assert.doesNotMatch(privacyHtml, /plugin\.jup\.ag/);
  assert.doesNotMatch(privacyHtml, /Studio,/);

  const studio = await worker.fetch(new Request('https://www.getdasha.com/studio'), {});
  assert.equal(studio.status, 308, 'disk /studio 308');
  assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');
  assert.doesNotMatch(await studio.text(), /Dasha Studio/);
}

// --- disk HTML contracts already mirrored ---
assertDiskHonestyContracts(diskHtml, 'disk');
assertDiskHonestyContracts(COMPUTE_PAGE_HTML, 'embed');
{
  const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
  assert.equal(served.status, 200, 'disk /compute 200');
  assert.equal(served.headers.get('x-dasha-edge'), 'compute');
  assertDiskHonestyContracts(await served.text(), 'worker.fetch');
}

assert.match(networkSrc, /settled_24h: publicSettled24h/);
assert.match(networkSrc, /settled_24h = paid-inference only/);
assert.match(networkSrc, /providers_online: providers\.length/);

// --- live honesty floor (SoR for ships not yet on this tree) ---
{
  const live = await liveFetch('/compute', { accept: 'text/html' });
  assert.equal(live.status, 200, 'live /compute 200');
  assert.equal(live.headers.get('x-dasha-edge'), 'compute', 'live edge=compute');
  const liveHtml = await live.text();
  assertHonestyFloorHtml(liveHtml, 'live www.getdasha.com/compute');
}

{
  const net = await liveFetch('/compute/api/network');
  assert.equal(net.status, 200, 'live network 200');
  const body = await net.json();
  assertNetworkShape(body, 'live network');
  assert.doesNotMatch(JSON.stringify(body), /"prompt"|"messages"/);
}

{
  const fac = await liveFetch('/compute/api/factory');
  assert.equal(fac.status, 200, 'live factory 200');
  const body = await fac.json();
  assert.equal(body.schema, 'factory.compute.v0', 'live factory schema');
  assertSettled24h(body, 'live factory', { allowNonZero: true });
  assert.match(body.note || '', /settled_24h = paid-inference only/);
  assert.doesNotMatch(JSON.stringify(body), /"prompt"|"messages"/);
}

{
  const api = await liveFetch('/compute/api');
  assert.equal(api.status, 200, 'live /compute/api 200');
  const body = await api.json();
  assert.equal(body.billing?.x402, 'flag_off', 'live /compute/api x402 flag_off');
  assert.match(String(body.billing?.chat_completions || ''), /Prepaid credits/, 'live prepaid credits stay');
}

{
  const v1 = await liveFetch('/compute/api/v1');
  assert.equal(v1.status, 200, 'live /compute/api/v1 200');
  const body = await v1.json();
  assert.equal(body.billing?.x402, 'flag_off', 'live /v1 x402 flag_off');
  assert.equal(body.service, 'dasha-compute');
}

{
  const privacy = await liveFetch('/privacy', { accept: 'text/html' });
  assert.equal(privacy.status, 200, 'live /privacy 200');
  assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  const html = await privacy.text();
  assert.match(html, /<h1>Privacy<\/h1>/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const studio = await liveFetch('/studio');
  assert.equal(studio.status, 308, 'live /studio 308');
  assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');
}

console.log('dasha-compute-canary-suite: PASS (disk network/factory/privacy/studio + live honesty floor)');
