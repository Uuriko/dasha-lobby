#!/usr/bin/env node
/** Hosted chat SSE opt-in + page getReader stream:true; unauthed stays JSON 401. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeApi, ComputeNetwork } from './dasha-compute-network.mjs';
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
  assert.equal(streamed.headers.get('x-dasha-route'), 'hosted');
  assert.equal(streamed.headers.get('x-dasha-model'), 'gpt-oss-20b');
  assert.equal(streamed.headers.get('x-dasha-spend-usd'), '0.00');
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

// Economy's #328 condition: a hosted SSE charge settles only after the terminal chunk
// (finish_reason/[DONE]) is enqueued. Abort before terminal -> full refund; the completed
// stream's spend row rejects any later refund ('settled').
{
  const rows2 = new Map();
  const storage2 = {
    async get(key) { return rows2.get(key); },
    async put(key, value) {
      if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows2.set(name, item);
      else rows2.set(key, value);
    },
    async delete(key) { rows2.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows2].filter(([k]) => k.startsWith(prefix))); },
  };
  const env2 = {
    LOBBY_SESSION_SECRET: secret,
    AI: { async run(_m, input) { return input?.stream === true ? chunksStream([{ response: 'ok' }]) : { response: 'ok' }; } },
  };
  const net = new ComputeNetwork({ storage: storage2 }, env2);
  env2.LOBBY = { idFromName: () => 'public', get: () => ({ fetch: (req) => net.fetch(req, origin) }) };
  const session2 = await createSessionToken(env2, { xId: 'ssecut', handle: 'sse_cut' });
  const headers2 = { Cookie: `${COOKIE}=${session2}`, Origin: origin, 'Content-Type': 'application/json' };
  rows2.set('compute:credit-balance:x:ssecut', { owner: 'x:ssecut', cents: 20, updatedAt: 0 });
  const balance2 = () => rows2.get('compute:credit-balance:x:ssecut')?.cents;
  const chat = (stream) => computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST', headers: headers2,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], ...(stream ? { stream: true } : {}) }),
  }), env2, origin);
  // Free floor: 3 asks per 10 minutes per owner charge nothing.
  for (let i = 0; i < 3; i++) {
    const freeRes = await chat(false);
    assert.equal(freeRes.status, 200, await freeRes.text());
  }
  assert.equal(balance2(), 20, 'free floor asks charge nothing');

  // Abort BEFORE the terminal chunk: full refund of the charged ask.
  let upstreamCtrl;
  env2.AI.run = async (_m, input) => input?.stream === true
    ? new ReadableStream({ start(c) { upstreamCtrl = c; } })
    : { response: 'ok' };
  const abortRes = await chat(true);
  assert.equal(abortRes.status, 200);
  assert.equal(balance2(), 15, 'charged ask debits $0.05');
  const reader = abortRes.body.getReader();
  upstreamCtrl.enqueue({ response: 'partial' });
  const firstChunk = await reader.read();
  assert.match(new TextDecoder().decode(firstChunk.value), /partial/);
  await reader.cancel();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(balance2(), 20, 'abort before the terminal chunk refunds in full');

  // Completed stream: terminal chunk enqueued, charge stands, later refund rejected.
  env2.AI.run = async (_m, input) => input?.stream === true ? chunksStream([{ response: 'done' }]) : { response: 'ok' };
  const okRes = await chat(true);
  assert.equal(okRes.status, 200);
  assert.equal(balance2(), 15, 'second charged ask debits');
  const okBody = await okRes.text();
  assert.match(okBody, /"finish_reason":"stop"/);
  assert.match(okBody, /data: \[DONE\]/);
  await new Promise((r) => setTimeout(r, 50));
  const spendRows = [...rows2.entries()].filter(([k]) => k.startsWith('compute:credit-spend:x:ssecut:hosted_'));
  assert.equal(spendRows.length, 2, 'two charged asks, two spend rows');
  const refundedRow = spendRows.find(([, v]) => v.refundedAt);
  const settledRow = spendRows.find(([, v]) => v.settledAt);
  assert.ok(refundedRow, 'abort-before-terminal produced a refunded spend row');
  assert.ok(settledRow, 'completed stream produced a settled spend row');
  const late = await net.refundCredits('x:ssecut', { requestId: settledRow[0].split(':').pop(), now: Date.now(), reason: 'hosted-cut' });
  assert.equal(late.ok, false);
  assert.equal(late.error, 'settled');
  assert.equal(balance2(), 15, 'refund after settle is rejected');
}
