#!/usr/bin/env node
/**
 * Quiet Discord-style topic chips on /lobby threads.
 * Fixed 5 tags. Optional. No freeform, no people-data, no Room merge.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORUM_TAGS,
  FORUM_TAG_ERROR,
  filterThreadsByTag,
  newThread,
  publicThread,
  searchThreads,
  validateForumTag,
} from './dasha-forum.mjs';
import edgeWorker, {
  asStandaloneLobbyPage,
  forumIndexPageHtml,
  forumTagFilterHtml,
  forumThreadPageHtml,
  injectLobbyForumTagCss,
  rewriteLobbyForumChrome,
} from './dasha-lobby-worker.mjs';
import { LOBBY_CLIENT_JS, LOBBY_CLIENT_SRI, LOBBY_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const forumSrc = readFileSync(join(root, 'dasha-forum.mjs'), 'utf8');
const pageSrc = readFileSync(join(root, 'dasha-lobby-page.html'), 'utf8');
const docs = readFileSync(join(root, 'LOBBY-FORUM-TAGS.md'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.deepEqual(FORUM_TAGS, ['trade', 'meme', 'help', 'play', 'news']);
assert.equal(FORUM_TAGS.length, 5);
assert.equal(validateForumTag('').ok, true);
assert.equal(validateForumTag('').tag, null);
assert.equal(validateForumTag(null).tag, null);
assert.equal(validateForumTag('  Meme  ').tag, 'meme');
assert.equal(validateForumTag('trade').tag, 'trade');
assert.equal(validateForumTag('help').ok, true);
assert.equal(validateForumTag('play').ok, true);
assert.equal(validateForumTag('news').ok, true);
assert.equal(validateForumTag('freeform').ok, false);
assert.equal(validateForumTag('freeform').error, FORUM_TAG_ERROR);
assert.equal(validateForumTag('@dash_eats').ok, false);
assert.equal(validateForumTag('53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump').ok, false);
assert.equal(validateForumTag(['meme']).ok, false);
assert.equal(validateForumTag({ tag: 'meme' }).ok, false);

const base = {
  title: 'hello room',
  text: 'just a thread',
  handle: 'dash_eats',
  now: 1_700_000_000_000,
  id: 't1',
};
const tagged = newThread({ ...base, tag: 'meme' });
assert.equal(tagged.ok, true);
assert.equal(tagged.summary.tag, 'meme');
assert.equal(publicThread(tagged.summary).tag, 'meme');

const plain = newThread(base);
assert.equal(plain.ok, true);
assert.equal(plain.summary.tag, undefined);
assert.equal(publicThread(plain.summary).tag, null);

const bad = newThread({ ...base, tag: 'spam-me' });
assert.equal(bad.ok, false);
assert.equal(bad.error, FORUM_TAG_ERROR);

const index = [
  { id: 'a', title: 'chart', handle: 'dash_eats', snippet: 'jup.ag', tag: 'trade', lastTs: 2 },
  { id: 'b', title: 'lol', handle: 'dash_eats', snippet: 'cat', tag: 'meme', lastTs: 1 },
  { id: 'c', title: 'no chip', handle: 'dash_eats', snippet: 'plain' },
];
assert.deepEqual(filterThreadsByTag(index, 'meme').map((t) => t.id), ['b']);
assert.deepEqual(filterThreadsByTag(index, '').map((t) => t.id), ['a', 'b', 'c']);
assert.deepEqual(filterThreadsByTag(index, 'nope'), []);
assert.equal(searchThreads(index, 'meme').some((t) => t.id === 'b'), true);

const filters = forumTagFilterHtml('meme');
assert.match(filters, /aria-label="Thread tags"/);
assert.match(filters, /href="\/lobby\?tag=meme#threads"/);
assert.match(filters, /href="\/lobby#threads"/);
assert.match(filters, /aria-current="page">meme</);
assert.doesNotMatch(filters, /freeform|fingerprint|plugin\.jup\.ag|\/room/);
for (const tag of FORUM_TAGS) assert.match(filters, new RegExp(`>${tag}<`));

const painted = forumIndexPageHtml('<div id="dasha-forum"><p class="forum-empty">None yet.</p></div>', [
  { id: 'tmeme', title: 'cat pic', handle: 'dash_eats', tag: 'meme', replies: 0, ts: 1 },
  { id: 'ttrade', title: 'jup route', handle: 'dash_eats', tag: 'trade', replies: 1, ts: 2 },
], { tag: 'meme' });
assert.match(painted, /class="df-tag" aria-label="Tag meme">meme</);
assert.match(painted, /cat pic/);
assert.doesNotMatch(painted, /jup route/);
assert.doesNotMatch(painted, /forum-empty">None yet/);

const allPaint = forumIndexPageHtml('<div id="dasha-forum"></div>', [
  { id: 'tmeme', title: 'cat pic', handle: 'dash_eats', tag: 'meme', replies: 0, ts: 1 },
]);
assert.match(allPaint, /cat pic/);
assert.match(allPaint, /class="df-tag" aria-label="Tag meme">meme</);
assert.match(allPaint, /Start the first thread|df-list/);

const threadHtml = forumThreadPageHtml(
  '<div id="dasha-forum"></div>',
  { id: 'tmeme', title: 'cat pic', handle: 'dash_eats', tag: 'meme' },
  [{ id: 'tmeme-0', handle: 'dash_eats', text: 'hi', ts: 1 }],
);
assert.match(threadHtml, /<h2 class="df-title">cat pic<\/h2><span class="df-tag" aria-label="Tag meme">meme<\/span>/);

const css = injectLobbyForumTagCss('<html><head></head><body></body></html>');
assert.match(css, /id="dasha-forum-tags"/);
assert.equal(injectLobbyForumTagCss(css), css, 'inject is idempotent');

const rewritten = rewriteLobbyForumChrome(`<!doctype html><html><head><title>Forum — $dasha</title></head><body><h1>Forum</h1><div id="dasha-forum"></div></body></html>`);
assert.match(rewritten, /id="dasha-forum-tags"/);
assert.match(rewritten, /<h1>Lobby<\/h1>/);
assert.match(asStandaloneLobbyPage(LOBBY_PAGE_HTML), /id="dasha-forum-tags"/);

assert.match(LOBBY_CLIENT_JS, /var FORUM_TAGS=\['trade','meme','help','play','news'\]/);
assert.match(LOBBY_CLIENT_JS, /aria-label','Optional tag'/);
assert.match(LOBBY_CLIENT_JS, /aria-label','Thread tags'/);
assert.match(LOBBY_CLIENT_JS, /if\(tag\)payload\.tag=tag/);
assert.match(LOBBY_CLIENT_JS, /params\.set\('tag',lastTag\)/);
assert.match(LOBBY_CLIENT_JS, /readTagQuery\(\)/);
assert.doesNotMatch(LOBBY_CLIENT_JS, /plugin\.jup\.ag/);
assert.doesNotMatch(LOBBY_CLIENT_JS, /fingerprint|Project Room|\/room\b/);

const sri = 'sha384-' + createHash('sha384').update(LOBBY_CLIENT_JS, 'utf8').digest('base64');
assert.equal(LOBBY_CLIENT_SRI, sri);
assert.match(pageSrc, new RegExp(sri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(LOBBY_PAGE_HTML, new RegExp(sri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.match(workerSrc, /injectLobbyForumTagCss/);
assert.match(workerSrc, /tag: input\?\.tag/);
assert.match(workerSrc, /url\.searchParams\.get\('tag'\)/);
assert.match(forumSrc, /FORUM_TAGS/);
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(forumSrc, /plugin\.jup\.ag/);
assert.match(docs, /Stay off/);
assert.match(docs, /plugin\.jup\.ag/);
assert.match(docs, /Room merge/);
assert.match(docs, /\/lobby/);
assert.match(docs, /`trade` \/ `meme` \/ `help` \/ `play` \/ `news`/);
assert.match(docs, /Instinct deploys/);
assert.doesNotMatch(docs, /https:\/\/plugin\.jup\.ag/);
assert.match(workerSrc, new RegExp(MINT));

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const lobby = await edgeWorker.fetch(new Request(`${origin}/lobby`), {});
  assert.equal(lobby.status, 200, `${origin}/lobby`);
  const html = await lobby.text();
  assert.match(html, /id=["']dasha-forum-tags["']/, `${origin} tag CSS`);
  assert.match(html, /id=["']dasha-forum["']/, `${origin} threads`);
  assert.match(html, /id=["']forum-play-go["']/, `${origin} Play`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(html, /Project Room|\/room\b/);
  const forum = await edgeWorker.fetch(new Request(`${origin}/forum`), {});
  assert.equal(forum.status, 308, `${origin}/forum still 308`);
}

console.log('dasha-lobby-forum-tags: PASS (fixed 5 lobby tags; optional create; filter + first-paint chips; no freeform / Room / plugin.jup.ag)');
