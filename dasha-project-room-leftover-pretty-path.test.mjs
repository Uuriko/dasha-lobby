#!/usr/bin/env node
/**
 * Leftover pretty path (2026-09-11): live /project-room (+slash / Title-case
 * / underscore /project_room) html-404 while /room is 200 discovery on
 * www+lobby. Fold to /room (lobby same-host via potterHome308Response).
 * Do not invent /project-rooms. Keep Compute separate — no /compute/project-room.
 * Exact /room stays 200 (null dest). Disk only. No Designer. No wrangler.
 * Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_ROOM_308_PATHS/, 'room leftover 308 set present');
assert.match(
  workerSrc,
  /Leftover \/project-room \(2026-09-11\)/,
  'leftover comment names /project-room family',
);
assert.match(
  workerSrc,
  /["']\/project-room["'],\s*["']\/project-room\/["']/,
  'set lists /project-room +slash',
);
assert.match(
  workerSrc,
  /["']\/project_room["'],\s*["']\/project_room\/["']/,
  'set lists underscore /project_room +slash',
);
assert.doesNotMatch(
  workerSrc,
  /["']\/project-rooms["']/,
  'do not invent /project-rooms',
);
assert.doesNotMatch(
  workerSrc,
  /["']\/compute\/project-room["']/,
  'keep Compute separate — no /compute/project-room tab',
);

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const ROOM = `${WWW}/room`;
const LOBBY_ROOM = `${LOBBY}/room`;
const COMPUTE = `${WWW}/compute`;

const FOLDS = [
  '/project-room', '/project-room/',
  '/Project-room', '/Project-Room', '/PROJECT-ROOM', '/pRoJeCt-RoOm/',
  '/project_room', '/project_room/',
  '/Project_room', '/Project_Room', '/PROJECT_ROOM', '/pRoJeCt_RoOm/',
];
const STAY_NULL = [
  '/room', '/room/',
  '/project-rooms', '/project-rooms/',
  '/compute/project-room', '/compute/project-room/',
  '/rooms', '/chatroom',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), ROOM, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not /compute`);
}
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, `${path} stays out`);
}

const env = {
  LOBBY_SESSION_SECRET: 'project-room-leftover-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const loc = host === 'lobby.getdasha.com' ? LOBBY_ROOM : ROOM;
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), loc, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      assert.doesNotMatch(res.headers.get('location') || '', /project-room-staging/, `${host} ${path} ${method} not origin`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/project-rooms', '/compute/project-room']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), loc, `${host} ${path} ${method} not invented`);
      assert.notEqual(res.headers.get('location'), ROOM, `${host} ${path} ${method} not /room`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not /compute`);
      assert.equal(potterHome308Dest(path), null, `${host} ${path} dest stays null`);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/project-room', '/project_room', '/project-rooms']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-project-room-leftover-pretty-path: PASS (/project-room+/project_room +slash +Title-case 308 /room www+lobby GET+HEAD same-host; /room 200 dest; no /project-rooms; no /compute/project-room; no plugin.jup.ag)');
