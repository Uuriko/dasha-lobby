#!/usr/bin/env node
/**
 * Motley leftover pretty-paths from live hunt 2026-09-17:
 * 1. Bare /proof (+/) Title-case 308 → same-host /compute/proof
 *    (face already 200). /proof.json already 308 → /compute/proof.json.
 *    Do not rewrite the #216 proof page body.
 * 2. /compute/digest (+/) Title-case 308 → Motley /digest (face already
 *    200). /compute/api/digest already 308 → /digest.json — keep it.
 *    Do not retarget apex /api/digest (Motley HTML → /digest stays).
 * Apex /.well-known/* 404 is Webflow (x-wf-region, no x-dasha-edge) —
 * skip; CF zone owns apex, not a Worker 308.
 * Stay-outs: /api/proof /api/v1 /api/models /api/providers Muse #225
 * faces. Disk only. No Designer. Never plugin.jup.ag. No Ask UX. No Quill.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const proofPageSrc = readFileSync(join(root, 'dasha-compute-proof-page.mjs'), 'utf8');

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_PROOF_308_PATHS/, 'bare /proof leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_DIGEST_308_PATHS/, 'nested /compute/digest leftover set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(proofPageSrc, /1\. Right now/, '#216 proof page body stays');

const proofSet = workerSrc.match(/const POTTER_PROOF_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const digestSet = workerSrc.match(/const POTTER_COMPUTE_DIGEST_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}
for (const path of ['/proof', '/proof/']) {
  assert.ok(listed(proofSet, path), `proof set lists ${path}`);
}
for (const path of ['/compute/digest', '/compute/digest/']) {
  assert.ok(listed(digestSet, path), `digest set lists ${path}`);
}
assert.doesNotMatch(proofSet, /['"]\/api\/proof['"]/, 'do not invent /api/proof');
assert.doesNotMatch(proofSet, /['"]\/compute\/api\/proof['"]/, '/compute/api/proof stays its Set');
assert.doesNotMatch(proofSet, /['"]\/proof\.json['"]/, '/proof.json stays existing leftover');
assert.doesNotMatch(proofSet, /dasha-muse-product/, 'proof leftover set does not import Muse HTML');
assert.doesNotMatch(digestSet, /['"]\/api\/digest['"]/, 'do not retarget /api/digest');
assert.doesNotMatch(digestSet, /['"]\/compute\/api\/digest['"]/, '/compute/api/digest stays Motley map');
assert.doesNotMatch(digestSet, /['"]\/digest['"]/, 'exact /digest stays 200 handler');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
assert.doesNotMatch(discoveryMap, /['"]\/proof['"]/, '/proof leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/digest['"]/, '/compute/digest leftover lives in its Set, not Motley map');
assert.match(discoveryMap, /['"]\/compute\/api\/digest['"]/, 'keep /compute/api/digest → /digest.json');
assert.match(discoveryMap, /['"]\/api\/proof\.json['"]/, 'keep /api/proof.json leftover');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const PROOF = `${WWW}/compute/proof`;
const LOBBY_PROOF = `${LOBBY}/compute/proof`;
const DIGEST = `${WWW}/digest`;
const LOBBY_DIGEST = `${LOBBY}/digest`;
const DIGEST_JSON = `${WWW}/digest.json`;

const PROOF_FOLDS = [
  '/proof',
  '/proof/',
  '/Proof',
  '/PROOF',
  '/Proof/',
];
const DIGEST_FOLDS = [
  '/compute/digest',
  '/compute/digest/',
  '/Compute/digest',
  '/COMPUTE/DIGEST',
  '/Compute/Digest/',
];

const STAY_200 = [
  '/compute/proof',
  '/compute/proof/',
  '/digest',
  '/digest.json',
];
const STAY_OUT = [
  '/api/proof',
  '/api/proof/',
  '/api/v1',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
];

for (const path of PROOF_FOLDS) {
  assert.equal(potterHome308Dest(path), PROOF, `${path} → /compute/proof`);
}
for (const path of DIGEST_FOLDS) {
  assert.equal(potterHome308Dest(path), DIGEST, `${path} → /digest`);
  assert.notEqual(potterHome308Dest(path), DIGEST_JSON, `${path} is not /digest.json`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/compute/api/digest'), DIGEST_JSON, '/compute/api/digest still /digest.json');
assert.equal(potterHome308Dest('/compute/api/digest/'), DIGEST_JSON, '/compute/api/digest/ still /digest.json');
assert.equal(potterHome308Dest('/api/digest'), null, 'do not retarget /api/digest (live Motley HTML stays off this map)');
assert.equal(potterHome308Dest('/compute/api/proof'), `${WWW}/compute/proof.md`, '/compute/api/proof still proof.md');
assert.equal(potterHome308Dest('/api/proof.json'), `${WWW}/compute/proof.json`, '/api/proof.json still proof.json');
assert.equal(potterHome308Dest('/start'), null, 'Muse #225 /start stays face');
assert.equal(potterHome308Dest('/providers'), null, 'Muse #225 /providers stays face');
assert.equal(potterHome308Dest('/developers'), null, 'Muse #225 /developers stays face');
assert.equal(potterHome308Dest('/network'), null, 'Muse #225 /network stays face');

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  if (dest === PROOF) return LOBBY_PROOF;
  if (dest === DIGEST) return LOBBY_DIGEST;
  return dest;
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-proof-digest-leftover-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName: () => 'public',
    get: () => ({
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === '/digest/pack' || path === '/digest.json') {
          return new Response(JSON.stringify({ items: [] }), {
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response('nope', { status: 404 });
      },
    }),
  },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [
    ...PROOF_FOLDS.map((p) => [p, PROOF]),
    ...DIGEST_FOLDS.map((p) => [p, DIGEST]),
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, dest), `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/compute/proof', '/digest']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method} stays 200`);
      if (path === '/compute/proof' && method === 'GET') {
        const html = await res.text();
        assert.match(html, /1\. Right now/, `${host} /compute/proof body untouched`);
        assert.match(html, /\/compute\/proof\.json/, `${host} /compute/proof keeps json twin`);
      }
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/api/v1', '/api/models', '/api/providers']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
  {
    const res = await edgeWorker.fetch(new Request(`https://${host}/api/proof`), env);
    assert.notEqual(res.status, 308, `${host} /api/proof is not leftover 308`);
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/proof</loc>`), 'sitemap omits leftover /proof');
assert.ok(!sitemapXml.includes(`${WWW}/compute/digest</loc>`), 'sitemap omits leftover /compute/digest');
assert.ok(sitemapXml.includes(`${WWW}/compute/proof</loc>`), 'sitemap keeps /compute/proof face');
assert.ok(sitemapXml.includes(`${WWW}/digest</loc>`), 'sitemap keeps /digest face');

console.log('dasha-motley-proof-digest-leftover-pretty-path: PASS (/proof 308 /compute/proof same-host; /compute/digest 308 /digest; Title-case+slash; www+lobby GET+HEAD; dests 200; keep /compute/api/digest + /api/digest; stay-out /api/proof|/api/v1|/api/models|/api/providers; no Muse restack; no plugin.jup.ag)');
