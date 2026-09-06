#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 66c5ac55): live settlement/billing + getting-started
 * leftovers (+ /compute/* tabs, slash / Title-case) html-404 → 308 /compute.
 * /endpoint /endpoints /sdk /cli + /compute/* tabs → 308 /compute/api
 * (lobby host rewrites Location onto lobby). /purchase → /how-to-buy.
 * /once-a-day /once_a_day → /faucet. Apex only for faucet leftover —
 * do not invent /compute/once-a-day. Title-case via existing dest lowercasing.
 * Exact /compute stays 200 (null dest). Skip /health /status /openai /v1
 * /admin /blog /tos — do not invent a fold. Disk only. No Designer.
 * Never plugin.jup.ag.
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
assert.match(workerSrc, /POTTER_COMPUTE_API_DOCS_308_PATHS/, 'api-docs 308 set present');
assert.match(workerSrc, /POTTER_HOWTO_308_PATHS/, 'howto 308 set present');
assert.match(workerSrc, /POTTER_FAUCET_DOOR_308_PATHS/, 'faucet door 308 set present');
assert.match(
  workerSrc,
  /Settlement\/billing \+ getting-started leftovers/,
  'compute leftover comment names settlement/billing family',
);
assert.match(
  workerSrc,
  /Leftover \/endpoint \/endpoints \/sdk \/cli/,
  'api leftover comment lists /endpoint /endpoints /sdk /cli',
);
assert.match(
  workerSrc,
  /Leftover: \/purchase/,
  'howto leftover comment lists /purchase',
);
assert.match(
  workerSrc,
  /Leftover \/once-a-day \/once_a_day/,
  'faucet leftover comment lists /once-a-day /once_a_day',
);
assert.match(
  workerSrc,
  /\/settlement\|\/settlements\|\/invoice\|\/invoices\|\/credit\|\/refill\|\/kits\|\/try\|\/getting-started\|\/get-started\|\/getstarted\|\/mac_kit/,
  'potterHome308Dest comment lists settlement/billing family',
);
assert.match(
  workerSrc,
  /\/endpoint\|\/endpoints\|\/sdk\|\/cli\|\/compute\/endpoint\|\/compute\/endpoints\|\/compute\/sdk\|\/compute\/cli/,
  'potterHome308Dest comment lists endpoint/sdk/cli family',
);
assert.match(
  workerSrc,
  /\/how-tobuy\|\/howto_buy\|\/purchase/,
  'potterHome308Dest comment lists /purchase on howto family',
);
assert.match(
  workerSrc,
  /\/once-a-day\|\/once_a_day/,
  'potterHome308Dest comment lists once-a-day on faucet family',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const apiDocs = workerSrc.match(/const POTTER_COMPUTE_API_DOCS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const howto = workerSrc.match(/const POTTER_HOWTO_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const faucet = workerSrc.match(/const POTTER_FAUCET_DOOR_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

const COMPUTE_LEAVES = [
  'settlement', 'settlements', 'invoice', 'invoices', 'credit', 'refill',
  'kits', 'try', 'getting-started', 'get-started', 'getstarted', 'mac_kit',
];
const API_LEAVES = ['endpoint', 'endpoints', 'sdk', 'cli'];

for (const leaf of COMPUTE_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
}
for (const leaf of API_LEAVES) {
  assert.match(apiDocs, new RegExp(`'/${leaf}'`));
  assert.match(apiDocs, new RegExp(`'/compute/${leaf}'`));
  assert.doesNotMatch(tab, new RegExp(`['"]/${leaf}['"]`), `/${leaf} is api-docs, not compute-tab`);
}
assert.match(howto, /'\/purchase'/);
assert.match(faucet, /'\/once-a-day'/);
assert.match(faucet, /'\/once_a_day'/);
assert.doesNotMatch(tab, /['"]\/purchase['"]/, '/purchase is howto, not compute-tab');
assert.doesNotMatch(tab, /['"]\/once-a-day['"]/, '/once-a-day is faucet, not compute-tab');
assert.doesNotMatch(faucet, /['"]\/compute\/once-a-day['"]/, 'do not invent /compute/once-a-day');
assert.doesNotMatch(tab, /['"]\/health['"]/, 'do not invent /health');
assert.doesNotMatch(tab, /['"]\/status['"]/, 'do not invent /status');
assert.doesNotMatch(tab, /['"]\/openai['"]/, 'do not invent /openai');
assert.doesNotMatch(tab, /['"]\/v1['"]/, 'do not invent /v1');
assert.doesNotMatch(tab, /['"]\/admin['"]/, 'do not invent /admin');
assert.doesNotMatch(tab, /['"]\/blog['"]/, 'do not invent /blog');
assert.doesNotMatch(tab, /['"]\/tos['"]/, 'do not invent /tos');
assert.doesNotMatch(apiDocs, /['"]\/openai['"]/, 'do not invent /openai on api-docs set');
assert.doesNotMatch(apiDocs, /['"]\/v1['"]/, 'do not invent /v1 on api-docs set');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const API = `${WWW}/compute/api`;
const HOWTO = `${WWW}/how-to-buy`;
const FAUCET = `${WWW}/faucet`;

const TO_COMPUTE = COMPUTE_LEAVES.flatMap((leaf) => [
  `/${leaf}`, `/${leaf}/`,
  `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
  `/${leaf.toUpperCase()}`,
  `/compute/${leaf}`, `/compute/${leaf}/`,
  `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
]);
const TO_API = API_LEAVES.flatMap((leaf) => [
  `/${leaf}`, `/${leaf}/`,
  `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
  `/${leaf.toUpperCase()}`,
  `/compute/${leaf}`, `/compute/${leaf}/`,
  `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
]);
const TO_HOWTO = [
  '/purchase', '/purchase/', '/Purchase', '/PURCHASE', '/pUrChAsE/',
];
const TO_FAUCET = [
  '/once-a-day', '/once-a-day/', '/Once-a-day', '/ONCE-A-DAY', '/Once-A-Day/',
  '/once_a_day', '/once_a_day/', '/Once_a_day', '/ONCE_A_DAY', '/Once_A_Day/',
];
const PRIOR_COMPUTE = [
  '/settle', '/settle/', '/Settle',
  '/billing', '/Billing',
  '/pay', '/Pay',
  '/usdc', '/Usdc',
  '/mac-kit', '/Mac-kit',
  '/compute/settle', '/compute/billing', '/compute/mac-kit',
];
const PRIOR_API = ['/gateway', '/Gateway', '/compute/gateway', '/swagger', '/openapi'];
const PRIOR_HOWTO = ['/buy', '/Buy', '/howto', '/Howto'];
const PRIOR_FAUCET = ['/donate', '/Donate', '/tip', '/Tip'];
const SKIP_404 = [
  '/admin', '/admin/', '/Admin',
  '/blog', '/blog/', '/Blog',
  '/tos', '/tos/', '/Tos',
];
const SKIP_UNTOUCHED = [
  '/health', '/health/',
  '/status', '/status/',
  '/openai', '/openai/', '/OpenAI',
  '/v1', '/v1/',
];
const STAY_OUT = [...SKIP_404, ...SKIP_UNTOUCHED];

for (const path of [...TO_COMPUTE, ...PRIOR_COMPUTE]) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of [...TO_API, ...PRIOR_API]) {
  assert.equal(potterHome308Dest(path), API, path);
}
for (const path of [...TO_HOWTO, ...PRIOR_HOWTO]) {
  assert.equal(potterHome308Dest(path), HOWTO, path);
}
for (const path of [...TO_FAUCET, ...PRIOR_FAUCET]) {
  assert.equal(potterHome308Dest(path), FAUCET, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays JSON');
assert.equal(potterHome308Dest('/how-to-buy'), null, '/how-to-buy stays 200');
assert.equal(potterHome308Dest('/faucet'), null, '/faucet stays 200');
assert.equal(potterHome308Dest('/compute/once-a-day'), null, 'do not invent /compute/once-a-day');
assert.equal(potterHome308Dest('/compute/purchase'), null, 'do not invent /compute/purchase');
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
  LOBBY_SESSION_SECRET: 'settlement-billing-endpoint-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
const FETCH_FOLDS = [
  ...TO_COMPUTE.map((path) => [path, COMPUTE]),
  ...TO_API.map((path) => [path, API]),
  ...TO_HOWTO.map((path) => [path, HOWTO]),
  ...TO_FAUCET.map((path) => [path, FAUCET]),
  ...PRIOR_COMPUTE.map((path) => [path, COMPUTE]),
  ...PRIOR_API.map((path) => [path, API]),
  ...PRIOR_HOWTO.map((path) => [path, HOWTO]),
  ...PRIOR_FAUCET.map((path) => [path, FAUCET]),
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
  const howtoPage = await edgeWorker.fetch(new Request(`https://${host}/how-to-buy`), env);
  assert.equal(howtoPage.status, 200, `${host} /how-to-buy stays 200`);
  const faucetPage = await edgeWorker.fetch(new Request(`https://${host}/faucet`), env);
  assert.equal(faucetPage.status, 200, `${host} /faucet stays 200`);
  for (const method of ['GET', 'HEAD']) {
    const api = await edgeWorker.fetch(new Request(`https://${host}/compute/api`, { method }), env);
    assert.equal(api.status, 200, `${host} /compute/api ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await api.text(), '');
  }
  for (const path of SKIP_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 404, `${host} ${path} ${method} stays 404`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (host === 'www.getdasha.com') {
        assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${host} ${path} ${method} html-404`);
        if (method === 'HEAD') assert.equal(await res.text(), '');
      }
    }
  }
  for (const path of SKIP_UNTOUCHED) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), API, `${host} ${path} ${method} not folded to api`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/settlement', '/settlements', '/invoice', '/invoices', '/credit', '/refill',
  '/kits', '/try', '/getting-started', '/get-started', '/getstarted', '/mac_kit',
  '/endpoint', '/endpoints', '/sdk', '/cli', '/purchase', '/once-a-day', '/once_a_day',
  '/health', '/status', '/openai', '/v1', '/admin', '/blog', '/tos',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-settlement-billing-endpoint-pretty-path: PASS (settlement/billing+getting-started 308 /compute; /endpoint+/sdk+/cli 308 /compute/api lobby rewrite; /purchase 308 /how-to-buy; /once-a-day 308 /faucet; Title-case+slash+tab peers; /settle+/billing+/pay+/usdc+/mac-kit+/buy+/donate regression; /compute+/compute/api+/how-to-buy+/faucet 200; /health+/status+/openai+/v1+/admin+/blog+/tos stay out; no plugin.jup.ag)');
