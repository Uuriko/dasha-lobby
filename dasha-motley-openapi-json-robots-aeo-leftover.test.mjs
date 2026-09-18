#!/usr/bin/env node
/**
 * Motley AEO leftover polish (2026-09-17, post-#252):
 * 1. Apex /openapi.json (+/) Title-case 308 → /compute/openapi.json
 *    (real OpenAPI 3.1). Live Motley /api/openapi.json already does this;
 *    fold it so a tip deploy does not wipe Motley. /openapi and
 *    /api/openapi (no .json) stay gateway leftovers → /compute/api.
 *    /openapi.yaml already folds via POTTER_OPENAPI_YAML_308_PATHS.
 * 2. Worker-owned /robots.txt Allowlist for /llms.txt (already),
 *    /agents.json, /.well-known/mcp.json, /.well-known/agent.json,
 *    /compute/skill.md. Disk dasha-robots.txt stays in sync. Not Webflow.
 * Nested /compute/api/openapi.json leftover lives in
 * POTTER_COMPUTE_API_OPENAPI_JSON_308_PATHS, not this apex set.
 * Stay-outs: Muse #225 faces, Ask UX, Quill #247, #216 proof body,
 * Phase 0, Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const diskRobots = readFileSync(join(root, 'dasha-robots.txt'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_OPENAPI_JSON_308_PATHS/, 'apex /openapi.json leftover set');
assert.match(workerSrc, /POTTER_OPENAPI_YAML_308_PATHS/, 'keep /openapi.yaml leftover set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');

const jsonSet = workerSrc.match(/const POTTER_OPENAPI_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}
for (const path of ['/openapi.json', '/openapi.json/', '/api/openapi.json', '/api/openapi.json/']) {
  assert.ok(listed(jsonSet, path), `openapi json set lists ${path}`);
}
assert.doesNotMatch(jsonSet, /['"]\/openapi['"]/, '/openapi stays gateway leftover');
assert.doesNotMatch(jsonSet, /['"]\/api\/openapi['"]/, '/api/openapi stays gateway leftover');
assert.doesNotMatch(jsonSet, /['"]\/compute\/api\/openapi\.json['"]/, 'nested leftover lives in its Set');
assert.doesNotMatch(jsonSet, /['"]\/compute\/openapi\.json['"]/, 'exact /compute/openapi.json stays 200');
assert.doesNotMatch(jsonSet, /dasha-muse-product/, 'openapi leftover set does not import Muse HTML');

const WWW = 'https://www.getdasha.com';
const OPENAPI = `${WWW}/compute/openapi.json`;
const API = `${WWW}/compute/api`;

const JSON_FOLDS = [
  '/openapi.json',
  '/openapi.json/',
  '/OpenAPI.JSON',
  '/OPENAPI.JSON',
  '/OpenApi.Json/',
  '/api/openapi.json',
  '/api/openapi.json/',
  '/Api/OpenAPI.JSON',
  '/API/OPENAPI.JSON/',
];
const GATEWAY_STAY = [
  '/openapi',
  '/openapi/',
  '/api/openapi',
  '/api/openapi/',
];
const STAY_200 = [
  '/compute/openapi.json',
  '/compute/openapi.yaml',
  '/agents.json',
  '/.well-known/mcp.json',
  '/.well-known/agent.json',
  '/compute/skill.md',
  '/llms.txt',
  '/robots.txt',
];
const STAY_OUT = [
  '/api/v1',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
];

for (const path of JSON_FOLDS) {
  assert.equal(potterHome308Dest(path), OPENAPI, `${path} → /compute/openapi.json`);
  assert.notEqual(potterHome308Dest(path), API, `${path} is not the status stub`);
}
for (const path of GATEWAY_STAY) {
  assert.equal(potterHome308Dest(path), API, `${path} stays gateway leftover`);
}
assert.equal(potterHome308Dest('/openapi.yaml'), OPENAPI, '/openapi.yaml still spec leftover');
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/compute/api/openapi'), OPENAPI, '/compute/api/openapi still spec leftover');
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
const ROBOTS_ALLOWS = [
  '/llms.txt',
  '/agents.json',
  '/.well-known/mcp.json',
  '/.well-known/agent.json',
  '/compute/skill.md',
  '/compute/openapi.json',
];
for (const path of ROBOTS_ALLOWS) {
  const line = new RegExp(`^Allow: ${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm');
  assert.match(robotsConst, line, `worker ROBOTS_TXT Allows ${path}`);
  assert.match(diskRobots, line, `disk robots Allows ${path}`);
}
assert.match(robotsConst, /\/agents\.json/, 'identity/allowlist mentions /agents.json');
assert.match(robotsConst, /\/\.well-known\/mcp\.json/, 'identity/allowlist mentions /.well-known/mcp.json');
assert.match(robotsConst, /\/\.well-known\/agent\.json/, 'identity/allowlist mentions /.well-known/agent.json');
assert.match(robotsConst, /\/compute\/skill\.md/, 'identity/allowlist mentions /compute/skill.md');
assert.match(robotsConst, /\/compute\/openapi\.json/, 'identity/allowlist mentions /compute/openapi.json');
assert.doesNotMatch(robotsConst, /plugin\.jup\.ag/);
assert.doesNotMatch(diskRobots, /plugin\.jup\.ag/);
assert.doesNotMatch(robotsConst, new RegExp(MINT), 'robots stays rules, not a mint page');

const env = {
  LOBBY_SESSION_SECRET: 'motley-openapi-json-robots-aeo-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of JSON_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), OPENAPI, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of GATEWAY_STAY) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(res.status, 308, `${host} ${path} stays gateway 308`);
    const wantApi = host === 'lobby.getdasha.com' ? 'https://lobby.getdasha.com/compute/api' : API;
    assert.equal(res.headers.get('location'), wantApi, `${host} ${path} still /compute/api`);
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
    const api = await edgeWorker.fetch(new Request(`https://${host}/compute/api`), env);
    assert.equal(api.status, 200, `${host} /compute/api stays 200`);
    const body = await api.json();
    assert.notEqual(body.openapi, '3.1.0', `${host} /compute/api is the status stub, not the spec`);
  }
  {
    const robots = await edgeWorker.fetch(new Request(`https://${host}/robots.txt`), env);
    assert.equal(robots.status, 200, `${host}/robots.txt`);
    if (host === 'www.getdasha.com') {
      assert.equal(robots.headers.get('x-dasha-edge'), 'robots', `${host} robots is Worker-owned`);
    }
    const text = await robots.text();
    for (const path of ROBOTS_ALLOWS) {
      assert.match(text, new RegExp(`^Allow: ${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `${host} robots Allows ${path}`);
    }
    assert.doesNotMatch(text, /plugin\.jup\.ag/, `${host} robots no plugin.jup.ag`);
    assert.doesNotMatch(text, /paste this into Webflow SEO settings/, `${host} robots no Webflow lecture`);
  }
  for (const path of ['/api/v1', '/api/models', '/api/providers']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/openapi.json</loc>`), 'sitemap omits leftover /openapi.json');

console.log('dasha-motley-openapi-json-robots-aeo-leftover: PASS (/openapi.json+/api/openapi.json 308 /compute/openapi.json; /openapi+/api/openapi stay /compute/api; robots Allows /llms.txt /agents.json /.well-known/mcp.json /.well-known/agent.json /compute/skill.md /compute/openapi.json; Title-case+slash; www+lobby GET+HEAD; dests 200 OpenAPI 3.1; stay-out /api/v1|/api/models|/api/providers; no Muse restack; no plugin.jup.ag)');
