#!/usr/bin/env node
/**
 * Quiet Lobby → Compute challenge cards.
 * Below first chat paint, before Play. Links into existing Compute doors.
 * Disk + worker inject. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  asStandaloneLobbyPage,
  forumIndexPageHtml,
  injectLobbyComputeActs,
  LOBBY_ACTS_HTML,
  rewriteLobbyForumChrome,
} from './dasha-lobby-worker.mjs';
import { LOBBY_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const lobbyDisk = readFileSync(join(root, 'dasha-lobby-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

const ACTS = [
  { key: 'provide', href: 'https://www.getdasha.com/compute#provide', copy: 'Provide' },
  { key: 'ask', href: 'https://www.getdasha.com/compute#ask', copy: 'Ask' },
  { key: 'build', href: 'https://www.getdasha.com/compute#build', copy: 'Build' },
];

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

function pinInner(html) {
  const vis = afterStyleScript(html);
  const pin = vis.match(/<p\b[^>]*\bclass=["'][^"']*\bforum-pin\b[^>]*>[\s\S]*?<\/p>/i);
  return pin ? pin[0] : '';
}

function assertActs(html, label) {
  const vis = afterStyleScript(html);
  assert.match(html, /id=["']dasha-lobby-acts["']/, `${label} acts CSS`);
  assert.match(vis, /id=["']lobby-acts["']/, `${label} #lobby-acts`);
  assert.match(html, /prefers-reduced-motion/, `${label} reduced-motion`);
  assert.equal(
    (vis.match(/\bdata-lobby-act=/g) || []).length,
    3,
    `${label} three cards`,
  );
  for (const act of ACTS) {
    assert.match(
      vis,
      new RegExp(`data-lobby-act="${act.key}"[^>]*href="${act.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
      `${label} ${act.key} href`,
    );
    assert.match(vis, new RegExp(`>${act.copy}<`), `${label} ${act.key} copy`);
  }
  const chatAt = html.indexOf('id="dasha-lobby"');
  const actsAt = html.indexOf('id="lobby-acts"');
  const playAt = html.indexOf('class="forum-play"');
  const thAt = html.indexOf('id="dasha-forum"');
  assert.ok(
    chatAt >= 0 && actsAt > chatAt && playAt > actsAt && thAt > playAt,
    `${label} chat then acts then Play then threads`,
  );
  assert.doesNotMatch(pinInner(html), /compute/, `${label} pin stays mint, no Compute`);
  assert.doesNotMatch(pinInner(html), /Buy|Chess|jup\.ag/, `${label} pin no Buy/Chess dump`);
  assert.doesNotMatch(html, /id=["']compute-door["']/, `${label} no compute-door`);
  assert.doesNotMatch(html, /nav-drop|hamburger|>Menu</, `${label} no hamburger`);
  assert.doesNotMatch(html, /disclaimer/i, `${label} no disclaimer`);
  assert.doesNotMatch(html, /three(?:\.min)?\.js|from ['"]three['"]/, `${label} no Three.js`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
  assert.doesNotMatch(vis, /Provide once today|Ask with a guest key/, `${label} no chatty act ledes`);
  assert.match(vis, />Dasha vs Anna\.</, `${label} Play lede`);
  assert.doesNotMatch(vis, /Dasha vs Anna in the room/, `${label} no Play essay`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} Play`);
}

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function injectLobbyComputeActs/);
assert.match(workerSrc, /out = injectLobbyComputeActs\(out\);/);
assert.match(LOBBY_ACTS_HTML, /compute#provide/);
assert.match(LOBBY_ACTS_HTML, /compute#ask/);
assert.match(LOBBY_ACTS_HTML, /compute#build/);

assertActs(lobbyDisk, 'disk source');
assertActs(asStandaloneLobbyPage(lobbyDisk), 'standalone disk');
assertActs(asStandaloneLobbyPage(LOBBY_PAGE_HTML), 'standalone bundled');
assertActs(rewriteLobbyForumChrome(LOBBY_PAGE_HTML), 'rewrite bundled');

const bare = `<!doctype html><html><head><title>$dasha Lobby</title></head><body>
<h1>Lobby</h1>
<div id="dasha-lobby"></div>
<section class="forum-play" aria-label="Play"><button type="button" id="forum-play-go">Play</button></section>
<div id="dasha-forum"></div>
</body></html>`;
const injected = injectLobbyComputeActs(bare);
assert.match(injected, /id=["']lobby-acts["']/, 'inject bare #lobby-acts');
assert.match(injected, /id=["']dasha-lobby-acts["']/, 'inject bare CSS');
assert.match(injected, /compute#provide/, 'inject bare provide');
assert.match(injected, /compute#ask/, 'inject bare ask');
assert.match(injected, /compute#build/, 'inject bare build');
assert.equal((afterStyleScript(injected).match(/\bdata-lobby-act=/g) || []).length, 3, 'inject bare three cards');
assert.ok(injected.indexOf('id="lobby-acts"') > injected.indexOf('id="dasha-lobby"'), 'inject bare after chat');
assert.ok(injected.indexOf('class="forum-play"') > injected.indexOf('id="lobby-acts"'), 'inject bare before Play');
assert.equal(injectLobbyComputeActs(injected), injected, 'inject is idempotent');
assert.equal(
  injectLobbyComputeActs('<html><body><h1>Home</h1></body></html>'),
  '<html><body><h1>Home</h1></body></html>',
  'inject skips non-lobby',
);

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const lobby = await edgeWorker.fetch(new Request(`${origin}/lobby`), {});
  assert.equal(lobby.status, 200, `${origin}/lobby`);
  assert.equal(lobby.headers.get('x-dasha-edge'), 'lobby-page');
  const html = await lobby.text();
  assertActs(html, `served ${origin}/lobby`);
}

{
  const painted = forumIndexPageHtml(lobbyDisk, []);
  assert.match(painted, /Link X to post\./, 'threads lede');
  assert.doesNotMatch(painted, /Official room\. Read freely/, 'no Official-room essay');
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /id=["']lobby-acts["']/, 'home has no lobby acts');
  assert.doesNotMatch(html, /id=["']compute-door["']/, 'home no compute-door');
}

{
  const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
  assert.equal(studio.status, 308);
  assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');
}

console.log('dasha-lobby-compute-acts: PASS (3 Compute cards after chat; #provide #ask #build; no hamburger / disclaimer / Three / plugin.jup.ag)');
