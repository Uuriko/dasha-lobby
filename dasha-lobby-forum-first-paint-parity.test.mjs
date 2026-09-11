#!/usr/bin/env node
/**
 * Forum first-paint parity between the www product edge and the lobby host.
 *
 * www.getdasha.com/lobby (productEdge) server-paints the forum chips + thread list (or one
 * thread) into #dasha-forum. lobby.getdasha.com/lobby (the default edge handler) used to serve
 * the same page with an empty mount and rely on client hydration. This test pins both handlers
 * to the same server-painted contract, and pins the fail-open shape: a dead lobby DO still
 * serves the page, just unpainted.
 */
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';

const THREAD = {
  id: 'paintthread1',
  title: 'Server painted thread',
  handle: 'painter',
  ts: 1788220800000,
  lastTs: 1788307200000,
  replies: 1,
  snippet: 'painted on the server, not hydrated',
  tag: 'meme',
};
const POST = {
  id: 'post-1',
  handle: 'painter',
  text: 'first paint on the lobby host',
  ts: 1788220800000,
};

function lobbyEnv() {
  return {
    LOBBY: {
      idFromName: name => name,
      get: () => ({
        fetch: async request => {
          const path = new URL(request.url).pathname;
          if (path === '/forum/threads') {
            return Response.json({ threads: [THREAD] });
          }
          if (path === `/forum/thread/${THREAD.id}`) {
            return Response.json({ thread: THREAD, posts: [POST] });
          }
          return new Response('not found', { status: 404 });
        },
      }),
    },
  };
}

// Lobby host: index first paint (chips + thread list) now matches the www edge.
{
  const res = await worker.fetch(new Request('https://lobby.getdasha.com/lobby'), lobbyEnv());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'lobby-page');
  const html = await res.text();
  assert.match(html, /<div class="df-list">/, 'lobby host /lobby must server-paint the thread list');
  assert.match(html, /Server painted thread/);
  assert.match(html, /<span class="df-tag"[^>]*>meme<\/span>/, 'tag chip must be server-painted');
  assert.match(html, /painted on the server, not hydrated/);
}

// Lobby host: single-thread first paint.
{
  const res = await worker.fetch(new Request(`https://lobby.getdasha.com/lobby?t=${THREAD.id}`), lobbyEnv());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'lobby-page');
  const html = await res.text();
  assert.match(html, /<div class="df-posts">/, 'lobby host /lobby?t= must server-paint the thread posts');
  assert.match(html, /first paint on the lobby host/);
  assert.match(html, /<title>Server painted thread — \$dasha Lobby<\/title>/);
}

// www edge: unchanged — still server-paints from the same helpers.
{
  const res = await worker.fetch(new Request('https://www.getdasha.com/lobby'), lobbyEnv());
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<div class="df-list">/, 'www edge keeps its forum first paint');
  assert.match(html, /Server painted thread/);
}

// Fail-open on both hosts: a missing lobby DO serves the page unpainted, never an error.
for (const host of ['https://lobby.getdasha.com', 'https://www.getdasha.com']) {
  const res = await worker.fetch(new Request(`${host}/lobby`), {});
  assert.equal(res.status, 200, `${host}/lobby stays 200 without the DO`);
  const html = await res.text();
  assert.doesNotMatch(html, /<div class="df-list">/);
  assert.match(html, /id="dasha-forum"/);
}

console.log('dasha-lobby-forum-first-paint-parity: PASS');
