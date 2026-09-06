#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 49d4d133): live /help /guide /tutorial /support
 * /docs-help /getting-help /contact /free-credits /buy-credits /get-credits
 * (+ /compute/* tabs, Title-case) html-404 → 308 /compute. Pay/Credits/Ask +
 * /topup|/top-up peers already 308→/compute. Fold support synonyms + contact
 * + free/buy/get-credits to plain /compute — NOT faucet earn.
 * /docs stays dedicated → /compute/api (not bare /compute).
 * Exact /compute /privacy stay 200 (null dest). Bare /price stays the 200
 * JSON token-price API. Skip /terms /tos /legal /admin /blog /news /waitlist
 * /faq — do not invent a fold. Disk only. No Designer. Never plugin.jup.ag.
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
  /Help\/support\/contact \+ Pay\/Credits honesty leftovers/,
  'leftover comment names help/support/contact + Pay/Credits family',
);
assert.match(
  workerSrc,
  /\/docs stays dedicated → \/compute\/api \(not here\)/,
  'leftover comment keeps /docs on /compute/api, not COMPUTE_TAB',
);
assert.match(
  workerSrc,
  /\/help\|\/guide\|\/tutorial\|\/support\|\/docs-help\|\/getting-help\|\/contact\|\/free-credits\|\/buy-credits\|\/get-credits/,
  'potterHome308Dest comment lists leftover family',
);
assert.match(
  workerSrc,
  /\/help now folds via COMPUTE_TAB → \/compute/,
  'privacy-synonym comment notes /help folds to /compute, not /privacy',
);
assert.match(
  workerSrc,
  /Still skip \/terms \/tos \/legal \/faq/,
  'privacy-synonym comment still skips /terms /tos /legal /faq',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const apiDocs = workerSrc.match(/const POTTER_COMPUTE_API_DOCS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const COMPUTE_LEAVES = [
  'help', 'guide', 'tutorial', 'support', 'docs-help', 'getting-help',
  'contact', 'free-credits', 'buy-credits', 'get-credits',
];
for (const leaf of COMPUTE_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
}
assert.match(apiDocs, /'\/docs'/);
assert.doesNotMatch(tab, /['"]\/docs['"]/, 'do not put bare /docs on COMPUTE_TAB');
assert.doesNotMatch(tab, /['"]\/docs\/['"]/, 'do not put /docs/ on COMPUTE_TAB');
assert.doesNotMatch(tab, /['"]\/price['"]/, 'do not fold bare /price');
assert.doesNotMatch(tab, /['"]\/privacy['"]/, 'do not fold /privacy');
assert.doesNotMatch(tab, /['"]\/terms['"]/, 'do not invent /terms');
assert.doesNotMatch(tab, /['"]\/tos['"]/, 'do not invent /tos');
assert.doesNotMatch(tab, /['"]\/legal['"]/, 'do not invent /legal');
assert.doesNotMatch(tab, /['"]\/admin['"]/, 'do not invent /admin');
assert.doesNotMatch(tab, /['"]\/blog['"]/, 'do not invent /blog');
assert.doesNotMatch(tab, /['"]\/news['"]/, 'do not invent /news');
assert.doesNotMatch(tab, /['"]\/waitlist['"]/, 'do not invent /waitlist');
assert.doesNotMatch(tab, /['"]\/faq['"]/, 'do not invent /faq');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const API = `${WWW}/compute/api`;
const PRIVACY = `${WWW}/privacy`;

const NEW_PATHS = COMPUTE_LEAVES.flatMap((leaf) => [
  `/${leaf}`, `/${leaf}/`,
  `/${leaf[0].toUpperCase()}${leaf.slice(1)}`,
  `/${leaf.toUpperCase()}`,
  `/compute/${leaf}`, `/compute/${leaf}/`,
  `/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`,
]);
const PRIOR_PEERS = [
  '/topup', '/topup/', '/Topup', '/TOPUP',
  '/top-up', '/top-up/', '/Top-up', '/TOP-UP',
  '/pay', '/pay/', '/Pay',
  '/credits', '/credits/', '/Credits',
  '/ask', '/ask/', '/Ask',
];
const FOLDS = [...NEW_PATHS, ...PRIOR_PEERS];
const DOCS = ['/docs', '/docs/', '/Docs', '/DOCS', '/dOcS/'];
const STAY_NULL = [
  '/price', '/price/', '/Price',
  '/privacy', '/privacy/',
  '/compute',
];
const SKIP_404 = [
  '/terms', '/terms/', '/Terms',
  '/tos', '/tos/', '/Tos',
  '/legal', '/legal/', '/Legal',
  '/admin', '/admin/', '/Admin',
  '/blog', '/blog/', '/Blog',
  '/news', '/news/', '/News',
  '/waitlist', '/waitlist/', '/Waitlist',
  '/faq', '/faq/', '/Faq', '/FAQ',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
  assert.notEqual(potterHome308Dest(path), PRIVACY, `${path} is not /privacy`);
}
for (const path of DOCS) {
  assert.equal(potterHome308Dest(path), API, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not bare /compute`);
}
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}
for (const path of SKIP_404) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  const u = new URL(dest);
  if (u.pathname === '/compute/api' || u.pathname.startsWith('/compute/api/')) {
    return LOBBY + u.pathname;
  }
  return dest;
}

const FETCH_SAMPLE = [
  '/help', '/Help/', '/guide', '/Support', '/contact',
  '/free-credits', '/buy-credits', '/get-credits',
  '/docs-help', '/getting-help', '/tutorial',
  '/compute/help', '/Compute/contact/',
  '/topup', '/top-up',
];

const env = {
  LOBBY_SESSION_SECRET: 'apex-help-credits-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName() { return 'public'; },
    get() {
      return {
        async fetch() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          });
        },
      };
    },
  },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FETCH_SAMPLE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of DOCS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, API), `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not bare /compute`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  }
  for (const path of ['/price', '/price/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
  for (const path of SKIP_404) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), PRIVACY, `${host} ${path} ${method} not folded to privacy`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/help', '/guide', '/tutorial', '/support', '/contact',
  '/free-credits', '/buy-credits', '/get-credits', '/docs-help', '/getting-help',
  '/docs', '/terms', '/tos', '/legal', '/admin', '/blog', '/news', '/waitlist', '/faq',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-apex-help-credits-pretty-path: PASS (/help+/guide+/tutorial+/support+/docs-help+/getting-help+/contact+/free-credits+/buy-credits+/get-credits + /compute/* tabs 308 /compute; /topup+/top-up+/pay+/credits+/ask peers; /docs 308 /compute/api; Title-case+slash; www+lobby GET+HEAD sample; /compute+/privacy 200; bare /price untouched; /terms+/tos+/legal+/admin+/blog+/news+/waitlist+/faq stay out; /help not /privacy; no plugin.jup.ag)');
