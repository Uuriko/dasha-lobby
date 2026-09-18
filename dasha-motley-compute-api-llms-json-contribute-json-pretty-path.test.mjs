#!/usr/bin/env node
/**
 * Motley leftover nested machine doors (2026-09-17, post-#253):
 * live GET/HEAD /compute/api/llms.json /compute/api/contribute.json
 * (+slash / Title-case via toLowerCase) JSON-404 while faces already
 * 200. Fold to /compute/llms.txt (compute packet; /llms.txt is the
 * site index) and /contribute HTML (not /humans.txt). Must win over
 * the /compute/api/ casefold catch-all. Lobby same-host, not www
 * cross-host. Do not invent apex /llms.json /contribute.json or
 * /api/llms.json. Bare /compute/api/llms + /compute/api/contribute
 * stay their Sets. Disk only. No Designer. Never plugin.jup.ag.
 * No Muse HTML. No Ask UX. No Quill. No #216 proof body. No Room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_API_LLMS_JSON_308_PATHS/, 'nested llms.json leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_CONTRIBUTE_JSON_308_PATHS/, 'nested contribute.json leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_LLMS_308_PATHS/, 'keep bare /compute/api/llms set');
assert.match(workerSrc, /POTTER_COMPUTE_API_CONTRIBUTE_308_PATHS/, 'keep bare /compute/api/contribute set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map/set beat casefold catch-all');
assert.match(workerSrc, /dasha-muse-product/, 'Muse #225 faces imported; leftover maps stay out');

const llmsJsonSet = workerSrc.match(/const POTTER_COMPUTE_API_LLMS_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const contributeJsonSet = workerSrc.match(/const POTTER_COMPUTE_API_CONTRIBUTE_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const llmsSet = workerSrc.match(/const POTTER_COMPUTE_API_LLMS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const contributeSet = workerSrc.match(/const POTTER_COMPUTE_API_CONTRIBUTE_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}
for (const path of ['/compute/api/llms.json', '/compute/api/llms.json/']) {
  assert.ok(listed(llmsJsonSet, path), `llms.json set lists ${path}`);
}
for (const path of ['/compute/api/contribute.json', '/compute/api/contribute.json/']) {
  assert.ok(listed(contributeJsonSet, path), `contribute.json set lists ${path}`);
}
assert.doesNotMatch(llmsJsonSet, /['"]\/llms\.json['"]/, 'do not invent apex /llms.json');
assert.doesNotMatch(llmsJsonSet, /['"]\/api\/llms\.json['"]/, 'do not invent /api/llms.json');
assert.doesNotMatch(llmsJsonSet, /['"]\/compute\/api\/llms['"]/, 'bare /compute/api/llms stays its Set');
assert.doesNotMatch(contributeJsonSet, /['"]\/contribute\.json['"]/, 'do not invent apex /contribute.json');
assert.doesNotMatch(contributeJsonSet, /['"]\/api\/contribute\.json['"]/, 'do not invent /api/contribute.json');
assert.doesNotMatch(contributeJsonSet, /['"]\/compute\/api\/contribute['"]/, 'bare /compute/api/contribute stays its Set');
assert.doesNotMatch(llmsSet, /['"]\/compute\/api\/llms\.json['"]/, 'llms.json leftover lives in its Set');
assert.doesNotMatch(contributeSet, /['"]\/compute\/api\/contribute\.json['"]/, 'contribute.json leftover lives in its Set');
assert.doesNotMatch(llmsJsonSet, /dasha-muse-product/, 'llms.json leftover set does not import Muse HTML');
assert.doesNotMatch(contributeJsonSet, /dasha-muse-product/, 'contribute.json leftover set does not import Muse HTML');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/llms\.json['"]/, 'llms.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/contribute\.json['"]/, 'contribute.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/llms\.json['"]/, 'do not invent apex /llms.json leftover');
assert.doesNotMatch(discoveryMap, /['"]\/contribute\.json['"]/, 'do not invent apex /contribute.json leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'do not invent /api/v1 leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'do not invent /api/models leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'do not invent /api/providers leftover');
assert.match(discoveryMap, /['"]\/api\/contribute['"]/, 'keep #235 /api/contribute on Motley map');
assert.match(discoveryMap, /['"]\/contribute\.md['"]/, 'keep #241 /contribute.md on Motley map');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const LLMS = `${WWW}/compute/llms.txt`;
const LOBBY_LLMS = `${LOBBY}/compute/llms.txt`;
const SITE_LLMS = `${WWW}/llms.txt`;
const CONTRIBUTE = `${WWW}/contribute`;
const LOBBY_CONTRIBUTE = `${LOBBY}/contribute`;
const HUMANS = `${WWW}/humans.txt`;

const LLMS_JSON_FOLDS = [
  '/compute/api/llms.json',
  '/compute/api/llms.json/',
  '/Compute/api/llms.json',
  '/COMPUTE/API/LLMS.JSON',
  '/Compute/Api/Llms.json/',
];
const CONTRIBUTE_JSON_FOLDS = [
  '/compute/api/contribute.json',
  '/compute/api/contribute.json/',
  '/Compute/api/contribute.json',
  '/COMPUTE/API/CONTRIBUTE.JSON',
  '/Compute/Api/Contribute.json/',
];

const STAY_200 = [
  '/compute/llms.txt',
  '/llms.txt',
  '/contribute',
  '/humans.txt',
];
const STAY_OUT = [
  '/api/v1',
  '/api/v1/',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
  '/llms.json',
  '/contribute.json',
  '/api/llms.json',
  '/api/contribute.json',
];

for (const path of LLMS_JSON_FOLDS) {
  assert.equal(potterHome308Dest(path), LLMS, `${path} → /compute/llms.txt`);
  assert.notEqual(potterHome308Dest(path), SITE_LLMS, `${path} is not the site index`);
}
for (const path of CONTRIBUTE_JSON_FOLDS) {
  assert.equal(potterHome308Dest(path), CONTRIBUTE, `${path} → /contribute`);
  assert.notEqual(potterHome308Dest(path), HUMANS, `${path} is not /humans.txt`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/compute/api/llms'), LLMS, 'bare /compute/api/llms still folds');
assert.equal(potterHome308Dest('/compute/api/llms/'), LLMS, 'bare /compute/api/llms/ still folds');
assert.equal(potterHome308Dest('/compute/api/contribute'), CONTRIBUTE, 'bare /compute/api/contribute still folds');
assert.equal(potterHome308Dest('/compute/api/contribute/'), CONTRIBUTE, 'bare /compute/api/contribute/ still folds');
assert.equal(potterHome308Dest('/api/contribute'), CONTRIBUTE, '#235 /api/contribute still folds');
assert.equal(potterHome308Dest('/contribute.md'), CONTRIBUTE, '#241 /contribute.md still folds');
assert.equal(potterHome308Dest('/compute/api/humans'), HUMANS, '/compute/api/humans still /humans.txt');
assert.equal(potterHome308Dest('/start'), null, 'Muse #225 /start stays face');
assert.equal(potterHome308Dest('/providers'), null, 'Muse #225 /providers stays face');
assert.equal(potterHome308Dest('/developers'), null, 'Muse #225 /developers stays face');
assert.equal(potterHome308Dest('/network'), null, 'Muse #225 /network stays face');

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  if (dest === LLMS) return LOBBY_LLMS;
  if (dest === CONTRIBUTE) return LOBBY_CONTRIBUTE;
  return dest;
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-compute-api-llms-contribute-json-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [
    ...LLMS_JSON_FOLDS.map((p) => [p, LLMS]),
    ...CONTRIBUTE_JSON_FOLDS.map((p) => [p, CONTRIBUTE]),
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, dest), `${host} ${path} ${method} loc`);
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
  for (const path of ['/api/v1', '/api/models', '/api/providers', '/llms.json', '/contribute.json']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
  const foo = await edgeWorker.fetch(new Request(`https://${host}/compute/api/foo`), env);
  assert.equal(foo.status, 404, `${host} /compute/api/foo stays JSON 404`);
  assert.notEqual(foo.headers.get('location'), LLMS, `${host} /compute/api/foo not llms`);
  assert.notEqual(foo.headers.get('location'), CONTRIBUTE, `${host} /compute/api/foo not contribute`);
  {
    const bareLlms = await edgeWorker.fetch(new Request(`https://${host}/compute/api/llms`), env);
    assert.equal(bareLlms.status, 308, `${host} /compute/api/llms leftover 308`);
    assert.equal(bareLlms.headers.get('location'), LLMS, `${host} /compute/api/llms still www compute packet`);
  }
  {
    const bareContribute = await edgeWorker.fetch(new Request(`https://${host}/compute/api/contribute`), env);
    assert.equal(bareContribute.status, 308, `${host} /compute/api/contribute leftover 308`);
    assert.equal(bareContribute.headers.get('location'), CONTRIBUTE, `${host} /compute/api/contribute still www HTML face`);
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/compute/api/llms.json',
  '/compute/api/contribute.json',
]) {
  assert.ok(!sitemapXml.includes(`${WWW}${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-motley-compute-api-llms-json-contribute-json-pretty-path: PASS (/compute/api/llms.json 308 /compute/llms.txt same-host; /compute/api/contribute.json 308 /contribute HTML same-host; Title-case+slash; www+lobby GET+HEAD; dests 200; stay-out /llms.json|/contribute.json|/api/v1|/api/models|/api/providers; no Muse restack; no plugin.jup.ag)');
