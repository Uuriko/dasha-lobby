#!/usr/bin/env node
/**
 * Leftover pretty path: live GET/HEAD /compute/api/docs (+slash / Title-case)
 * was JSON fail-loud 404 on www + lobby while /compute/skill.md is already
 * the agent docs face (200 markdown). Fold to that face.
 * Singular leftover /compute/api/doc still 404 after plural docs went live.
 * Apex /sdk-docs /api-reference /sdk /cli stay 308 → /compute/api.
 * /compute/sdk /compute/sdk-docs /compute/cli /compute/api-reference fold via POTTER_COMPUTE_DOCS_SKILL_308_PATHS.
 * Lobby same-host via potterHome308Response. Disk only. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_API_DOCS_SKILL_308_PATHS/, 'api/docs leftover set');
assert.match(workerSrc, /Live GET\/HEAD \/compute\/api\/docs/, 'live 404 comment');
assert.match(workerSrc, /that's \/sdk-docs \/api-reference leftover dest/, 'gateway leftovers stay /compute/api');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const SKILL = `${WWW}/compute/skill.md`;
const LOBBY_SKILL = `${LOBBY}/compute/skill.md`;
const API = `${WWW}/compute/api`;

const FOLDS = [
  '/compute/api/docs',
  '/compute/api/docs/',
  '/Compute/api/docs',
  '/COMPUTE/API/DOCS',
  '/Compute/Api/Docs',
  '/Compute/Api/Docs/',
  '/COMPUTE/API/DOCS/',
  '/compute/api/doc',
  '/compute/api/doc/',
  '/Compute/api/doc',
  '/COMPUTE/API/DOC',
  '/Compute/Api/Doc',
  '/Compute/Api/Doc/',
  '/COMPUTE/API/DOC/',
];

const GATEWAY_UNCHANGED = [
  ['/sdk-docs', API],
  ['/sdk-docs/', API],
  ['/api-reference', API],
  ['/sdk', API],
  ['/cli', API],
  ['/api/docs', API],
  ['/docs', API],
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), SKILL, path);
}
for (const [path, dest] of GATEWAY_UNCHANGED) {
  assert.equal(potterHome308Dest(path), dest, `unchanged ${path}`);
}
assert.equal(potterHome308Dest('/compute/skill.md'), null, '/compute/skill.md stays 200');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays JSON');
assert.equal(potterHome308Dest('/docs/other'), null, 'do not invent /docs/*');
assert.notEqual(potterHome308Dest('/compute/api/documentation'), SKILL, 'do not invent /compute/api/documentation');

const env = { LOBBY_SESSION_SECRET: 'compute-api-docs-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'getdasha.com', 'lobby.getdasha.com']) {
  const skillLoc = host === 'lobby.getdasha.com' ? LOBBY_SKILL : SKILL;
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), skillLoc, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const face = await edgeWorker.fetch(new Request(`https://${host}/compute/skill.md`), env);
  assert.equal(face.status, 200, `${host} /compute/skill.md stays 200`);
  assert.match(face.headers.get('content-type') || '', /text\/markdown/);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/compute/api/docs</loc>`), 'sitemap omits leftover /compute/api/docs');
assert.ok(!sitemapXml.includes(`${WWW}/compute/api/doc</loc>`), 'sitemap omits leftover /compute/api/doc');

console.log('dasha-compute-api-docs-pretty-path: PASS (/compute/api/docs+/doc 308 skill.md www+lobby GET+HEAD; apex /sdk-docs stay /compute/api; no plugin.jup.ag)');
