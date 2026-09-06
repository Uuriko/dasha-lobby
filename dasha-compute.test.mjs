import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const html = await readFile(new URL('./dasha-compute.html', import.meta.url), 'utf8');
const loginHtml = await readFile(new URL('./dasha-login-page.html', import.meta.url), 'utf8');
const loginClient = await readFile(new URL('./dasha-x-connect-prompt.js', import.meta.url), 'utf8');
for (const text of ['Start.', 'Ask.', 'Provide', 'Marketplace', 'Run', 'Mixture · sub-24GB', 'Register', 'Download kit', 'v0.3 open alpha', 'Name this Mac.']) assert.ok(html.includes(text), `missing ${text}`);
assert.doesNotMatch(html, /role="tablist"[^>]*Dasha Compute sections/);
assert.doesNotMatch(html, /id="tab-sponsor"/);
assert.doesNotMatch(html, /Exact claim|Sponsor the fleet|Night Shift/);
assert.match(html, /hashchange/);
assert.match(html, /jup\.ag\/tokens\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
assert.match(html, /id="login" href="\/login\?return=\/compute"/);
assert.match(html, /id="provider-login" href="\/login\?return=\/compute%23provide"/);
assert.doesNotMatch(html, /id="login"[^>]+oauth\/x\/start/);
assert.match(html, /https:\/\/lobby\.getdasha\.com\/compute\/api\/v1/);
assert.match(html, /DASHA_API_KEY/);
assert.match(html, /id="create-api-key"/);
assert.match(html, /\.\/install\.sh/, 'registered Mac setup must install the persistent provider service');
assert.doesNotMatch(html, /dasha-local-consumer/);
assert.doesNotMatch(html, /compute\.getdasha\.com|public routing turns on/i);
assert.doesNotMatch(html, /ollama pull raptor/i);
const kit = fileURLToPath(new URL('./dasha-worker-assets/dasha-compute-open-alpha.tar.gz', import.meta.url));
const kitFile = path => execFileSync('tar', ['-xOf', kit, `dasha-compute-open-alpha/${path}`], { encoding: 'utf8' });
assert.equal(kitFile('provider/agent.py'), await readFile(new URL('./dasha-compute-open-alpha/provider/agent.py', import.meta.url), 'utf8'), 'published provider must match maintained source');
assert.match(kitFile('README.md'), /curl -fLO https:\/\/www\.getdasha\.com\/dasha-compute-open-alpha\.tar\.gz/);
assert.match(kitFile('README.md'), /doctor exits nonzero when the coordinator, Ollama, or any configured model is unavailable/);
assert.match(kitFile('provider/agent.py'), /dasha-compute-provider\/0\.3/);
assert.match(kitFile('provider/agent.py'), /models\s+failed · missing:/);
assert.match(kitFile('provider/agent.py'), /def size_soft_report/);
assert.match(kitFile('provider/agent.py'), /def keepalive_soft_report/);
assert.match(kitFile('provider/agent.py'), /api\/ps/);
assert.match(kitFile('README.md'), /mapped ≥27B tags and cold `\/api\/ps` keep-alive/);
assert.match(kitFile('tests/e2e.test.mjs'), /provider doctor fails when a configured Ollama model is missing/);
assert.match(kitFile('provider/agent.py'), /models": list\(available\)/);
assert.match(kitFile('tests/e2e.test.mjs'), /provider advertises only installed Ollama models/);
assert.match(kitFile('provider/agent.py'), /providers\/jobs\/\{job_id\}\/heartbeat/);
assert.match(kitFile('provider/agent.py'), /if response\.get\("cancelled"\)/);
assert.match(kitFile('install.sh'), /security add-generic-password/);
assert.match(kitFile('install.sh'), /launchctl bootstrap/);
assert.match(kitFile('install.sh'), /DASHA_PROVIDER_KEY_FILE|\.dasha-provider-key/);
assert.match(kitFile('install.sh'), /rm -f "\$KEY_FILE"/);
assert.doesNotMatch(html, /DASHA_PROVIDER_KEY=/);
assert.match(html, /\.dasha-provider-key/);
assert.match(kitFile('provider/dasha-compute'), /status\|doctor\|benchmark\|logs/);
assert.match(kitFile('provider/agent.py'), /--benchmark/);
assert.doesNotMatch([kitFile('README.md'), kitFile('SECURITY.md'), kitFile('THREAT_MODEL.md'), kitFile('provider/agent.py'), kitFile('coordinator/server.mjs')].join('\n'), /v0\.2|0\.2\.0/);
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'inline product script missing');
assert.doesNotThrow(() => new Function(script), 'inline product script must parse');
const { default: worker, DashaLobby } = await import('./dasha-lobby-worker.mjs');
const { ComputeNetwork } = await import('./dasha-compute-network.mjs');
const { createSessionToken } = await import('./dasha-lobby-x.mjs');

const staleExpiryJob = { id: 'job_renewed', owner: 'x:test', model: 'qwen3-8b', createdAt: Date.now() - 301_000, expiresAt: Date.now() - 1 };
let storedExpiryJob = { ...staleExpiryJob, stream: true, status: 'complete', chunks: ['renewed stream result'], expiresAt: Date.now() + 60_000 };
let staleJobDeleted = false;
const renewedKeyRows = new Map();
const renewedNetwork = new ComputeNetwork({ storage: {
  async get(key) {
    if (String(key).startsWith('compute:api-key:')) return renewedKeyRows.get(key);
    if (String(key).startsWith('compute:credit-')) return renewedKeyRows.get(key);
    return structuredClone(storedExpiryJob);
  },
  async put(key, value) {
    if (String(key).startsWith('compute:api-key:') || String(key).startsWith('compute:credit-')) {
      renewedKeyRows.set(key, value);
      return;
    }
  },
  async delete() { staleJobDeleted = true; },
  async list({ prefix = '' } = {}) { return new Map([...renewedKeyRows].filter(([k]) => k.startsWith(prefix))); },
} }, {});
const renewedStreamText = await renewedNetwork.streamResponse({ ...staleExpiryJob, stream: true }).text();
assert.match(renewedStreamText, /renewed stream result/);
assert.match(renewedStreamText, /"finish_reason":"stop"/);
assert.doesNotMatch(renewedStreamText, /request timed out/);
storedExpiryJob = { ...staleExpiryJob, stream: false, status: 'complete', answer: 'renewed complete result', expiresAt: Date.now() + 60_000 };
renewedKeyRows.set('compute:credit-balance:x:test', { owner: 'x:test', cents: 1000, updatedAt: Date.now() });
renewedNetwork.apiKey = async () => ({ id: 'key_renewed', owner: 'x:test', limitCents: null, limitReset: 'none', spendCents: 0, spendWindowStart: Date.now() });
renewedNetwork.queueJob = async () => ({ job: staleExpiryJob });
const renewedCompletion = await renewedNetwork.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', { method: 'POST', body: '{}' }));
assert.equal(renewedCompletion.status, 200);
assert.equal((await renewedCompletion.json()).choices[0].message.content, 'renewed complete result');
assert.equal(staleJobDeleted, false, 'renewed jobs must not be deleted at their original expiry');

let disconnectedJob = { id: 'job_disconnected', owner: 'x:test', model: 'qwen3-8b', stream: true, status: 'leased', messages: [{ role: 'user', content: 'forget me' }], chunks: ['partial'], createdAt: Date.now(), expiresAt: Date.now() + 60_000 };
let disconnectReads = 0, disconnectWrites = 0;
const disconnectedStorage = {
  async get() { disconnectReads++; return structuredClone(disconnectedJob); },
  async put(_key, value) { disconnectWrites++; disconnectedJob = structuredClone(value); },
  async delete() { disconnectWrites++; disconnectedJob = null; },
};
const disconnectedReader = new ComputeNetwork({ storage: disconnectedStorage }, {}).streamResponse(disconnectedJob).body.getReader();
await disconnectedReader.cancel();
assert.equal(disconnectedJob.status, 'cancelled');
assert.equal(disconnectedJob.messages, null, 'disconnect must delete the leased prompt');
assert.equal(disconnectedJob.chunks, null, 'disconnect must delete partial output');
assert.equal(disconnectWrites, 1);
const readsAfterDisconnect = disconnectReads;
await new Promise(resolve => setTimeout(resolve, 300));
assert.equal(disconnectReads, readsAfterDisconnect, 'disconnect must stop storage polling');

const pruneNow = Date.now();
const terminalTask = (id, status, content) => ({ id, owner: 'x:test', title: id, prompt: 'test', model: 'qwen3-8b', template: 'custom', repeat: 'none', status, stepIndex: 0, nextRunAt: null, artifacts: [{ id: `job_${id}`, status, content }], createdAt: pruneNow - 20_000 });
const pruneRows = new Map([
  ['compute:night:night_complete', terminalTask('night_complete', 'complete', 'kept result')],
  ['compute:night:night_failed', terminalTask('night_failed', 'failed', null)],
  ['compute:night:night_active', { ...terminalTask('night_active', 'running', null), artifacts: [] }],
  ['compute:job:job_complete', { id: 'job_complete', nightId: 'night_complete', status: 'complete', expiresAt: pruneNow - 1 }],
  ['compute:job:job_failed', { id: 'job_failed', nightId: 'night_failed', status: 'failed', expiresAt: pruneNow - 1 }],
  ['compute:job:job_active', { id: 'job_active', nightId: 'night_active', status: 'leased', model: 'qwen3-8b', createdAt: pruneNow - 10_000, expiresAt: pruneNow - 1 }],
]);
const pruneStorage = {
  async get(key) { return pruneRows.get(key); },
  async put(key, value) { pruneRows.set(key, value); },
  async delete(key) { pruneRows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...pruneRows].filter(([key]) => key.startsWith(prefix))); },
};
await new ComputeNetwork({ storage: pruneStorage }, {}).prune(pruneNow);
assert.equal(pruneRows.get('compute:night:night_complete').artifacts.length, 1, 'pruning a retained completed job must not invent a failure');
assert.equal(pruneRows.get('compute:night:night_complete').status, 'complete');
assert.equal(pruneRows.get('compute:night:night_failed').artifacts.length, 1, 'pruning a retained failed job must not duplicate its failure');
assert.equal(pruneRows.get('compute:night:night_active').status, 'failed', 'an active Night Shift job that expires must still fail');
assert.match(pruneRows.get('compute:night:night_active').artifacts[0].error, /expired before completion/);

const route = await worker.fetch(new Request('https://www.getdasha.com/compute'), {}, {});
assert.equal(route.status, 200);
assert.equal(route.headers.get('x-dasha-edge'), 'compute');
const routeHtml = await route.text();
assert.match(routeHtml, /Start\./);
assert.match(routeHtml, /<h1 class="tf-q">Ask\.<\/h1>/);
assert.equal((await worker.fetch(new Request('https://www.getdasha.com/compute/index.html'), {}, {})).headers.get('x-dasha-edge'), 'compute');
const archive = await worker.fetch(new Request('https://www.getdasha.com/dasha-compute-open-alpha.tar.gz'), { ASSETS: { fetch: async () => new Response('kit') } }, {});
assert.equal(await archive.text(), 'kit');
let hostedInput;
const env = {
  AI: { run: async (_model, input) => { hostedInput = input; return { response: 'Hosted inference works.' }; } },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-test-secret',
};
const token = await createSessionToken(env, { xId: '123', handle: 'dasha_test' });
assert.equal((await (await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/status'), env, {})).json()).live, true);
assert.deepEqual(await (await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/healthz', { headers: { Origin: 'https://www.getdasha.com' } }), env, {})).json(), { ok: true, service: 'dasha-compute', version: '0.3.0' });
const hosted = await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/chat', {
  method: 'POST',
  headers: { Cookie: `__Host-dasha_x=${token}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Say hello.' }),
}), env, {});
assert.equal(hosted.status, 200);
assert.deepEqual(await hosted.json(), { answer: 'Hosted inference works.', model: 'gpt-oss-20b', provider: 'Cloudflare Workers AI', stored: false });
assert.deepEqual(hostedInput.messages.slice(-1), [{ role: 'user', content: 'Say hello.' }]);
const continued = await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/chat', {
  method: 'POST', headers: { Cookie: `__Host-dasha_x=${token}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'First.' }, { role: 'assistant', content: 'Reply.' }, { role: 'user', content: 'Continue.' }] }),
}), env, {});
assert.equal(continued.status, 200);
assert.deepEqual(hostedInput.messages.slice(-3), [{ role: 'user', content: 'First.' }, { role: 'assistant', content: 'Reply.' }, { role: 'user', content: 'Continue.' }]);
const tooLong = await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/chat', {
  method: 'POST', headers: { Cookie: `__Host-dasha_x=${token}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: Array.from({ length: 13 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: 'x' })) }),
}), env, {});
assert.equal(tooLong.status, 400);
const anonymous = await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/chat', {
  method: 'POST', headers: { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'No.' }),
}), env, {});
assert.equal(anonymous.status, 401);
assert.equal((await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/chat', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'No.' }) }), env, {})).status, 403);

globalThis.WebSocketRequestResponsePair ||= class {};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) { if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item); else rows.set(key, value); },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([key]) => key.startsWith(prefix))); },
  async getAlarm() { return Date.now(); }, async setAlarm() {},
};
let ready;
const lobby = new DashaLobby({ storage, setWebSocketAutoResponse() {}, blockConcurrencyWhile(fn) { ready = fn(); }, getWebSockets() { return []; } }, env);
await ready;
const userHeaders = { Cookie: `__Host-dasha_x=${token}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' };
const register = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/register', { method: 'POST', headers: userHeaders, body: JSON.stringify({ name: '  ', models: ['qwen3-8b', 'gemma3-12b'] }) }));
assert.equal(register.status, 201);
const credentials = await register.json();
assert.match(credentials.provider_token, /^dcp_/);
assert.equal(JSON.stringify([...rows.values()]).includes(credentials.provider_token), false, 'plaintext provider token must not be stored');
assert.equal(rows.get(`compute:provider:${credentials.provider_id}`).name, 'My Mac', 'blank provider names need a usable fallback');
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).models, [], 'registered models are not online until the provider reports them');
const providerHeaders = { Authorization: `Bearer ${credentials.provider_token}`, 'Content-Type': 'application/json' };
const heartbeat = { provider_id: credentials.provider_id, name: '  ', models: ['qwen3-8b'], hardware: { system: 'Darwin', machine: 'arm64', memory_gb: 64, ignored: 'nope', benchmarked_at: 1234, benchmarks: [{ model: 'qwen3-8b', tokens_per_second: 42.125 }, { model: 'gpt-oss-120b', tokens_per_second: 999 }] } };
const verified = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/verify', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }));
assert.equal(verified.status, 200);
assert.deepEqual((await verified.json()).models, ['qwen3-8b', 'gemma3-12b']);
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/verify', { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify(heartbeat) }))).status, 401);
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }))).status, 204);
assert.equal(rows.get(`compute:provider:${credentials.provider_id}`).name, 'My Mac', 'blank heartbeats must not erase the provider name');
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).hardware, { system: 'Darwin', machine: 'arm64', memory_gb: 64, benchmarked_at: 1234, benchmarks: [{ model: 'qwen3-8b', tokens_per_second: 42.13 }] });
const network = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/network'))).json();
assert.equal(network.providers_online, 1);
assert.deepEqual(network.models_available, ['qwen3-8b']);
assert.deepEqual(network.capacity, [{ model: 'qwen3-8b', providers: 1, measured_providers: 1, tokens_per_second: 42.13 }]);
const v1network = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/network'))).json();
assert.equal(v1network.providers_online, 1);
assert.deepEqual(v1network.models_available, ['qwen3-8b']);
const mine = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers', { headers: userHeaders }))).json();
assert.equal(mine.providers[0].id, credentials.provider_id);
assert.deepEqual(mine.providers[0].allowed_models, ['qwen3-8b', 'gemma3-12b']);
assert.equal(mine.providers[0].hardware.memory_gb, 64);
assert.equal('tokenHash' in mine.providers[0], false);
const unregisteredHeartbeat = { ...heartbeat, models: ['gpt-oss-120b'] };
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(unregisteredHeartbeat) }))).status, 204);
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).models, [], 'a provider cannot self-authorize another supported model');
const switchedHeartbeat = { ...heartbeat, models: ['gemma3-12b'] };
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(switchedHeartbeat) }))).status, 204);
assert.deepEqual(rows.get(`compute:provider:${credentials.provider_id}`).models, ['gemma3-12b'], 'a temporarily absent registered model can come back online');
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }))).status, 204);
const submit = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', { method: 'POST', headers: userHeaders, body: JSON.stringify({ model: 'qwen3-8b', prompt: 'Community hello.' }) }));
assert.equal(submit.status, 202);
const submitted = await submit.json();
const queued = await (await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${submitted.id}`, { headers: userHeaders }))).json();
assert.equal(queued.queue_position, 1);
const poll = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }));
assert.equal(poll.status, 200);
assert.equal((await poll.json()).job.messages[0].content, 'Community hello.');
const result = await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${submitted.id}/result`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id, content: 'Community inference works.' }) }));
assert.equal(result.status, 202);
assert.equal(rows.get(`compute:job:${submitted.id}`).messages, null, 'prompt must be removed after completion');
const completed = await (await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${submitted.id}`, { headers: userHeaders }))).json();
assert.equal(completed.answer, 'Community inference works.');
await storage.put('compute:credit-balance:x:123', { owner: 'x:123', cents: 1000, updatedAt: Date.now() });
const keyCreated = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', { method: 'POST', headers: userHeaders, body: JSON.stringify({ name: 'SDK test' }) }));
assert.equal(keyCreated.status, 201);
const developerKey = await keyCreated.json();
assert.match(developerKey.api_key, /^dsk_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]+$/);
assert.equal(JSON.stringify([...rows.values()]).includes(developerKey.api_key), false, 'plaintext developer API key must not be stored');
const listedKeys = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/keys', { headers: userHeaders }))).json();
assert.deepEqual(listedKeys.keys.map(key => key.name), ['SDK test']);
assert.equal('tokenHash' in listedKeys.keys[0], false);
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models', { headers: { Authorization: 'Bearer wrong' } }))).status, 401);
const apiHeaders = { Authorization: `Bearer ${developerKey.api_key}`, 'Content-Type': 'application/json' };
const apiModels = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models', { headers: apiHeaders }))).json();
assert.deepEqual(apiModels.data.map(model => model.id), ['qwen3-8b']);
const apiCompletionPromise = lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', { method: 'POST', headers: apiHeaders, body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'Use the SDK.' }], temperature: 0, max_tokens: 99 }) }));
await new Promise(resolve => setTimeout(resolve, 0));
let apiPoll;
for (let attempt = 0; attempt < 20; attempt++) {
  apiPoll = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }));
  if (apiPoll.status === 200) break;
  await new Promise(resolve => setTimeout(resolve, 5));
}
assert.equal(apiPoll.status, 200);
const apiJob = (await apiPoll.json()).job;
assert.equal(apiJob.temperature, 0);
assert.equal(apiJob.max_tokens, 99);
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${apiJob.id}/result`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id, content: 'OpenAI compatibility works.', usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 } }) }))).status, 202);
const apiCompletion = await apiCompletionPromise;
assert.equal(apiCompletion.status, 200);
const apiCompletionBody = await apiCompletion.json();
assert.equal(apiCompletionBody.object, 'chat.completion');
assert.equal(apiCompletionBody.choices[0].message.content, 'OpenAI compatibility works.');
assert.equal(apiCompletionBody.usage.total_tokens, 9);
const streamResponse = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/chat/completions', { method: 'POST', headers: apiHeaders, body: JSON.stringify({ model: 'qwen3-8b', stream: true, messages: [{ role: 'system', content: 'Be concise.' }, { role: 'user', content: 'Stream.' }] }) }));
assert.match(streamResponse.headers.get('content-type'), /text\/event-stream/);
let streamPoll;
for (let attempt = 0; attempt < 20; attempt++) {
  streamPoll = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }));
  if (streamPoll.status === 200) break;
  await new Promise(resolve => setTimeout(resolve, 5));
}
assert.equal(streamPoll.status, 200);
const streamJob = (await streamPoll.json()).job;
assert.equal(streamJob.stream, true);
for (const chunk of [{ delta: 'hello ' }, { delta: 'from Dasha' }, { done: true, usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } }]) {
  assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${streamJob.id}/chunk`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id, ...chunk }) }))).status, 202);
}
const streamText = await streamResponse.text();
assert.match(streamText, /"content":"hello "/);
assert.match(streamText, /"content":"from Dasha"/);
assert.match(streamText, /"finish_reason":"stop"/);
assert.match(streamText, /data: \[DONE\]/);
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/keys/${developerKey.id}`, { method: 'DELETE', headers: userHeaders }))).status, 200);
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/models', { headers: apiHeaders }))).status, 401);
const nightCreated = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/night', { method: 'POST', headers: userHeaders, body: JSON.stringify({ title: 'Morning research', template: 'research', model: 'qwen3-8b', repeat: 'none', prompt: 'Research community inference reliability.' }) }))).json();
assert.equal(nightCreated.task.status, 'running');
const nightPoll = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }));
assert.equal(nightPoll.status, 200);
const nightJob = (await nightPoll.json()).job;
assert.equal(nightJob.messages[0].role, 'system');
assert.match(nightJob.messages[0].content, /Research the request carefully/);
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${nightJob.id}/result`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id, content: 'Night Shift report.' }) }))).status, 202);
const nightTasks = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/night', { headers: userHeaders }))).json();
assert.equal(nightTasks.tasks[0].status, 'running');
assert.equal(nightTasks.tasks[0].stepIndex, 1);
assert.equal(nightTasks.tasks[0].artifacts[0].content, 'Night Shift report.');
const nightReviewJob = (await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }))).json()).job;
assert.match(nightReviewJob.messages[1].content, /Challenge the findings below/);
assert.match(nightReviewJob.messages[1].content, /Night Shift report\./);
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${nightReviewJob.id}/result`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id, content: 'Night Shift critique.' }) }))).status, 202);
const nightReviewTasks = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/night', { headers: userHeaders }))).json();
assert.equal(nightReviewTasks.tasks[0].status, 'running');
assert.equal(nightReviewTasks.tasks[0].stepIndex, 2);
const nightSynthesisJob = (await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }))).json()).job;
assert.match(nightSynthesisJob.messages[1].content, /Synthesize a final decision-ready report/);
assert.match(nightSynthesisJob.messages[1].content, /Night Shift critique\./);
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${nightSynthesisJob.id}/result`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id, content: 'Night Shift final report.' }) }))).status, 202);
const completedNightTasks = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/night', { headers: userHeaders }))).json();
assert.equal(completedNightTasks.tasks[0].status, 'complete');
assert.deepEqual(completedNightTasks.tasks[0].artifacts.map(artifact => artifact.content), ['Night Shift final report.', 'Night Shift critique.', 'Night Shift report.']);
const nightSummary = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/night/summary', { headers: userHeaders }))).json();
assert.equal(nightSummary.artifacts[0].title, 'Morning research');
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/night/${nightCreated.task.id}`, { method: 'DELETE', headers: userHeaders }))).status, 200);
const dailyCreated = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/night', { method: 'POST', headers: userHeaders, body: JSON.stringify({ title: 'Daily briefing', template: 'briefing', model: 'qwen3-8b', repeat: 'daily', run_at: Date.now() + 60_000, prompt: 'Summarize the day.' }) }))).json();
assert.equal(dailyCreated.task.status, 'scheduled');
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/night/${dailyCreated.task.id}/run`, { method: 'POST', headers: userHeaders }))).status, 202);
const dailyPoll = await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }));
const dailyJob = (await dailyPoll.json()).job;
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${dailyJob.id}/result`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id, content: 'Daily result.' }) }))).status, 202);
const dailyTask = (await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/night', { headers: userHeaders }))).json()).tasks.find(task => task.id === dailyCreated.task.id);
assert.equal(dailyTask.status, 'scheduled');
assert.ok(dailyTask.nextRunAt > Date.now());
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/night/${dailyCreated.task.id}`, { method: 'DELETE', headers: userHeaders }))).status, 200);
const cancellable = await (await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/jobs', { method: 'POST', headers: userHeaders, body: JSON.stringify({ model: 'qwen3-8b', messages: [{ role: 'user', content: 'Earlier.' }, { role: 'assistant', content: 'Reply.' }, { role: 'user', content: 'Delete me.' }] }) }))).json();
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }))).status, 200);
const cancellableKey = `compute:job:${cancellable.id}`;
rows.get(cancellableKey).leaseExpiresAt = Date.now() + 1000;
const renewed = await (await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${cancellable.id}/heartbeat`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id }) }))).json();
assert.deepEqual(renewed, { ok: true, cancelled: false, lease_seconds: 300 });
assert.ok(rows.get(cancellableKey).leaseExpiresAt > Date.now() + 4 * 60_000, 'heartbeat must renew the lease');
await lobby.alarm();
assert.equal(rows.get(cancellableKey).status, 'leased', 'renewed work must not be requeued');
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${cancellable.id}/heartbeat`, { method: 'POST', headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' }, body: JSON.stringify({ provider_id: credentials.provider_id }) }))).status, 401);
const cancelled = await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${cancellable.id}`, { method: 'DELETE', headers: userHeaders }));
assert.deepEqual(await cancelled.json(), { ok: true, prompt_deleted: true });
assert.equal(rows.get(cancellableKey).messages, null, 'cancelled leased prompts must be removed immediately');
assert.deepEqual(await (await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/jobs/${cancellable.id}/heartbeat`, { method: 'POST', headers: providerHeaders, body: JSON.stringify({ provider_id: credentials.provider_id }) }))).json(), { ok: true, cancelled: true });
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/jobs/${cancellable.id}`, { headers: userHeaders }))).status, 404);
assert.equal((await lobby.fetch(new Request(`https://lobby.getdasha.com/compute/api/providers/${credentials.provider_id}`, { method: 'DELETE', headers: userHeaders }))).status, 200);
assert.equal((await lobby.fetch(new Request('https://lobby.getdasha.com/compute/api/providers/poll', { method: 'POST', headers: providerHeaders, body: JSON.stringify(heartbeat) }))).status, 401);
rows.set('compute:job:expired', { id: 'expired', status: 'queued', model: 'qwen3-8b', expiresAt: Date.now() - 1 });
await lobby.alarm();
assert.equal(rows.has('compute:job:expired'), false, 'alarm must prune expired prompt-bearing jobs');
const executablePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
if (!existsSync(executablePath)) {
  console.log('dasha compute: API/network passed (skip browser — no CHROME_BIN)');
  process.exit(0);
}
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const computeUrl = new URL('./dasha-compute.html', import.meta.url).href;
await page.goto(computeUrl, { waitUntil: 'domcontentloaded' });
assert.equal(await page.$eval('body', node => node.dataset.step), 'gate');
{
  const paint = await page.evaluate(() => {
    const shown = id => {
      const el = document.getElementById(id);
      return !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
    };
    return {
      primaries: [...document.querySelectorAll('.primary')].filter(el => el.offsetParent && !el.closest('[hidden]')).map(el => el.id || el.textContent.trim()),
      use: shown('pick-ask'),
      provide: shown('pick-provide'),
      pay: shown('pick-pay'),
      credits: shown('pick-credits'),
      market: !!document.getElementById('ocm-door'),
      prompt: shown('prompt'),
      mixture: shown('eng-mixture'),
      tabs: !!document.querySelector('nav.nav[role=tablist]'),
      gateQ: document.querySelector('#step-gate .tf-q')?.textContent || '',
    };
  });
  assert.equal(paint.gateQ, 'Start.');
  assert.equal(paint.use, true);
  assert.equal(paint.provide, true);
  assert.equal(paint.pay, true);
  assert.equal(paint.credits, true);
  assert.equal(paint.market, false);
  assert.equal(paint.prompt, false);
  assert.equal(paint.mixture, false);
  assert.equal(paint.tabs, false);
  assert.ok(paint.primaries.includes('pick-ask'));
}
await page.click('#pick-ask');
assert.equal(await page.$eval('body', node => node.dataset.step), 'ask');
assert.equal(await page.$eval('#engine', node => node.value), 'hosted');
await page.evaluate(() => {
  conversation = [];
  document.getElementById('prompt').value = 'Keyboard shortcut.';
  loggedIn = true;
  hostedLive = true;
  window.fetch = async (url) => {
    if (String(url).includes('/compute/api/chat')) {
      return new Response(JSON.stringify({ answer: 'Shortcut works.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  updateRun();
});
await page.focus('#prompt');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.getElementById('answer').textContent.includes('Shortcut works.'));
assert.equal(await page.$eval('body', node => node.dataset.step), 'answer');
await page.click('#pick-provide-after');
assert.equal(await page.$eval('body', node => node.dataset.step), 'provide-name');
assert.equal(await page.$eval('#step-provide-name', node => node.hidden), false);
await page.click('#provide-next');
assert.equal(await page.$eval('body', node => node.dataset.step), 'provide-reg');
assert.equal(await page.$eval('#provider-login', node => node.hidden), false);
await page.evaluate(() => {
  loggedIn = true;
  $('provider-login').hidden = true;
  $('register-provider').hidden = false;
  $('register-provider').disabled = false;
  api = async path => {
    if (path === '/compute/api/providers/register') return { coordinator_url: 'https://lobby.getdasha.com/compute/api', provider_id: 'mac_test', provider_token: 'dcp_one_time' };
    if (path === '/compute/api/providers') return { providers: [{ id: 'mac_test', name: 'Test Mac', models: ['qwen3-8b'], last_seen_at: null, online: false }] };
    if (path === '/compute/api/status') return { live: true };
    if (path === '/auth/status') return { loggedIn: true, provider: 'wallet', wallet: { display: '1111…1111' } };
    if (path === '/compute/api/network') return { providers_online: 0, models_available: [] };
    if (path === '/compute/api/keys') return { keys: [] };
    throw Error('unexpected test path '+path);
  };
});
await page.$eval('#provider-name', node => { node.value = '   '; });
await page.click('#register-provider');
assert.equal(await page.$eval('#provider-status', node => node.textContent), 'Name this Mac first.');
await page.$eval('#provider-name', node => { node.value = 'Test Mac'; });
await page.evaluate(() => { showTf('provide-reg'); });
await page.click('#register-provider');
await page.waitForFunction(() => document.getElementById('setup').textContent.includes('dcp_one_time'));
assert.match(await page.$eval('#setup', node => node.textContent), /\.dasha-provider-key/);
assert.match(await page.$eval('#setup', node => node.textContent), /chmod 0600/);
assert.doesNotMatch(await page.$eval('#setup', node => node.textContent), /DASHA_PROVIDER_KEY=/);
assert.equal(await page.$eval('body', node => node.dataset.step), 'provide-done');
await page.evaluate(() => { sent=1; loggedIn=true; apiKeyCount=0; paintAnswerApi(); showTf('answer'); });
await page.click('#answer-api');
assert.equal(await page.$eval('body', node => node.dataset.step), 'build');
assert.equal(await page.$eval('#build', node => node.open), true);
await page.$eval('#gateway', node => { node.value = 'http://localhost:9999/v1'; node.dispatchEvent(new Event('input')); });
assert.match(await page.$eval('#code', node => node.textContent), /localhost:9999\/v1\/chat\/completions/);
await page.evaluate(() => { providersOnline = 0; networkModels = new Set(); updateRun(); showTf('how'); });
await page.click('#eng-mixture');
assert.equal(await page.$eval('#engine', node => node.value), 'mixture');
assert.equal(await page.$eval('body', node => node.dataset.step), 'night', '0 Macs skips model');
assert.equal(await page.$eval('#night-use-hosted', node => !!node.offsetParent), true);
await page.evaluate(() => { providersOnline = 1; networkModels = new Set(['qwen3-8b']); updateRun(); showTf('how'); });
await page.click('#eng-mixture');
assert.equal(await page.$eval('body', node => node.dataset.step), 'model', 'online Mac opens model');
assert.doesNotMatch(await page.content(), /ollama pull raptor/i);
await page.setRequestInterception(true);
page.on('request', request => {
  if (request.url().startsWith('https://www.getdasha.com/login')) {
    request.respond({ contentType: 'text/html', body: loginHtml.replace(/<script src="[^"]+x-connect\.js"[^>]*><\/script>/, `<script>${loginClient}</script>`) });
  } else if (request.url() === 'https://lobby.getdasha.com/auth/status') {
    request.respond({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': 'https://www.getdasha.com', 'Access-Control-Allow-Credentials': 'true' }, body: JSON.stringify({ loggedIn: true, provider: 'wallet', wallet: { display: '1111…1111' } }) });
  } else request.abort();
});
await page.goto('https://www.getdasha.com/login?return=/compute', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-login-next]:not([hidden])');
assert.equal(await page.$eval('[data-login-next] a', node => node.href), 'https://www.getdasha.com/compute');
await page.goto('https://www.getdasha.com/login?return=/compute%23provide', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-login-next]:not([hidden])');
assert.equal(await page.$eval('[data-login-next] a', node => node.href), 'https://www.getdasha.com/compute#provide');
await page.goto('https://www.getdasha.com/login?return=/compute%23build', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-login-next]:not([hidden])');
assert.equal(await page.$eval('[data-login-next] a', node => node.href), 'https://www.getdasha.com/compute#build');
await page.goto('https://www.getdasha.com/login?return=https://evil.example', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-login-next]:not([hidden])');
assert.equal(await page.$eval('[data-login-next] a', node => node.href), 'https://www.getdasha.com/simp#holder', 'login must reject open redirects');
await browser.close();
console.log('dasha compute: unified Ask/Provide/Marketplace/Build + API contract passed');
