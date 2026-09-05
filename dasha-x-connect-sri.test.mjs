#!/usr/bin/env node
/**
 * Lobby + chess were shipping a stale x-connect SRI (TfilU2…).
 * Live /client/x-connect.js is X_CONNECT_SRI. Browsers block the stale pin.
 * Disk only. No static-gen. No wrangler.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHESS_PAGE_HTML,
  HOME_HTML,
  LOBBY_PAGE_HTML,
  X_CONNECT_JS,
  X_CONNECT_SRI,
} from './dasha-lobby-static-gen.mjs';
import edgeWorker, { injectXConnectPrompt } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const STALE = 'sha384-TfilU2+Ahqd0cJ9tlKgZ5XzZfD5E830sS1TVyvNdZNsxFq0OjopktBKS8rH40Nze';
const liveSri = 'sha384-' + createHash('sha384').update(X_CONNECT_JS, 'utf8').digest('base64');
const sriRe = new RegExp(X_CONNECT_SRI.replace(/[+/]/g, '\\$&'));

assert.equal(X_CONNECT_SRI, liveSri, 'X_CONNECT_SRI matches bundled x-connect.js');
assert.notEqual(X_CONNECT_SRI, STALE, 'live sri is not the leftover pin');
assert.match(X_CONNECT_JS, /\/compute#use/);
assert.match(X_CONNECT_JS, /\/compute#source/);
assert.match(X_CONNECT_JS, /\/compute#sponsor/);
assert.match(readFileSync(join(root, 'dasha-x-connect-prompt.js'), 'utf8'), /\/compute#sponsor/);

const lobbyDisk = readFileSync(join(root, 'dasha-lobby-page.html'), 'utf8');
const chessDisk = readFileSync(join(root, 'dasha-chess-page.html'), 'utf8');

for (const [label, html] of [
  ['bundled lobby', LOBBY_PAGE_HTML],
  ['disk lobby', lobbyDisk],
  ['bundled chess', CHESS_PAGE_HTML],
  ['disk chess', chessDisk],
]) {
  assert.match(html, /client\/x-connect\.js/, `${label} loads x-connect`);
  assert.match(html, sriRe, `${label} pins live x-connect sri`);
  assert.doesNotMatch(html, /sha384-TfilU2\+Ahqd0cJ9tlKgZ5XzZfD5E830sS1TVyvNdZNsxFq0OjopktBKS8rH40Nze/, `${label} drops stale x-connect sri`);
}

async function served(path) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 200, `${path} 200`);
  return res.text();
}

const lobbyLive = await served('/lobby');
const chessLive = await served('/chess');
for (const [label, html] of [
  ['worker /lobby', lobbyLive],
  ['worker /chess', chessLive],
]) {
  assert.match(html, sriRe, `${label} pins live x-connect sri`);
  assert.doesNotMatch(html, /sha384-TfilU2\+Ahqd0cJ9tlKgZ5XzZfD5E830sS1TVyvNdZNsxFq0OjopktBKS8rH40Nze/, `${label} drops stale x-connect sri`);
}

const STALE_HOME = 'sha384-P+GWjU8raxzhHMCZ1bUqltsuNcVs17yd3qy7fpQGPl2hKiE1yHGK3s/jQQJoRjD6';
const staleHome = `<!doctype html><html><body><a href="/">Buy</a><script src="https://lobby.getdasha.com/client/x-connect.js" integrity="${STALE_HOME}" crossorigin="anonymous" defer></script></body></html>`;
const rewritten = injectXConnectPrompt(staleHome);
assert.match(rewritten, sriRe, 'inject rewrites stale home x-connect sri');
assert.doesNotMatch(rewritten, /sha384-P\+GWjU8raxzhHMCZ1bUqltsuNcVs17yd3qy7fpQGPl2hKiE1yHGK3s\/jQQJoRjD6/, 'inject drops P+GWjU8 pin');
assert.equal((rewritten.match(/client\/x-connect\.js/g) || []).length, 1, 'inject keeps one x-connect tag');
const inline = '<html><body><script>window.DashaXConnectPrompt=1</script></body></html>';
assert.equal(injectXConnectPrompt(inline), inline, 'inline DashaXConnectPrompt is left alone');
assert.match(HOME_HTML, sriRe, 'HOME_HTML pins live x-connect sri');
assert.doesNotMatch(HOME_HTML, /sha384-pF9pJa2E4m1ec3sbkjve5zpRsWdDNj6\/rTNDT\+KrPBM3Z3AaciDDfANfMfmqzbjY/, 'HOME_HTML drops pF9pJa2 pin');

const wwwXc = await edgeWorker.fetch(new Request('https://www.getdasha.com/client/x-connect.js'), {});
const lobbyXc = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/client/x-connect.js'), {});
assert.equal(wwwXc.status, 200, 'www /client/x-connect.js 200');
assert.equal(lobbyXc.status, 200, 'lobby /client/x-connect.js 200');
assert.notEqual(wwwXc.headers.get('x-dasha-edge'), 'html-404', 'www x-connect not html-404');
assert.match(wwwXc.headers.get('content-type') || '', /javascript/);
const wwwBody = await wwwXc.text();
const lobbyBody = await lobbyXc.text();
assert.equal(wwwBody, lobbyBody, 'www x-connect body matches lobby');
assert.equal('sha384-' + createHash('sha384').update(wwwBody, 'utf8').digest('base64'), X_CONNECT_SRI, 'www x-connect SRI matches pin');
const wwwHead = await edgeWorker.fetch(new Request('https://www.getdasha.com/client/x-connect.js', { method: 'HEAD' }), {});
assert.equal(wwwHead.status, 200, 'www x-connect HEAD');

console.log('dasha-x-connect-sri: PASS (lobby + chess + home rewrite + www /client/x-connect.js)');

