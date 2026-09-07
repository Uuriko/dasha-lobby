#!/usr/bin/env node
/**
 * Leftover pretty path (Worker a17b9472-6f4e-4a6f-9cfd-3dd677ff495c):
 * live /windsurf /aider /continue /zed (+slash / Title-case / /compute/* tabs)
 * html-404 → 308 https://www.getdasha.com/compute.
 * Peers of live /vscode /cursor /copilot /chatgpt (already 308→/compute).
 * /continue is the Continue.dev IDE door (OAuth ?continue=1 query is unrelated).
 * Exact /compute /privacy stay 200 (null dest). Bare /price stays the 200
 * JSON token-price API. Skip intentional 404s: /code /terminal /emacs /vim
 * /neovim /jetbrains /codeium /tabnine /openai /arcade /x402 — do not invent
 * a fold. Disk only. No Designer. Never plugin.jup.ag.
 * PR-mirror only — no wrangler deploy.
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

assert.match(
  workerSrc,
  /Never fold \/price \(200 JSON\) or \/privacy \(200\)/,
  'leftover comment keeps /price and /privacy as 200s',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const NEW_LEAVES = ['windsurf', 'aider', 'continue', 'zed'];
const PEER_LEAVES = ['vscode', 'cursor', 'chatgpt', 'copilot'];
for (const leaf of [...NEW_LEAVES, ...PEER_LEAVES]) {
  assert.match(tab, new RegExp(`["']/${leaf}["']`));
  assert.match(tab, new RegExp(`["']/${leaf}/["']`));
  assert.match(tab, new RegExp(`["']/compute/${leaf}["']`));
  assert.match(tab, new RegExp(`["']/compute/${leaf}/["']`));
}

const SKIPS = [
  '/code', '/terminal', '/emacs', '/vim', '/neovim',
  '/jetbrains', '/codeium', '/tabnine', '/openai', '/arcade', '/x402',
  '/price', '/privacy',
];
for (const skip of SKIPS) {
  assert.doesNotMatch(tab, new RegExp(`['"]${skip}['"]`), `${skip} stays out of compute-tab set`);
}
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const COMPUTE = `${WWW}/compute`;
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

const TO_COMPUTE = NEW_LEAVES.flatMap((leaf) => [
  ...variants(leaf),
  ...variants(leaf, '/compute'),
  ...[`/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`, `/Compute/${leaf}/`],
]);
const PEER_PATHS = PEER_LEAVES.flatMap((leaf) => [
  ...variants(leaf),
  ...variants(leaf, '/compute'),
  ...[`/Compute/${leaf}`, `/COMPUTE/${leaf.toUpperCase()}`, `/Compute/${leaf}/`],
]);
const STAY_200 = ['/compute', '/privacy', '/privacy/', '/price', '/price/'];
const SKIP_404 = [
  '/code', '/code/', '/Code',
  '/terminal', '/terminal/', '/Terminal',
  '/emacs', '/emacs/', '/Emacs',
  '/vim', '/vim/', '/Vim',
  '/neovim', '/neovim/', '/Neovim',
  '/jetbrains', '/jetbrains/', '/Jetbrains',
  '/codeium', '/codeium/', '/Codeium',
  '/tabnine', '/tabnine/', '/Tabnine',
  '/openai', '/openai/', '/OpenAI',
  '/arcade', '/arcade/', '/Arcade',
  '/x402', '/x402/',
];

for (const path of [...TO_COMPUTE, ...PEER_PATHS]) {
  assert.equal(potterHome308Dest(path), COMPUTE, path);
  assert.notEqual(potterHome308Dest(path), PRIVACY, `${path} is not /privacy`);
}
assert.equal(potterHome308Dest('/vscode'), COMPUTE, 'peer /vscode still 308');
assert.equal(potterHome308Dest('/cursor'), COMPUTE, 'peer /cursor still 308');
assert.equal(potterHome308Dest('/Vscode'), COMPUTE, 'peer /Vscode Title-case still 308');
assert.equal(potterHome308Dest('/Cursor'), COMPUTE, 'peer /Cursor Title-case still 308');
assert.equal(potterHome308Dest('/compute/vscode'), COMPUTE, 'peer /compute/vscode still 308');
assert.equal(potterHome308Dest('/compute/cursor'), COMPUTE, 'peer /compute/cursor still 308');
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200 handler`);
}
for (const path of SKIP_404) {
  assert.equal(potterHome308Dest(path), null, `do not fold ${path}`);
}
assert.equal(potterHome308Dest('/compute/'), COMPUTE, '/compute/ still folds to /compute');
assert.equal(potterHome308Dest('/oauth/x/start'), null, 'OAuth start path is not the /continue IDE door');

const FETCH_NEW = [
  '/windsurf', '/windsurf/', '/Windsurf', '/WINDSURF', '/WiNdSuRf/',
  '/aider', '/aider/', '/Aider', '/AIDER',
  '/continue', '/continue/', '/Continue', '/CONTINUE',
  '/zed', '/zed/', '/Zed', '/ZED',
  '/compute/windsurf', '/compute/windsurf/', '/Compute/windsurf', '/COMPUTE/WINDSURF',
  '/compute/aider', '/Compute/aider/',
  '/compute/continue', '/Compute/Continue/',
  '/compute/zed', '/COMPUTE/ZED',
];
const FETCH_PEERS = [
  '/vscode', '/vscode/', '/Vscode', '/VSCODE',
  '/cursor', '/cursor/', '/Cursor', '/CURSOR',
  '/chatgpt', '/ChatGPT',
  '/copilot', '/Copilot/',
  '/compute/vscode', '/compute/cursor',
];

const env = {
  LOBBY_SESSION_SECRET: 'windsurf-aider-continue-zed-pretty-path-secret',
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
  for (const path of [...FETCH_NEW, ...FETCH_PEERS]) {
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
      assert.equal(potterHome308Dest(path), null, `${host} ${path} dest stays null`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not folded to compute`);
      assert.notEqual(res.headers.get('location'), PRIVACY, `${host} ${path} ${method} not folded to privacy`);
      if (res.status === 308) {
        assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} 308 dest is not /compute`);
      }
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const oauth = await edgeWorker.fetch(new Request(`https://${host}/oauth/x/start?continue=1`, { method }), env);
    assert.notEqual(oauth.headers.get('location'), COMPUTE, `${host} /oauth/x/start?continue=1 ${method} is not the /continue IDE door`);
    const ideContinue = await edgeWorker.fetch(new Request(`https://${host}/continue?continue=1`, { method }), env);
    assert.equal(ideContinue.status, 308, `${host} /continue?continue=1 ${method}`);
    assert.equal(ideContinue.headers.get('location'), COMPUTE, `${host} /continue?continue=1 ${method} loc`);
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/compute<\/loc>/);
for (const path of [
  '/windsurf', '/aider', '/continue', '/zed',
  '/vscode', '/cursor', '/chatgpt', '/copilot',
  '/code', '/terminal', '/emacs', '/vim', '/neovim',
  '/jetbrains', '/codeium', '/tabnine', '/openai', '/arcade', '/x402',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-windsurf-aider-continue-zed-pretty-path: PASS (/windsurf+/aider+/continue+/zed + /compute/* tabs 308 /compute; peer /vscode+/cursor+/chatgpt+/copilot still 308; Title-case+slash; www+lobby GET+HEAD; /compute+/privacy+/price 200; skip /code+/terminal+/emacs+/vim+/neovim+/jetbrains+/codeium+/tabnine+/openai+/arcade+/x402; OAuth ?continue=1 unrelated; no plugin.jup.ag)');
