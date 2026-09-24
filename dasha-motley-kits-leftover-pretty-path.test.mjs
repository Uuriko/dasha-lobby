#!/usr/bin/env node
/**
 * Motley leftover kits doors (2026-09-18): live GET/HEAD /room/kits.json
 * /api/kits /api/kits.json (+slash / Title-case via toLowerCase) 404
 * while /room/kits is the 200 text/plain catalog. Fold to that face.
 * Lobby same-host, not www cross-host. Exact /room/kits + kits.txt
 * family stay 200 Room proxy (dest-null). Do not invent a Room proxy
 * for kits.json. Apex /kits stays compute-tab leftover → /compute.
 * Skip /compute/digest. Do not invent doctor.md / PROVIDE.md.
 * www /room/* is the Room worker, so the 308 does not run on www until
 * deploy route www.getdasha.com/room/kits.json* (longer than Room's
 * /room* prefix). Do not widen that route to /room*. Do not add
 * kits.json to ROOM_UPSTREAM.
 * Disk only. No Designer. Never plugin.jup.ag. No Muse HTML. No Ask
 * UX. No Quill. No Room Phase 0. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { roomUpstreamPath } from './dasha-room-edge-proxy.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const proxySrc = readFileSync(join(root, 'dasha-room-edge-proxy.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(proxySrc, /plugin\.jup\.ag/, 'proxy must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_KITS_308_PATHS/, 'kits leftover set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map/set beat casefold catch-all');
assert.match(workerSrc, /dasha-muse-product/, 'Muse #225 faces imported; leftover maps stay out');
assert.match(
  workerSrc,
  /POTTER_KITS_308_PATHS\.has\(src\)/,
  'lobby same-host rewrite lists kits leftover dest',
);
assert.match(
  workerSrc,
  /https:\/\/www\.getdasha\.com\/room\/kits/,
  'leftover dest is live /room/kits face',
);
assert.match(
  workerSrc,
  /www\.getdasha\.com\/room\/kits\.json\*/,
  'worker names the www route that beats Room /room/*',
);

const KITS_JSON_ROUTE = /"pattern": "www\.getdasha\.com\/room\/kits\.json\*"/;
for (const file of ['dasha-lobby-wrangler.deploy.jsonc', 'dasha-lobby-wrangler.jsonc']) {
  const wrangler = readFileSync(join(root, file), 'utf8');
  assert.match(wrangler, KITS_JSON_ROUTE, `${file} routes www /room/kits.json* to this worker`);
  assert.match(wrangler, /"pattern": "www\.getdasha\.com\/\*"/, `${file} keeps the www catch-all`);
  assert.doesNotMatch(wrangler, /www\.getdasha\.com\/room\*/, `${file} must not steal the Room door prefix`);
  assert.doesNotMatch(wrangler, /www\.getdasha\.com\/room\/\*/, `${file} must not steal www /room/*`);
  assert.doesNotMatch(wrangler, /"pattern": "getdasha\.com\/\*"/, `${file} must not steal apex Webflow`);
}

const kitsSet = workerSrc.match(/const POTTER_KITS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
const roomDiscoverySet = workerSrc.match(/const POTTER_ROOM_AGENT_DISCOVERY_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const tabSet = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}
for (const path of [
  '/room/kits.json', '/room/kits.json/',
  '/api/kits', '/api/kits/',
  '/api/kits.json', '/api/kits.json/',
]) {
  assert.ok(listed(kitsSet, path), `kits set lists ${path}`);
}
assert.doesNotMatch(kitsSet, /['"]\/room\/kits['"]/, 'exact /room/kits stays 200 catalog');
assert.doesNotMatch(kitsSet, /['"]\/kits['"]/, 'apex /kits stays compute-tab leftover');
assert.doesNotMatch(kitsSet, /['"]\/compute\/kits['"]/, 'do not steal /compute/kits tab leftover');
assert.doesNotMatch(kitsSet, /['"]\/compute\/digest['"]/, 'do not invent /compute/digest leftover here');
assert.doesNotMatch(kitsSet, /['"]\/compute\/doctor\.md['"]/, 'do not invent doctor.md');
assert.doesNotMatch(kitsSet, /['"]\/PROVIDE\.md['"]/, 'do not invent PROVIDE.md');
assert.doesNotMatch(kitsSet, /['"]\/provide\.md['"]/, 'do not invent provide.md');
assert.doesNotMatch(kitsSet, /['"]\/api\/kit['"]/, 'do not invent /api/kit');
assert.doesNotMatch(kitsSet, /dasha-muse-product/, 'kits leftover set does not import Muse HTML');
assert.doesNotMatch(discoveryMap, /['"]\/room\/kits\.json['"]/, '/room/kits.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/api\/kits['"]/, '/api/kits leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/api\/kits\.json['"]/, '/api/kits.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(roomDiscoverySet, /['"]\/room\/kits\.json['"]/, 'kits.json is not llms leftover');
assert.doesNotMatch(proxySrc, /\/room\/kits\.json/, 'do not invent Room kits.json proxy');
assert.match(tabSet, /['"]\/kits['"]/, 'apex /kits stays compute-tab leftover');

assert.equal(roomUpstreamPath('/room/kits.json'), null, 'kits.json stays out of ROOM_UPSTREAM');
assert.equal(roomUpstreamPath('/room/kits.json/'), null, 'kits.json slash stays out of ROOM_UPSTREAM');
assert.equal(roomUpstreamPath('/room/kits'), '/kits.txt', '/room/kits stays catalog proxy');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const KITS = `${WWW}/room/kits`;
const LOBBY_KITS = `${LOBBY}/room/kits`;
const COMPUTE = `${WWW}/compute`;
const DIGEST = `${WWW}/digest`;
const PROVIDE = `${WWW}/compute#provide`;

const KITS_FOLDS = [
  '/room/kits.json',
  '/room/kits.json/',
  '/Room/kits.json',
  '/ROOM/KITS.JSON',
  '/Room/Kits.json/',
  '/api/kits',
  '/api/kits/',
  '/Api/Kits',
  '/API/KITS',
  '/Api/Kits/',
  '/api/kits.json',
  '/api/kits.json/',
  '/Api/kits.json',
  '/API/KITS.JSON',
  '/Api/Kits.json/',
];

const STAY_200 = [
  '/room/kits',
  '/room/kits/',
  '/room/kits.txt',
];

const STAY_OUT = [
  '/api/kit',
  '/api/kit/',
  '/compute/doctor.md',
  '/PROVIDE.md',
  '/provide.md',
];

for (const path of KITS_FOLDS) {
  assert.equal(potterHome308Dest(path), KITS, `${path} → /room/kits`);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not /compute`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 catalog`);
}
for (const path of STAY_OUT) {
  assert.notEqual(potterHome308Dest(path), KITS, `stay-out ${path} is not /room/kits`);
}
assert.equal(potterHome308Dest('/kits'), COMPUTE, 'apex /kits stays compute-tab leftover');
assert.equal(potterHome308Dest('/compute/kits'), COMPUTE, '/compute/kits stays compute-tab leftover');
assert.equal(potterHome308Dest('/compute/digest'), DIGEST, '/compute/digest stay-skip keeps existing leftover');
assert.notEqual(potterHome308Dest('/compute/doctor.md'), PROVIDE, 'do not invent /compute/doctor.md');
assert.equal(potterHome308Dest('/start'), null, 'Muse #225 /start stays face');
assert.equal(potterHome308Dest('/providers'), null, 'Muse #225 /providers stays face');

function expectLoc(host) {
  return host === 'lobby.getdasha.com' ? LOBBY_KITS : KITS;
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-kits-leftover-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of KITS_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host), `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not /compute`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      assert.doesNotMatch(res.headers.get('location') || '', /project-room-staging/, `${host} ${path} ${method} not origin`);
      if (host === 'lobby.getdasha.com') {
        assert.match(res.headers.get('location') || '', /^https:\/\/lobby\.getdasha\.com\//, `${host} ${path} same-host`);
        assert.doesNotMatch(res.headers.get('location') || '', /^https:\/\/www\.getdasha\.com\//, `${host} ${path} not www cross-host`);
      }
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/api/kit', '/compute/doctor.md', '/PROVIDE.md']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.headers.get('location'), expectLoc(host), `${host} ${path} not /room/kits`);
    assert.notEqual(potterHome308Dest(path), KITS, `${host} ${path} dest is not kits face`);
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/room/kits.json', '/api/kits', '/api/kits.json']) {
  assert.ok(!sitemapXml.includes(`${WWW}${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-motley-kits-leftover-pretty-path: PASS (/room/kits.json + /api/kits + /api/kits.json 308 /room/kits same-host; Title-case+slash; www+lobby GET+HEAD; www route kits.json* beats Room /room/*; not Room proxy invent; apex /kits stays tab; stay-out doctor.md/PROVIDE.md/digest invent; no Muse restack; no plugin.jup.ag)');
