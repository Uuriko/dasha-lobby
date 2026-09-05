#!/usr/bin/env node
/**
 * Leftover Title-case /Forum /Chat + machine files (/Llms.txt /Robots.txt /Sitemap.xml
 * /Ai.txt /Llms-Full.txt) html-404 while lowercase siblings work.
 * Forum/Chat must 308 via forumToLobbyRedirect (keep ?t=) — NOT potterHome308Dest.
 * Machine files 308 via potterHome308Dest / POTTER_PRODUCT_CASEFOLD_DEST.
 * Exact lowercase stays 200. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  potterHome308Dest,
  isForumChatAliasPath,
  forumToLobbyRedirect,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /isForumChatAliasPath/, 'forum/chat casefold helper');
assert.match(workerSrc, /Machine files \(\/Llms\.txt \/Robots\.txt/, 'machine case-fold comment');
assert.match(workerSrc, /\[\'\/llms\.txt\'/, 'llms.txt in product casefold map');
assert.match(workerSrc, /\[\'\/robots\.txt\'/, 'robots.txt in product casefold map');
assert.match(workerSrc, /\[\'\/sitemap\.xml\'/, 'sitemap.xml in product casefold map');
assert.doesNotMatch(
  workerSrc,
  /POTTER_PRODUCT_CASEFOLD_DEST = new Map\(\[[^\]]*\[\'\/forum\'/,
  'forum must NOT be in potterHome308Dest map',
);

// Helper
for (const p of ['/forum', '/forum/', '/chat', '/chat/', '/Forum', '/FORUM', '/Chat', '/CHAT', '/FoRuM/']) {
  assert.equal(isForumChatAliasPath(p), true, p);
}
assert.equal(isForumChatAliasPath('/lobby'), false);
assert.equal(isForumChatAliasPath('/forum/threads'), false);

// Machine files via potterHome308Dest — Title-case 308, exact lowercase null
const MACHINE = [
  ['/llms.txt', 'https://www.getdasha.com/llms.txt'],
  ['/llms-full.txt', 'https://www.getdasha.com/llms-full.txt'],
  ['/ai.txt', 'https://www.getdasha.com/ai.txt'],
  ['/robots.txt', 'https://www.getdasha.com/robots.txt'],
  ['/sitemap.xml', 'https://www.getdasha.com/sitemap.xml'],
];
for (const [canon, dest] of MACHINE) {
  const slug = canon.slice(1);
  const title = `/${slug[0].toUpperCase()}${slug.slice(1)}`;
  const upper = `/${slug.toUpperCase()}`;
  assert.equal(potterHome308Dest(title), dest, title);
  assert.equal(potterHome308Dest(upper), dest, upper);
  assert.equal(potterHome308Dest(canon), null, `${canon} stays 200`);
}
assert.equal(potterHome308Dest('/Llms.txt'), 'https://www.getdasha.com/llms.txt');
assert.equal(potterHome308Dest('/LLMS.TXT'), 'https://www.getdasha.com/llms.txt');
assert.equal(potterHome308Dest('/Llms-Full.txt'), 'https://www.getdasha.com/llms-full.txt');
assert.equal(potterHome308Dest('/LLMS-FULL.TXT'), 'https://www.getdasha.com/llms-full.txt');
assert.equal(potterHome308Dest('/Robots.txt'), 'https://www.getdasha.com/robots.txt');
assert.equal(potterHome308Dest('/Sitemap.xml'), 'https://www.getdasha.com/sitemap.xml');
assert.equal(potterHome308Dest('/SITEMAP.XML'), 'https://www.getdasha.com/sitemap.xml');
assert.equal(potterHome308Dest('/Ai.txt'), 'https://www.getdasha.com/ai.txt');

// Forum/Chat must NOT go through potterHome308Dest (would drop ?t=)
for (const p of ['/Forum', '/FORUM', '/Chat', '/CHAT', '/forum', '/chat']) {
  assert.equal(potterHome308Dest(p), null, `${p} not in potterHome308Dest`);
}

// forumToLobbyRedirect keeps ?t=
{
  const res = forumToLobbyRedirect(new URL('https://www.getdasha.com/Forum?t=abc'));
  assert.equal(res.status, 308);
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://www.getdasha.com/lobby');
  assert.equal(loc.searchParams.get('t'), 'abc');
  assert.equal(loc.hash, '#threads');
}

const LOBBY = 'https://www.getdasha.com/lobby';
const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/Forum', '/FORUM', '/Chat', '/CHAT', '/forum', '/chat', '/Forum/', '/Chat/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const loc = res.headers.get('location');
      assert.ok(loc === LOBBY || loc.startsWith(LOBBY + '?') || loc.startsWith(LOBBY + '#'), `${host} ${path} loc=${loc}`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  // ?t= preserved on Title-case Forum
  const withT = await edgeWorker.fetch(new Request(`https://${host}/Forum?t=testthread`), env);
  assert.equal(withT.status, 308, `${host} /Forum?t=`);
  const locT = new URL(withT.headers.get('location'));
  assert.equal(locT.origin + locT.pathname, LOBBY);
  assert.equal(locT.searchParams.get('t'), 'testthread');
  assert.equal(locT.hash, '#threads');

  const lowerT = await edgeWorker.fetch(new Request(`https://${host}/forum?t=abc`), env);
  assert.equal(lowerT.status, 308);
  const locL = new URL(lowerT.headers.get('location'));
  assert.equal(locL.searchParams.get('t'), 'abc');
  assert.equal(locL.hash, '#threads');

  // Machine Title-case 308
  for (const [canon, dest] of MACHINE) {
    const slug = canon.slice(1);
    const title = `/${slug[0].toUpperCase()}${slug.slice(1)}`;
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${title}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${title} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${title} loc`);
    }
    const lower = await edgeWorker.fetch(new Request(`https://${host}${canon}`), env);
    assert.equal(lower.status, 200, `${host} ${canon} stays 200`);
  }
  // Extra known Title forms
  for (const [path, dest] of [
    ['/Llms.txt', 'https://www.getdasha.com/llms.txt'],
    ['/Robots.txt', 'https://www.getdasha.com/robots.txt'],
    ['/Sitemap.xml', 'https://www.getdasha.com/sitemap.xml'],
  ]) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(res.status, 308, `${host} ${path}`);
    assert.equal(res.headers.get('location'), dest);
  }
}

// www lowercase edges
for (const [path, edge] of [
  ['/llms.txt', 'llms'],
  ['/llms-full.txt', 'llms-full'],
  ['/ai.txt', 'ai'],
  ['/robots.txt', 'robots'],
  ['/sitemap.xml', 'sitemap'],
]) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), env);
  assert.equal(res.status, 200, path);
  assert.equal(res.headers.get('x-dasha-edge'), edge, `${path} edge`);
}

console.log('dasha-forum-chat-machine-casefold-pretty-path: PASS (Forum/Chat Title-case 308+?t=, machine files casefold, lowercase 200)');
