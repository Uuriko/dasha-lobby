#!/usr/bin/env node
/**
 * Motley leftover nested machine doors (2026-09-18, post-#256/#257):
 * live GET/HEAD /compute/humans /compute/humans.txt /compute/humans.json
 * (+slash / Title-case via toLowerCase) html-404 while /humans.txt is
 * the 200 text/plain face (#251). Fold to that face, NOT /contribute
 * HTML. Lobby same-host, not www cross-host. Nested /compute/api/humans
 * stays its Set. Live /compute/api/humans.json already 308 → /humans.txt
 * (keep-live). Exact /humans.txt dest is null. Do not invent apex /humans.
 * Disk only. No Designer. Never plugin.jup.ag. No Muse HTML. No Ask
 * UX. No Quill. No #216 proof body. No Room. No people-data. No Phase 0.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_HUMANS_308_PATHS/, 'nested /compute/humans leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_HUMANS_308_PATHS/, 'keep /compute/api/humans set');
assert.match(workerSrc, /POTTER_HUMANS_TXT_308_PATHS/, 'keep slash /humans.txt/ set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map/set beat casefold catch-all');
assert.match(workerSrc, /dasha-muse-product/, 'Muse #225 faces imported; leftover maps stay out');
assert.match(
  workerSrc,
  /u\.pathname === '\/humans\.txt' && POTTER_COMPUTE_HUMANS_308_PATHS\.has\(src\)/,
  'lobby same-host rewrite lists /compute/humans leftover dest',
);

const humansSet = workerSrc.match(/const POTTER_COMPUTE_HUMANS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const apiHumansSet = workerSrc.match(/const POTTER_COMPUTE_API_HUMANS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const slashHumansSet = workerSrc.match(/const POTTER_HUMANS_TXT_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}
for (const path of ['/compute/humans', '/compute/humans/', '/compute/humans.txt', '/compute/humans.txt/', '/compute/humans.json', '/compute/humans.json/']) {
  assert.ok(listed(humansSet, path), `compute humans set lists ${path}`);
}
for (const path of ['/compute/api/humans', '/compute/api/humans/', '/compute/api/humans.json', '/compute/api/humans.json/']) {
  assert.ok(listed(apiHumansSet, path), `api humans set lists ${path}`);
}
assert.doesNotMatch(humansSet, /['"]\/humans['"]/, 'do not invent apex /humans');
assert.doesNotMatch(humansSet, /['"]\/humans\.txt['"]/, 'exact /humans.txt stays 200 face');
assert.doesNotMatch(humansSet, /['"]\/api\/humans['"]/, 'do not invent /api/humans');
assert.doesNotMatch(humansSet, /['"]\/compute\/api\/humans['"]/, '/compute/api/humans stays its Set');
assert.doesNotMatch(humansSet, /['"]\/compute\/api\/humans\.json['"]/, '/compute/api/humans.json stays its Set');
assert.doesNotMatch(humansSet, /['"]\/contribute['"]/, 'do not restack /contribute on leftover set');
assert.doesNotMatch(apiHumansSet, /['"]\/compute\/humans['"]/, '/compute/humans leftover lives in its Set');
assert.doesNotMatch(apiHumansSet, /['"]\/compute\/humans\.txt['"]/, '/compute/humans.txt leftover lives in its Set');
assert.doesNotMatch(apiHumansSet, /['"]\/compute\/humans\.json['"]/, '/compute/humans.json leftover lives in its Set');
assert.doesNotMatch(slashHumansSet, /['"]\/compute\/humans['"]/, 'slash set stays /humans.txt/ only');
assert.doesNotMatch(humansSet, /dasha-muse-product/, 'compute humans leftover set does not import Muse HTML');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
assert.doesNotMatch(discoveryMap, /['"]\/compute\/humans['"]/, '/compute/humans leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/humans\.txt['"]/, '/compute/humans.txt leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/humans\.json['"]/, '/compute/humans.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/humans\.txt['"]/, 'exact /humans.txt is not a Motley leftover into /contribute');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'do not invent /api/v1 leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'do not invent /api/models leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'do not invent /api/providers leftover');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const HUMANS = `${WWW}/humans.txt`;
const LOBBY_HUMANS = `${LOBBY}/humans.txt`;
const CONTRIBUTE = `${WWW}/contribute`;

const HUMANS_FOLDS = [
  '/compute/humans',
  '/compute/humans/',
  '/Compute/humans',
  '/COMPUTE/HUMANS',
  '/Compute/Humans/',
  '/compute/humans.txt',
  '/compute/humans.txt/',
  '/Compute/humans.txt',
  '/COMPUTE/HUMANS.TXT',
  '/Compute/Humans.txt/',
  '/compute/humans.json',
  '/compute/humans.json/',
  '/Compute/humans.json',
  '/COMPUTE/HUMANS.JSON',
  '/Compute/Humans.json/',
];

const STAY_200 = [
  '/humans.txt',
];
const STAY_OUT = [
  '/api/v1',
  '/api/v1/',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
  '/humans',
  '/api/humans',
];

for (const path of HUMANS_FOLDS) {
  assert.equal(potterHome308Dest(path), HUMANS, `${path} → /humans.txt`);
  assert.notEqual(potterHome308Dest(path), CONTRIBUTE, `${path} is not /contribute`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/compute/api/humans'), HUMANS, '/compute/api/humans still /humans.txt');
assert.equal(potterHome308Dest('/compute/api/humans/'), HUMANS, '/compute/api/humans/ still /humans.txt');
assert.equal(potterHome308Dest('/compute/api/humans.json'), HUMANS, 'live /compute/api/humans.json keep-live → /humans.txt');
assert.equal(potterHome308Dest('/compute/api/humans.json/'), HUMANS, 'live /compute/api/humans.json/ keep-live → /humans.txt');
assert.equal(potterHome308Dest('/humans.txt/'), HUMANS, 'slash /humans.txt/ still folds');
assert.notEqual(potterHome308Dest('/compute/api/humans'), CONTRIBUTE, '/compute/api/humans is not /contribute');
assert.equal(potterHome308Dest('/start'), null, 'Muse #225 /start stays face');
assert.equal(potterHome308Dest('/providers'), null, 'Muse #225 /providers stays face');
assert.equal(potterHome308Dest('/developers'), null, 'Muse #225 /developers stays face');
assert.equal(potterHome308Dest('/network'), null, 'Muse #225 /network stays face');

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  if (dest === HUMANS) return LOBBY_HUMANS;
  return dest;
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-compute-humans-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of HUMANS_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, HUMANS), `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), CONTRIBUTE, `${host} ${path} ${method} not /contribute`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (host === 'lobby.getdasha.com') {
        assert.match(res.headers.get('location') || '', /^https:\/\/lobby\.getdasha\.com\//, `${host} ${path} same-host`);
        assert.doesNotMatch(res.headers.get('location') || '', /^https:\/\/www\.getdasha\.com\//, `${host} ${path} not www cross-host`);
      }
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of STAY_200) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method} stays 200`);
      assert.match(res.headers.get('content-type') || '', /^text\/plain; charset=utf-8$/i, `${host} ${path} ${method} content-type`);
      assert.equal(res.headers.get('x-dasha-edge'), 'humans', `${host} ${path} ${method} edge`);
      if (method === 'HEAD') {
        assert.equal(await res.text(), '');
      } else {
        const body = await res.text();
        assert.equal(body.slice(0, 10), '/* TEAM */', `${host} /humans.txt body prefix`);
        assert.doesNotMatch(body, /Contribute to Dasha/);
        assert.doesNotMatch(body, /<html/i);
        assert.doesNotMatch(body, /@gmail\.|@getdasha\.|mailto:/i, 'no people-data');
      }
    }
  }
  {
    const apiHumans = await edgeWorker.fetch(new Request(`https://${host}/compute/api/humans`), env);
    assert.equal(apiHumans.status, 308, `${host} /compute/api/humans leftover 308`);
    assert.equal(apiHumans.headers.get('location'), HUMANS, `${host} /compute/api/humans still www /humans.txt`);
    assert.notEqual(apiHumans.headers.get('location'), CONTRIBUTE, `${host} /compute/api/humans not /contribute`);
  }
  {
    const apiJson = await edgeWorker.fetch(new Request(`https://${host}/compute/api/humans.json`), env);
    assert.equal(apiJson.status, 308, `${host} /compute/api/humans.json leftover 308`);
    assert.equal(apiJson.headers.get('location'), HUMANS, `${host} /compute/api/humans.json keep-live www /humans.txt`);
  }
  for (const path of ['/api/v1', '/api/models', '/api/providers', '/humans']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
  const foo = await edgeWorker.fetch(new Request(`https://${host}/compute/api/foo`), env);
  assert.equal(foo.status, 404, `${host} /compute/api/foo stays JSON 404`);
  assert.notEqual(foo.headers.get('location'), HUMANS, `${host} /compute/api/foo not humans`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/compute/humans', '/compute/humans.txt', '/compute/humans.json', '/compute/api/humans.json']) {
  assert.ok(!sitemapXml.includes(`${WWW}${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-motley-compute-humans-pretty-path: PASS (/compute/humans + /compute/humans.txt + /compute/humans.json 308 /humans.txt same-host; Title-case+slash; www+lobby GET+HEAD; dest 200 text/plain TEAM; not /contribute; keep-live /compute/api/humans.json; stay-out /humans|/api/v1|/api/models|/api/providers; no Muse restack; no people-data; no plugin.jup.ag)');
