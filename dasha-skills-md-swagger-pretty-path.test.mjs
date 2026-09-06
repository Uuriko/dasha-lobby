#!/usr/bin/env node
/**
 * Leftover pretty path (Worker a4fbd23c): live /skills.md /compute/skills.md
 * (+slash / Title-case) html-404 → 308 /compute. Do NOT fold /compute/skill/*.md
 * (200 markdown). Live /swagger-ui /swagger-ui.html /api-docs (+slash / Title-case)
 * html-404 → 308 /compute/api. Exact /compute and /compute/api stay 200.
 * Lobby /compute/api dests stay same-host via potterHome308Response.
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
assert.match(workerSrc, /Redo: \/skills\.md\|\/compute\/skills\.md/, 'skills.md leftover comment');
assert.match(workerSrc, /POTTER_COMPUTE_API_DOCS_308_PATHS/, 'swagger/api-docs 308 set present');
assert.match(workerSrc, /\/swagger-ui \/swagger-ui\.html \/api-docs/, 'swagger leftover comment');

const COMPUTE = 'https://www.getdasha.com/compute';
const API = 'https://www.getdasha.com/compute/api';
const LOBBY_API = 'https://lobby.getdasha.com/compute/api';

const SKILLS_MD = [
  '/skills.md', '/skills.md/', '/Skills.md', '/SKILLS.MD', '/Skills.MD/',
  '/compute/skills.md', '/compute/skills.md/', '/Compute/skills.md', '/COMPUTE/SKILLS.MD', '/Compute/Skills.md/',
];
const SWAGGER = [
  '/swagger-ui', '/swagger-ui/', '/Swagger-ui', '/SWAGGER-UI', '/Swagger-UI/',
  '/swagger-ui.html', '/swagger-ui.html/', '/Swagger-ui.html', '/SWAGGER-UI.HTML', '/Swagger-Ui.html/',
  '/api-docs', '/api-docs/', '/Api-docs', '/API-DOCS', '/Api-Docs/',
];
const SKILL_MD_STAY = [
  '/compute/skill/provide.md',
  '/compute/skill/use.md',
  '/compute/skill/ocm-host.md',
];

for (const path of SKILLS_MD) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
for (const path of SWAGGER) {
  assert.equal(potterHome308Dest(path), API, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays 200');
assert.equal(potterHome308Dest('/compute/api/'), null, '/compute/api/ stays 200');
for (const path of SKILL_MD_STAY) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 markdown`);
}
assert.equal(potterHome308Dest('/compute/use'), COMPUTE, '/compute/use still compute tab');
assert.equal(potterHome308Dest('/compute/ask'), COMPUTE, '/compute/ask still compute tab');

const env = { LOBBY_SESSION_SECRET: 'skills-md-swagger-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of SKILLS_MD) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of SWAGGER) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const want = host === 'lobby.getdasha.com' ? LOBBY_API : API;
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  for (const method of ['GET', 'HEAD']) {
    const api = await edgeWorker.fetch(new Request(`https://${host}/compute/api`, { method }), env);
    assert.equal(api.status, 200, `${host} /compute/api ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await api.text(), '');
  }
  for (const path of SKILL_MD_STAY) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(res.status, 200, `${host} ${path} stays 200`);
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/skills.md', '/compute/skills.md', '/swagger-ui', '/swagger-ui.html', '/api-docs']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-skills-md-swagger-pretty-path: PASS (/skills.md+/compute/skills.md 308 /compute; /swagger-ui+/swagger-ui.html+/api-docs 308 /compute/api www+lobby GET+HEAD; /compute+/compute/api+/compute/skill/*.md 200; no plugin.jup.ag)');
