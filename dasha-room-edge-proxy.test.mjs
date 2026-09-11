#!/usr/bin/env node
/**
 * Project Room edge reverse-proxy: /room discovery on apex+www+lobby.
 * GET+HEAD. Query ignored. Site-root /.well-known/agent.json stays Compute.
 * Disk only. No Designer. No wrangler deploy. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { COMPUTE_AGENT_JSON } from './dasha-compute-agent.mjs';
import {
  ROOM_EDGE,
  ROOM_ORIGIN,
  isRoomDiscoveryPath,
  normalizeRoomPath,
  roomDiscoveryResponse,
  roomUpstreamPath,
  roomUpstreamUrl,
} from './dasha-room-edge-proxy.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const proxySrc = readFileSync(join(root, 'dasha-room-edge-proxy.mjs'), 'utf8');
const routesSrc = readFileSync(join(root, 'ROUTES.md'), 'utf8');

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(proxySrc, /plugin\.jup\.ag/, 'proxy must not mention plugin.jup.ag');
assert.match(workerSrc, /from '\.\/dasha-room-edge-proxy\.mjs'/, 'worker imports Room edge proxy');
assert.equal(
  (workerSrc.match(/roomDiscoveryResponse\(request/g) || []).length,
  1,
  'Room discovery once, early in default fetch',
);
assert.match(routesSrc, /\/room\/llms\.txt/, 'ROUTES.md names Room discovery');
assert.doesNotMatch(proxySrc, /arcade|multichain|x402|people-data|ocm\//, 'proxy stays on Room discovery');

assert.equal(ROOM_ORIGIN, 'https://project-room-staging.getdasha.workers.dev');
assert.equal(normalizeRoomPath('/Room/LLMS.TXT/'), '/room/llms.txt');
assert.equal(normalizeRoomPath('/room/'), '/room/');
assert.equal(roomUpstreamPath('/room'), '/llms.txt');
assert.equal(roomUpstreamPath('/room/'), '/llms.txt');
assert.equal(roomUpstreamPath('/room?cb=1'), null, 'pathname helper does not see query');
assert.equal(roomUpstreamPath('/room/llms.txt'), '/llms.txt');
assert.equal(roomUpstreamPath('/room/llms-full.txt'), '/llms-full.txt');
assert.equal(roomUpstreamPath('/room/.well-known/agent.json'), '/.well-known/agent.json');
assert.equal(roomUpstreamPath('/room/api/health'), '/api/health');
assert.equal(roomUpstreamPath('/.well-known/agent.json'), null, 'site-root agent.json is not Room');
assert.equal(roomUpstreamPath('/room/secret'), null, 'do not invent Room UI paths');
assert.equal(isRoomDiscoveryPath('/room'), true);
assert.equal(isRoomDiscoveryPath('/.well-known/agent.json'), false);
assert.equal(roomUpstreamUrl('/room'), `${ROOM_ORIGIN}/llms.txt`);
assert.equal(roomUpstreamUrl('/room/.well-known/agent.json'), `${ROOM_ORIGIN}/.well-known/agent.json`);
assert.equal(potterHome308Dest('/room'), null, '/room is not a leftover 308');
assert.equal(potterHome308Dest('/room/'), null, '/room/ is not a leftover 308');

const LLMS = '# Project Room\n\norigin mock\n';
const LLMS_FULL = '# Project Room\n\nfull packet\n';
const ROOM_AGENT = '{\n  "name": "Project Room",\n  "product": { "not": "run factory" }\n}\n';
const HEALTH = '{"ok":true,"service":"project-room"}\n';

const ORIGIN_DOCS = {
  '/llms.txt': { type: 'text/plain; charset=utf-8', body: LLMS },
  '/llms-full.txt': { type: 'text/plain; charset=utf-8', body: LLMS_FULL },
  '/.well-known/agent.json': { type: 'application/json; charset=utf-8', body: ROOM_AGENT },
  '/api/health': { type: 'application/json; charset=utf-8', body: HEALTH },
};

const calls = [];
const stubFetch = async (href, init = {}) => {
  const url = new URL(String(href?.url || href));
  calls.push({
    href: url.href,
    method: init.method || 'GET',
    headers: init.headers || new Headers(),
    search: url.search,
  });
  assert.equal(url.origin, ROOM_ORIGIN, 'upstream stays on Room origin');
  assert.equal(url.search, '', 'do not forward query to origin');
  const doc = ORIGIN_DOCS[url.pathname];
  if (!doc) {
    return new Response('{"error":"nope"}', {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8', connection: 'keep-alive' },
    });
  }
  return new Response(doc.body, {
    status: 200,
    headers: {
      'content-type': doc.type,
      'cache-control': 'public, max-age=9',
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
      'set-cookie': 'room=nope',
    },
  });
};

{
  const direct = await roomDiscoveryResponse(new Request('https://lobby.getdasha.com/room?cb=1'), { fetch: stubFetch });
  assert.equal(direct.status, 200);
  assert.equal(direct.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(direct.headers.get('cache-control'), 'no-store');
  assert.equal(direct.headers.get('x-dasha-edge'), ROOM_EDGE);
  assert.equal(direct.headers.get('set-cookie'), null, 'do not forward set-cookie');
  assert.equal(direct.headers.get('connection'), null, 'do not forward hop-by-hop');
  assert.equal(await direct.text(), LLMS);
  assert.equal(calls.at(-1).href, `${ROOM_ORIGIN}/llms.txt`);
}

assert.equal(
  await roomDiscoveryResponse(new Request('https://www.getdasha.com/.well-known/agent.json'), { fetch: stubFetch }),
  null,
  'helper must not claim Compute agent.json',
);
assert.equal(
  await roomDiscoveryResponse(new Request('https://lobby.getdasha.com/room', { method: 'POST' }), { fetch: stubFetch }),
  null,
  'POST is not a discovery door',
);

const HOSTS = ['getdasha.com', 'www.getdasha.com', 'lobby.getdasha.com'];
const PATHS = [
  { path: '/room', type: /text\/plain/, body: LLMS, upstream: '/llms.txt' },
  { path: '/room/', type: /text\/plain/, body: LLMS, upstream: '/llms.txt' },
  { path: '/room?cb=1', type: /text\/plain/, body: LLMS, upstream: '/llms.txt' },
  { path: '/room/llms.txt', type: /text\/plain/, body: LLMS, upstream: '/llms.txt' },
  { path: '/room/llms-full.txt', type: /text\/plain/, body: LLMS_FULL, upstream: '/llms-full.txt' },
  { path: '/room/.well-known/agent.json', type: /application\/json/, body: ROOM_AGENT, upstream: '/.well-known/agent.json' },
];

const prevFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const href = String(input?.url || input);
  if (href.startsWith(ROOM_ORIGIN)) return stubFetch(href, init);
  throw new Error('unexpected fetch ' + href);
};
try {
  const env = { fetch: stubFetch };
  for (const host of HOSTS) {
    for (const spec of PATHS) {
      for (const method of ['GET', 'HEAD']) {
        const res = await edgeWorker.fetch(new Request(`https://${host}${spec.path}`, { method }), env);
        assert.equal(res.status, 200, `${host}${spec.path} ${method}`);
        assert.match(res.headers.get('content-type') || '', spec.type, `${host}${spec.path} ${method} type`);
        assert.equal(res.headers.get('cache-control'), 'no-store', `${host}${spec.path} ${method} no-store`);
        assert.equal(res.headers.get('x-dasha-edge'), ROOM_EDGE, `${host}${spec.path} ${method} edge`);
        assert.equal(res.headers.get('connection'), null, `${host}${spec.path} ${method} no hop-by-hop`);
        if (method === 'HEAD') {
          assert.equal(await res.text(), '', `${host}${spec.path} HEAD empty`);
        } else {
          assert.equal(await res.text(), spec.body, `${host}${spec.path} GET body`);
        }
        assert.equal(calls.at(-1).href, `${ROOM_ORIGIN}${spec.upstream}`, `${host}${spec.path} ${method} origin`);
        assert.equal(calls.at(-1).search, '', `${host}${spec.path} ${method} no query`);
      }
    }

    const computeCard = await edgeWorker.fetch(new Request(`https://${host}/.well-known/agent.json`), env);
    assert.equal(computeCard.status, 200, `${host} site-root agent.json`);
    assert.equal(computeCard.headers.get('x-dasha-edge'), 'compute-agent', `${host} site-root stays Compute`);
    const card = await computeCard.json();
    assert.equal(card.name, 'Dasha Compute', `${host} site-root name`);
    assert.deepEqual(card, COMPUTE_AGENT_JSON, `${host} site-root Compute card`);
    assert.doesNotMatch(JSON.stringify(card), /Project Room/, `${host} site-root is not Room`);
    assert.doesNotMatch(JSON.stringify(card), /plugin\.jup\.ag/);

    if (host === 'lobby.getdasha.com') {
      const unknown = await edgeWorker.fetch(new Request(`https://${host}/room/nope`), env);
      assert.notEqual(unknown.headers.get('x-dasha-edge'), ROOM_EDGE, 'unknown Room path is not proxied');
      assert.equal(unknown.status, 404, 'lobby unknown Room path stays 404');
      assert.deepEqual(await unknown.json(), { error: 'not found' });
    }
  }
} finally {
  globalThis.fetch = prevFetch;
}

console.log('dasha-room-edge-proxy: PASS (/room+/room/+/room?cb=1+/room/llms.txt+/room/.well-known/agent.json GET+HEAD 200 apex+www+lobby; site-root agent.json Compute; no plugin.jup.ag)');
