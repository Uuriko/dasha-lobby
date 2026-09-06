import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { createHash } from 'node:crypto';
import { createArcadeEngine } from './dasha-arcade-engine.mjs';
import { ARCADE_CLIENT_JS } from './dasha-arcade-client.mjs';
import { ARCADE_HTML, ARCADE_CSS } from './dasha-arcade-page.mjs';
import { arcadeResponse, addArcadeLobbyLink } from './dasha-arcade.mjs';
import worker from './dasha-lobby-worker.mjs';

const e = createArcadeEngine();
const tick = (s, count) => { for (let i = 0; i < count; i++) e.step(s, 1 / 60); };

test('flight needs input, stops on impact, and scores each clear only once', () => {
  const idle = e.create('after-hours', () => 0.5);
  tick(idle, 180);
  assert.equal(idle.over, true);
  const y = idle.y;
  e.act(idle, 'flap'); tick(idle, 60);
  assert.equal(idle.y, y);
  const s = e.create('after-hours', () => 0.5);
  e.act(s, 'flap'); e.step(s, 1 / 60);
  assert.ok(s.y < 205);
  s.gates = [{ x: 55, center: 210, gap: 195, counted: false }];
  e.step(s, 1 / 60);
  assert.equal(s.score, 10);
  e.step(s, 1 / 60);
  assert.equal(s.score, 10);
  s.y = 35; s.gates = [{ x: 140, center: 210, gap: 160, counted: false }];
  e.step(s, 1 / 60);
  assert.equal(s.over, true);
});

test('notification game clamps lanes, collects stars, loses three chances, and ends at 45s', () => {
  const s = e.create('do-not-disturb', () => 0.5);
  for (let i = 0; i < 8; i++) e.act(s, 'left');
  assert.equal(s.lane, 0);
  for (let i = 0; i < 8; i++) e.act(s, 'right');
  assert.equal(s.lane, 2);
  s.items = [{ lane: 2, y: 355, good: true }]; e.step(s, 1 / 60);
  assert.equal(s.score, 10); assert.equal(s.collected, 1);
  for (let i = 0; i < 3; i++) { s.items = [{ lane: 2, y: 355, good: false }]; e.step(s, 1 / 60); }
  assert.equal(s.lives, 0); assert.equal(s.over, true);
  const timed = e.create('do-not-disturb', () => 0.99);
  tick(timed, 2702);
  assert.equal(timed.over, true); assert.ok(timed.elapsed >= 45); assert.equal(timed.lives, 3);
});

test('packing has a balanced shuffled deck, no timer, correct scoring, and a final result', () => {
  const s = e.create('carry-on', () => 0.2);
  assert.equal(s.deck.length, 18);
  assert.equal(s.deck.filter(c => c.pack).length, 9);
  tick(s, 4000); assert.equal(s.index, 0); assert.equal(s.over, false);
  for (const card of s.deck) e.act(s, card.pack ? 'pack' : 'leave');
  assert.equal(s.correct, 18); assert.equal(s.score, 330); assert.equal(s.over, true);
  e.act(s, 'pack'); assert.equal(s.score, 330);
  const bad = e.create('carry-on', () => 0.2);
  e.act(bad, bad.deck[0].pack ? 'leave' : 'pack');
  assert.equal(bad.score, 0); assert.equal(bad.streak, 0); assert.match(bad.feedback, /list/);
});

test('new rounds are independent and invalid elapsed time cannot alter game state', () => {
  const a = e.create('after-hours'); a.score = 700;
  const b = e.create('after-hours'); assert.equal(b.score, 0);
  for (const value of [NaN, Infinity, -1, 0]) e.step(b, value);
  assert.equal(b.elapsed, 0);
  assert.throws(() => e.create('missing'));
});

test('Worker serves the page and all local assets through GET and HEAD on both routed hosts', async () => {
  new Script(ARCADE_CLIENT_JS);
  for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
    for (const [path, expected, mime] of [['/arcade', ARCADE_HTML, 'text/html'], ['/arcade/play.js', ARCADE_CLIENT_JS, 'javascript'], ['/arcade/style.css', ARCADE_CSS, 'text/css']]) {
      const res = await worker.fetch(new Request(`https://${host}${path}`), {});
      assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), new RegExp(mime));
      assert.equal(await res.text(), expected);
      const head = await worker.fetch(new Request(`https://${host}${path}`, { method: 'HEAD' }), {});
      assert.equal(head.status, 200); assert.equal(await head.text(), '');
    }
    const image = await worker.fetch(new Request(`https://${host}/arcade/portrait.jpg`), {});
    const bytes = Buffer.from(await image.arrayBuffer());
    assert.equal(image.headers.get('content-type'), 'image/jpeg'); assert.equal(bytes.length, 24875);
    assert.equal(bytes.subarray(0, 3).toString('hex'), 'ffd8ff');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), '5bc5141841d5d65b10d3ae19c33aa6f4aeb68383dbd4d5488d14526f960e1dec');
    const slash = await worker.fetch(new Request(`https://${host}/arcade/?from=lobby`), {});
    assert.equal(slash.status, 308); assert.equal(slash.headers.get('location'), '/arcade?from=lobby');
    const post = await worker.fetch(new Request(`https://${host}/arcade`, { method: 'POST' }), {});
    assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD');
  }
  assert.equal(arcadeResponse(new Request('https://www.getdasha.com/oauth/x/start')), null);
});

test('lobby discovery is idempotent, page-scoped, and preserves the existing Play control', () => {
  const lobby = '<section id="forum-play"><div class="forum-play-row"><button id="forum-play-go">Play</button></div></section>';
  const linked = addArcadeLobbyLink(lobby);
  assert.match(linked, /href="\/arcade"/); assert.match(linked, /id="forum-play-go"/);
  assert.equal(addArcadeLobbyLink(linked), linked);
  const home = '<section id="chat-door"><a href="/lobby">Chat</a></section>';
  assert.equal(addArcadeLobbyLink(home), home);
});

test('the complete served Lobby retains its Arcade link after existing page transformations', async t => {
  // The Lobby normally fetches a live price for its tape; this route test stays offline.
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline route fixture'); });
  const res = await worker.fetch(new Request('https://www.getdasha.com/lobby'), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.equal((html.match(/href="\/arcade"/g) || []).length, 1);
  assert.match(html, /id="forum-play-go"/);
  assert.match(html, /id="dasha-forum"/);
  assert.match(html, /id="dasha-chess"/);
});
