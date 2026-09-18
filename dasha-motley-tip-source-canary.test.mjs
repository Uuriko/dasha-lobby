#!/usr/bin/env node
/**
 * Motley tip-source canaries — /humans.txt TEAM face, /proof +
 * /compute/digest 308 synonyms, /compute/humans 308.
 *
 * Prefer worker/module on tip, not live. Live Motley leftover 308s
 * (#251 /humans.txt, #252 /proof+/compute/digest, #261 /compute/humans)
 * stay Instinct-gated until wrangler of Uuriko/dasha-lobby tip. Default
 * is source only so CI stays green. Set LIVE_MOTLEY_CANARY=1 to fail
 * honestly on that live gap.
 *
 * potterHome308Dest + worker.fetch. No wrangler. No Designer. No Quill
 * dasha-compute.html edit (#260 owns HTML). Never plugin.jup.ag.
 * No people-data. No Muse restack.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const HUMANS = `${WWW}/humans.txt`;
const LOBBY_HUMANS = `${LOBBY}/humans.txt`;
const PROOF = `${WWW}/compute/proof`;
const LOBBY_PROOF = `${LOBBY}/compute/proof`;
const DIGEST = `${WWW}/digest`;
const LOBBY_DIGEST = `${LOBBY}/digest`;
const CONTRIBUTE = `${WWW}/contribute`;

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /const HUMANS_TXT = /, 'HUMANS_TXT face constant');
assert.match(workerSrc, /Exact \/humans\.txt is a 200 text\/plain/, 'humans face comment');
assert.match(workerSrc, /POTTER_HUMANS_TXT_308_PATHS/, 'slash /humans.txt/ leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_HUMANS_308_PATHS/, '/compute/humans leftover set');
assert.match(workerSrc, /POTTER_PROOF_308_PATHS/, 'bare /proof leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_DIGEST_308_PATHS/, '/compute/digest leftover set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(
  workerSrc,
  /u\.pathname === '\/humans\.txt' && POTTER_COMPUTE_HUMANS_308_PATHS\.has\(src\)/,
  'lobby same-host rewrite lists /compute/humans dest',
);
assert.match(
  workerSrc,
  /u\.pathname === '\/compute\/proof' && POTTER_PROOF_308_PATHS\.has\(src\)/,
  'lobby same-host rewrite lists /proof dest',
);
assert.match(
  workerSrc,
  /u\.pathname === '\/digest' && POTTER_COMPUTE_DIGEST_308_PATHS\.has\(src\)/,
  'lobby same-host rewrite lists /compute/digest dest',
);

const humansConst = workerSrc.match(/const HUMANS_TXT = `[\s\S]*?`;/)[0];
assert.match(humansConst, /^const HUMANS_TXT = `\/\* TEAM \*\//, 'HUMANS_TXT opens /* TEAM */');
assert.doesNotMatch(humansConst, /<html/i, 'HUMANS_TXT is not HTML');
assert.doesNotMatch(humansConst, /Contribute to Dasha/, 'HUMANS_TXT is not contribute HTML');
assert.doesNotMatch(humansConst, /@gmail\.|@getdasha\.|mailto:/i, 'HUMANS_TXT has no people-data');
assert.doesNotMatch(humansConst, /trydemigod|demigod/i, 'HUMANS_TXT stays off Demigod');
assert.doesNotMatch(humansConst, /plugin\.jup\.ag/, 'HUMANS_TXT no plugin');

function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}

const humansSet = workerSrc.match(/const POTTER_COMPUTE_HUMANS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const proofSet = workerSrc.match(/const POTTER_PROOF_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const digestSet = workerSrc.match(/const POTTER_COMPUTE_DIGEST_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const slashHumansSet = workerSrc.match(/const POTTER_HUMANS_TXT_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

for (const path of ['/compute/humans', '/compute/humans/', '/compute/humans.txt', '/compute/humans.txt/']) {
  assert.ok(listed(humansSet, path), `compute humans set lists ${path}`);
}
for (const path of ['/proof', '/proof/']) {
  assert.ok(listed(proofSet, path), `proof set lists ${path}`);
}
for (const path of ['/compute/digest', '/compute/digest/']) {
  assert.ok(listed(digestSet, path), `digest set lists ${path}`);
}
assert.ok(listed(slashHumansSet, '/humans.txt/'), 'slash set lists /humans.txt/');
assert.doesNotMatch(humansSet, /['"]\/humans\.txt['"]/, 'exact /humans.txt stays 200 face');
assert.doesNotMatch(humansSet, /['"]\/humans['"]/, 'do not invent apex /humans');
assert.doesNotMatch(proofSet, /['"]\/api\/proof['"]/, 'do not invent /api/proof');
assert.doesNotMatch(digestSet, /['"]\/digest['"]/, 'exact /digest stays 200');
assert.doesNotMatch(digestSet, /['"]\/api\/digest['"]/, 'do not retarget /api/digest');

const HUMANS_SLASH_FOLDS = [
  '/humans.txt/',
  '/Humans.txt',
  '/HUMANS.TXT',
];
const COMPUTE_HUMANS_FOLDS = [
  '/compute/humans',
  '/compute/humans/',
  '/Compute/Humans',
  '/compute/humans.txt',
  '/COMPUTE/HUMANS.TXT',
];
const HUMANS_FOLDS = [...HUMANS_SLASH_FOLDS, ...COMPUTE_HUMANS_FOLDS];
const PROOF_FOLDS = ['/proof', '/proof/', '/Proof', '/PROOF', '/Proof/'];
const DIGEST_FOLDS = ['/compute/digest', '/compute/digest/', '/Compute/digest', '/COMPUTE/DIGEST'];
const STAY_200 = ['/humans.txt'];
const STAY_OUT = ['/humans', '/api/proof', '/api/v1', '/api/models', '/api/providers'];

for (const path of HUMANS_FOLDS) {
  assert.equal(potterHome308Dest(path), HUMANS, `${path} → /humans.txt`);
  assert.notEqual(potterHome308Dest(path), CONTRIBUTE, `${path} is not /contribute`);
}
for (const path of PROOF_FOLDS) {
  assert.equal(potterHome308Dest(path), PROOF, `${path} → /compute/proof`);
}
for (const path of DIGEST_FOLDS) {
  assert.equal(potterHome308Dest(path), DIGEST, `${path} → /digest`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/start'), null, 'Muse /start stays face');
assert.equal(potterHome308Dest('/providers'), null, 'Muse /providers stays face');
assert.equal(potterHome308Dest('/developers'), null, 'Muse /developers stays face');
assert.equal(potterHome308Dest('/network'), null, 'Muse /network stays face');

function expectLoc(host, dest, src) {
  if (host !== 'lobby.getdasha.com') return dest;
  const p = String(src || '').toLowerCase();
  if (dest === HUMANS && ['/compute/humans', '/compute/humans/', '/compute/humans.txt', '/compute/humans.txt/'].includes(p)) {
    return LOBBY_HUMANS;
  }
  if (dest === PROOF) return LOBBY_PROOF;
  if (dest === DIGEST) return LOBBY_DIGEST;
  return dest;
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-tip-source-canary-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

async function assertHumansFace(fetchImpl, host, label) {
  for (const method of ['GET', 'HEAD']) {
    const res = await fetchImpl(new Request(`https://${host}/humans.txt`, { method }), env);
    assert.equal(res.status, 200, `${label} ${host} /humans.txt ${method} 200`);
    assert.match(res.headers.get('content-type') || '', /^text\/plain; charset=utf-8$/i, `${label} ${host} /humans.txt ${method} content-type`);
    assert.doesNotMatch(res.headers.get('content-type') || '', /text\/html/i, `${label} ${host} /humans.txt ${method} not HTML`);
    if (label !== 'live') {
      assert.equal(res.headers.get('x-dasha-edge'), 'humans', `${label} ${host} /humans.txt ${method} edge`);
    }
    if (method === 'HEAD') {
      assert.equal(await res.text(), '', `${label} ${host} /humans.txt HEAD empty`);
    } else {
      const body = await res.text();
      assert.equal(body.slice(0, 10), '/* TEAM */', `${label} ${host} /humans.txt TEAM prefix`);
      assert.match(body, /Contribute: https:\/\/www\.getdasha\.com\/contribute/, `${label} contribute pointer`);
      assert.match(body, /Crew: https:\/\/www\.getdasha\.com\/crew/, `${label} crew pointer`);
      assert.doesNotMatch(body, /Contribute to Dasha/, `${label} not contribute HTML`);
      assert.doesNotMatch(body, /<html/i, `${label} not HTML`);
      assert.doesNotMatch(body, /@gmail\.|@getdasha\.|mailto:/i, `${label} no people-data`);
      assert.doesNotMatch(body, /plugin\.jup\.ag/, `${label} no plugin`);
    }
  }
}

async function assertFolds308(fetchImpl, host, folds, dest, label) {
  for (const path of folds) {
    for (const method of ['GET', 'HEAD']) {
      const res = await fetchImpl(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${label} ${host} ${path} ${method} 308`);
      const loc = expectLoc(host, dest, path);
      assert.equal(res.headers.get('location'), loc, `${label} ${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), CONTRIBUTE, `${label} ${host} ${path} ${method} not /contribute`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${label} ${host} ${path} ${method} no plugin`);
      if (host === 'lobby.getdasha.com' && loc.startsWith(LOBBY)) {
        assert.match(res.headers.get('location') || '', /^https:\/\/lobby\.getdasha\.com\//, `${label} ${host} ${path} same-host`);
        assert.doesNotMatch(res.headers.get('location') || '', /^https:\/\/www\.getdasha\.com\//, `${label} ${host} ${path} not www cross-host`);
      }
      if (method === 'HEAD') assert.equal(await res.text(), '', `${label} ${host} ${path} HEAD empty`);
    }
  }
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  await assertHumansFace((req) => worker.fetch(req, env), host, 'worker.fetch');
  await assertFolds308((req) => worker.fetch(req, env), host, HUMANS_FOLDS, HUMANS, 'worker.fetch');
  await assertFolds308((req) => worker.fetch(req, env), host, PROOF_FOLDS, PROOF, 'worker.fetch');
  await assertFolds308((req) => worker.fetch(req, env), host, DIGEST_FOLDS, DIGEST, 'worker.fetch');
}

const liveCanary = process.env.LIVE_MOTLEY_CANARY === '1';
if (liveCanary) {
  const liveFetch = async (request) => {
    return fetch(request.url, {
      method: request.method,
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
      headers: { 'User-Agent': 'dasha-motley-tip-source-canary.test', Accept: '*/*' },
    });
  };
  const probe = await liveFetch(new Request('https://www.getdasha.com/humans.txt'));
  const probeType = probe.headers.get('content-type') || '';
  const probeBody = probe.status === 200 && !/text\/html/i.test(probeType) ? await probe.text() : '';
  const humansLive = probe.status === 200 && /^text\/plain/i.test(probeType) && probeBody.startsWith('/* TEAM */');
  if (!humansLive) {
    assert.fail(
      'LIVE_MOTLEY_CANARY: live /humans.txt is not the text/plain TEAM face. Instinct wrangler of Uuriko/dasha-lobby tip (#251/#252/#261) still outstanding — source canaries on potterHome308Dest + worker.fetch already hold.',
    );
  }
  await assertHumansFace(liveFetch, 'www.getdasha.com', 'live');
  const proofLive = await liveFetch(new Request('https://www.getdasha.com/proof'));
  assert.equal(proofLive.status, 308, 'LIVE_MOTLEY_CANARY live /proof 308');
  assert.equal(proofLive.headers.get('location'), PROOF, 'LIVE_MOTLEY_CANARY live /proof loc');
  const humansFoldLive = await liveFetch(new Request('https://www.getdasha.com/compute/humans'));
  assert.equal(humansFoldLive.status, 308, 'LIVE_MOTLEY_CANARY live /compute/humans 308');
  assert.equal(humansFoldLive.headers.get('location'), HUMANS, 'LIVE_MOTLEY_CANARY live /compute/humans loc');
  const digestLive = await liveFetch(new Request('https://www.getdasha.com/compute/digest'));
  assert.equal(digestLive.status, 308, 'LIVE_MOTLEY_CANARY live /compute/digest 308');
  assert.equal(digestLive.headers.get('location'), DIGEST, 'LIVE_MOTLEY_CANARY live /compute/digest loc');
  console.log('dasha-motley-tip-source-canary: PASS (/humans.txt TEAM + /proof + /compute/digest + /compute/humans; live Motley too)');
} else {
  console.log('dasha-motley-tip-source-canary: PASS (/humans.txt text/plain TEAM; /proof 308 /compute/proof; /compute/digest 308 /digest; /compute/humans 308 /humans.txt; potterHome308Dest + worker.fetch — live Instinct-gated until tip)');
}
