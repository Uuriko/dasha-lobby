#!/usr/bin/env node
/** www/apex must serve SIWG + faucet stills from ASSETS (not Webflow html-404). */
import assert from 'node:assert/strict';
import edgeWorker, { isWorkerStaticAssetPath } from './dasha-lobby-worker.mjs';

assert.equal(isWorkerStaticAssetPath('/client/sign-in-with-grok-bot.jpg'), true);
assert.equal(isWorkerStaticAssetPath('/client/faucet.png'), true);
assert.equal(isWorkerStaticAssetPath('/client/faucet.avif'), true);
assert.equal(isWorkerStaticAssetPath('/client/faucet.webp'), true);
assert.equal(isWorkerStaticAssetPath('/simp/photo/x'), true);
assert.equal(isWorkerStaticAssetPath('/simp/card/x'), true);
assert.equal(isWorkerStaticAssetPath('/og/home.png'), true);
assert.equal(isWorkerStaticAssetPath('/client/other.jpg'), false);

const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const PATHS = [
  '/client/sign-in-with-grok-bot.jpg',
  '/client/faucet.png',
  '/client/faucet.avif',
  '/client/faucet.webp',
];

for (const host of ['https://www.getdasha.com', 'https://getdasha.com']) {
  for (const path of PATHS) {
    let hit = 0;
    const env = {
      ASSETS: {
        async fetch(req) {
          hit += 1;
          assert.ok(String(req.url).endsWith(path), `ASSETS url for ${path}`);
          return new Response(BYTES, {
            status: 200,
            headers: { 'Content-Type': path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : path.endsWith('.avif') ? 'image/avif' : 'image/jpeg' },
          });
        },
      },
    };
    const res = await edgeWorker.fetch(new Request(`${host}${path}`), env);
    assert.equal(res.status, 200, `${host}${path} status`);
    assert.equal(hit, 1, `${host}${path} ASSETS hit`);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.equal(res.headers.get('cache-control'), 'public, max-age=86400');
    assert.notEqual(res.headers.get('x-dasha-edge'), 'html-404', `${host}${path} not html-404`);
    const buf = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...buf], [...BYTES], `${host}${path} body`);
  }
}

{
  const path = '/client/sign-in-with-grok-bot.jpg';
  let hit = 0;
  const env = {
    ASSETS: {
      async fetch() {
        hit += 1;
        return new Response(BYTES, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
      },
    },
  };
  const head = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`, { method: 'HEAD' }), env);
  assert.equal(head.status, 200, 'www SIWG HEAD');
  assert.equal(hit, 1);
  assert.equal(head.headers.get('x-dasha-edge'), null);
}

const PRICE = { ok: true, mint: '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump', priceUsd: 0.000468 };
for (const host of ['https://www.getdasha.com', 'https://getdasha.com']) {
  let hit = 0;
  const env = {
    LOBBY: {
      idFromName(name) { assert.equal(name, 'public'); return 'public'; },
      get() {
        return {
          async fetch(req) {
            hit += 1;
            assert.equal(new URL(req.url).pathname, '/price');
            return new Response(JSON.stringify(PRICE), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          },
        };
      },
    },
  };
  const res = await edgeWorker.fetch(new Request(`${host}/price`), env);
  assert.equal(res.status, 200, `${host}/price status`);
  assert.equal(hit, 1, `${host}/price LOBBY hit`);
  assert.notEqual(res.headers.get('x-dasha-edge'), 'html-404', `${host}/price not html-404`);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.mint, PRICE.mint);
  const head = await edgeWorker.fetch(new Request(`${host}/price`, { method: 'HEAD' }), env);
  assert.equal(head.status, 200, `${host}/price HEAD`);
}

console.log('dasha-www-client-assets: PASS (www/apex ASSETS for SIWG+faucet, /price JSON)');

