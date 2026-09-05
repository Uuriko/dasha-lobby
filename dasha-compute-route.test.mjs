import assert from 'node:assert/strict';
import { createSessionToken } from './dasha-lobby-x.mjs';
import worker from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const compute = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(compute.status, 200);
assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
const body = await compute.text();
assert.match(body, /Dasha Compute/);
assert.match(body, /Start\./);
assert.match(body, /<h1 class="tf-q">Ask\.<\/h1>/);
assert.match(body, /Mixture · sub-24GB/);
assert.match(body, />Marketplace</);
assert.match(body, /hashchange/);
assert.doesNotMatch(body, /not an investment/);
assert.doesNotMatch(body, /id=[\"']tab-sponsor[\"']/);
assert.match(body, /Start\. Ask\. Provide\. Pay\. Credits\./);
assert.doesNotMatch(body, /Night Shift/);
assert.match(body, /<title>Dasha Compute/);
assert.match(body, /property="og:title" content="Dasha Compute"/);
assert.match(body, /property="og:description" content="Start\. Ask\. Provide\. Pay\. Credits\."/);
assert.match(body, /property="og:url" content="https:\/\/www\.getdasha\.com\/compute"/);
assert.match(body, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/);
assert.match(body, /name="twitter:title" content="Dasha Compute"/);
assert.match(body, /name="twitter:description" content="Start\. Ask\. Provide\. Pay\. Credits\."/);
assert.match(body, /name="twitter:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/);
assert.doesNotMatch(body, /Compute is gone/);
assert.doesNotMatch(body, /plugin\.jup\.ag/);
assert.match(body, /\[hidden\]\{display:none!important\}/);
assert.match(body, /id="provider-login"/);
assert.match(body, /id="key-login"/);
assert.doesNotMatch(body, /id=["']ocm-door["']/);
assert.match(body, /\$\('provider-login'\)\.hidden=loggedIn/);

const slash = await worker.fetch(new Request('https://www.getdasha.com/compute/'), {});
assert.equal(slash.status, 308);
assert.equal(slash.headers.get('location'), 'https://www.getdasha.com/compute');
const index = await worker.fetch(new Request('https://www.getdasha.com/compute/index.html'), {});
assert.equal(index.status, 308);
assert.equal(index.headers.get('location'), 'https://www.getdasha.com/compute');

const kit = await worker.fetch(new Request('https://www.getdasha.com/dasha-compute-open-alpha.tar.gz'), {
  ASSETS: { fetch: async () => new Response('kit', { status: 200 }) },
});
assert.equal(kit.status, 200);
assert.equal(await kit.text(), 'kit');

const studio = await worker.fetch(new Request('https://www.getdasha.com/studio'), {});
assert.equal(studio.status, 308);
assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');
const forum = await worker.fetch(new Request('https://www.getdasha.com/forum'), {});
assert.equal(forum.status, 308);
assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
const privacy = await worker.fetch(new Request('https://www.getdasha.com/privacy'), {});
assert.equal(privacy.status, 200);
assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'compute-route-secret',
};
const wwwStatus = await worker.fetch(new Request('https://www.getdasha.com/compute/api/status'), env);
assert.equal(wwwStatus.status, 200);
assert.equal((await wwwStatus.json()).live, true);
assert.equal(wwwStatus.headers.get('content-type'), 'application/json; charset=utf-8');
const wwwRoot = await worker.fetch(new Request('https://www.getdasha.com/compute/api'), env);
assert.equal(wwwRoot.status, 200);
assert.equal(wwwRoot.headers.get('content-type'), 'application/json; charset=utf-8');
assert.equal((await wwwRoot.json()).live, true);
const wwwRootSlash = await worker.fetch(new Request('https://www.getdasha.com/compute/api/'), env);
assert.equal(wwwRootSlash.status, 200);
assert.equal((await wwwRootSlash.json()).live, true);
const wwwRootOpts = await worker.fetch(new Request('https://www.getdasha.com/compute/api', { method: 'OPTIONS', headers: { Origin: 'https://www.getdasha.com' } }), env);
assert.equal(wwwRootOpts.status, 204);
assert.equal(wwwRootOpts.headers.get('access-control-allow-origin'), 'https://www.getdasha.com');
const status = await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/status'), env);
assert.equal(status.status, 200);
assert.equal((await status.json()).live, true);
const token = await createSessionToken(env, { xId: '1', handle: 'route' });
const hosted = await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/chat', {
  method: 'POST',
  headers: { Cookie: `__Host-dasha_x=${token}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Hi.' }),
}), env);
assert.equal(hosted.status, 200);

const healthz = await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/healthz', { headers: { Origin: 'https://www.getdasha.com' } }), env);
assert.equal(healthz.status, 200);
assert.equal(healthz.headers.get('access-control-allow-origin'), 'https://www.getdasha.com');
assert.deepEqual(await healthz.json(), { ok: true, service: 'dasha-compute', version: '0.3.0' });

async function assertGatewayRes(res, label) {
  assert.equal(res.status, 200, label);
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8', label);
  const text = await res.text();
  assert.doesNotMatch(text, /<!doctype/i, label);
  const parsed = JSON.parse(text);
  assert.equal(parsed.object, 'gateway', label);
  assert.equal(parsed.models, '/compute/api/v1/models', label);
  assert.ok(String(parsed.chat_completions).endsWith('chat/completions'), label);
  return parsed;
}

await assertGatewayRes(await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1'), env), 'www /compute/api/v1');
const wwwFoo = await worker.fetch(new Request('https://www.getdasha.com/compute/api/foo'), env);
assert.equal(wwwFoo.status, 404);
assert.equal(wwwFoo.headers.get('content-type'), 'application/json; charset=utf-8');
assert.deepEqual(await wwwFoo.json(), { error: 'not found' });
const lobbyFoo = await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/foo'), env);
assert.equal(lobbyFoo.status, 404);
assert.equal(lobbyFoo.headers.get('content-type'), 'application/json; charset=utf-8');
assert.deepEqual(await lobbyFoo.json(), { error: 'not found' });
await assertGatewayRes(await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1/'), env), 'www /compute/api/v1/');
await assertGatewayRes(await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/v1'), env), 'lobby /compute/api/v1');
await assertGatewayRes(await worker.fetch(new Request('https://lobby.getdasha.com/compute/api/v1/'), env), 'lobby /compute/api/v1/');
const wwwGwHead = await worker.fetch(new Request('https://www.getdasha.com/compute/api/v1', { method: 'HEAD' }), env);
assert.equal(wwwGwHead.status, 200);

const empty = { async list() { return new Map(); }, async get() {}, async put() {}, async delete() {} };
const v1 = await new ComputeNetwork({ storage: empty }, env).fetch(new Request('https://lobby.getdasha.com/compute/api/v1/network'));
assert.equal(v1.status, 200);
const v1body = await v1.json();
assert.equal(v1body.providers_online, 0);
assert.ok(Array.isArray(v1body.models_available));
const gwDo = await new ComputeNetwork({ storage: empty }, env).fetch(new Request('https://lobby.getdasha.com/compute/api/v1'));
await assertGatewayRes(gwDo, 'ComputeNetwork /compute/api/v1');

assert.match(body, /base\+'\/healthz'/);
assert.match(body, /base\+'\/v1\/network'/);

console.log('dasha-compute-route: PASS (/compute 200 edge=compute, /compute/+/index.html 308 /compute, www bare+/+status /compute/api, lobby status, kit, studio 308, forum 308, privacy 200, healthz + v1/network + v1 gateway, unknown /compute/api/foo JSON 404)');

const sponsors = await worker.fetch(new Request('https://www.getdasha.com/compute/api/sponsors'), {});
assert.equal(sponsors.status, 200);
assert.equal(sponsors.headers.get('content-type'), 'application/json; charset=utf-8');
const board = await sponsors.json();
assert.equal(board.raised_usd, 0);
assert.equal(board.goal_usd, 17292);
assert.equal(board.treasury, 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb');
assert.equal(board.machines.length, 8);
assert.equal(board.machines[0].status, 'open');
assert.equal(board.credit.length, 0);
assert.match(JSON.stringify(board.machines.map(m => m.name).join('|')), /MacBook Pro 16/);
const sponsorHead = await worker.fetch(new Request('https://www.getdasha.com/compute/api/sponsors', { method: 'HEAD' }), {});
assert.equal(sponsorHead.status, 200);

const store = new Map();
const network = new ComputeNetwork({ storage: {
  async get(key) { return store.get(key) ?? null; },
  async put(key, value) { store.set(key, structuredClone(value)); },
  async delete(key) { store.delete(key); },
  async list({ prefix }) { return new Map([...store.entries()].filter(([key]) => key.startsWith(prefix))); },
} }, { LOBBY_SESSION_SECRET: 'compute-route-secret' });
const openBoard = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors'));
assert.equal(openBoard.status, 200);
assert.equal((await openBoard.json()).machines.filter(m => m.status === 'open').length, 8);
const sponsorToken = await createSessionToken({ LOBBY_SESSION_SECRET: 'compute-route-secret' }, { xId: '7', handle: 'dash_eats' });
const named = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors', {
  method: 'POST',
  headers: { Cookie: `__Host-dasha_x=${sponsorToken}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' },
  body: JSON.stringify({ machine: 'mbp-16', name: 'dash_eats', url: 'https://getdasha.com' }),
}), 'https://www.getdasha.com');
assert.equal(named.status, 201);
const namedBoard = await named.json();
assert.equal(namedBoard.machines.find(m => m.id === 'mbp-16').status, 'named');
assert.equal(namedBoard.machines.find(m => m.id === 'mbp-16').sponsor.handle, 'dash_eats');
assert.equal(namedBoard.credit.length, 0, 'named is not funded; Use credit stays empty');
const clash = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors', {
  method: 'POST',
  headers: { Cookie: `__Host-dasha_x=${sponsorToken}`, Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' },
  body: JSON.stringify({ machine: 'mbp-16', name: 'other' }),
}), 'https://www.getdasha.com');
assert.equal(clash.status, 409);

