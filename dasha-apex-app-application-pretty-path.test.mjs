#!/usr/bin/env node
/**
 * Leftover pretty path (Worker f3b06492): live /app /application
 * + /compute/app|/application (+slash / Title-case) html-404 → 308 /compute.
 * Product-door synonyms while /dashboard /console /sandbox /playground /demo
 * /try peers already 308→/compute. Do NOT invent /arcade /games. Do NOT fold
 * /connect (ambiguous). Skip /v1 /openai /status /health /terms /admin.
 * Bare /price stays the 200 JSON token-price API. /privacy /compute stay 200.
 * /play still 308→/lobby. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(
  workerSrc,
  /App\/application leftovers/,
  'leftover comment names app/application family',
);
assert.match(
  workerSrc,
  /Do NOT invent \/arcade \/games/,
  'leftover comment keeps /arcade /games uninvented',
);
assert.match(
  workerSrc,
  /Do NOT fold \/connect/,
  'leftover comment keeps /connect out (ambiguous)',
);
assert.match(
  workerSrc,
  /\/app\|\/application\|\/compute\/app\|\/compute\/application/,
  'potterHome308Dest comment lists leftover family',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const leaf of ['app', 'application']) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
}
for (const skip of ['/connect', '/v1', '/openai', '/status', '/health', '/terms', '/admin', '/arcade', '/games']) {
  assert.doesNotMatch(tab, new RegExp(`['"]${skip}['"]`), `${skip} stays out of compute-tab set`);
}
assert.doesNotMatch(tab, /['"]\/price['"]/, 'do not fold bare /price');
assert.doesNotMatch(tab, /['"]\/privacy['"]/, 'do not fold /privacy');

const WWW = 'https://www.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const LOBBY = `${WWW}/lobby`;

const SHIP = [
  '/app', '/app/', '/App', '/APP', '/aPp/',
  '/application', '/application/', '/Application', '/APPLICATION', '/aPpLiCaTiOn/',
  '/compute/app', '/compute/app/', '/Compute/app', '/COMPUTE/APP', '/Compute/App/',
  '/compute/application', '/compute/application/', '/Compute/application',
  '/COMPUTE/APPLICATION', '/Compute/Application/',
];
const PRIOR_PEERS = [
  '/dashboard', '/dashboard/', '/Dashboard',
  '/console', '/console/', '/Console',
  '/sandbox', '/sandbox/', '/Sandbox',
  '/playground', '/playground/', '/Playground',
  '/try', '/try/', '/Try',
];
const UNTOUCHED = [
  '/price', '/privacy', '/compute',
  '/arcade', '/games', '/connect',
  '/v1', '/openai', '/status', '/health', '/terms', '/admin',
];
const STAY_404 = ['/arcade', '/connect', '/terms'];

for (const path of [...SHIP, ...PRIOR_PEERS]) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of UNTOUCHED) {
  assert.equal(potterHome308Dest(path), null, `${path} stays untouched`);
}
assert.equal(potterHome308Dest('/play'), LOBBY, '/play → lobby');

const env = {
  LOBBY_SESSION_SECRET: 'apex-app-application-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of SHIP) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of STAY_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 404, `${host} ${path} ${method} stays 404`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (host === 'www.getdasha.com') {
        assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${host} ${path} ${method} html-404`);
        if (method === 'HEAD') assert.equal(await res.text(), '');
      }
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
}

console.log('dasha-apex-app-application-pretty-path: PASS (/app+/application + /compute/app|/application 308 /compute; Title-case+slash; www+lobby GET+HEAD; /dashboard+/console+/sandbox+/playground+/try peers; /play → lobby; /price+/privacy+/compute untouched; /arcade+/games+/connect+/v1+/openai+/status+/health+/terms+/admin stay out; no plugin.jup.ag)');
