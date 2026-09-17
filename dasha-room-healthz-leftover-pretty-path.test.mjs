#!/usr/bin/env node
/**
 * Leftover pretty path (2026-09-17): live GET/HEAD /room/healthz
 * (+slash / Title-case) html-404 on www+lobby while /room/health is
 * the 200 Project Room probe face. Fold to /room/health (lobby
 * same-host via potterHome308Response, like other /room doors).
 * Exact /room/health leftover dest stays /room/api/health (historical).
 * Do not invent apex /healthz or /room/readyz. Do not fold Compute
 * /compute/healthz here. Do not invent /room/join. Disk only. No
 * Designer. No wrangler. Never plugin.jup.ag.
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
assert.match(workerSrc, /Leftover \/room\/healthz \(2026-09-17\)/, 'leftover comment names /room/healthz');
assert.match(
  workerSrc,
  /p === ["']\/room\/healthz["'] \|\| p === ["']\/room\/healthz\/["']/,
  'probe leftover dest special-case in potterHome308Dest',
);
assert.match(
  workerSrc,
  /https:\/\/www\.getdasha\.com\/room\/health/,
  'leftover dest is live /room/health face',
);
assert.match(
  workerSrc,
  /src === ['"]\/room\/healthz['"] \|\|\s*src === ['"]\/room\/healthz\/['"]/,
  'lobby same-host rewrite lists /room/healthz',
);

const discoverySet = workerSrc.match(/const POTTER_ROOM_AGENT_DISCOVERY_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.doesNotMatch(discoverySet, /['"]\/room\/healthz['"]/, 'healthz is dest special-case, not llms set');
assert.doesNotMatch(proxySrc, /\/room\/healthz/, 'do not invent Room healthz proxy');
assert.equal(roomUpstreamPath('/room/healthz'), null, 'healthz stays out of ROOM_UPSTREAM');
assert.equal(roomUpstreamPath('/room/healthz/'), null, 'healthz slash stays out of ROOM_UPSTREAM');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const ROOM_HEALTH = `${WWW}/room/health`;
const LOBBY_HEALTH = `${LOBBY}/room/health`;
const ROOM_API_HEALTH = `${WWW}/room/api/health`;
const COMPUTE_HEALTHZ = `${WWW}/compute/api/healthz`;

const FOLDS = [
  '/room/healthz',
  '/room/healthz/',
  '/Room/healthz',
  '/ROOM/HEALTHZ',
  '/Room/Healthz',
  '/Room/Healthz/',
  '/ROOM/HEALTHZ/',
];

const STAY_NULL = [
  '/healthz',
  '/healthz/',
  '/Healthz',
  '/room/readyz',
  '/room/readyz/',
  '/room/join',
  '/room/connect',
  '/room/open',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), ROOM_HEALTH, path);
  assert.notEqual(potterHome308Dest(path), ROOM_API_HEALTH, `${path} is not /room/api/health`);
  assert.notEqual(potterHome308Dest(path), COMPUTE_HEALTHZ, `${path} is not Compute healthz`);
}
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, `${path} stays out`);
}
assert.equal(potterHome308Dest('/room/health'), ROOM_API_HEALTH, 'historical /room/health leftover stays');
assert.equal(potterHome308Dest('/compute/healthz'), COMPUTE_HEALTHZ, '/compute/healthz stays Compute leftover');
assert.equal(potterHome308Dest('/room/api/health'), null, '/room/api/health stays 200 dest');

const env = {
  LOBBY_SESSION_SECRET: 'room-healthz-leftover-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

function assertLeftover308(res, host, path, method, loc) {
  assert.equal(res.status, 308, `${host} ${path} ${method}`);
  assert.equal(res.headers.get('location'), loc, `${host} ${path} ${method} loc`);
  assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
  assert.doesNotMatch(res.headers.get('location') || '', /project-room-staging/, `${host} ${path} ${method} not origin`);
  assert.doesNotMatch(res.headers.get('location') || '', /\/compute\//, `${host} ${path} ${method} not Compute`);
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const healthLoc = host === 'lobby.getdasha.com' ? LOBBY_HEALTH : ROOM_HEALTH;
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assertLeftover308(res, host, path, method, healthLoc);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/healthz', '/room/readyz', '/room/join']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), healthLoc, `${host} ${path} ${method} not /room/health`);
      assert.notEqual(res.headers.get('location'), ROOM_HEALTH, `${host} ${path} ${method} not invented Room health`);
      assert.equal(potterHome308Dest(path), null, `${host} ${path} dest stays null`);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes('https://www.getdasha.com/room/healthz</loc>'), 'sitemap omits leftover /room/healthz');

console.log('dasha-room-healthz-leftover-pretty-path: PASS (/room/healthz +slash +Title-case 308 /room/health www+lobby GET+HEAD same-host; /healthz+/room/readyz+/room/join stay out; /compute/healthz stays Compute; no plugin.jup.ag)');
