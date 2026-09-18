#!/usr/bin/env node
/**
 * Soft-doctor invent leftover (#235 surface): live GET/HEAD
 * /invent /compute/invent (+slash / Title-case via toLowerCase)
 * 308 → /compute#provide. Same POTTER_COMPUTE_DOCTOR_PROVIDE_308_PATHS
 * family as /compute/doctor.txt /self-test /plugin.
 * Do not invent doctor.md / PROVIDE.md. Apex /waitlist stays out.
 * Stay-outs /api/v1 /api/models /api/providers /api/v1/status remain
 * null/404. Disk only. No Designer. Never plugin.jup.ag. No Muse HTML.
 * No Room. No people-data. No wrangler.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_DOCTOR_PROVIDE_308_PATHS/, 'invent leftover set');
assert.match(workerSrc, /Live leftover \/invent \/compute\/invent/, 'invent leftover comment');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.doesNotMatch(workerSrc, /['"]\/compute\/doctor\.md['"]/, 'do not invent doctor.md');
assert.doesNotMatch(workerSrc, /['"]\/compute\/PROVIDE\.md['"]/, 'do not invent PROVIDE.md');
assert.doesNotMatch(workerSrc, /['"]\/PROVIDE\.md['"]/, 'do not invent apex PROVIDE.md');

const provideSet = workerSrc.match(/const POTTER_COMPUTE_DOCTOR_PROVIDE_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of ['/invent', '/invent/', '/compute/invent', '/compute/invent/']) {
  assert.match(
    provideSet,
    new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `provide set lists ${path}`,
  );
}
assert.doesNotMatch(provideSet, /['"]\/compute\/doctor\.md['"]/, 'doctor.md stays out of provide set');
assert.doesNotMatch(provideSet, /['"]\/waitlist['"]/, 'apex /waitlist stays out of provide set');

const WWW = 'https://www.getdasha.com';
const PROVIDE = `${WWW}/compute#provide`;

const FOLDS = [
  '/invent',
  '/invent/',
  '/Invent',
  '/INVENT',
  '/Invent/',
  '/compute/invent',
  '/compute/invent/',
  '/Compute/invent',
  '/COMPUTE/INVENT',
  '/Compute/Invent/',
];

const STAY_OUT = [
  '/api/v1',
  '/api/v1/',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
  '/waitlist',
  '/compute/doctor.md',
  '/compute/PROVIDE.md',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), PROVIDE, `${path} → #provide`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/compute/doctor.txt'), PROVIDE, '/compute/doctor.txt still #provide');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');

const env = {
  LOBBY_SESSION_SECRET: 'apex-invent-soft-doctor-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), PROVIDE, `${host} ${path} ${method} loc`);
      assert.match(res.headers.get('location') || '', /#provide$/, `${host} ${path} ${method} hash`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/api/v1', '/api/models', '/api/providers', '/api/v1/status']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/invent', '/compute/invent']) {
  assert.ok(!sitemapXml.includes(`${WWW}${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-invent-soft-doctor-pretty-path: PASS (/invent + /compute/invent 308 /compute#provide; Title-case+slash via toLowerCase; www+lobby GET+HEAD; stay-out /api/v1|/api/models|/api/providers|/api/v1/status + doctor.md/PROVIDE.md; no plugin.jup.ag)');
