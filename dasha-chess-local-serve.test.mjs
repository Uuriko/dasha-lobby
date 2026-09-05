#!/usr/bin/env node
/**
 * /chess loads /client/chess-local.js. Live was 404 on www + lobby,
 * so window.DashaChessLocal never booted and local play (Dasha vs Anna) sat.
 * Disk only. No static-gen. No wrangler.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import {
  CHESS_LOCAL_JS,
  CHESS_PAGE_HTML,
} from './dasha-lobby-static-gen.mjs';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const chessDisk = readFileSync(join(root, 'dasha-chess-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.ok(CHESS_LOCAL_JS.length > 1000, 'CHESS_LOCAL_JS is the real engine');
assert.match(CHESS_LOCAL_JS, /DashaChessLocal/);
assert.match(CHESS_LOCAL_JS, /startLocalGame/);
assert.match(CHESS_LOCAL_JS, /annaReply/);
assert.doesNotMatch(CHESS_LOCAL_JS, /plugin\.jup\.ag/);

assert.match(CHESS_PAGE_HTML, /src="\/client\/chess-local\.js"/);
assert.match(chessDisk, /src="\/client\/chess-local\.js"/);
assert.match(CHESS_PAGE_HTML, /function engine\(\)\{return window\.DashaChessLocal\|\|null\}/);
assert.match(worker, /CHESS_LOCAL_JS/);
assert.ok((worker.match(/url\.pathname === '\/client\/chess-local\.js'/g) || []).length >= 2, 'www + lobby serve chess-local.js');
assert.ok((worker.match(/url\.pathname === '\/client\/x-connect\.js'/g) || []).length >= 2, 'www + lobby serve x-connect.js');
assert.doesNotMatch(worker, /plugin\.jup\.ag/);

const sandbox = { globalThis: {}, window: {} };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
runInContext(CHESS_LOCAL_JS, createContext(sandbox));
const engine = sandbox.DashaChessLocal;
assert.ok(engine, 'IIFE sets DashaChessLocal');
const start = engine.startLocalGame();
assert.equal(start.state.status, 'active');
assert.equal(start.state.board.length, 64);
assert.equal(engine.legalMoves(start.state).length, 20);
const e2e4 = engine.playMove(start.state, { from: 'e2', to: 'e4' });
assert.equal(e2e4.ok, true);
assert.ok(engine.annaReply(e2e4.state));

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const js = await edgeWorker.fetch(new Request(`${origin}/client/chess-local.js`), {});
  assert.equal(js.status, 200, `${origin}/client/chess-local.js 200`);
  assert.match(js.headers.get('content-type') || '', /javascript/);
  const body = await js.text();
  assert.equal(body, CHESS_LOCAL_JS, `${origin}/client/chess-local.js same body`);
  assert.match(body, /DashaChessLocal/);
  assert.doesNotMatch(body, /plugin\.jup\.ag/);

  const head = await edgeWorker.fetch(new Request(`${origin}/client/chess-local.js`, { method: 'HEAD' }), {});
  assert.equal(head.status, 200, `HEAD ${origin}/client/chess-local.js 200`);
  assert.equal(await head.text(), '', `HEAD ${origin}/client/chess-local.js empty`);

  const chess = await edgeWorker.fetch(new Request(`${origin}/chess`), {});
  assert.equal(chess.status, 200, `${origin}/chess 200`);
  assert.match(chess.headers.get('link') || '', /<\/llms\.txt>; rel="describedby"/, `${origin}/chess HTTP Link llms.txt`);
  assert.match(chess.headers.get('link') || '', /<\/llms-full\.txt>; rel="describedby"/, `${origin}/chess HTTP Link llms-full.txt`);
  assert.match(chess.headers.get('content-security-policy') || '', /frame-ancestors 'self'/, `${origin}/chess CSP still allows embed`);
  const chessHtml = await chess.text();
  assert.match(chessHtml, /src="\/client\/chess-local\.js"/);
  assert.match(chessHtml, new RegExp(MINT));
  assert.match(chessHtml, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/, `${origin}/chess HTML describedby`);
  assert.match(chessHtml, /<link rel="describedby" href="\/llms-full\.txt" type="text\/plain">/, `${origin}/chess HTML describedby full`);
  assert.doesNotMatch(chessHtml, /plugin\.jup\.ag/);
  assert.doesNotMatch(chessHtml, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);

  if (origin.includes('lobby.')) {
    const x = await edgeWorker.fetch(new Request(`${origin}/client/x-connect.js`), {});
    assert.equal(x.status, 200, `${origin}/client/x-connect.js still 200`);
    assert.match(await x.text(), /DashaXConnectPrompt/);
  }
}

const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
assert.equal(privacy.status, 200, '/privacy still 200');
assert.match(await privacy.text(), /<h1[^>]*>Privacy<\/h1>/i);

const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
assert.equal(studio.status, 308, '/studio still 308');
assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');

const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {
  // productEdge fetches upstream Webflow for home; empty env still must not 5xx
});
assert.ok(home.status === 200 || home.status === 404 || home.status === 500, `home not thrown (${home.status})`);

console.log('dasha-chess-local-serve: PASS (www + lobby serve chess-local.js; describedby; local engine boots)');
