#!/usr/bin/env node
/**
 * Nested Motley leftover peers: live GET/HEAD /compute/api/robots
 * /compute/api/sitemap (+slash / Title-case via toLowerCase) 308 →
 * /robots.txt / /sitemap.xml. Faces already 200. .txt/.xml peers already
 * fold via POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST. Apex /api/robots and
 * /compute/api/robots.txt already 308. Must win over the /compute/api/
 * casefold catch-all. Stay-outs /api/v1 /api/models /api/providers
 * /api/v1/status remain null/404. Disk only. No Designer. Never
 * plugin.jup.ag. No Muse HTML. No Room. No wrangler.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_API_ROBOTS_308_PATHS/, 'nested robots leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_SITEMAP_308_PATHS/, 'nested sitemap leftover set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map/set beat casefold catch-all');

const robotsSet = workerSrc.match(/const POTTER_COMPUTE_API_ROBOTS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const sitemapSet = workerSrc.match(/const POTTER_COMPUTE_API_SITEMAP_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of ['/compute/api/robots', '/compute/api/robots/']) {
  assert.match(
    robotsSet,
    new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `robots set lists ${path}`,
  );
}
for (const path of ['/compute/api/sitemap', '/compute/api/sitemap/']) {
  assert.match(
    sitemapSet,
    new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `sitemap set lists ${path}`,
  );
}
assert.doesNotMatch(robotsSet, /['"]\/api\/v1['"]/, 'do not invent /api/v1 in robots set');
assert.doesNotMatch(sitemapSet, /['"]\/api\/models['"]/, 'do not invent /api/models in sitemap set');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
assert.match(discoveryMap, /['"]\/compute\/api\/robots\.txt['"]/, '.txt peer already present');
assert.match(discoveryMap, /['"]\/compute\/api\/sitemap\.xml['"]/, '.xml peer already present');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'do not invent /api/v1 leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'do not invent /api/models leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'do not invent /api/providers leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1\/status['"]/, 'do not invent /api/v1/status leftover');

const WWW = 'https://www.getdasha.com';
const ROBOTS = `${WWW}/robots.txt`;
const SITEMAP = `${WWW}/sitemap.xml`;

const ROBOTS_FOLDS = [
  '/compute/api/robots',
  '/compute/api/robots/',
  '/Compute/api/robots',
  '/COMPUTE/API/ROBOTS',
  '/Compute/Api/Robots/',
  '/compute/api/robots.txt',
  '/compute/api/robots.txt/',
  '/Compute/api/robots.txt',
  '/COMPUTE/API/ROBOTS.TXT',
];
const SITEMAP_FOLDS = [
  '/compute/api/sitemap',
  '/compute/api/sitemap/',
  '/Compute/api/sitemap',
  '/COMPUTE/API/SITEMAP',
  '/Compute/Api/Sitemap/',
  '/compute/api/sitemap.xml',
  '/compute/api/sitemap.xml/',
  '/Compute/api/sitemap.xml',
  '/COMPUTE/API/SITEMAP.XML',
];

const STAY_200 = [
  '/robots.txt',
  '/sitemap.xml',
];
const STAY_OUT = [
  '/api/v1',
  '/api/v1/',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
];

for (const path of ROBOTS_FOLDS) {
  assert.equal(potterHome308Dest(path), ROBOTS, `${path} → /robots.txt`);
}
for (const path of SITEMAP_FOLDS) {
  assert.equal(potterHome308Dest(path), SITEMAP, `${path} → /sitemap.xml`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}

const env = {
  LOBBY_SESSION_SECRET: 'apex-api-lobby-nested-motley-peers-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [
    ...ROBOTS_FOLDS.map((p) => [p, ROBOTS]),
    ...SITEMAP_FOLDS.map((p) => [p, SITEMAP]),
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of STAY_200) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method} stays 200`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of STAY_OUT) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/compute/api/robots', '/compute/api/sitemap', '/compute/api/robots.txt', '/compute/api/sitemap.xml']) {
  assert.ok(!sitemapXml.includes(`${WWW}${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-api-lobby-nested-motley-peers-pretty-path: PASS (bare /compute/api/robots|/sitemap + .txt/.xml peers 308 faces; Title-case+slash; www+lobby GET+HEAD; dests 200; stay-out /api/v1|/api/models|/api/providers|/api/v1/status; no plugin.jup.ag)');
