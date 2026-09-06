#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 65b09216): live /prefermlx /m4 /balances
 * /credits/buy (+ /compute/* tabs, slash / Title-case) html-404 → 308 /compute.
 * Concat sibling of shipped /prefer-mlx /prefer_mlx; chip sibling of shipped
 * /apple-silicon /silicon /mlx; plural sibling of shipped /balance; nested
 * peer of shipped /buy-credits. Case-fold already lowercases Title-case.
 * Do NOT invent /arcade /games. Do NOT fold /connect /openai /v1 /admin
 * /health. Skip /status /tos (leave 404). Disk only. No Designer. Never
 * plugin.jup.ag. PR-mirror only — no wrangler deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(
  workerSrc,
  /Concat sibling of \/prefer-mlx \(live \/prefermlx html-404 while hyphen\/underscore peers already 308\)/,
  'leftover comment names concat sibling /prefermlx',
);
assert.match(
  workerSrc,
  /Concat sibling of \/compute\/prefer-mlx/,
  'leftover comment names concat sibling /compute/prefermlx',
);
assert.match(
  workerSrc,
  /Chip sibling of \/apple-silicon \/silicon \/mlx \(live \/m4 html-404\)/,
  'leftover comment names chip sibling /m4',
);
assert.match(
  workerSrc,
  /Plural sibling of \/balance \(live \/balances html-404\)/,
  'leftover comment names plural sibling /balances',
);
assert.match(
  workerSrc,
  /Nested peer of \/buy-credits \(live \/credits\/buy html-404\)/,
  'leftover comment names nested peer /credits/buy',
);
assert.match(
  workerSrc,
  /\/prefermlx\|\/compute\/prefermlx\|\/m4\|\/compute\/m4\|\/balances\|\/compute\/balances\|\/credits\/buy\|\/compute\/credits\/buy/,
  'potterHome308Dest comment lists leftover family',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/prefermlx', '/compute/prefermlx',
  '/m4', '/compute/m4',
  '/balances', '/compute/balances',
  '/credits/buy', '/compute/credits/buy',
  '/prefer-mlx', '/prefer_mlx', '/compute/prefer-mlx', '/compute/prefer_mlx',
  '/mlx', '/compute/mlx',
  '/apple-silicon', '/silicon', '/balance', '/buy-credits',
]) {
  assert.match(tab, new RegExp(`'${path}'`), `${path} in compute-tab set`);
}
for (const skip of ['/connect', '/openai', '/v1', '/arcade', '/games', '/admin', '/health', '/status', '/tos']) {
  assert.doesNotMatch(tab, new RegExp(`['"]${skip}['"]`), `${skip} stays out of compute-tab set`);
}

const WWW = 'https://www.getdasha.com';
const COMPUTE = `${WWW}/compute`;

const SHIP = [
  '/prefermlx', '/prefermlx/', '/Prefermlx', '/PREFERMLX', '/pReFeRmLx/',
  '/compute/prefermlx', '/compute/prefermlx/', '/Compute/prefermlx',
  '/COMPUTE/PREFERMLX', '/Compute/Prefermlx/',
  '/m4', '/m4/', '/M4', '/M4/',
  '/compute/m4', '/compute/m4/', '/Compute/m4', '/COMPUTE/M4', '/Compute/M4/',
  '/balances', '/balances/', '/Balances', '/BALANCES', '/bAlAnCeS/',
  '/compute/balances', '/compute/balances/', '/Compute/balances',
  '/COMPUTE/BALANCES', '/Compute/Balances/',
  '/credits/buy', '/credits/buy/', '/Credits/buy', '/CREDITS/BUY', '/Credits/Buy/',
  '/compute/credits/buy', '/compute/credits/buy/', '/Compute/credits/buy',
  '/COMPUTE/CREDITS/BUY', '/Compute/Credits/Buy/',
];
const PRIOR_PEERS = [
  '/prefer-mlx', '/prefer-mlx/', '/Prefer-mlx', '/PREFER-MLX',
  '/prefer_mlx', '/prefer_mlx/', '/Prefer_mlx', '/PREFER_MLX',
  '/apple-silicon', '/apple-silicon/', '/Apple-silicon',
  '/silicon', '/silicon/', '/Silicon',
  '/mlx', '/mlx/', '/Mlx', '/MLX',
  '/balance', '/balance/', '/Balance',
  '/buy-credits', '/buy-credits/', '/Buy-credits', '/BUY-CREDITS',
];
const LEAVE_404 = [
  '/connect', '/openai', '/v1', '/arcade', '/games', '/admin', '/health', '/status', '/tos',
];
const STAY_404 = [
  '/connect', '/openai', '/v1', '/arcade', '/games', '/admin', '/status', '/tos',
];

for (const path of [...SHIP, ...PRIOR_PEERS]) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
for (const path of LEAVE_404) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
  assert.equal(potterHome308Dest(`${path}/`), null, `do not fold ${path}/`);
}

const env = {
  LOBBY_SESSION_SECRET: 'prefermlx-m4-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of [...SHIP, ...PRIOR_PEERS]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  for (const path of LEAVE_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
  for (const path of STAY_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 404, `${host} ${path} ${method} stays 404`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (host === 'www.getdasha.com') {
        assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${host} ${path} ${method} html-404`);
        if (method === 'HEAD') assert.equal(await res.text(), '');
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/prefermlx', '/m4', '/balances', '/credits/buy',
  '/prefer-mlx', '/prefer_mlx', '/mlx', '/buy-credits',
  '/connect', '/openai', '/v1', '/arcade', '/games', '/admin', '/health', '/status', '/tos',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-prefermlx-m4-pretty-path: PASS (/prefermlx+/m4+/balances+/credits/buy + /compute/* tabs 308 /compute; Title-case+slash; www+lobby GET+HEAD; /prefer-mlx+/prefer_mlx+/apple-silicon+/silicon+/mlx+/balance+/buy-credits peers; /connect+/openai+/v1+/arcade+/games+/admin+/health+/status+/tos stay out; no plugin.jup.ag)');
