#!/usr/bin/env node
/**
 * Motley leftover nested machine door (2026-09-18, post-#254):
 * live GET/HEAD /compute/api/openapi.json (+slash / Title-case via
 * toLowerCase) JSON-404 while /compute/openapi.json is already 200
 * OpenAPI 3.1. Fold to that face. Must win over the /compute/api/
 * casefold catch-all. Lobby same-host, not www cross-host. Bare
 * /compute/api/openapi stays its Set. Apex /openapi.json +
 * /api/openapi.json stay POTTER_OPENAPI_JSON_308_PATHS.
 * Disk only. No Designer. Never plugin.jup.ag. No Muse HTML. No Ask
 * UX. No Quill. No #216 proof body. No Room. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const diskRobots = readFileSync(join(root, 'dasha-robots.txt'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_API_OPENAPI_JSON_308_PATHS/, 'nested openapi.json leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_OPENAPI_308_PATHS/, 'keep bare /compute/api/openapi set');
assert.match(workerSrc, /POTTER_OPENAPI_JSON_308_PATHS/, 'keep apex /openapi.json set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map/set beat casefold catch-all');
assert.match(workerSrc, /dasha-muse-product/, 'Muse #225 faces imported; leftover maps stay out');
assert.match(
  workerSrc,
  /u\.pathname === '\/compute\/openapi\.json' && POTTER_COMPUTE_API_OPENAPI_JSON_308_PATHS\.has\(src\)/,
  'lobby same-host rewrite lists nested openapi.json leftover dest',
);

const openapiJsonSet = workerSrc.match(/const POTTER_COMPUTE_API_OPENAPI_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const openapiSet = workerSrc.match(/const POTTER_COMPUTE_API_OPENAPI_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const apexJsonSet = workerSrc.match(/const POTTER_OPENAPI_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}
for (const path of ['/compute/api/openapi.json', '/compute/api/openapi.json/']) {
  assert.ok(listed(openapiJsonSet, path), `openapi.json set lists ${path}`);
}
assert.doesNotMatch(openapiJsonSet, /['"]\/openapi\.json['"]/, 'do not invent apex /openapi.json here');
assert.doesNotMatch(openapiJsonSet, /['"]\/api\/openapi\.json['"]/, 'apex /api/openapi.json stays its Set');
assert.doesNotMatch(openapiJsonSet, /['"]\/compute\/api\/openapi['"]/, 'bare /compute/api/openapi stays its Set');
assert.doesNotMatch(openapiSet, /['"]\/compute\/api\/openapi\.json['"]/, 'openapi.json leftover lives in its Set');
assert.doesNotMatch(apexJsonSet, /['"]\/compute\/api\/openapi\.json['"]/, 'nested leftover not on apex set');
assert.doesNotMatch(openapiJsonSet, /dasha-muse-product/, 'openapi.json leftover set does not import Muse HTML');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/openapi\.json['"]/, 'openapi.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'do not invent /api/v1 leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'do not invent /api/models leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'do not invent /api/providers leftover');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const OPENAPI = `${WWW}/compute/openapi.json`;
const LOBBY_OPENAPI = `${LOBBY}/compute/openapi.json`;
const API = `${WWW}/compute/api`;

const OPENAPI_JSON_FOLDS = [
  '/compute/api/openapi.json',
  '/compute/api/openapi.json/',
  '/Compute/api/openapi.json',
  '/COMPUTE/API/OPENAPI.JSON',
  '/Compute/Api/Openapi.json/',
];

const STAY_200 = [
  '/compute/openapi.json',
  '/compute/openapi.yaml',
];
const STAY_OUT = [
  '/api/v1',
  '/api/v1/',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
];

for (const path of OPENAPI_JSON_FOLDS) {
  assert.equal(potterHome308Dest(path), OPENAPI, `${path} → /compute/openapi.json`);
  assert.notEqual(potterHome308Dest(path), API, `${path} is not the status stub`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/compute/api/openapi'), OPENAPI, 'bare /compute/api/openapi still folds');
assert.equal(potterHome308Dest('/compute/api/openapi/'), OPENAPI, 'bare /compute/api/openapi/ still folds');
assert.equal(potterHome308Dest('/openapi.json'), OPENAPI, 'apex /openapi.json still folds');
assert.equal(potterHome308Dest('/api/openapi.json'), OPENAPI, '/api/openapi.json still folds');
assert.equal(potterHome308Dest('/api/openapi'), API, '/api/openapi stays gateway leftover');
assert.equal(potterHome308Dest('/start'), null, 'Muse #225 /start stays face');
assert.equal(potterHome308Dest('/providers'), null, 'Muse #225 /providers stays face');
assert.equal(potterHome308Dest('/developers'), null, 'Muse #225 /developers stays face');
assert.equal(potterHome308Dest('/network'), null, 'Muse #225 /network stays face');

function extractConst(name) {
  const m = workerSrc.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(m, `${name} embedded`);
  return m[1];
}
const robotsConst = extractConst('ROBOTS_TXT');
const llmsConst = extractConst('LLMS_TXT');
const llmsFullConst = extractConst('LLMS_FULL_TXT');
assert.match(robotsConst, /^Allow: \/compute\/openapi\.json$/m, 'worker ROBOTS_TXT Allows /compute/openapi.json');
assert.match(diskRobots, /^Allow: \/compute\/openapi\.json$/m, 'disk robots Allows /compute/openapi.json');
assert.match(robotsConst, /\/compute\/openapi\.json/, 'identity/allowlist mentions /compute/openapi.json');
assert.match(llmsConst, /https:\/\/www\.getdasha\.com\/compute\/openapi\.json/, 'llms.txt mentions canonical OpenAPI');
assert.match(llmsFullConst, /https:\/\/www\.getdasha\.com\/compute\/openapi\.json/, 'llms-full mentions canonical OpenAPI');
assert.doesNotMatch(robotsConst, /plugin\.jup\.ag/);
assert.doesNotMatch(diskRobots, /plugin\.jup\.ag/);

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  if (dest === OPENAPI) return LOBBY_OPENAPI;
  return dest;
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-compute-api-openapi-json-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of OPENAPI_JSON_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, OPENAPI), `${host} ${path} ${method} loc`);
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
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  {
    const spec = await edgeWorker.fetch(new Request(`https://${host}/compute/openapi.json`), env);
    assert.equal(spec.status, 200, `${host} /compute/openapi.json stays 200`);
    if (host === 'www.getdasha.com') {
      const body = await spec.json();
      assert.equal(body.openapi, '3.1.0', `${host} dest is OpenAPI 3.1`);
    }
  }
  {
    const bare = await edgeWorker.fetch(new Request(`https://${host}/compute/api/openapi`), env);
    assert.equal(bare.status, 308, `${host} /compute/api/openapi leftover 308`);
    assert.equal(bare.headers.get('location'), OPENAPI, `${host} /compute/api/openapi still www spec`);
  }
  {
    const robots = await edgeWorker.fetch(new Request(`https://${host}/robots.txt`), env);
    assert.equal(robots.status, 200, `${host}/robots.txt`);
    const text = await robots.text();
    assert.match(text, /^Allow: \/compute\/openapi\.json$/m, `${host} robots Allows /compute/openapi.json`);
    assert.doesNotMatch(text, /plugin\.jup\.ag/, `${host} robots no plugin.jup.ag`);
  }
  {
    const llms = await edgeWorker.fetch(new Request(`https://${host}/llms.txt`), env);
    assert.equal(llms.status, 200, `${host}/llms.txt`);
    const text = await llms.text();
    assert.match(text, /https:\/\/www\.getdasha\.com\/compute\/openapi\.json/, `${host} llms mentions canonical OpenAPI`);
  }
  {
    const packet = await edgeWorker.fetch(new Request(`https://${host}/compute/llms.txt`), env);
    assert.equal(packet.status, 200, `${host}/compute/llms.txt`);
    const text = await packet.text();
    assert.match(text, /https:\/\/www\.getdasha\.com\/compute\/openapi\.json/, `${host} compute packet mentions canonical OpenAPI`);
  }
  for (const path of ['/api/v1', '/api/models', '/api/providers']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
  const foo = await edgeWorker.fetch(new Request(`https://${host}/compute/api/foo`), env);
  assert.equal(foo.status, 404, `${host} /compute/api/foo stays JSON 404`);
  assert.notEqual(foo.headers.get('location'), OPENAPI, `${host} /compute/api/foo not openapi`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/compute/api/openapi.json</loc>`), 'sitemap omits leftover /compute/api/openapi.json');

console.log('dasha-motley-compute-api-openapi-json-pretty-path: PASS (/compute/api/openapi.json 308 /compute/openapi.json same-host; Title-case+slash; www+lobby GET+HEAD; dest 200 OpenAPI 3.1; robots/llms mention canonical; stay-out /api/v1|/api/models|/api/providers; no Muse restack; no plugin.jup.ag)');
