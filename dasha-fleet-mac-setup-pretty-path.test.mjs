#!/usr/bin/env node
/**
 * Leftover pretty path (Worker e8adc1ad): live fleet/capacity + console/credits
 * + Mac/local + setup/try + kit/prefer leftovers (+ /compute/* tabs, slash /
 * Title-case) html-404 → 308 /compute. Apex /donate /donate/ → /faucet.
 * Title-case works via existing dest lowercasing.
 * Exact /compute stays 200 (null dest). Skip /admin /blog /news /faq /waitlist
 * /join /oauth /status /health — do not invent a fold. Do not invent
 * /compute/donate. Disk only. No Designer. Never plugin.jup.ag.
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
assert.match(
  workerSrc,
  /Fleet\/capacity \+ console\/credits \+ Mac\/local \+ setup\/try \+ kit\/prefer leftovers/,
  'compute leftover comment names fleet/mac/setup families',
);
assert.match(
  workerSrc,
  /Leftover \/donate \/donate\//,
  'faucet leftover comment lists /donate',
);
assert.match(
  workerSrc,
  /\/rent\|\/capacity\|\/offer\|\/offers\|\/worker\|\/workers\|\/node\|\/nodes\|\/cluster\|\/pool\|\/machines\|\/benchmark\|\/queue/,
  'potterHome308Dest comment lists fleet/capacity family',
);
assert.match(
  workerSrc,
  /\/dashboard\|\/console\|\/balance\|\/pay-usdc\|\/apple-silicon\|\/macos\|\/silicon\|\/local\|\/edge/,
  'potterHome308Dest comment lists console + Mac family',
);
assert.match(
  workerSrc,
  /\/onboard\|\/setup\|\/quickstart\|\/playground\|\/sandbox\|\/hello\|\/example\|\/examples\|\/prefer\|\/preference\|\/preferences/,
  'potterHome308Dest comment lists setup + kit family',
);
assert.match(
  workerSrc,
  /\/donate \/compute\/faucet/,
  'potterHome308Dest comment lists /donate on faucet family',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const faucet = workerSrc.match(/const POTTER_FAUCET_DOOR_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

const FLEET_LEAVES = [
  'rent', 'capacity', 'offer', 'offers', 'worker', 'workers', 'node', 'nodes',
  'cluster', 'pool', 'machines', 'benchmark', 'queue',
];
const CONSOLE_LEAVES = ['dashboard', 'console', 'balance', 'pay-usdc'];
const MAC_LEAVES = ['apple-silicon', 'macos', 'silicon', 'local', 'edge'];
const SETUP_LEAVES = ['onboard', 'setup', 'quickstart', 'playground', 'sandbox'];
const KIT_LEAVES = ['hello', 'example', 'examples', 'prefer', 'preference', 'preferences'];
const COMPUTE_LEAVES = [...FLEET_LEAVES, ...CONSOLE_LEAVES, ...MAC_LEAVES, ...SETUP_LEAVES, ...KIT_LEAVES];

for (const leaf of COMPUTE_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
}
assert.match(faucet, /'\/donate'/);
assert.doesNotMatch(tab, /['"]\/donate['"]/, '/donate is faucet, not compute-tab');
assert.doesNotMatch(tab, /['"]\/compute\/donate['"]/, 'do not invent /compute/donate');
assert.doesNotMatch(faucet, /['"]\/compute\/donate['"]/, 'do not invent /compute/donate on faucet set');
assert.doesNotMatch(tab, /['"]\/admin['"]/, 'do not invent /admin');
assert.doesNotMatch(tab, /['"]\/blog['"]/, 'do not invent /blog');
assert.doesNotMatch(tab, /['"]\/news['"]/, 'do not invent /news');
assert.doesNotMatch(tab, /['"]\/faq['"]/, 'do not invent /faq');
assert.doesNotMatch(tab, /['"]\/waitlist['"]/, 'do not invent /waitlist');
assert.doesNotMatch(tab, /['"]\/join['"]/, 'do not invent /join');
assert.doesNotMatch(tab, /['"]\/oauth['"]/, 'do not invent /oauth');
assert.doesNotMatch(tab, /['"]\/status['"]/, 'do not invent /status');
assert.doesNotMatch(tab, /['"]\/health['"]/, 'do not invent /health');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const COMPUTE = 'https://www.getdasha.com/compute';
const FAUCET = 'https://www.getdasha.com/faucet';

const TO_COMPUTE = COMPUTE_LEAVES.flatMap((leaf) => [
  `/${leaf}`, `/${leaf}/`,
  `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
  `/${leaf.toUpperCase()}`,
  `/compute/${leaf}`, `/compute/${leaf}/`,
  `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
]);
const TO_FAUCET = [
  '/donate', '/donate/', '/Donate', '/DONATE', '/dOnAtE/',
];
const PRIOR_COMPUTE = [
  '/host', '/host/', '/Host',
  '/pay', '/Pay',
  '/usdc', '/Usdc',
  '/mac-kit', '/Mac-kit',
  '/compute/usdc', '/compute/mac-kit',
];
const PRIOR_FAUCET = ['/tip', '/tip/', '/Tip', '/tips', '/Tips'];
const SKIP_404 = [
  '/admin', '/admin/', '/Admin', '/ADMIN',
  '/blog', '/blog/', '/Blog', '/BLOG',
  '/news', '/news/', '/News', '/NEWS',
  '/faq', '/faq/', '/Faq', '/FAQ',
  '/waitlist', '/waitlist/', '/Waitlist', '/WAITLIST',
  '/join', '/join/', '/Join', '/JOIN',
];
const SKIP_UNTOUCHED = [
  '/oauth', '/oauth/', '/OAuth',
  '/status', '/status/', '/Status',
  '/health', '/health/', '/Health',
];
const STAY_OUT = [...SKIP_404, ...SKIP_UNTOUCHED];

for (const path of [...TO_COMPUTE, ...PRIOR_COMPUTE]) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of [...TO_FAUCET, ...PRIOR_FAUCET]) {
  assert.equal(potterHome308Dest(path), FAUCET, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/compute/donate'), null, 'do not invent /compute/donate');
assert.equal(potterHome308Dest('/compute/donate/'), null, 'do not invent /compute/donate/');
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}

const env = {
  LOBBY_SESSION_SECRET: 'fleet-mac-setup-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
const FETCH_FOLDS = [
  ...TO_COMPUTE.map((path) => [path, COMPUTE]),
  ...TO_FAUCET.map((path) => [path, FAUCET]),
  ...PRIOR_COMPUTE.map((path) => [path, COMPUTE]),
  ...PRIOR_FAUCET.map((path) => [path, FAUCET]),
];

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of FETCH_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  const faucet = await edgeWorker.fetch(new Request(`https://${host}/faucet`), env);
  assert.equal(faucet.status, 200, `${host} /faucet stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(faucet.headers.get('x-dasha-edge'), 'faucet');
  }
  for (const path of SKIP_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 404, `${host} ${path} ${method} stays 404`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), FAUCET, `${host} ${path} ${method} not folded to faucet`);
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
      assert.notEqual(res.headers.get('location'), FAUCET, `${host} ${path} ${method} not folded to faucet`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
        assert.notEqual(res.headers.get('location'), FAUCET, `${host} ${path} ${method} 308 dest is not /faucet`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/rent', '/capacity', '/offer', '/dashboard', '/console', '/balance', '/pay-usdc',
  '/apple-silicon', '/macos', '/local', '/edge', '/onboard', '/setup', '/quickstart',
  '/playground', '/sandbox', '/hello', '/example', '/examples', '/prefer', '/donate',
  '/admin', '/blog', '/news', '/faq', '/waitlist', '/join', '/oauth', '/status', '/health',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-fleet-mac-setup-pretty-path: PASS (fleet/capacity+console+Mac+setup+kit 308 /compute; /donate 308 /faucet; Title-case+slash+tab peers; /host+/pay+/usdc+/mac-kit+/tip+/tips regression; /compute+/faucet 200; /admin+/blog+/news+/faq+/waitlist+/join 404; /oauth+/status+/health stay out; no /compute/donate; no plugin.jup.ag)');
