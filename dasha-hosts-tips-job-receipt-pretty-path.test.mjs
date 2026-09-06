#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 7528e50a): live compute doors /hosts /inferences
 * /key /keys /apikey /api-key /api_key /install /doctor /me /usage + /inference
 * /gpu /gpus /pricing /providing /mac-kit (+ /compute/* peers, slash / Title-case)
 * html-404 → 308 /compute. Faucet /tips /compute/tips (peer of /tip) → /faucet.
 * API synonyms: /job /compute/job /api/job → /compute/api/jobs;
 * /receipt /receipts /compute/receipt(s) /api/receipt(s) → /compute/api/receipts;
 * /api/keys → /compute/api/keys. Lobby rewrites /compute/api* Location onto
 * lobby host (same as dasha-compute-api-prefix / skills-md-swagger).
 * Regression: /host /tip /jobs /pay /usdc still fold. Exact /compute and
 * /faucet/me stay non-308. Skip /openai /v1 /resend /email /health /status
 * /healthz. Disk only. No Designer. Never plugin.jup.ag. Never Demigod.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(workerSrc, /POTTER_FAUCET_DOOR_308_PATHS/, 'faucet door 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_API_JOBS_308_PATHS/, 'jobs 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_API_RECEIPTS_308_PATHS/, 'receipts 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_API_KEYS_308_PATHS/, 'api keys 308 set present');
assert.match(
  workerSrc,
  /Leftover compute doors: live \/hosts \/inferences \/key \/keys/,
  'compute-door leftover comment',
);
assert.match(
  workerSrc,
  /Leftover plural \/tips \/compute\/tips/,
  'faucet /tips leftover comment',
);
assert.match(
  workerSrc,
  /Leftover singular \/job \/compute\/job \/api\/job/,
  'job synonym leftover comment',
);
assert.match(
  workerSrc,
  /Leftover \/receipt \/receipts \/compute\/receipt\(s\) \/api\/receipt\(s\)/,
  'receipt leftover comment',
);
assert.match(
  workerSrc,
  /Leftover \/api\/keys → \/compute\/api\/keys/,
  'api/keys leftover comment',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const faucet = workerSrc.match(/const POTTER_FAUCET_DOOR_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const jobs = workerSrc.match(/const POTTER_COMPUTE_API_JOBS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const receipts = workerSrc.match(/const POTTER_COMPUTE_API_RECEIPTS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const apiKeys = workerSrc.match(/const POTTER_COMPUTE_API_KEYS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

const COMPUTE_LEAVES = [
  'hosts', 'inferences', 'key', 'keys', 'apikey', 'api-key', 'api_key',
  'install', 'doctor', 'me', 'usage', 'inference', 'gpu', 'gpus',
  'pricing', 'providing', 'mac-kit',
];
for (const leaf of COMPUTE_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
}
assert.match(faucet, /'\/tips'/);
assert.match(faucet, /'\/compute\/tips'/);
assert.match(jobs, /'\/job'/);
assert.match(jobs, /'\/compute\/job'/);
assert.match(jobs, /'\/api\/job'/);
assert.match(receipts, /'\/receipt'/);
assert.match(receipts, /'\/receipts'/);
assert.match(receipts, /'\/compute\/receipt'/);
assert.match(receipts, /'\/api\/receipts'/);
assert.match(apiKeys, /'\/api\/keys'/);
assert.doesNotMatch(apiKeys, /['"]\/keys['"]/, '/keys is compute-tab, not api-keys set');
assert.doesNotMatch(tab, /['"]\/openai['"]/, 'do not invent /openai on compute-tab set');
assert.doesNotMatch(tab, /['"]\/v1['"]/, 'do not invent /v1');
assert.doesNotMatch(tab, /['"]\/resend['"]/, 'do not invent /resend');
assert.doesNotMatch(tab, /['"]\/email['"]/, 'do not invent /email');
assert.doesNotMatch(tab, /['"]\/health['"]/, 'do not invent /health');
assert.doesNotMatch(tab, /['"]\/status['"]/, 'do not invent /status');
assert.doesNotMatch(tab, /['"]\/healthz['"]/, 'do not invent /healthz');
assert.doesNotMatch(tab, /['"]\/api\/keys['"]/, '/api/keys is not a compute-tab fold');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const FAUCET = `${WWW}/faucet`;
const JOBS = `${WWW}/compute/api/jobs`;
const RECEIPTS = `${WWW}/compute/api/receipts`;
const KEYS = `${WWW}/compute/api/keys`;

const TO_COMPUTE = COMPUTE_LEAVES.flatMap((leaf) => [
  `/${leaf}`, `/${leaf}/`,
  `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
  `/${leaf.toUpperCase()}`,
  `/compute/${leaf}`, `/compute/${leaf}/`,
  `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
]);
const TO_FAUCET = [
  '/tips', '/tips/', '/Tips', '/TIPS', '/tIpS/',
  '/compute/tips', '/compute/tips/', '/Compute/tips', '/COMPUTE/TIPS', '/Compute/Tips/',
];
const TO_JOBS = [
  '/job', '/job/', '/Job', '/JOB', '/jOb/',
  '/compute/job', '/compute/job/', '/Compute/job', '/COMPUTE/JOB',
  '/api/job', '/api/job/', '/Api/Job', '/API/JOB',
];
const TO_RECEIPTS = [
  '/receipt', '/receipt/', '/Receipt', '/RECEIPT',
  '/receipts', '/receipts/', '/Receipts', '/RECEIPTS',
  '/compute/receipt', '/compute/receipt/', '/Compute/receipt', '/COMPUTE/RECEIPT',
  '/compute/receipts', '/compute/receipts/', '/Compute/receipts', '/COMPUTE/RECEIPTS',
  '/api/receipt', '/api/receipt/', '/Api/Receipt', '/API/RECEIPT',
  '/api/receipts', '/api/receipts/', '/Api/Receipts', '/API/RECEIPTS',
];
const TO_KEYS = [
  '/api/keys', '/api/keys/', '/Api/Keys', '/API/KEYS', '/API/keys/',
];
const PRIOR_COMPUTE = ['/host', '/host/', '/Host', '/pay', '/Pay', '/usdc', '/Usdc'];
const PRIOR_FAUCET = ['/tip', '/tip/', '/Tip', '/TIP'];
const PRIOR_JOBS = ['/jobs', '/jobs/', '/Jobs', '/compute/jobs', '/api/jobs'];
const STAY_OUT = [
  '/openai', '/openai/', '/OpenAI',
  '/v1', '/v1/',
  '/resend', '/resend/', '/Resend',
  '/email', '/email/', '/Email',
  '/health', '/health/',
  '/status', '/status/',
  '/healthz', '/healthz/',
];

for (const path of [...TO_COMPUTE, ...PRIOR_COMPUTE]) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of [...TO_FAUCET, ...PRIOR_FAUCET]) {
  assert.equal(potterHome308Dest(path), FAUCET, path);
}
for (const path of [...TO_JOBS, ...PRIOR_JOBS]) {
  assert.equal(potterHome308Dest(path), JOBS, path);
}
for (const path of TO_RECEIPTS) {
  assert.equal(potterHome308Dest(path), RECEIPTS, path);
}
for (const path of TO_KEYS) {
  assert.equal(potterHome308Dest(path), KEYS, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/faucet/me'), null, '/faucet/me stays 200');
assert.equal(potterHome308Dest('/faucet/me/'), null, '/faucet/me/ stays faucet leaf');
assert.equal(potterHome308Dest('/keys'), COMPUTE, '/keys is compute door, not api keys');
assert.equal(potterHome308Dest('/compute/keys'), COMPUTE, '/compute/keys is compute door');
assert.equal(potterHome308Dest('/api/keys'), KEYS, '/api/keys folds to API');
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  const u = new URL(dest);
  if (u.pathname === '/compute/api' || u.pathname.startsWith('/compute/api/')) {
    return LOBBY + u.pathname;
  }
  return dest;
}

const env = {
  LOBBY_SESSION_SECRET: 'hosts-tips-job-receipt-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  FAUCET: {
    idFromName() { return 'main'; },
    get() {
      return {
        async fetch() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          });
        },
      };
    },
  },
};
const FETCH_FOLDS = [
  ...TO_COMPUTE.map((path) => [path, COMPUTE]),
  ...TO_FAUCET.map((path) => [path, FAUCET]),
  ...TO_JOBS.map((path) => [path, JOBS]),
  ...TO_RECEIPTS.map((path) => [path, RECEIPTS]),
  ...TO_KEYS.map((path) => [path, KEYS]),
  ...PRIOR_COMPUTE.map((path) => [path, COMPUTE]),
  ...PRIOR_FAUCET.map((path) => [path, FAUCET]),
  ...PRIOR_JOBS.map((path) => [path, JOBS]),
];

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of FETCH_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const want = expectLoc(host, dest);
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  const faucetMe = await edgeWorker.fetch(new Request(`https://${host}/faucet/me`), env);
  assert.equal(faucetMe.status, 200, `${host} /faucet/me stays 200`);
  assert.notEqual(faucetMe.headers.get('location'), COMPUTE, `${host} /faucet/me not folded to compute`);
  for (const path of STAY_OUT) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), FAUCET, `${host} ${path} ${method} not folded to faucet`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/hosts', '/inferences', '/key', '/keys', '/apikey', '/me', '/usage', '/mac-kit',
  '/tips', '/compute/tips', '/job', '/receipt', '/receipts', '/api/keys',
  '/openai', '/v1', '/resend', '/email', '/health', '/status', '/healthz',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-hosts-tips-job-receipt-pretty-path: PASS (compute doors 308 /compute; /tips 308 /faucet; /job→jobs /receipt(s)→receipts /api/keys→keys; lobby api same-host; /host /tip /jobs /pay /usdc regression; /compute+/faucet/me non-308; skips stay out; no plugin.jup.ag)');
