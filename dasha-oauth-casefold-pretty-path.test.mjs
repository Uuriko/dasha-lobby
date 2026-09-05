#!/usr/bin/env node
/**
 * Leftover Title-case /OAuth/x(...) and /OAuth/github(...) html-404 while
 * lowercase siblings already 308→lobby (www) or 200 (lobby). 308 to
 * canonical lowercase on www; exact lowercase stays null so existing
 * www→lobby hop and lobby handlers run. Disk only. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /\/OAuth\/x\(\.\.\.\) \/OAuth\/github\(\.\.\.\) Title-case/, 'oauth case-fold comment');

const WWW = 'https://www.getdasha.com';

const CASES = [
  ['/OAuth/x/start', `${WWW}/oauth/x/start`],
  ['/oauth/X/start', `${WWW}/oauth/x/start`],
  ['/OAUTH/x/start', `${WWW}/oauth/x/start`],
  ['/Oauth/x/start', `${WWW}/oauth/x/start`],
  ['/OAuth/x/callback', `${WWW}/oauth/x/callback`],
  ['/OAuth/github/start', `${WWW}/oauth/github/start`],
  ['/oauth/GitHub/start', `${WWW}/oauth/github/start`],
  ['/Oauth/github/start', `${WWW}/oauth/github/start`],
  ['/OAuth/github/callback', `${WWW}/oauth/github/callback`],
  ['/OAuth/x', `${WWW}/oauth/x`],
  ['/OAuth/github/', `${WWW}/oauth/github/`],
];

for (const [path, dest] of CASES) {
  assert.equal(potterHome308Dest(path), dest, path);
}

for (const path of [
  '/oauth/x/start',
  '/oauth/x/callback',
  '/oauth/github/start',
  '/oauth/github/callback',
  '/oauth/x',
  '/oauth/github/',
]) {
  assert.equal(potterHome308Dest(path), null, `lowercase ${path} stays for handlers`);
}

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
}

console.log('dasha-oauth-casefold-pretty-path: PASS (Title-case /OAuth/x+/github 308 lowercase www+lobby GET+HEAD)');
