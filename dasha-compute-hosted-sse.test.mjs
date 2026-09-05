#!/usr/bin/env node
/** Hosted chat SSE opt-in + page getReader stream:true; unauthed stays JSON 401. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeApi } from './dasha-compute-network.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');
assert.match(html, /getReader\(\)/, 'page uses getReader');
assert.match(html, /stream:true/, 'page requests stream:true');
assert.doesNotMatch(html, /for\(const ch of text\)/, 'no fake typewriter');
assert.match(html, /async function readSse\(/, 'readSse helper');

const origin = 'https://www.getdasha.com';
const secret = 'hosted-sse-secret';

function chunksStream(parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

{
  let sawStream = false;
  const env = {
    LOBBY_SESSION_SECRET: secret,
    AI: {
      async run(_model, input) {
        if (input?.stream === true) {
          sawStream = true;
          return chunksStream([{ response: 'Hi' }, { response: '!' }]);
        }
        return { response: 'plain Hi' };
      },
    },
  };
  const session = await createSessionToken(env, { xId: '7', handle: 'sse_user' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const streamed = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: true }),
  }), env, origin);
  assert.equal(streamed.status, 200);
  assert.match(streamed.headers.get('content-type') || '', /text\/event-stream/);
  const body = await streamed.text();
  assert.match(body, /"content":"Hi"/);
  assert.match(body, /data: \[DONE\]/);
  assert.equal(sawStream, true);

  const plain = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  }), env, origin);
  assert.equal(plain.status, 200);
  assert.match(plain.headers.get('content-type') || '', /application\/json/);
  const json = await plain.json();
  assert.equal(json.answer, 'plain Hi');
  assert.equal(json.stored, false);
}

{
  const env = {
    LOBBY_SESSION_SECRET: secret,
    AI: { async run() { return chunksStream([{ response: 'nope' }]); } },
  };
  const unauth = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: true }),
  }), env, origin);
  assert.equal(unauth.status, 401);
  assert.match(unauth.headers.get('content-type') || '', /application\/json/);
  assert.deepEqual(await unauth.json(), { error: 'login required' });
}

console.log('dasha-compute-hosted-sse: PASS');
