#!/usr/bin/env node
/**
 * Durable Motley leftover product doors + invent synonym.
 * Live Motley restore already 308s apex
 * /api/{contribute,bounties,listings,chess,verify.json,proof.json} + nested
 * /compute/api/{listings,verify.json,proof.json} (+slash / Title-case) → faces.
 * Fold those here so tip deploys do not wipe Motley.
 * Invent soft-doctor: live /doctor.txt /self-test /plugin /plug-in already
 * 308 → /compute#provide. Leftover /invent (+slash / Title-case) joins that
 * Provide-308 set. Do not invent /compute/invent or nested
 * /compute/api/{bounties,chess}. Nested /compute/api/contribute folds
 * via dedicated Set → /contribute. Hold stay-outs /api/v1
 * /api/models /api/providers /api/v1/status. Disk only. No Designer.
 * Never plugin.jup.ag. No Muse HTML. No Room. No capacity invent.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /Live Motley restore also 308s apex \/api\/\{contribute,bounties,listings,/, 'motley product leftover comment');
assert.match(workerSrc, /leftover \/invent/, 'invent leftover comment');
assert.match(workerSrc, /POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST/, 'motley leftover map');
assert.match(workerSrc, /POTTER_COMPUTE_DOCTOR_PROVIDE_308_PATHS/, 'invent leftover set');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map beats casefold catch-all');
assert.match(workerSrc, /'\/compute\/invent'/, '#238 already folds /compute/invent with invent family');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/api/contribute', '/api/contribute/',
  '/api/bounties', '/api/bounties/',
  '/api/listings', '/api/listings/',
  '/api/chess', '/api/chess/',
  '/api/verify.json', '/api/verify.json/',
  '/api/proof.json', '/api/proof.json/',
  '/compute/api/listings', '/compute/api/listings/',
  '/compute/api/verify.json', '/compute/api/verify.json/',
  '/compute/api/proof.json', '/compute/api/proof.json/',
]) {
  assert.match(discoveryMap, new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), `map lists ${path}`);
}
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/contribute['"]/, 'nested /compute/api/contribute lives in its Set');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/bounties['"]/, 'do not invent nested /compute/api/bounties');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/chess['"]/, 'do not invent nested /compute/api/chess');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'do not invent /api/models leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'do not invent /api/providers leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'do not invent /api/v1 leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1\/status['"]/, 'do not invent /api/v1/status leftover');

const provideSet = workerSrc.match(/const POTTER_COMPUTE_DOCTOR_PROVIDE_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/invent', '/invent/',
  '/doctor.txt', '/doctor.txt/',
  '/self-test', '/self-test/',
  '/plugin', '/plugin/',
  '/plug-in', '/plug-in/',
]) {
  assert.match(provideSet, new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), `provide set lists ${path}`);
}
assert.match(provideSet, /['"]\/compute\/invent['"]/, '#238 already lists /compute/invent in provide set');
assert.doesNotMatch(provideSet, /['"]\/waitlist['"]/, 'apex /waitlist stays out of provide set');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const CONTRIBUTE = `${WWW}/contribute`;
const BOUNTIES = `${WWW}/bounties`;
const LISTINGS = `${WWW}/listings`;
const CHESS = `${WWW}/chess`;
const VERIFY_JSON = `${WWW}/verify.json`;
const PROOF_JSON = `${WWW}/compute/proof.json`;
const PROVIDE = `${WWW}/compute#provide`;

const MOTLEY_FOLDS = [
  ['/api/contribute', CONTRIBUTE],
  ['/api/contribute/', CONTRIBUTE],
  ['/Api/Contribute', CONTRIBUTE],
  ['/API/CONTRIBUTE', CONTRIBUTE],
  ['/Api/Contribute/', CONTRIBUTE],
  ['/api/bounties', BOUNTIES],
  ['/api/bounties/', BOUNTIES],
  ['/Api/Bounties', BOUNTIES],
  ['/API/BOUNTIES', BOUNTIES],
  ['/Api/Bounties/', BOUNTIES],
  ['/api/listings', LISTINGS],
  ['/api/listings/', LISTINGS],
  ['/Api/Listings', LISTINGS],
  ['/API/LISTINGS', LISTINGS],
  ['/Api/Listings/', LISTINGS],
  ['/api/chess', CHESS],
  ['/api/chess/', CHESS],
  ['/Api/Chess', CHESS],
  ['/API/CHESS', CHESS],
  ['/Api/Chess/', CHESS],
  ['/api/verify.json', VERIFY_JSON],
  ['/api/verify.json/', VERIFY_JSON],
  ['/Api/Verify.json', VERIFY_JSON],
  ['/API/VERIFY.JSON', VERIFY_JSON],
  ['/Api/Verify.json/', VERIFY_JSON],
  ['/api/proof.json', PROOF_JSON],
  ['/api/proof.json/', PROOF_JSON],
  ['/Api/Proof.json', PROOF_JSON],
  ['/API/PROOF.JSON', PROOF_JSON],
  ['/Api/Proof.json/', PROOF_JSON],
  ['/compute/api/listings', LISTINGS],
  ['/compute/api/listings/', LISTINGS],
  ['/Compute/api/listings', LISTINGS],
  ['/COMPUTE/API/LISTINGS', LISTINGS],
  ['/Compute/Api/Listings/', LISTINGS],
  ['/compute/api/verify.json', VERIFY_JSON],
  ['/compute/api/verify.json/', VERIFY_JSON],
  ['/Compute/api/Verify.json', VERIFY_JSON],
  ['/COMPUTE/API/VERIFY.JSON', VERIFY_JSON],
  ['/Compute/Api/Verify.json/', VERIFY_JSON],
  ['/compute/api/proof.json', PROOF_JSON],
  ['/compute/api/proof.json/', PROOF_JSON],
  ['/Compute/api/Proof.json', PROOF_JSON],
  ['/COMPUTE/API/PROOF.JSON', PROOF_JSON],
  ['/Compute/Api/Proof.json/', PROOF_JSON],
];

const INVENT_FOLDS = [
  ['/invent', PROVIDE],
  ['/invent/', PROVIDE],
  ['/Invent', PROVIDE],
  ['/INVENT', PROVIDE],
  ['/Invent/', PROVIDE],
  ['/doctor.txt', PROVIDE],
  ['/doctor.txt/', PROVIDE],
  ['/Doctor.txt', PROVIDE],
  ['/DOCTOR.TXT', PROVIDE],
  ['/Doctor.txt/', PROVIDE],
  ['/self-test', PROVIDE],
  ['/self-test/', PROVIDE],
  ['/Self-Test', PROVIDE],
  ['/SELF-TEST', PROVIDE],
  ['/Self-Test/', PROVIDE],
  ['/plugin', PROVIDE],
  ['/plugin/', PROVIDE],
  ['/Plugin', PROVIDE],
  ['/PLUGIN', PROVIDE],
  ['/Plugin/', PROVIDE],
  ['/plug-in', PROVIDE],
  ['/plug-in/', PROVIDE],
  ['/Plug-In', PROVIDE],
  ['/PLUG-IN', PROVIDE],
  ['/Plug-In/', PROVIDE],
];

const STAY_200 = [
  ['/contribute', null],
  ['/bounties', null],
  ['/listings', null],
  ['/compute/proof.json', null],
];

const STAY_OUT = [
  '/api/v1',
  '/api/v1/',
  '/api/v1/status',
  '/api/models',
  '/api/providers',
  '/compute/api/bounties',
  '/compute/api/chess',
  '/waitlist',
];

for (const [path, dest] of MOTLEY_FOLDS) {
  assert.equal(potterHome308Dest(path), dest, path);
}
for (const [path, dest] of INVENT_FOLDS) {
  assert.equal(potterHome308Dest(path), dest, path);
}
for (const [path, dest] of STAY_200) {
  assert.equal(potterHome308Dest(path), dest, `${path} stays 200`);
}
assert.equal(potterHome308Dest('/chess'), 'https://www.getdasha.com/', 'bare /chess product door 308s home');
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
}
assert.equal(potterHome308Dest('/compute/doctor.txt'), PROVIDE, '/compute/doctor.txt still #provide');
assert.equal(potterHome308Dest('/api/lobby'), `${WWW}/lobby`, '/api/lobby still Motley discovery leftover');
assert.equal(potterHome308Dest('/compute/api/contribute'), CONTRIBUTE, '/compute/api/contribute folds to /contribute');
assert.equal(potterHome308Dest('/compute/api/contribute/'), CONTRIBUTE, '/compute/api/contribute/ folds to /contribute');
assert.equal(potterHome308Dest('/compute/invent'), PROVIDE, '#238 /compute/invent still #provide');
assert.equal(potterHome308Dest('/compute/invent/'), PROVIDE, '#238 /compute/invent/ still #provide');

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  const u = new URL(dest);
  if (u.pathname === '/compute/proof.json') {
    return LOBBY + u.pathname + u.search + u.hash;
  }
  return dest;
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-invent-leftover-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName: () => 'public',
    get: () => ({
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === '/compute/api/network') {
          return new Response(JSON.stringify({
            providers_online: 1,
            models_available: ['qwen3-4b'],
            capacity: [{ model: 'qwen3-4b', providers: 1, tokens_per_second: 40 }],
            jobs_queued: 0,
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/readyz') {
          return new Response(JSON.stringify({
            ok: true,
            service: 'dasha-compute',
            can_serve: true,
            reason: 'community_or_hosted',
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/verify') {
          return new Response(JSON.stringify({
            chain: { length: 2, tip: 'abc' },
            verdict: { tier: 'ANCHORED', why: 'test' },
            checked_at: '2026-09-13T00:00:00.000Z',
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/factory') {
          return new Response(JSON.stringify({ settled_24h: 0, jobs: 0 }), {
            headers: { 'content-type': 'application/json' },
          });
        }
        if (path === '/compute/api/pricing') {
          return new Response(JSON.stringify({
            unit: 'successful_chat_completion',
            request_usd: '0.05',
            currency: 'USD',
            card_available: false,
            card_note: 'no card yet',
          }), { headers: { 'content-type': 'application/json' } });
        }
        return new Response('nope', { status: 404 });
      },
    }),
  },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [...MOTLEY_FOLDS, ...INVENT_FOLDS]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, dest), `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const contribute = await edgeWorker.fetch(new Request(`https://${host}/contribute`, { method }), env);
    assert.equal(contribute.status, 200, `${host} /contribute ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await contribute.text(), '');
    const bounties = await edgeWorker.fetch(new Request(`https://${host}/bounties`, { method }), env);
    assert.equal(bounties.status, 200, `${host} /bounties ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await bounties.text(), '');
    const listings = await edgeWorker.fetch(new Request(`https://${host}/listings`, { method }), env);
    assert.equal(listings.status, 200, `${host} /listings ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await listings.text(), '');
    const chess = await edgeWorker.fetch(new Request(`https://${host}/chess`, { method }), env);
    assert.equal(chess.status, 308, `${host} /chess ${method} product door`);
    assert.equal(chess.headers.get('location'), 'https://www.getdasha.com/');
    if (method === 'HEAD') assert.equal(await chess.text(), '');
    const proof = await edgeWorker.fetch(new Request(`https://${host}/compute/proof.json`, { method }), env);
    assert.equal(proof.status, 200, `${host} /compute/proof.json ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await proof.text(), '');
  }
  const nestedContribute = await edgeWorker.fetch(new Request(`https://${host}/compute/api/contribute`), env);
  assert.equal(nestedContribute.status, 308, `${host} /compute/api/contribute leftover 308`);
  assert.equal(nestedContribute.headers.get('location'), CONTRIBUTE, `${host} /compute/api/contribute loc`);
  const inventNested = await edgeWorker.fetch(new Request(`https://${host}/compute/invent`), env);
  assert.equal(inventNested.status, 308, `${host} /compute/invent leftover 308`);
  assert.equal(inventNested.headers.get('location'), PROVIDE, `${host} /compute/invent loc`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/api/contribute',
  '/api/bounties',
  '/api/listings',
  '/api/chess',
  '/api/verify.json',
  '/api/proof.json',
  '/compute/api/listings',
  '/compute/api/verify.json',
  '/compute/api/proof.json',
  '/invent',
  '/doctor.txt',
  '/self-test',
  '/plugin',
  '/plug-in',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-motley-invent-leftover-pretty-path: PASS (Motley /api/{contribute,bounties,listings,chess,verify.json,proof.json} + nested /compute/api/{listings,verify.json,proof.json,contribute} 308 faces; /invent + /compute/invent + apex /doctor.txt /self-test /plugin /plug-in 308 #provide; Title-case+slash; www+lobby GET+HEAD; dests 200 except live /verify.json face; stay-out /api/v1|/api/models|/api/providers|/api/v1/status + nested bounties/chess; no plugin.jup.ag)');
