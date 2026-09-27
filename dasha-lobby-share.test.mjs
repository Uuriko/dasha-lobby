#!/usr/bin/env node
/** /lobby share card: the room, Chat + Play + Fill the jar / Buy. Disk only. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  LOBBY_DESC,
  LOBBY_TITLE,
  asStandaloneLobbyPage,
} from './dasha-lobby-worker.mjs';
import { LOBBY_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const pageSrc = readFileSync(join(root, 'dasha-lobby-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const TG = 'https://t.me/+xB7S8mIQaKFiZjRh';
const CARD = 'Chat. Play. Fill the jar. Buy.';

assert.equal(LOBBY_TITLE, '$dasha Lobby');
assert.equal(LOBBY_DESC, CARD);

function assertShare(html, label) {
  assert.match(html, /<title>\$dasha Lobby<\/title>/, `${label} title`);
  assert.match(html, /property="og:title" content="\$dasha Lobby"/, `${label} og:title`);
  assert.match(html, /property="og:description" content="Chat\. Play\. Fill the jar\. Buy\."/, `${label} og:desc`);
  assert.match(html, /property="og:url" content="https:\/\/www\.getdasha\.com\/lobby"/, `${label} og:url`);
  assert.match(html, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/, `${label} og:image`);
  assert.match(html, /name="twitter:card" content="summary_large_image"/, `${label} twitter:card`);
  assert.match(html, /name="twitter:title" content="\$dasha Lobby"/, `${label} twitter:title`);
  assert.match(html, /name="twitter:description" content="Chat\. Play\. Fill the jar\. Buy\."/, `${label} twitter:desc`);
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  assert.doesNotMatch(head, /Studio|\/studio/i, `${label} no Studio on card`);
  assert.doesNotMatch(head, /Compute|\/compute/i, `${label} no Compute on card`);
  assert.doesNotMatch(head, /plugin\.jup\.ag/, `${label} no plugin.jup`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup body`);
  assert.match(html, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  if (/t\.me\//.test(html)) {
    assert.match(html, new RegExp(TG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} official TG`);
    assert.doesNotMatch(html, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/, `${label} no other TG`);
  }
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} H1`);
  assert.match(html, /id="dasha-lobby"/, `${label} chat`);
  assert.match(html, /<h2>Play<\/h2>/, `${label} Play`);
  assert.match(html, /id="threads-title">Threads<\/h2>/, `${label} threads`);
  const chatAt = html.indexOf('id="dasha-lobby"');
  const playAt = html.indexOf('class="forum-play"');
  const thAt = html.indexOf('id="dasha-forum"');
  assert.ok(chatAt >= 0 && playAt > chatAt && thAt > playAt, `${label} chat then Play then threads`);
  assert.doesNotMatch(html, /<h1>Forum<\/h1>/, `${label} no Forum product`);
}

assertShare(pageSrc, 'disk source');
assertShare(asStandaloneLobbyPage(LOBBY_PAGE_HTML), 'bundled');
assertShare(asStandaloneLobbyPage(pageSrc), 'standalone source');

const lobby = await edgeWorker.fetch(new Request('https://www.getdasha.com/lobby'), {});
assert.equal(lobby.status, 200);
assert.equal(lobby.headers.get('x-dasha-edge'), 'lobby-page');
const body = await lobby.text();
assertShare(body, 'served /lobby');

const slash = await edgeWorker.fetch(new Request('https://www.getdasha.com/lobby/'), {});
assert.equal(slash.status, 200);

const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
assert.equal(forum.status, 308);
assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');

const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
assert.equal(studio.status, 308);
assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');

console.log('dasha-lobby-share: PASS (room OG Chat+Play+Fill the jar+Buy, /forum 308, one room, no Studio/Compute on card)');
