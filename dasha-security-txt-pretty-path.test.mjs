#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 6bcd8adf): live /security /security.txt
 * (+slash / Title-case) html-404 → 308 /.well-known/security.txt.
 * Exact /.well-known/security.txt stays 200 (null dest).
 * Do not invent /humans.txt /ads.txt /terms /tos.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_SECURITY_TXT_308_PATHS/, 'security.txt leftover 308 set present');
assert.match(
  workerSrc,
  /Leftover \/security \/security\.txt \(\+slash \/ Title-case\) → \/\.well-known\/security\.txt/,
  'security leftover comment',
);

const DEST = 'https://www.getdasha.com/.well-known/security.txt';

const FOLDS = [
  '/security', '/security/', '/Security', '/SECURITY', '/sEcUrItY/',
  '/security.txt', '/security.txt/', '/Security.txt', '/SECURITY.TXT', '/Security.TXT/',
];
const STAY_OUT = [
  '/.well-known/security.txt',
  '/humans.txt',
  '/ads.txt',
  '/terms',
  '/tos',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), DEST, path);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay out ${path}`);
}

const env = { LOBBY_SESSION_SECRET: 'security-txt-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), DEST, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const canon = await edgeWorker.fetch(new Request(`https://${host}/.well-known/security.txt`, { method }), env);
    assert.equal(canon.status, 200, `${host} /.well-known/security.txt ${method} stays 200`);
    if (method === 'HEAD') {
      assert.equal(await canon.text(), '');
    } else {
      const body = await canon.text();
      assert.match(body, /Canonical: https:\/\/[^/\s]+\/.well-known\/security\.txt/);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/security', '/security.txt']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-security-txt-pretty-path: PASS (/security+/security.txt 308 /.well-known/security.txt www+lobby GET+HEAD; Title-case+slash; exact well-known 200; no /humans.txt /ads.txt /terms /tos; no plugin.jup.ag)');
