#!/usr/bin/env node
/**
 * Leftover pretty path (Worker f6521987): live /llms-full /llms_full
 * (+slash / Title-case) html-404 → 308 /llms-full.txt.
 * /.well-known/llms-full.txt (Title-case; no slash — live slash is 404)
 * → same dest. /.well-known/ai.txt (Title-case) → 308 /ai.txt.
 * Keep existing /llms (+slash / Title-case) + /.well-known/llms.txt → /llms.txt.
 * Exact /llms-full.txt /llms.txt /ai.txt stay 200 (null dest).
 * Do not invent /llm /humans.txt /ads.txt /terms /tos /social.
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
assert.match(workerSrc, /POTTER_LLMS_FULL_AEO_308_PATHS/, 'llms-full aeo leftover 308 set present');
assert.match(workerSrc, /POTTER_LLMS_AEO_308_PATHS/, 'llms aeo peer 308 set present');
assert.match(workerSrc, /POTTER_AI_TXT_WELLKNOWN_308_PATHS/, 'well-known ai.txt leftover 308 set present');
assert.match(
  workerSrc,
  /Leftover \/llms-full \/llms_full \(\+slash \/ Title-case\) \+ \/\.well-known\/llms-full\.txt → \/llms-full\.txt/,
  'llms-full leftover comment',
);
assert.match(
  workerSrc,
  /Existing \/llms \(\+slash \/ Title-case\) \+ \/\.well-known\/llms\.txt → \/llms\.txt/,
  'llms peer leftover comment',
);

const FULL = 'https://www.getdasha.com/llms-full.txt';
const LLMS = 'https://www.getdasha.com/llms.txt';
const AI = 'https://www.getdasha.com/ai.txt';

const LLMS_FULL_FOLDS = [
  '/llms-full', '/llms-full/', '/Llms-full', '/LLMS-FULL', '/Llms-Full/',
  '/llms_full', '/llms_full/', '/Llms_full', '/LLMS_FULL', '/Llms_Full/',
  '/.well-known/llms-full.txt', '/.well-known/Llms-Full.txt', '/.well-known/LLMS-FULL.TXT',
];
const LLMS_PEERS = [
  '/llms', '/llms/', '/Llms', '/LLMS', '/Llms/',
  '/.well-known/llms.txt', '/.well-known/Llms.txt', '/.well-known/LLMS.TXT',
];
const AI_WELLKNOWN = [
  '/.well-known/ai.txt', '/.well-known/Ai.txt', '/.well-known/AI.TXT',
];
const STAY_200 = [
  '/llms-full.txt',
  '/llms.txt',
  '/ai.txt',
];
const STAY_OUT = [
  '/llm',
  '/humans.txt',
  '/ads.txt',
  '/terms',
  '/tos',
  '/social',
  '/.well-known/llms-full.txt/',
  '/.well-known/ai.txt/',
  '/.well-known/llms.txt/',
];

for (const path of LLMS_FULL_FOLDS) {
  assert.equal(potterHome308Dest(path), FULL, path);
}
for (const path of LLMS_PEERS) {
  assert.equal(potterHome308Dest(path), LLMS, path);
}
for (const path of AI_WELLKNOWN) {
  assert.equal(potterHome308Dest(path), AI, path);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay out ${path}`);
}

const env = { LOBBY_SESSION_SECRET: 'llms-full-aeo-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [paths, dest] of [
    [LLMS_FULL_FOLDS, FULL],
    [LLMS_PEERS, LLMS],
    [AI_WELLKNOWN, AI],
  ]) {
    for (const path of paths) {
      for (const method of ['GET', 'HEAD']) {
        const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
        assert.equal(res.status, 308, `${host} ${path} ${method}`);
        assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
        assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
        if (method === 'HEAD') assert.equal(await res.text(), '');
      }
    }
  }
  for (const [path, edge] of [
    ['/llms-full.txt', 'llms-full'],
    ['/llms.txt', 'llms'],
    ['/ai.txt', 'ai'],
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const canon = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(canon.status, 200, `${host} ${path} ${method} stays 200`);
      if (host === 'www.getdasha.com') {
        assert.equal(canon.headers.get('x-dasha-edge'), edge, `${host} ${path} edge`);
      }
      if (method === 'HEAD') assert.equal(await canon.text(), '');
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/llms-full', '/llms_full', '/llms', '/.well-known/llms-full.txt', '/.well-known/ai.txt', '/.well-known/llms.txt']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/llms-full\.txt<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/llms\.txt<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/ai\.txt<\/loc>/);

console.log('dasha-llms-full-aeo-pretty-path: PASS (/llms-full+/llms_full+/.well-known/llms-full.txt 308 /llms-full.txt; /llms+/.well-known/llms.txt 308 /llms.txt; /.well-known/ai.txt 308 /ai.txt; Title-case+slash; exact txt 200; stay-outs; no plugin.jup.ag)');
