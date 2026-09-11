#!/usr/bin/env node
/**
 * Leftover pretty path: live GET/HEAD /compute/docs + /compute/openapi.json
 * (+slash / Title-case) were 308 → /compute/api (JSON gateway) on www + lobby.
 * Agents/humans asking for docs landed on raw JSON. No OpenAPI file exists —
 * do not invent one. Fold this path-family to /compute/skill.md.
 * Leftover /compute/documentation + /compute/openapi (no .json) still dumped
 * to the JSON gateway after #192 — same family, same skill dest.
 * Live GET/HEAD /compute/doctor was 308 → /compute (Ask first-paint). Soft-doctor
 * / Provide enroll lands on /compute#provide. After #192, leftover /provide
 * /enroll /setup /doctor (apex) + /compute/provide|/enroll|/setup still dumped
 * to Ask. Fold this join family to /compute#provide.
 * /sdk-docs /cli /api-reference /compute/sdk stay gateway leftovers.
 * Lobby skill dests same-host via potterHome308Response. Disk only.
 * Never plugin.jup.ag. No ocm rewrite. No Designer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_DOCS_SKILL_308_PATHS/, 'docs/openapi leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_DOCTOR_PROVIDE_308_PATHS/, 'doctor leftover set');
assert.match(workerSrc, /Live GET \/compute\/docs \+ \/compute\/openapi\.json/, 'live docs comment');
assert.match(workerSrc, /Live GET \/compute\/doctor was 308/, 'live doctor comment');
assert.match(workerSrc, /\/compute\/documentation \+ \/compute\/openapi \(no \.json\)/, 'documentation leftover comment');
assert.match(workerSrc, /Leftover \/provide \/enroll \/setup/, 'provide join leftover comment');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const SKILL = `${WWW}/compute/skill.md`;
const LOBBY_SKILL = `${LOBBY}/compute/skill.md`;
const PROVIDE = `${WWW}/compute#provide`;
const API = `${WWW}/compute/api`;
const COMPUTE = `${WWW}/compute`;

const DOCS_SKILL = [
  '/compute/docs',
  '/compute/docs/',
  '/Compute/docs',
  '/COMPUTE/DOCS',
  '/Compute/Docs',
  '/Compute/Docs/',
  '/COMPUTE/DOCS/',
  '/compute/openapi.json',
  '/compute/openapi.json/',
  '/Compute/openapi.json',
  '/COMPUTE/OPENAPI.JSON',
  '/Compute/Openapi.json',
  '/Compute/Openapi.Json/',
  '/COMPUTE/OPENAPI.JSON/',
  '/compute/documentation',
  '/compute/documentation/',
  '/Compute/documentation',
  '/COMPUTE/DOCUMENTATION',
  '/Compute/Documentation',
  '/Compute/Documentation/',
  '/COMPUTE/DOCUMENTATION/',
  '/compute/openapi',
  '/compute/openapi/',
  '/Compute/openapi',
  '/COMPUTE/OPENAPI',
  '/Compute/Openapi',
  '/Compute/Openapi/',
  '/COMPUTE/OPENAPI/',
];

const PROVIDE_JOIN = [
  '/compute/doctor',
  '/compute/doctor/',
  '/Compute/doctor',
  '/COMPUTE/DOCTOR',
  '/Compute/Doctor',
  '/Compute/Doctor/',
  '/COMPUTE/DOCTOR/',
  '/doctor',
  '/doctor/',
  '/Doctor',
  '/DOCTOR',
  '/provide',
  '/provide/',
  '/Provide',
  '/PROVIDE',
  '/pRoViDe/',
  '/compute/provide',
  '/compute/provide/',
  '/Compute/provide',
  '/COMPUTE/PROVIDE',
  '/Compute/Provide/',
  '/enroll',
  '/enroll/',
  '/Enroll',
  '/ENROLL',
  '/compute/enroll',
  '/compute/enroll/',
  '/Compute/enroll',
  '/COMPUTE/ENROLL',
  '/Compute/Enroll/',
  '/setup',
  '/setup/',
  '/Setup',
  '/SETUP',
  '/compute/setup',
  '/compute/setup/',
  '/Compute/setup',
  '/COMPUTE/SETUP',
  '/Compute/Setup/',
];

const GATEWAY_UNCHANGED = [
  ['/openapi.json', API],
  ['/openapi.json/', API],
  ['/openapi', API],
  ['/documentation', API],
  ['/sdk-docs', API],
  ['/api-reference', API],
  ['/compute/sdk-docs', API],
  ['/compute/sdk', API],
  ['/compute/cli', API],
  ['/compute/swagger', API],
  ['/api/docs', API],
  ['/docs', API],
];

const TAB_UNCHANGED = [
  ['/compute/install', COMPUTE],
  ['/compute/use', COMPUTE],
  ['/compute/night', COMPUTE],
  ['/start', COMPUTE],
  ['/onboard', COMPUTE],
  ['/quickstart', COMPUTE],
];

for (const path of DOCS_SKILL) {
  assert.equal(potterHome308Dest(path), SKILL, path);
}
for (const path of PROVIDE_JOIN) {
  assert.equal(potterHome308Dest(path), PROVIDE, path);
}
for (const [path, dest] of GATEWAY_UNCHANGED) {
  assert.equal(potterHome308Dest(path), dest, `unchanged ${path}`);
}
for (const [path, dest] of TAB_UNCHANGED) {
  assert.equal(potterHome308Dest(path), dest, `unchanged ${path}`);
}
assert.equal(potterHome308Dest('/compute/skill.md'), null, '/compute/skill.md stays 200');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays JSON');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.notEqual(potterHome308Dest('/compute/openapi.yaml'), SKILL, 'do not invent /compute/openapi.yaml');
assert.notEqual(potterHome308Dest('/compute/swagger.json'), SKILL, 'do not invent swagger→skill');
assert.notEqual(potterHome308Dest('/compute/readme'), SKILL, 'do not invent /compute/readme');
assert.match(potterHome308Dest('/doctor') || '', /#provide$/, 'apex /doctor hashes #provide');

const env = {
  LOBBY_SESSION_SECRET: 'compute-docs-openapi-doctor-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'getdasha.com', 'lobby.getdasha.com']) {
  const skillLoc = host === 'lobby.getdasha.com' ? LOBBY_SKILL : SKILL;
  for (const path of DOCS_SKILL) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), skillLoc, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of PROVIDE_JOIN) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), PROVIDE, `${host} ${path} ${method} loc`);
      assert.match(res.headers.get('location') || '', /#provide$/, `${host} ${path} ${method} hash`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const sdk = await edgeWorker.fetch(new Request(`https://${host}/sdk-docs`, { method }), env);
    assert.equal(sdk.status, 308, `${host} /sdk-docs ${method} still gateway`);
    const wantApi = host === 'lobby.getdasha.com' ? `${LOBBY}/compute/api` : API;
    assert.equal(sdk.headers.get('location'), wantApi, `${host} /sdk-docs ${method} loc`);
    if (method === 'HEAD') assert.equal(await sdk.text(), '');

    const install = await edgeWorker.fetch(new Request(`https://${host}/compute/install`, { method }), env);
    assert.equal(install.status, 308, `${host} /compute/install ${method} still tab`);
    assert.equal(install.headers.get('location'), COMPUTE, `${host} /compute/install ${method} loc`);
    assert.doesNotMatch(install.headers.get('location') || '', /#/, `${host} /compute/install ${method} no hash`);
    if (method === 'HEAD') assert.equal(await install.text(), '');
  }
  const face = await edgeWorker.fetch(new Request(`https://${host}/compute/skill.md`), env);
  assert.equal(face.status, 200, `${host} /compute/skill.md stays 200`);
  assert.match(face.headers.get('content-type') || '', /text\/markdown/);
  assert.match(await face.text(), /Join a Mac at \/compute#provide/, `${host} skill names Provide door`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/compute/docs</loc>`), 'sitemap omits leftover /compute/docs');
assert.ok(!sitemapXml.includes(`${WWW}/compute/openapi.json</loc>`), 'sitemap omits leftover /compute/openapi.json');
assert.ok(!sitemapXml.includes(`${WWW}/compute/documentation</loc>`), 'sitemap omits leftover /compute/documentation');
assert.ok(!sitemapXml.includes(`${WWW}/compute/openapi</loc>`), 'sitemap omits leftover /compute/openapi');
assert.ok(!sitemapXml.includes(`${WWW}/compute/doctor</loc>`), 'sitemap omits leftover /compute/doctor');
assert.ok(!sitemapXml.includes(`${WWW}/provide</loc>`), 'sitemap omits leftover /provide');
assert.ok(!sitemapXml.includes(`${WWW}/enroll</loc>`), 'sitemap omits leftover /enroll');
assert.ok(!sitemapXml.includes(`${WWW}/setup</loc>`), 'sitemap omits leftover /setup');
assert.ok(!sitemapXml.includes(`${WWW}/doctor</loc>`), 'sitemap omits leftover /doctor');

console.log('dasha-compute-docs-openapi-doctor-pretty-path: PASS (/compute/docs+/documentation+/openapi(+.json) 308 skill.md www+lobby GET+HEAD; /provide+/enroll+/setup+/doctor + /compute/* 308 /compute#provide; /sdk-docs stay /compute/api; no plugin.jup.ag)');
