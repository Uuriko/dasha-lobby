#!/usr/bin/env node
/**
 * Nested Motley leftovers:
 * - GET/HEAD /compute/api/benchmarks (+slash / Title-case) 308 → /benchmarks.
 *   Face already 200. Sibling /api/benchmarks.json and
 *   /compute/api/benchmarks.json already 308 — keep them. Lobby same-host.
 * - GET/HEAD /compute/api/factory.json (+slash / Title-case) 308 →
 *   /compute/api/factory (factory.compute.v0). Exact face stays 200.
 *   Apex /factory.json stays the 200 catalog. /compute/factory and
 *   /api/factory already 308 — keep them.
 * Must win over the /compute/api/ casefold catch-all. Peer 308s do not
 * copy the request query string. Robots/sitemap synonyms stay put.
 * Stay-outs /api/v1 /api/models /api/providers /api/v1/status remain 404.
 * Disk only. No Designer. Never plugin.jup.ag. No Muse HTML. No Room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_API_BENCHMARKS_308_PATHS/, 'nested benchmarks leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_FACTORY_JSON_308_PATHS/, 'nested factory.json leftover set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map/set beat casefold catch-all');

const benchmarksSet = workerSrc.match(/const POTTER_COMPUTE_API_BENCHMARKS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const factoryJsonSet = workerSrc.match(/const POTTER_COMPUTE_API_FACTORY_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const robotsSet = workerSrc.match(/const POTTER_COMPUTE_API_ROBOTS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const sitemapSet = workerSrc.match(/const POTTER_COMPUTE_API_SITEMAP_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}
for (const path of ['/compute/api/benchmarks', '/compute/api/benchmarks/']) {
  assert.ok(listed(benchmarksSet, path), `benchmarks set lists ${path}`);
}
for (const path of ['/compute/api/factory.json', '/compute/api/factory.json/']) {
  assert.ok(listed(factoryJsonSet, path), `factory.json set lists ${path}`);
}
assert.doesNotMatch(benchmarksSet, /['"]\/benchmarks\.json['"]/, 'do not invent apex /benchmarks.json');
assert.doesNotMatch(benchmarksSet, /['"]\/api\/benchmarks['"]/, 'do not invent apex /api/benchmarks');
assert.doesNotMatch(benchmarksSet, /['"]\/benchmarks['"]/, 'exact /benchmarks stays the 200 face');
assert.doesNotMatch(benchmarksSet, /['"]\/compute\/api\/benchmarks\.json['"]/, '.json sibling stays on the Motley map');
assert.doesNotMatch(factoryJsonSet, /['"]\/factory\.json['"]/, 'apex /factory.json stays the 200 catalog');
assert.doesNotMatch(factoryJsonSet, /['"]\/api\/factory\.json['"]/, 'do not invent /api/factory.json');
assert.doesNotMatch(factoryJsonSet, /['"]\/compute\/api\/factory['"]/, 'exact /compute/api/factory stays handler');
assert.doesNotMatch(factoryJsonSet, /['"]\/compute\/factory['"]/, '/compute/factory stays its existing set');
assert.match(robotsSet, /['"]\/compute\/api\/robots['"]/, 'robots synonym untouched');
assert.doesNotMatch(robotsSet, /benchmarks|factory/, 'robots set stays robots');
assert.match(sitemapSet, /['"]\/compute\/api\/sitemap['"]/, 'sitemap synonym untouched');
assert.doesNotMatch(sitemapSet, /benchmarks|factory/, 'sitemap set stays sitemap');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
assert.match(discoveryMap, /['"]\/api\/benchmarks\.json['"]/, 'keep apex /api/benchmarks.json');
assert.match(discoveryMap, /['"]\/compute\/api\/benchmarks\.json['"]/, 'keep nested /compute/api/benchmarks.json');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/benchmarks['"]/, 'extensionless benchmarks lives in its Set');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/factory\.json['"]/, 'factory.json lives in its Set');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'stay-out /api/v1');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'stay-out /api/models');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'stay-out /api/providers');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1\/status['"]/, 'stay-out /api/v1/status');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const BENCHMARKS = `${WWW}/benchmarks`;
const FACTORY = `${WWW}/compute/api/factory`;
const ROBOTS = `${WWW}/robots.txt`;

const BENCHMARK_FOLDS = [
  '/compute/api/benchmarks',
  '/compute/api/benchmarks/',
  '/Compute/api/benchmarks',
  '/COMPUTE/API/BENCHMARKS',
  '/Compute/Api/Benchmarks/',
];
const FACTORY_JSON_FOLDS = [
  '/compute/api/factory.json',
  '/compute/api/factory.json/',
  '/Compute/api/factory.json',
  '/COMPUTE/API/FACTORY.JSON',
  '/Compute/Api/Factory.json/',
];

for (const path of BENCHMARK_FOLDS) {
  assert.equal(potterHome308Dest(path), BENCHMARKS, `${path} → /benchmarks`);
}
for (const path of FACTORY_JSON_FOLDS) {
  assert.equal(potterHome308Dest(path), FACTORY, `${path} → /compute/api/factory`);
}
assert.equal(potterHome308Dest('/api/benchmarks.json'), BENCHMARKS, 'keep /api/benchmarks.json');
assert.equal(potterHome308Dest('/compute/api/benchmarks.json'), BENCHMARKS, 'keep /compute/api/benchmarks.json');
assert.equal(potterHome308Dest('/compute/factory'), FACTORY, 'keep /compute/factory');
assert.equal(potterHome308Dest('/api/factory'), FACTORY, 'keep /api/factory');
assert.equal(potterHome308Dest('/compute/api/robots'), ROBOTS, 'robots synonym stays /robots.txt');
assert.equal(potterHome308Dest('/compute/api/sitemap'), `${WWW}/sitemap.xml`, 'sitemap synonym stays /sitemap.xml');

for (const path of [
  '/benchmarks',
  '/benchmarks/',
  '/compute/api/factory',
  '/compute/api/factory/',
  '/factory.json',
  '/factory.json/',
  '/benchmarks.json',
  '/api/factory.json',
  '/api/v1',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
]) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  return dest.replace(WWW, LOBBY);
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-compute-api-benchmarks-factory-json-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [
    ...BENCHMARK_FOLDS.map((p) => [p, BENCHMARKS]),
    ...FACTORY_JSON_FOLDS.map((p) => [p, FACTORY]),
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, dest), `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
    const queried = await edgeWorker.fetch(new Request(`https://${host}${path}?lane=1`), env);
    assert.equal(queried.status, 308, `${host} ${path} query still 308`);
    assert.equal(queried.headers.get('location'), expectLoc(host, dest), `${host} ${path} drops query like peers`);
  }

  for (const method of ['GET', 'HEAD']) {
    const benches = await edgeWorker.fetch(new Request(`https://${host}/benchmarks`, { method }), env);
    assert.equal(benches.status, 200, `${host} /benchmarks ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await benches.text(), '');
    const factory = await edgeWorker.fetch(new Request(`https://${host}/compute/api/factory`, { method }), env);
    assert.equal(factory.status, 200, `${host} /compute/api/factory ${method} stays 200`);
    if (method === 'GET') {
      const body = await factory.json();
      assert.equal(body.schema, 'factory.compute.v0', `${host} factory schema`);
    } else {
      assert.equal(await factory.text(), '');
    }
    const catalog = await edgeWorker.fetch(new Request(`https://${host}/factory.json`, { method }), env);
    assert.equal(catalog.status, 200, `${host} /factory.json ${method} stays catalog`);
    assert.notEqual(catalog.status, 308, `${host} /factory.json is not a synonym`);
  }

  const peer = await edgeWorker.fetch(new Request(`https://${host}/api/benchmarks.json?lane=1`), env);
  assert.equal(peer.status, 308, `${host} peer /api/benchmarks.json`);
  assert.equal(peer.headers.get('location'), expectLoc(host, BENCHMARKS), `${host} peer drops query`);
  const nestedPeer = await edgeWorker.fetch(new Request(`https://${host}/compute/api/benchmarks.json`), env);
  assert.equal(nestedPeer.status, 308, `${host} keep /compute/api/benchmarks.json`);
  assert.equal(nestedPeer.headers.get('location'), expectLoc(host, BENCHMARKS), `${host} nested .json loc`);
  const robots = await edgeWorker.fetch(new Request(`https://${host}/compute/api/robots`), env);
  assert.equal(robots.status, 308, `${host} robots synonym untouched`);
  assert.equal(robots.headers.get('location'), ROBOTS, `${host} robots loc stays www`);

  for (const path of ['/api/v1', '/api/models', '/api/providers', '/api/v1/status']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
  const foo = await edgeWorker.fetch(new Request(`https://${host}/compute/api/foo`), env);
  assert.equal(foo.status, 404, `${host} /compute/api/foo stays JSON 404`);

  const post = await edgeWorker.fetch(new Request(`https://${host}/compute/api/benchmarks`, { method: 'POST' }), env);
  assert.notEqual(post.status, 308, `${host} POST /compute/api/benchmarks is not a 308`);
  const postFactory = await edgeWorker.fetch(new Request(`https://${host}/compute/api/factory.json`, { method: 'POST' }), env);
  assert.notEqual(postFactory.status, 308, `${host} POST /compute/api/factory.json is not a 308`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/compute/api/benchmarks', '/compute/api/factory.json', '/compute/api/benchmarks.json']) {
  assert.ok(!sitemapXml.includes(`${WWW}${path}</loc>`), `sitemap omits leftover ${path}`);
}
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/benchmarks<\/loc>/, 'sitemap still lists /benchmarks');

console.log('dasha-motley-compute-api-benchmarks-factory-json-pretty-path: PASS (/compute/api/benchmarks 308 /benchmarks; /compute/api/factory.json 308 /compute/api/factory; Title-case+slash; www+lobby GET+HEAD; query dropped like peers; dests 200; keep .json benchmarks + /compute/factory; apex /factory.json stays 200; robots/sitemap untouched; stay-out /api/v1|/api/models|/api/providers|/api/v1/status; no plugin.jup.ag)');
