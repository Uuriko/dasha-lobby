#!/usr/bin/env node
/**
 * Hosted UI POST /compute/api/chat SSE must emit OpenAI-style usage on the final
 * stop chunk (parity with /compute/api/v1/chat/completions).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeApi } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /finish_reason: 'stop' \}\], usage: hostedUsage\(\)/);
assert.match(src, /upstreamUsage = payload\.usage/);

const origin = 'https://www.getdasha.com';
const secret = 'hosted-chat-usage-sse-secret';

function chunksStream(parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

function parseStopUsage(text) {
  const stopChunk = [...text.matchAll(/^data: (\{.*\})\s*$/gm)]
    .map((m) => JSON.parse(m[1]))
    .find((c) => c?.choices?.[0]?.finish_reason === 'stop');
  assert.ok(stopChunk, 'SSE must emit a stop chunk');
  assert.ok(stopChunk.usage, 'stop chunk must include usage');
  return stopChunk.usage;
}

{
  const env = {
    LOBBY_SESSION_SECRET: secret,
    AI: {
      async run(_model, input) {
        assert.equal(input?.stream, true);
        return chunksStream([
          { response: 'Hello' },
          { response: ' world', usage: { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 } },
        ]);
      },
    },
  };
  const session = await createSessionToken(env, { xId: 'usage-hosted', handle: 'usage_hosted' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const res = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: true }),
  }), env, origin);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
  const text = await res.text();
  assert.match(text, /"content":"Hello"/);
  assert.match(text, /"content":" world"/);
  assert.match(text, /"finish_reason":"stop"/);
  assert.match(text, /data: \[DONE\]/);
  assert.deepEqual(parseStopUsage(text), { prompt_tokens: 9, completion_tokens: 2, total_tokens: 11 });
}

{
  const env = {
    LOBBY_SESSION_SECRET: secret,
    AI: {
      async run(_model, input) {
        assert.equal(input?.stream, true);
        return chunksStream([{ response: 'abcd' }]); // 4 chars → ~1 completion token estimate
      },
    },
  };
  const session = await createSessionToken(env, { xId: 'usage-est', handle: 'usage_est' });
  const headers = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
  const res = await computeApi(new Request('https://lobby.getdasha.com/compute/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], stream: true }),
  }), env, origin);
  assert.equal(res.status, 200);
  const text = await res.text();
  const usage = parseStopUsage(text);
  assert.equal(typeof usage.prompt_tokens, 'number');
  assert.equal(typeof usage.completion_tokens, 'number');
  assert.equal(typeof usage.total_tokens, 'number');
  assert.ok(usage.completion_tokens >= 1);
  assert.equal(usage.total_tokens, usage.prompt_tokens + usage.completion_tokens);
  assert.match(text, /data: \[DONE\]/);
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
}

console.log('dasha-compute-hosted-chat-usage-sse.test.mjs: PASS');
