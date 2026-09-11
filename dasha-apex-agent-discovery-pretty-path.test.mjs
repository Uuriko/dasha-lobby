#!/usr/bin/env node
/**
 * Leftover pretty path: live GET/HEAD /agent.md /agents.md /AGENTS.md
 * /README.md /api.md /create-key /guest /guest-key /guest-keys
 * (+slash / Title-case) were HTML Not found 404 on www + lobby while
 * /compute/skill.md is the agent contract (PR #196 already folded the
 * /compute/* peers). Agents guessing root paths hit HTML-404.
 * Fold this apex leftover family via the same
 * POTTER_COMPUTE_AGENT_DISCOVERY_SKILL_308_PATHS set to
 * /compute/skill.md.
 * Singular /agent stays tab leftover → /compute (do not invent).
 * Bare /agents → agents.txt (#199). Exact /agents.txt + /agents.json 200.
 * POST /compute/api/guest-keys stays 201 mint (do not 308 the API path).
 * Compute-prefixed peers stay skill.md. Exact /compute/skill.md 200.
 * Lobby skill dests same-host via potterHome308Response. Disk only.
 * Never plugin.jup.ag. No ocm rewrite. No Designer. Do not invent DEX peers.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { ComputeNetwork } from './dasha-compute-network.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_AGENT_DISCOVERY_SKILL_308_PATHS/, 'agent-discovery leftover set');
assert.match(workerSrc, /Apex siblings \/agent\.md \/agents\.md \/AGENTS\.md/, 'apex leftover comment');
assert.match(workerSrc, /POST \/compute\/api\/guest-keys stays 201 mint/, 'API mint stays');
assert.match(workerSrc, /do not invent \/agent → skill/, 'singular /agent stays tab');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

const discoverySet = workerSrc.match(/const POTTER_COMPUTE_AGENT_DISCOVERY_SKILL_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/agent.md', '/agent.md/',
  '/agents.md', '/agents.md/',
  '/readme.md', '/readme.md/',
  '/api.md', '/api.md/',
  '/create-key', '/create-key/',
  '/guest', '/guest/',
  '/guest-key', '/guest-key/',
  '/guest-keys', '/guest-keys/',
]) {
  assert.match(discoverySet, new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), `set lists ${path}`);
}
assert.doesNotMatch(discoverySet, /['"]\/agent['"]/, 'do not invent singular /agent in discovery set');
assert.doesNotMatch(discoverySet, /['"]\/agents['"]/, 'do not claim /agents (agents.txt leftover)');
assert.doesNotMatch(discoverySet, /['"]\/readme['"]/, 'do not invent /readme (no .md)');
assert.doesNotMatch(discoverySet, /['"]\/compute\/api\/guest-keys['"]/, 'do not 308 the mint API path');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const SKILL = `${WWW}/compute/skill.md`;
const LOBBY_SKILL = `${LOBBY}/compute/skill.md`;
const COMPUTE = `${WWW}/compute`;
const AGENTS_TXT = `${WWW}/agents.txt`;

const FOLDS = [
  '/agent.md',
  '/agent.md/',
  '/Agent.md',
  '/AGENT.MD',
  '/Agent.md/',
  '/AGENT.MD/',
  '/agents.md',
  '/agents.md/',
  '/AGENTS.md',
  '/Agents.md',
  '/AGENTS.MD',
  '/Agents.md/',
  '/AGENTS.MD/',
  '/README.md',
  '/readme.md',
  '/readme.md/',
  '/Readme.md',
  '/README.MD',
  '/Readme.md/',
  '/README.MD/',
  '/api.md',
  '/api.md/',
  '/Api.md',
  '/API.MD',
  '/Api.md/',
  '/API.MD/',
  '/create-key',
  '/create-key/',
  '/Create-key',
  '/CREATE-KEY',
  '/Create-Key/',
  '/CREATE-KEY/',
  '/guest',
  '/guest/',
  '/Guest',
  '/GUEST',
  '/Guest/',
  '/GUEST/',
  '/guest-key',
  '/guest-key/',
  '/Guest-key',
  '/GUEST-KEY',
  '/Guest-Key/',
  '/GUEST-KEY/',
  '/guest-keys',
  '/guest-keys/',
  '/Guest-keys',
  '/GUEST-KEYS',
  '/Guest-Keys/',
  '/GUEST-KEYS/',
];

const COMPUTE_PEERS = [
  '/compute/agent.md',
  '/compute/agents.md',
  '/compute/AGENTS.md',
  '/compute/README.md',
  '/compute/api.md',
  '/compute/create-key',
  '/compute/guest',
  '/compute/guest-key',
  '/compute/guest-keys',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), SKILL, path);
}
for (const path of COMPUTE_PEERS) {
  assert.equal(potterHome308Dest(path), SKILL, `peer ${path}`);
}
assert.equal(potterHome308Dest('/agent'), COMPUTE, 'singular /agent stays compute leftover');
assert.equal(potterHome308Dest('/agent/'), COMPUTE, 'singular /agent/ stays compute leftover');
assert.equal(potterHome308Dest('/agents'), AGENTS_TXT, 'bare /agents stays agents.txt leftover');
assert.equal(potterHome308Dest('/agents/'), AGENTS_TXT, 'bare /agents/ stays agents.txt leftover');
assert.equal(potterHome308Dest('/agents.txt'), null, '/agents.txt stays 200');
assert.equal(potterHome308Dest('/agents.json'), null, '/agents.json stays 200');
assert.equal(potterHome308Dest('/compute/skill.md'), null, '/compute/skill.md stays 200');
assert.equal(potterHome308Dest('/compute/mcp.json'), null, '/compute/mcp.json stays 200');
assert.equal(potterHome308Dest('/compute/api/guest-keys'), null, '/compute/api/guest-keys stays mint API');
assert.equal(potterHome308Dest('/compute/api/guest-keys/'), null, '/compute/api/guest-keys/ stays mint API');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.notEqual(potterHome308Dest('/readme'), SKILL, 'do not invent /readme');
assert.notEqual(potterHome308Dest('/compute/readme'), SKILL, 'do not invent /compute/readme');
assert.notEqual(potterHome308Dest('/jupiter'), SKILL, 'do not invent DEX peer /jupiter');
assert.notEqual(potterHome308Dest('/orca'), SKILL, 'do not invent DEX peer /orca');
assert.notEqual(potterHome308Dest('/agent.mdx'), SKILL, 'do not invent /agent.mdx');

function memoryStorage() {
  const rows = new Map();
  return {
    rows,
    async get(key) { return rows.get(key); },
    async put(key, value) {
      if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
      else rows.set(key, value);
    },
    async delete(key) { rows.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
  };
}

const storage = memoryStorage();
const env = {
  LOBBY_SESSION_SECRET: 'apex-agent-discovery-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName: () => 'public',
    get: () => ({
      fetch: (request) => new ComputeNetwork({ storage }, env).fetch(request),
    }),
  },
};

for (const host of ['www.getdasha.com', 'getdasha.com', 'lobby.getdasha.com']) {
  const skillLoc = host === 'lobby.getdasha.com' ? LOBBY_SKILL : SKILL;
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), skillLoc, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of COMPUTE_PEERS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method} peer`);
      assert.equal(res.headers.get('location'), skillLoc, `${host} ${path} ${method} peer loc`);
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const agent = await edgeWorker.fetch(new Request(`https://${host}/agent`, { method }), env);
    assert.equal(agent.status, 308, `${host} /agent ${method} stays tab`);
    assert.equal(agent.headers.get('location'), COMPUTE, `${host} /agent ${method} loc`);
    assert.doesNotMatch(agent.headers.get('location') || '', /skill\.md/, `${host} /agent ${method} not skill`);
    if (method === 'HEAD') assert.equal(await agent.text(), '');

    const agents = await edgeWorker.fetch(new Request(`https://${host}/agents`, { method }), env);
    assert.equal(agents.status, 308, `${host} /agents ${method} stays agents.txt leftover`);
    assert.equal(agents.headers.get('location'), AGENTS_TXT, `${host} /agents ${method} loc`);
    if (method === 'HEAD') assert.equal(await agents.text(), '');
  }
  const face = await edgeWorker.fetch(new Request(`https://${host}/compute/skill.md`), env);
  assert.equal(face.status, 200, `${host} /compute/skill.md stays 200`);
  assert.match(face.headers.get('content-type') || '', /text\/markdown/);
  assert.match(await face.text(), /Guest key: POST \/compute\/api\/guest-keys/, `${host} skill names guest mint`);

  for (const path of ['/agents.txt', '/agents.json']) {
    const machine = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(machine.status, 200, `${host} ${path} stays 200`);
    assert.equal(machine.headers.get('location'), null, `${host} ${path} no 308`);
  }

  const apiGet = await edgeWorker.fetch(new Request(`https://${host}/compute/api/guest-keys`), env);
  assert.notEqual(apiGet.status, 308, `${host} GET /compute/api/guest-keys is not 308`);
  assert.equal(apiGet.status, 200, `${host} GET /compute/api/guest-keys stays contract`);

  const minted = await edgeWorker.fetch(new Request(`https://${host}/compute/api/guest-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `203.0.113.${90 + host.length}` },
    body: '{}',
  }), env);
  assert.notEqual(minted.status, 308, `${host} POST /compute/api/guest-keys is not 308`);
  assert.equal(minted.status, 201, `${host} POST /compute/api/guest-keys still mintable`);
  const body = await minted.json();
  assert.match(body.api_key, /^dgk_/, `${host} POST guest-keys mints dgk_`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/agent.md</loc>`), 'sitemap omits leftover /agent.md');
assert.ok(!sitemapXml.includes(`${WWW}/agents.md</loc>`), 'sitemap omits leftover /agents.md');
assert.ok(!sitemapXml.includes(`${WWW}/readme.md</loc>`), 'sitemap omits leftover /readme.md');
assert.ok(!sitemapXml.includes(`${WWW}/api.md</loc>`), 'sitemap omits leftover /api.md');
assert.ok(!sitemapXml.includes(`${WWW}/create-key</loc>`), 'sitemap omits leftover /create-key');
assert.ok(!sitemapXml.includes(`${WWW}/guest</loc>`), 'sitemap omits leftover /guest');
assert.ok(!sitemapXml.includes(`${WWW}/guest-key</loc>`), 'sitemap omits leftover /guest-key');
assert.ok(!sitemapXml.includes(`${WWW}/guest-keys</loc>`), 'sitemap omits leftover /guest-keys');

console.log('dasha-apex-agent-discovery-pretty-path: PASS (/agent.md+/agents.md+/AGENTS.md+/README.md+/api.md+/create-key+/guest+/guest-key+/guest-keys 308 skill.md www+lobby GET+HEAD +slash Title-case; compute peers stay; /agent stays /compute; /agents stays agents.txt; /agents.txt+/agents.json 200; POST /compute/api/guest-keys still mint; no plugin.jup.ag)');
