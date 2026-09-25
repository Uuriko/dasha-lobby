#!/usr/bin/env node
/**
 * Anti-clobber lock: next Instinct/repo deploy must keep live kits + proof +
 * invent + readyz pretty. Invent family already from #218. Kits catalog and
 * Accept text/plain /room stay on the Room proxy. Proof HTML/JSON/MD stay
 * 200. /compute/readyz leftover stays /compute/api/readyz.
 * Stay out: doctor.md as a fake doc, bare /readyz, apex /waitlist,
 * plugin.jup.ag. Disk only. No Designer. No wrangler.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { roomUpstreamPath, roomUpstreamUrl } from './dasha-room-edge-proxy.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const proxySrc = readFileSync(join(root, 'dasha-room-edge-proxy.mjs'), 'utf8');

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(proxySrc, /plugin\.jup\.ag/, 'proxy must not mention plugin.jup.ag');

const PROVIDE = 'https://www.getdasha.com/compute#provide';
const READYZ = 'https://www.getdasha.com/compute/api/readyz';

const INVENT = [
  '/compute/doctor.txt',
  '/compute/doctor.txt/',
  '/compute/self-test',
  '/compute/plugin',
  '/compute/plug-in',
  '/compute/waitlist',
  '/Compute/doctor.txt',
  '/Compute/Self-Test',
  '/Compute/Plugin',
  '/Compute/Plug-In',
  '/Compute/Waitlist',
  '/invent',
  '/invent/',
  '/Invent',
  '/INVENT',
  '/doctor.txt',
  '/self-test',
  '/plugin',
  '/plug-in',
];
for (const path of INVENT) {
  assert.equal(potterHome308Dest(path), PROVIDE, `${path} → #provide`);
}

const READYZ_LEFTOVER = [
  '/compute/readyz',
  '/compute/readyz/',
  '/Compute/readyz',
  '/COMPUTE/READYZ',
];
for (const path of READYZ_LEFTOVER) {
  assert.equal(potterHome308Dest(path), READYZ, `${path} → /compute/api/readyz`);
}

assert.equal(potterHome308Dest('/compute/api/readyz'), null, '/compute/api/readyz stays 200');
assert.equal(potterHome308Dest('/readyz'), null, 'do not invent bare /readyz');
assert.equal(potterHome308Dest('/waitlist'), null, 'do not invent apex /waitlist');
assert.notEqual(potterHome308Dest('/compute/doctor.md'), PROVIDE, 'do not invent /compute/doctor.md');
assert.doesNotMatch(workerSrc, /'\/compute\/doctor\.md'/, 'doctor.md stays out of 308 set');
assert.doesNotMatch(workerSrc, /'\/waitlist'/, 'apex /waitlist stays out of 308 set');
assert.doesNotMatch(workerSrc, /'\/readyz'/, 'bare /readyz stays out of 308 set');

const KITS = [
  '/room/kits',
  '/room/kits/',
  '/room/kit',
  '/room/kits.txt',
  '/room/kits.md',
  '/room/kit.txt',
  '/room/kit.md',
];
for (const path of KITS) {
  assert.equal(roomUpstreamPath(path), '/kits.txt', `${path} → origin /kits.txt`);
  assert.equal(roomUpstreamUrl(path), 'https://room.trydemigod.com/kits.txt', `${path} → live catalog`);
  assert.doesNotMatch(roomUpstreamUrl(path), /workers\.dev/, `${path} is not staging 1042`);
  assert.equal(potterHome308Dest(path), null, `${path} is not leftover 308`);
}
assert.equal(roomUpstreamPath('/room/kits.json'), null, 'do not invent /room/kits.json');
assert.match(proxySrc, /Accept: text\/plain/, 'proxy comments Accept text/plain /room');
assert.match(proxySrc, /\/kits\.txt/, 'proxy maps kits family to origin /kits.txt');

assert.match(workerSrc, /POTTER_COMPUTE_DOCTOR_PROVIDE_308_PATHS/, 'invent leftover set');
assert.match(workerSrc, /computeProofPageResponse/, 'proof HTML helper');
assert.match(workerSrc, /computeProofJsonResponse/, 'proof JSON helper');
assert.match(workerSrc, /computeProofMdResponse/, 'proof markdown helper');
assert.equal(workerSrc.split('return computeProofPageResponse(request);').length - 1, 2, 'proof at both dispatch sites');
assert.equal(workerSrc.split('return computeProofJsonResponse(request, env);').length - 1, 2, 'proof.json at both dispatch sites');
assert.equal(workerSrc.split('return computeProofMdResponse(request, env);').length - 1, 2, 'proof.md at both dispatch sites');

const env = {
  LOBBY_SESSION_SECRET: 'live-edge-align-secret',
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
  for (const path of ['/compute/doctor.txt', '/compute/self-test', '/compute/plugin', '/compute/plug-in', '/compute/waitlist', '/invent', '/doctor.txt', '/self-test', '/plugin', '/plug-in']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), PROVIDE, `${host} ${path} ${method} loc`);
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}/compute/readyz`, { method }), env);
    assert.equal(res.status, 308, `${host} /compute/readyz ${method}`);
    const expect = host === 'lobby.getdasha.com'
      ? 'https://lobby.getdasha.com/compute/api/readyz'
      : READYZ;
    assert.equal(res.headers.get('location'), expect, `${host} /compute/readyz ${method} loc`);
  }
  for (const path of ['/compute/proof', '/compute/proof/', '/compute/proof.json', '/compute/proof.md']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('x-dasha-edge'), 'compute-proof', `${host} ${path} ${method} edge`);
      if (method === 'HEAD') {
        assert.equal(await res.text(), '', `${host} ${path} HEAD empty`);
        continue;
      }
      if (path.startsWith('/compute/proof.json')) {
        assert.match(res.headers.get('content-type') || '', /application\/json/);
        const body = await res.json();
        assert.equal(body.schema, 'proof.compute.v0');
        assert.equal(body.right_now.providers_online, 1);
        assert.equal(body.fail_loud_contract.reason, 'no_mac_online');
      } else if (path.startsWith('/compute/proof.md')) {
        assert.match(res.headers.get('content-type') || '', /text\/markdown/);
        const md = await res.text();
        assert.match(md, /schema: proof\.compute\.v0/);
        assert.match(md, /providers_online: \*\*1\*\*/);
        assert.match(md, /no_mac_online/);
        assert.match(md, /Knap template on disk: phase0-publish\/knap/);
      } else {
        assert.match(res.headers.get('content-type') || '', /text\/html/);
        const html = await res.text();
        assert.match(html, /1\. Right now/);
        assert.match(html, /\/compute\/proof\.json/);
      }
    }
  }
  const bare = await edgeWorker.fetch(new Request(`https://${host}/readyz`), env);
  assert.notEqual(bare.status, 308, `${host} /readyz is not leftover 308`);
}

console.log('dasha-live-edge-align-pretty-path: PASS (invent #provide + /compute/readyz leftover + kits map + proof/json/md 200 www+lobby GET+HEAD; doctor.md / bare /readyz / apex /waitlist / plugin.jup.ag stay out)');
