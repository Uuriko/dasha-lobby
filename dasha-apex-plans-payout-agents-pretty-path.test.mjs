#!/usr/bin/env node
/**
 * Leftover pretty path (Worker ef812bfe): live /plan(s) /prices /payout(s)
 * /withdraw /cashout /payment(s) /checkout /getting_started /mac-setup
 * /mac_setup /agents|/agent /mcp /tools|/tool (+ /compute/* tabs, Title-case)
 * html-404 → 308 /compute. /compute/price folds; bare /price stays the
 * 200 JSON token-price API. Peers /pricing /pay /earn /getting-started
 * /mac /kit still → /compute. Skip /help /terms /admin /blog /waitlist
 * /tos /legal /news. Disk only. No Designer. Never plugin.jup.ag.
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
assert.match(
  workerSrc,
  /Plans\/prices\/payout\/payment\/agents leftovers/,
  'leftover comment names plans/prices/payout/payment/agents family',
);
assert.match(
  workerSrc,
  /Do NOT fold bare \/price/,
  'leftover comment keeps bare /price as token-price API',
);
assert.match(
  workerSrc,
  /\/plan\|\/plans\|\/prices\|\/payout\|\/payouts\|\/withdraw\|\/cashout\|\/payment\|\/payments\|\/checkout\|\/getting_started\|\/mac-setup\|\/mac_setup\|\/agents\|\/agent\|\/mcp\|\/tools\|\/tool/,
  'potterHome308Dest comment lists leftover family',
);
assert.match(
  workerSrc,
  /\/compute\/price/,
  'potterHome308Dest comment lists /compute/price fold',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const COMPUTE_LEAVES = [
  'plan', 'plans', 'prices', 'payout', 'payouts', 'withdraw', 'cashout',
  'payment', 'payments', 'checkout', 'getting_started', 'mac-setup', 'mac_setup',
  'agents', 'agent', 'mcp', 'tools', 'tool',
];
for (const leaf of COMPUTE_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
}
assert.match(tab, /'\/compute\/price'/);
assert.doesNotMatch(tab, /['"]\/price['"]/, 'do not fold bare /price');
assert.doesNotMatch(tab, /['"]\/price\/['"]/, 'do not fold bare /price/');
assert.doesNotMatch(tab, /['"]\/help['"]/, 'do not invent /help');
assert.doesNotMatch(tab, /['"]\/terms['"]/, 'do not invent /terms');
assert.doesNotMatch(tab, /['"]\/admin['"]/, 'do not invent /admin');
assert.doesNotMatch(tab, /['"]\/blog['"]/, 'do not invent /blog');
assert.doesNotMatch(tab, /['"]\/waitlist['"]/, 'do not invent /waitlist');
assert.doesNotMatch(tab, /['"]\/tos['"]/, 'do not invent /tos');
assert.doesNotMatch(tab, /['"]\/legal['"]/, 'do not invent /legal');
assert.doesNotMatch(tab, /['"]\/news['"]/, 'do not invent /news');

const COMPUTE = 'https://www.getdasha.com/compute';

const NEW_PATHS = [
  ...COMPUTE_LEAVES.flatMap((leaf) => [
    `/${leaf}`, `/${leaf}/`,
    `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
    `/${leaf.toUpperCase()}`,
    `/compute/${leaf}`, `/compute/${leaf}/`,
    `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
  ]),
  '/compute/price', '/compute/price/',
  '/Compute/price', '/COMPUTE/PRICE', '/Compute/Price/',
];
const PRIOR_PEERS = [
  '/pricing', '/pricing/', '/Pricing', '/PRICING',
  '/pay', '/pay/', '/Pay', '/PAY',
  '/earn', '/earn/', '/Earn', '/EARN',
  '/getting-started', '/getting-started/', '/Getting-started', '/GETTING-STARTED',
  '/mac', '/mac/', '/Mac', '/MAC',
  '/kit', '/kit/', '/Kit', '/KIT',
];
const FOLDS = [...NEW_PATHS, ...PRIOR_PEERS];
const STAY_OUT = [
  '/help', '/help/', '/Help',
  '/terms', '/terms/', '/Terms',
  '/admin', '/admin/', '/Admin',
  '/blog', '/blog/', '/Blog',
  '/waitlist', '/waitlist/', '/Waitlist',
  '/tos', '/tos/', '/Tos',
  '/legal', '/legal/', '/Legal',
  '/news', '/news/', '/News',
];
const BARE_PRICE = ['/price', '/price/', '/Price', '/PRICE'];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/compute/price'), COMPUTE, '/compute/price folds');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
for (const path of BARE_PRICE) {
  assert.equal(potterHome308Dest(path), null, `bare ${path} stays token-price API`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path} to compute`);
}

const FETCH_SAMPLE = [
  '/plan', '/Plans/', '/prices', '/Payout', '/checkout',
  '/getting_started', '/mac-setup', '/Agents', '/mcp', '/tools',
  '/compute/price', '/Compute/price/',
  '/pricing', '/pay', '/earn', '/getting-started', '/mac', '/kit',
];

const env = {
  LOBBY_SESSION_SECRET: 'apex-plans-payout-agents-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FETCH_SAMPLE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  for (const path of BARE_PRICE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
  for (const path of STAY_OUT) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/plan', '/plans', '/prices', '/price', '/payout', '/agents', '/mcp', '/tools',
  '/compute/price', '/help', '/terms', '/admin', '/blog', '/waitlist', '/tos', '/legal',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-plans-payout-agents-pretty-path: PASS (/plan(s)+/prices+/payout(s)+/withdraw+/cashout+/payment(s)+/checkout+/getting_started+/mac-setup+/agents|/agent+/mcp+/tools|/tool + /compute/* tabs 308 /compute; /compute/price folds; bare /price untouched; /pricing+/pay+/earn+/getting-started+/mac+/kit peers; Title-case+slash; www+lobby GET+HEAD sample; /compute 200; /help+/terms+/admin+/blog+/waitlist+/tos+/legal stay out; no plugin.jup.ag)');
