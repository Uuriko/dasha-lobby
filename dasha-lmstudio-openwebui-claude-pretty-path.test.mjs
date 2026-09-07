#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 35fc317b-c13c-4f98-b3aa-64763773ffa8):
 * live /lmstudio /lm-studio /lm_studio /openwebui /open-webui /open_webui
 * /webui /claude /m3 /gettingstarted /hi /welcome
 * (+ /compute/* tabs, slash / Title-case) 308 → /compute.
 * live /base-url /baseurl /base_url /chat-completions /chatcompletions
 * /chat_completions /embeddings /embedding /responses /response /completion
 * (+ /compute/* tabs, slash / Title-case) 308 → /compute/api.
 * Docs face only — do NOT invent /v1/chat/completions behavior.
 * /run /ollama /m4 /getstarted /hello /endpoint /docs peers already fold.
 * Exact /compute /privacy stay 200 (null dest). Bare /price stays the 200
 * JSON token-price API. Exact /compute/api stays JSON (null dest).
 * Skip /arcade /games /openai /anthropic /v1 /api/v1 /status /health
 * /healthz /network /x402 /attestation /blog /news /faq /waitlist /tos
 * /legal /discord /slack /admin /deposit /sell /jupiter /raydium /git
 * /about /metrics /ping — leave 404. Disk only. No Designer.
 * Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
 * Live www HEAD dests proven first on Worker 35fc317b.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /(?:String\(path \|\| ''\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /POTTER_COMPUTE_TAB_308_PATHS/, 'compute-tab 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_API_DOCS_308_PATHS/, 'api-docs 308 set present');
assert.match(
  workerSrc,
  /Leftover lmstudio\/openwebui\/claude batch \(Worker 35fc317b\)/,
  'compute leftover comment names lmstudio/openwebui/claude family',
);
assert.match(
  workerSrc,
  /Leftover \/base-url \/baseurl \/base_url \/chat-completions \/chatcompletions/,
  'api leftover comment lists /base-url /baseurl /chat-completions family',
);
assert.match(
  workerSrc,
  /Docs face only — do NOT invent \/v1\/chat\/completions behavior/,
  'api leftover comment keeps /v1/chat/completions uninvented',
);
assert.match(
  workerSrc,
  /\/lmstudio\|\/lm-studio\|\/lm_studio\|\/openwebui\|\/open-webui\|\/open_webui\|\/webui\|\/claude\|\/m3\|\/gettingstarted\|\/hi\|\/welcome/,
  'potterHome308Dest comment lists compute leftover family',
);
assert.match(
  workerSrc,
  /\/base-url\|\/baseurl\|\/base_url\|\/chat-completions\|\/chatcompletions\|\/chat_completions\|\/embeddings\|\/embedding\|\/responses\|\/response\|\/completion/,
  'potterHome308Dest comment lists api leftover family',
);
assert.match(
  workerSrc,
  /Do NOT invent \/arcade \/games/,
  'leftover comment keeps Arcade uninvented',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const apiDocs = workerSrc.match(/const POTTER_COMPUTE_API_DOCS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

const COMPUTE_LEAVES = [
  'lmstudio', 'lm-studio', 'lm_studio',
  'openwebui', 'open-webui', 'open_webui', 'webui',
  'claude', 'm3', 'gettingstarted', 'hi', 'welcome',
];
const API_LEAVES = [
  'base-url', 'baseurl', 'base_url',
  'chat-completions', 'chatcompletions', 'chat_completions',
  'embeddings', 'embedding', 'responses', 'response', 'completion',
];

for (const leaf of COMPUTE_LEAVES) {
  assert.match(tab, new RegExp(`'/${leaf}'`));
  assert.match(tab, new RegExp(`'/${leaf}/'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}'`));
  assert.match(tab, new RegExp(`'/compute/${leaf}/'`));
  assert.doesNotMatch(apiDocs, new RegExp(`['"]/${leaf}['"]`), `${leaf} is compute-tab, not api-docs`);
}
for (const leaf of API_LEAVES) {
  assert.match(apiDocs, new RegExp(`'/${leaf}'`));
  assert.match(apiDocs, new RegExp(`'/${leaf}/'`));
  assert.match(apiDocs, new RegExp(`'/compute/${leaf}'`));
  assert.match(apiDocs, new RegExp(`'/compute/${leaf}/'`));
  assert.doesNotMatch(tab, new RegExp(`['"]/${leaf}['"]`), `${leaf} is api-docs, not compute-tab`);
}

const SKIPS = [
  '/arcade', '/games', '/openai', '/anthropic', '/v1', '/api/v1',
  '/status', '/health', '/healthz', '/network', '/x402', '/attestation',
  '/blog', '/news', '/faq', '/waitlist', '/tos', '/legal', '/discord',
  '/slack', '/admin', '/deposit', '/sell', '/jupiter', '/raydium', '/git',
  '/about', '/metrics', '/ping', '/price', '/privacy',
];
for (const skip of SKIPS) {
  assert.doesNotMatch(tab, new RegExp(`['"]${skip}['"]`), `${skip} stays out of compute-tab set`);
  assert.doesNotMatch(apiDocs, new RegExp(`['"]${skip}['"]`), `${skip} stays out of api-docs set`);
}
assert.doesNotMatch(tab, /['"]\/v1\/chat\/completions['"]/, 'do not invent /v1/chat/completions on compute-tab');
assert.doesNotMatch(apiDocs, /['"]\/v1\/chat\/completions['"]/, 'do not invent /v1/chat/completions on api-docs');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const COMPUTE = `${WWW}/compute`;
const API = `${WWW}/compute/api`;
const PRIVACY = `${WWW}/privacy`;

function variants(leaf, prefix = '') {
  const base = `${prefix}/${leaf}`;
  const titleLeaf = `${leaf[0].toUpperCase()}${leaf.slice(1)}`;
  return [
    base, `${base}/`,
    `${prefix}/${titleLeaf}`,
    `${prefix}/${leaf.toUpperCase()}`,
    `${prefix}/${titleLeaf}/`,
  ];
}

const TO_COMPUTE = COMPUTE_LEAVES.flatMap((leaf) => [
  ...variants(leaf),
  ...variants(leaf, '/compute'),
  ...[`/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`, `/Compute/${leaf}/`],
]);
const TO_API = API_LEAVES.flatMap((leaf) => [
  ...variants(leaf),
  ...variants(leaf, '/compute'),
  ...[`/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`, `/Compute/${leaf}/`],
]);
const PRIOR_COMPUTE_PEERS = [
  '/run', '/ollama', '/m4', '/getstarted', '/hello',
];
const PRIOR_API_PEERS = [
  '/docs', '/docs/', '/Docs',
  '/sdk', '/cli', '/endpoint',
];
const STAY_200 = ['/compute', '/privacy', '/price'];
const SKIP_404 = [
  '/arcade', '/arcade/', '/Arcade',
  '/games', '/games/', '/Games',
  '/openai', '/openai/', '/OpenAI',
  '/anthropic', '/anthropic/', '/Anthropic',
  '/v1', '/v1/',
  '/api/v1', '/api/v1/',
  '/status', '/status/',
  '/health', '/health/',
  '/healthz', '/healthz/',
  '/network', '/network/',
  '/x402', '/x402/',
  '/attestation', '/attestation/',
  '/blog', '/blog/',
  '/news', '/news/',
  '/faq', '/faq/',
  '/waitlist', '/waitlist/',
  '/tos', '/tos/',
  '/legal', '/legal/',
  '/discord', '/discord/',
  '/slack', '/slack/',
  '/admin', '/admin/',
  '/deposit', '/deposit/',
  '/sell', '/sell/',
  '/jupiter', '/jupiter/',
  '/raydium', '/raydium/',
  '/git', '/git/',
  '/about', '/about/',
  '/metrics', '/metrics/',
  '/ping', '/ping/',
];
const CANARY = ['/price', '/privacy', '/arcade', '/openai', '/anthropic'];

for (const path of TO_COMPUTE) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
  assert.notEqual(potterHome308Dest(path), API, `${path} is not /compute/api`);
  assert.notEqual(potterHome308Dest(path), PRIVACY, `${path} is not /privacy`);
}
for (const path of TO_API) {
  assert.equal(potterHome308Dest(path), API, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not bare /compute`);
}
for (const path of PRIOR_COMPUTE_PEERS) {
  assert.equal(potterHome308Dest(path), COMPUTE, `peer ${path}`);
}
for (const path of PRIOR_API_PEERS) {
  assert.equal(potterHome308Dest(path), API, `peer ${path}`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays JSON');
assert.equal(potterHome308Dest('/compute/api/'), null, '/compute/api/ stays JSON');
assert.equal(potterHome308Dest('/v1/chat/completions'), null, 'do not invent /v1/chat/completions');
assert.equal(potterHome308Dest('/compute/api/v1/chat/completions'), null, 'exact /compute/api/v1/chat/completions stays handler');
for (const path of SKIP_404) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}
for (const path of CANARY) {
  assert.equal(potterHome308Dest(path), null, `canary ${path} stays null dest`);
}

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  const u = new URL(dest);
  if (u.pathname === '/compute/api' || u.pathname.startsWith('/compute/api/')) {
    return LOBBY + u.pathname;
  }
  return dest;
}

const FETCH_COMPUTE = [
  '/lmstudio', '/lmstudio/', '/Lmstudio', '/LM-STUDIO',
  '/lm-studio', '/lm_studio', '/openwebui', '/open-webui', '/open_webui',
  '/webui', '/Webui/', '/claude', '/Claude', '/m3', '/gettingstarted',
  '/hi', '/welcome', '/Welcome/',
  '/compute/lmstudio', '/Compute/openwebui/', '/compute/claude',
  '/compute/m3', '/compute/hi',
];
const FETCH_API = [
  '/base-url', '/base-url/', '/Base-url',
  '/baseurl', '/base_url', '/chat-completions', '/chatcompletions',
  '/chat_completions', '/embeddings', '/embedding', '/responses',
  '/response', '/completion', '/COMPLETION',
  '/compute/base-url', '/Compute/embeddings/', '/compute/completion',
];

const env = {
  LOBBY_SESSION_SECRET: 'lmstudio-openwebui-claude-pretty-path-secret',
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
  for (const path of FETCH_COMPUTE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of FETCH_API) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, API), `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not bare /compute`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
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
  for (const method of ['GET', 'HEAD']) {
    const api = await edgeWorker.fetch(new Request(`https://${host}/compute/api`, { method }), env);
    assert.equal(api.status, 200, `${host} /compute/api ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await api.text(), '');
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
  for (const path of [...CANARY, ...SKIP_404.filter((p) => !CANARY.includes(p))]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(potterHome308Dest(path), null, `${host} ${path} dest stays null`);
      assert.notEqual(res.status, 308, `${host} ${path} ${method} is not a leftover 308`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), PRIVACY, `${host} ${path} ${method} not folded to privacy`);
    }
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/compute<\/loc>/);
for (const path of [
  ...COMPUTE_LEAVES.map((leaf) => `/${leaf}`),
  ...API_LEAVES.map((leaf) => `/${leaf}`),
  '/arcade', '/games', '/openai', '/anthropic', '/v1',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-lmstudio-openwebui-claude-pretty-path: PASS (/lmstudio+/lm-studio+/lm_studio+/openwebui+/open-webui+/open_webui+/webui+/claude+/m3+/gettingstarted+/hi+/welcome + /compute/* tabs 308 /compute; /base-url+/chat-completions+/embeddings+/responses+/completion + /compute/* tabs 308 /compute/api; Title-case+slash; www+lobby GET+HEAD; /compute+/compute/api+/privacy+/price 200; canary /price+/privacy+/arcade+/openai+/anthropic stay out; no plugin.jup.ag)');
