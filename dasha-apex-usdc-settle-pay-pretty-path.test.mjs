#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 218cfd63): live /usdc /settle /topup /top-up
 * /billing /wallet /phantom /solana + /compute/* tabs (+slash / Title-case)
 * html-404 → 308 /compute. Pay/Credits already 308→/compute.
 * Title-case works via existing dest lowercasing.
 * Exact /compute stays 200 (null dest). Skip /openai /v1 /api/v1 /v1/models
 * /status /health /healthz /resend — do not invent a fold.
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
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(
  workerSrc,
  /USDC\/settle\/topup\/billing\/wallet\/phantom\/solana leftovers while Pay\/Credits/,
  'apex→/compute leftover comment lists USDC/settle/topup/billing/wallet/phantom/solana',
);
assert.match(
  workerSrc,
  /\/usdc\|\/settle\|\/topup\|\/top-up\|\/billing\|\/wallet\|\/phantom\|\/solana/,
  'potterHome308Dest comment lists leftover family',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const leaf of ['usdc', 'settle', 'topup', 'top-up', 'billing', 'wallet', 'phantom', 'solana']) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
}
assert.doesNotMatch(tab, /['"]\/openai['"]/, 'do not invent /openai on compute-tab set');
assert.doesNotMatch(tab, /['"]\/v1['"]/, 'do not invent /v1');
assert.doesNotMatch(tab, /['"]\/api\/v1['"]/, 'do not invent /api/v1');
assert.doesNotMatch(tab, /['"]\/v1\/models['"]/, 'do not invent /v1/models');
assert.doesNotMatch(tab, /['"]\/status['"]/, 'do not invent /status');
assert.doesNotMatch(tab, /['"]\/health['"]/, 'do not invent /health');
assert.doesNotMatch(tab, /['"]\/healthz['"]/, 'do not invent /healthz');
assert.doesNotMatch(tab, /['"]\/resend['"]/, 'do not invent /resend');

const COMPUTE = 'https://www.getdasha.com/compute';

const USDC_SETTLE = [
  '/usdc', '/usdc/', '/Usdc', '/USDC', '/uSdC/',
  '/settle', '/settle/', '/Settle', '/SETTLE', '/sEtTlE/',
  '/topup', '/topup/', '/Topup', '/TOPUP', '/tOpUp/',
  '/top-up', '/top-up/', '/Top-up', '/TOP-UP', '/Top-Up/',
  '/billing', '/billing/', '/Billing', '/BILLING', '/bIlLiNg/',
  '/wallet', '/wallet/', '/Wallet', '/WALLET', '/wAlLeT/',
  '/phantom', '/phantom/', '/Phantom', '/PHANTOM', '/pHaNtOm/',
  '/solana', '/solana/', '/Solana', '/SOLANA', '/sOlAnA/',
  '/compute/usdc', '/compute/usdc/', '/Compute/usdc', '/COMPUTE/USDC', '/Compute/Usdc/',
  '/compute/settle', '/compute/settle/', '/Compute/settle', '/COMPUTE/SETTLE', '/Compute/Settle/',
  '/compute/topup', '/compute/topup/', '/Compute/topup', '/COMPUTE/TOPUP', '/Compute/Topup/',
  '/compute/top-up', '/compute/top-up/', '/Compute/top-up', '/COMPUTE/TOP-UP', '/Compute/Top-Up/',
  '/compute/billing', '/compute/billing/', '/Compute/billing', '/COMPUTE/BILLING', '/Compute/Billing/',
  '/compute/wallet', '/compute/wallet/', '/Compute/wallet', '/COMPUTE/WALLET', '/Compute/Wallet/',
  '/compute/phantom', '/compute/phantom/', '/Compute/phantom', '/COMPUTE/PHANTOM', '/Compute/Phantom/',
  '/compute/solana', '/compute/solana/', '/Compute/solana', '/COMPUTE/SOLANA', '/Compute/Solana/',
];
const PRIOR_PEERS = [
  '/pay', '/pay/', '/Pay', '/PAY',
  '/credits', '/credits/', '/Credits', '/CREDITS',
  '/compute/pay', '/compute/credits',
];
const FOLDS = [...USDC_SETTLE, ...PRIOR_PEERS];
const STAY_OUT = [
  '/openai', '/openai/', '/OpenAI',
  '/v1', '/v1/',
  '/api/v1', '/api/v1/',
  '/v1/models', '/v1/models/',
  '/status', '/status/',
  '/health', '/health/',
  '/healthz', '/healthz/',
  '/resend', '/resend/', '/Resend',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
}
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path} to compute`);
}

const env = { LOBBY_SESSION_SECRET: 'apex-usdc-settle-pay-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
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
  for (const path of STAY_OUT) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/usdc', '/settle', '/topup', '/top-up', '/billing', '/wallet', '/phantom', '/solana', '/compute/usdc', '/openai', '/v1', '/status', '/health', '/resend']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-usdc-settle-pay-pretty-path: PASS (/usdc+/settle+/topup+/top-up+/billing+/wallet+/phantom+/solana + /compute/* tabs 308 /compute; Pay/Credits regression; Title-case+slash; www+lobby GET+HEAD; /compute 200; /openai+/v1+/status+/health+/healthz+/resend stay out; no plugin.jup.ag)');
