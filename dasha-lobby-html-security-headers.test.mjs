#!/usr/bin/env node
/**
 * #319: site-edge hardening headers must be route-independent.
 * Every 308 redirect carries the HTML_SECURITY bundle; HEAD HTML pass-through
 * responses are hardened like GET; no bare Response.redirect survives.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Response } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

const HARDENED = {
  'x-frame-options': 'DENY',
  'content-security-policy': "frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
};
const assertHardened = (res, label) => {
  for (const [name, value] of Object.entries(HARDENED)) {
    assert.equal(res.headers.get(name), value, `${label}: ${name}`);
  }
};

// invariants on the source: no bare redirect, HEAD branch hardened
assert.doesNotMatch(workerSrc, /Response\.redirect\(/, 'no bare Response.redirect survives in the worker');
assert.match(workerSrc, /applyHtmlSecurity\(new Headers\(upstream\.headers\)\)/, 'HEAD/non-GET HTML pass-through hardened');

// retired-door map: /launch -> /compute carries the bundle (GET + HEAD)
for (const method of ['GET', 'HEAD']) {
  const res = potterHome308Response(new Request(`https://www.getdasha.com/launch`, { method }), new URL('https://www.getdasha.com/launch'));
  assert.equal(res.status, 308, `/launch ${method} status`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/compute', `/launch ${method} location`);
  assertHardened(res, `/launch ${method}`);
}
assert.equal(potterHome308Response(new Request('https://www.getdasha.com/start'), new URL('https://www.getdasha.com/start')), null, 'Muse product path stays null');

// through the worker: Title-case product 308s + in-router doors
const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/Launch', '/desk', '/how', '/quiz']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method} status`);
      assert.ok(res.headers.get('location'), `${host} ${path} ${method} location`);
      assertHardened(res, `${host} ${path} ${method}`);
    }
  }
}

// hardened HTML routes keep their existing headers (regression: bundle unchanged)
const verify = await edgeWorker.fetch(new Request('https://www.getdasha.com/verify'), env);
assert.equal(verify.status, 200, '/verify 200');
assertHardened(verify, '/verify');

console.log('dasha-lobby-html-security-headers: PASS (15 hardened 308 sites + HEAD pass-through + bundle unchanged)');
