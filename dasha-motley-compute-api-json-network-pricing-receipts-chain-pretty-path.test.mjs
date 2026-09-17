#!/usr/bin/env node
/**
 * Motley leftover nested machine doors: live GET/HEAD
 * /compute/api/network.json /compute/api/pricing.json
 * /compute/api/receipts.json /compute/api/chain.json
 * (+slash / Title-case via toLowerCase) JSON-404 while faces already
 * 200/401. Fold to those faces. Must win over the /compute/api/
 * casefold catch-all. Exact /compute/api/{network,pricing,receipts,chain}
 * stay handlers. Do not restack #241 synonyms. Disk only. No Designer.
 * Never plugin.jup.ag. No Muse HTML. No Room. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_API_NETWORK_JSON_308_PATHS/, 'nested network.json leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_PRICING_JSON_308_PATHS/, 'nested pricing.json leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_RECEIPTS_JSON_308_PATHS/, 'nested receipts.json leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_CHAIN_JSON_308_PATHS/, 'nested chain.json leftover set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map/set beat casefold catch-all');
assert.doesNotMatch(workerSrc, /dasha-muse-product/, 'do not import Muse #225 HTML');

const networkSet = workerSrc.match(/const POTTER_COMPUTE_API_NETWORK_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const pricingSet = workerSrc.match(/const POTTER_COMPUTE_API_PRICING_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const receiptsSet = workerSrc.match(/const POTTER_COMPUTE_API_RECEIPTS_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const chainSet = workerSrc.match(/const POTTER_COMPUTE_API_CHAIN_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}
for (const path of ['/compute/api/network.json', '/compute/api/network.json/']) {
  assert.ok(listed(networkSet, path), `network.json set lists ${path}`);
}
for (const path of ['/compute/api/pricing.json', '/compute/api/pricing.json/']) {
  assert.ok(listed(pricingSet, path), `pricing.json set lists ${path}`);
}
for (const path of ['/compute/api/receipts.json', '/compute/api/receipts.json/']) {
  assert.ok(listed(receiptsSet, path), `receipts.json set lists ${path}`);
}
for (const path of ['/compute/api/chain.json', '/compute/api/chain.json/']) {
  assert.ok(listed(chainSet, path), `chain.json set lists ${path}`);
}
assert.doesNotMatch(networkSet, /['"]\/network\.json['"]/, 'do not invent apex /network.json');
assert.doesNotMatch(networkSet, /['"]\/api\/network\.json['"]/, 'do not invent /api/network.json');
assert.doesNotMatch(networkSet, /['"]\/compute\/api\/network['"]/, 'exact network face stays handler');
assert.doesNotMatch(pricingSet, /['"]\/pricing\.json['"]/, 'do not invent apex /pricing.json');
assert.doesNotMatch(pricingSet, /['"]\/api\/pricing\.json['"]/, 'do not invent /api/pricing.json');
assert.doesNotMatch(pricingSet, /['"]\/compute\/api\/pricing['"]/, 'exact pricing face stays handler');
assert.doesNotMatch(receiptsSet, /['"]\/receipts\.json['"]/, 'do not invent apex /receipts.json');
assert.doesNotMatch(receiptsSet, /['"]\/api\/receipts\.json['"]/, 'do not invent /api/receipts.json');
assert.doesNotMatch(receiptsSet, /['"]\/compute\/api\/receipts['"]/, 'exact receipts face stays handler');
assert.doesNotMatch(chainSet, /['"]\/chain\.json['"]/, 'do not invent apex /chain.json');
assert.doesNotMatch(chainSet, /['"]\/api\/chain\.json['"]/, 'do not invent /api/chain.json');
assert.doesNotMatch(chainSet, /['"]\/compute\/api\/chain['"]/, 'exact chain face stays handler');
assert.doesNotMatch(networkSet, /['"]\/contribute\.md['"]/, 'do not restack #241 /contribute.md');
assert.doesNotMatch(pricingSet, /['"]\/crew\.json['"]/, 'do not restack #241 /crew.json');
assert.doesNotMatch(receiptsSet, /['"]\/bag\.json['"]/, 'do not restack #241 /bag.json');
assert.doesNotMatch(chainSet, /['"]\/muse['"]/, 'do not restack #241 /muse');
assert.doesNotMatch(networkSet, /['"]\/compute\/api\/llms['"]/, 'do not restack #241 /compute/api/llms');
assert.doesNotMatch(pricingSet, /['"]\/compute\/api\/agents['"]/, 'do not restack #241 /compute/api/agents');
assert.doesNotMatch(receiptsSet, /['"]\/\.well-known\/ai-plugin\.json['"]/, 'do not restack #241 ai-plugin');
assert.doesNotMatch(chainSet, /['"]\/compute\/api\/openapi\.json['"]/, 'do not invent /compute/api/openapi.json');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/network\.json['"]/, 'network.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/pricing\.json['"]/, 'pricing.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/receipts\.json['"]/, 'receipts.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/chain\.json['"]/, 'chain.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'do not invent /api/v1 leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'do not invent /api/models leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'do not invent /api/providers leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1\/status['"]/, 'do not invent /api/v1/status leftover');
assert.match(discoveryMap, /['"]\/contribute\.md['"]/, 'keep #241 /contribute.md on Motley map');
assert.match(discoveryMap, /['"]\/crew\.json['"]/, 'keep #241 /crew.json on Motley map');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const NETWORK = `${WWW}/compute/api/network`;
const PRICING = `${WWW}/compute/api/pricing`;
const RECEIPTS = `${WWW}/compute/api/receipts`;
const CHAIN = `${WWW}/compute/api/chain`;
const CONTRIBUTE = `${WWW}/contribute`;
const LLMS = `${WWW}/compute/llms.txt`;

const NETWORK_FOLDS = [
  '/compute/api/network.json',
  '/compute/api/network.json/',
  '/Compute/api/network.json',
  '/COMPUTE/API/NETWORK.JSON',
  '/Compute/Api/Network.json/',
];
const PRICING_FOLDS = [
  '/compute/api/pricing.json',
  '/compute/api/pricing.json/',
  '/Compute/api/pricing.json',
  '/COMPUTE/API/PRICING.JSON',
  '/Compute/Api/Pricing.json/',
];
const RECEIPTS_FOLDS = [
  '/compute/api/receipts.json',
  '/compute/api/receipts.json/',
  '/Compute/api/receipts.json',
  '/COMPUTE/API/RECEIPTS.JSON',
  '/Compute/Api/Receipts.json/',
];
const CHAIN_FOLDS = [
  '/compute/api/chain.json',
  '/compute/api/chain.json/',
  '/Compute/api/chain.json',
  '/COMPUTE/API/CHAIN.JSON',
  '/Compute/Api/Chain.json/',
];

const STAY_FACE = [
  '/compute/api/network',
  '/compute/api/network/',
  '/compute/api/pricing',
  '/compute/api/pricing/',
  '/compute/api/receipts',
  '/compute/api/receipts/',
  '/compute/api/chain',
  '/compute/api/chain/',
];
const STAY_OUT = [
  '/api/v1',
  '/api/v1/',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
  '/network.json',
  '/pricing.json',
  '/receipts.json',
  '/chain.json',
  '/api/network.json',
  '/api/pricing.json',
  '/api/receipts.json',
  '/api/chain.json',
  '/compute/api/openapi.json',
];

for (const path of NETWORK_FOLDS) {
  assert.equal(potterHome308Dest(path), NETWORK, `${path} → /compute/api/network`);
}
for (const path of PRICING_FOLDS) {
  assert.equal(potterHome308Dest(path), PRICING, `${path} → /compute/api/pricing`);
}
for (const path of RECEIPTS_FOLDS) {
  assert.equal(potterHome308Dest(path), RECEIPTS, `${path} → /compute/api/receipts`);
}
for (const path of CHAIN_FOLDS) {
  assert.equal(potterHome308Dest(path), CHAIN, `${path} → /compute/api/chain`);
}
for (const path of STAY_FACE) {
  assert.equal(potterHome308Dest(path), null, `${path} stays handler`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/compute/network'), NETWORK, '/compute/network still folds to network face');
assert.equal(potterHome308Dest('/api/receipts'), RECEIPTS, '/api/receipts still folds to receipts face');
assert.equal(potterHome308Dest('/contribute.md'), CONTRIBUTE, '#241 /contribute.md still folds');
assert.equal(potterHome308Dest('/compute/api/llms'), LLMS, '#241 /compute/api/llms still folds');

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  return dest.replace(WWW, LOBBY);
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-compute-api-json-leftover-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName: () => 'public',
    get: () => ({
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === '/compute/api/network' || path === '/compute/api/network/') {
          return new Response(JSON.stringify({
            providers_online: 1,
            models_available: ['qwen3-4b'],
            capacity: [{ model: 'qwen3-4b', providers: 1, tokens_per_second: 40 }],
            jobs_queued: 0,
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/pricing' || path === '/compute/api/pricing/') {
          return new Response(JSON.stringify({
            unit: 'successful_chat_completion',
            request_usd: '0.05',
            currency: 'USD',
            card_available: false,
            card_note: 'no card yet',
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/chain' || path === '/compute/api/chain/') {
          return new Response(JSON.stringify({
            chain: { length: 2, tip: 'abc' },
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/receipts' || path === '/compute/api/receipts/') {
          return new Response(JSON.stringify({
            error: { message: 'sign in', type: 'authentication_error' },
          }), { status: 401, headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/readyz') {
          return new Response(JSON.stringify({
            ok: true,
            service: 'dasha-compute',
            can_serve: true,
            reason: 'community_or_hosted',
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/verify') {
          return new Response(JSON.stringify({
            chain: { length: 2, tip: 'abc' },
            verdict: { tier: 'ANCHORED', why: 'test' },
            checked_at: '2026-09-13T00:00:00.000Z',
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/factory') {
          return new Response(JSON.stringify({ settled_24h: 0, jobs: 0 }), {
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('nope', { status: 404 });
      },
    }),
  },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [
    ...NETWORK_FOLDS.map((p) => [p, NETWORK]),
    ...PRICING_FOLDS.map((p) => [p, PRICING]),
    ...RECEIPTS_FOLDS.map((p) => [p, RECEIPTS]),
    ...CHAIN_FOLDS.map((p) => [p, CHAIN]),
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, dest), `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const [path, want] of [
    ['/compute/api/network', 200],
    ['/compute/api/pricing', 200],
    ['/compute/api/receipts', 401],
    ['/compute/api/chain', 200],
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.status, 308, `${host} ${path} ${method} stays face`);
      assert.equal(res.status, want, `${host} ${path} ${method} face ${want}`);
    }
  }
  for (const path of ['/api/v1', '/api/models', '/api/providers']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
  const foo = await edgeWorker.fetch(new Request(`https://${host}/compute/api/foo`), env);
  assert.equal(foo.status, 404, `${host} /compute/api/foo stays JSON 404`);
  assert.notEqual(foo.headers.get('location'), NETWORK, `${host} /compute/api/foo not network`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/compute/api/network.json',
  '/compute/api/pricing.json',
  '/compute/api/receipts.json',
  '/compute/api/chain.json',
]) {
  assert.ok(!sitemapXml.includes(`${WWW}${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-motley-compute-api-json-network-pricing-receipts-chain-pretty-path: PASS (/compute/api/network.json 308 /compute/api/network; /compute/api/pricing.json 308 /compute/api/pricing; /compute/api/receipts.json 308 /compute/api/receipts; /compute/api/chain.json 308 /compute/api/chain; Title-case+slash; www+lobby GET+HEAD; dests 200/401; stay-out /api/v1|/api/models|/api/providers; no #241 restack; no plugin.jup.ag)');
