#!/usr/bin/env node
/**
 * Leftover pretty path: live GET/HEAD /compute/agent.md /compute/agents.md
 * /compute/AGENTS.md /compute/README.md /compute/api.md /compute/create-key
 * /compute/guest /compute/guest-key /compute/guest-keys (+slash / Title-case)
 * were HTML Not found 404 (not JSON fail-loud) on www + lobby while
 * /compute/skill.md is the agent contract. No separate agent.md. Fold this
 * path-family to /compute/skill.md.
 * Exact /compute/agent stays tab leftover → /compute (do not fold).
 * POST /compute/api/guest-keys stays 201 mint (do not 308 the API path).
 * Exact /compute/skill.md + /compute/mcp.json stay 200.
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
assert.match(workerSrc, /Live GET\/HEAD \/compute\/agent\.md \/compute\/agents\.md/, 'live 404 comment');
assert.match(workerSrc, /separate agent\.md/, 'honest: skill is the agent contract');
assert.match(workerSrc, /POST \/compute\/api\/guest-keys stays 201 mint/, 'API mint stays');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const SKILL = `${WWW}/compute/skill.md`;
const LOBBY_SKILL = `${LOBBY}/compute/skill.md`;
const COMPUTE = `${WWW}/compute`;

const FOLDS = [
  '/compute/agent.md',
  '/compute/agent.md/',
  '/Compute/agent.md',
  '/COMPUTE/AGENT.MD',
  '/Compute/Agent.md',
  '/Compute/Agent.md/',
  '/COMPUTE/AGENT.MD/',
  '/compute/agents.md',
  '/compute/agents.md/',
  '/compute/AGENTS.md',
  '/Compute/agents.md',
  '/COMPUTE/AGENTS.MD',
  '/Compute/Agents.md',
  '/Compute/Agents.md/',
  '/COMPUTE/AGENTS.MD/',
  '/compute/README.md',
  '/compute/readme.md',
  '/compute/readme.md/',
  '/Compute/readme.md',
  '/COMPUTE/README.MD',
  '/Compute/Readme.md',
  '/Compute/Readme.md/',
  '/COMPUTE/README.MD/',
  '/compute/api.md',
  '/compute/api.md/',
  '/Compute/api.md',
  '/COMPUTE/API.MD',
  '/Compute/Api.md',
  '/Compute/Api.md/',
  '/COMPUTE/API.MD/',
  '/compute/create-key',
  '/compute/create-key/',
  '/Compute/create-key',
  '/COMPUTE/CREATE-KEY',
  '/Compute/Create-key',
  '/Compute/Create-Key/',
  '/COMPUTE/CREATE-KEY/',
  '/compute/guest',
  '/compute/guest/',
  '/Compute/guest',
  '/COMPUTE/GUEST',
  '/Compute/Guest',
  '/Compute/Guest/',
  '/COMPUTE/GUEST/',
  '/compute/guest-key',
  '/compute/guest-key/',
  '/Compute/guest-key',
  '/COMPUTE/GUEST-KEY',
  '/Compute/Guest-key',
  '/Compute/Guest-Key/',
  '/COMPUTE/GUEST-KEY/',
  '/compute/guest-keys',
  '/compute/guest-keys/',
  '/Compute/guest-keys',
  '/COMPUTE/GUEST-KEYS',
  '/Compute/Guest-keys',
  '/Compute/Guest-Keys/',
  '/COMPUTE/GUEST-KEYS/',
];

const TAB_UNCHANGED = [
  ['/compute/agent', COMPUTE],
  ['/compute/agent/', COMPUTE],
  ['/Compute/agent', COMPUTE],
  ['/COMPUTE/AGENT', COMPUTE],
  ['/compute/agents', COMPUTE],
  ['/compute/agents/', COMPUTE],
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), SKILL, path);
}
for (const [path, dest] of TAB_UNCHANGED) {
  assert.equal(potterHome308Dest(path), dest, `unchanged ${path}`);
}
assert.equal(potterHome308Dest('/compute/skill.md'), null, '/compute/skill.md stays 200');
assert.equal(potterHome308Dest('/compute/mcp.json'), null, '/compute/mcp.json stays 200');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays JSON');
assert.equal(potterHome308Dest('/compute/api/guest-keys'), null, '/compute/api/guest-keys stays mint API');
assert.equal(potterHome308Dest('/compute/api/guest-keys/'), null, '/compute/api/guest-keys/ stays mint API');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.notEqual(potterHome308Dest('/compute/readme'), SKILL, 'do not invent /compute/readme');
assert.equal(potterHome308Dest('/agent.md'), SKILL, 'apex /agent.md leftover skill');
assert.equal(potterHome308Dest('/agents.md'), SKILL, 'apex /agents.md leftover skill');
assert.equal(potterHome308Dest('/create-key'), SKILL, 'apex /create-key leftover skill');
assert.equal(potterHome308Dest('/guest-keys'), SKILL, 'apex /guest-keys leftover skill');
assert.notEqual(potterHome308Dest('/compute/jupiter'), SKILL, 'do not invent DEX peer /compute/jupiter');
assert.notEqual(potterHome308Dest('/compute/orca'), SKILL, 'do not invent DEX peer /compute/orca');
assert.notEqual(potterHome308Dest('/compute/agent.mdx'), SKILL, 'do not invent /compute/agent.mdx');
assert.notEqual(potterHome308Dest('/compute/api/docs'), null, '/compute/api/docs already skill family');

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
  LOBBY_SESSION_SECRET: 'compute-agent-discovery-pretty-path-secret',
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
  for (const method of ['GET', 'HEAD']) {
    const agent = await edgeWorker.fetch(new Request(`https://${host}/compute/agent`, { method }), env);
    assert.equal(agent.status, 308, `${host} /compute/agent ${method} stays tab`);
    assert.equal(agent.headers.get('location'), COMPUTE, `${host} /compute/agent ${method} loc`);
    assert.doesNotMatch(agent.headers.get('location') || '', /skill\.md/, `${host} /compute/agent ${method} not skill`);
    if (method === 'HEAD') assert.equal(await agent.text(), '');
  }
  const face = await edgeWorker.fetch(new Request(`https://${host}/compute/skill.md`), env);
  assert.equal(face.status, 200, `${host} /compute/skill.md stays 200`);
  assert.match(face.headers.get('content-type') || '', /text\/markdown/);
  assert.match(await face.text(), /Guest key: POST \/compute\/api\/guest-keys/, `${host} skill names guest mint`);

  const mcp = await edgeWorker.fetch(new Request(`https://${host}/compute/mcp.json`), env);
  assert.equal(mcp.status, 200, `${host} /compute/mcp.json stays 200`);
  assert.match(mcp.headers.get('content-type') || '', /application\/json/);

  const apiGet = await edgeWorker.fetch(new Request(`https://${host}/compute/api/guest-keys`), env);
  assert.notEqual(apiGet.status, 308, `${host} GET /compute/api/guest-keys is not 308`);
  assert.equal(apiGet.status, 200, `${host} GET /compute/api/guest-keys stays contract`);

  const minted = await edgeWorker.fetch(new Request(`https://${host}/compute/api/guest-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `203.0.113.${80 + host.length}` },
    body: '{}',
  }), env);
  assert.notEqual(minted.status, 308, `${host} POST /compute/api/guest-keys is not 308`);
  assert.equal(minted.status, 201, `${host} POST /compute/api/guest-keys still mintable`);
  const body = await minted.json();
  assert.match(body.api_key, /^dgk_/, `${host} POST guest-keys mints dgk_`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/compute/agent.md</loc>`), 'sitemap omits leftover /compute/agent.md');
assert.ok(!sitemapXml.includes(`${WWW}/compute/agents.md</loc>`), 'sitemap omits leftover /compute/agents.md');
assert.ok(!sitemapXml.includes(`${WWW}/compute/readme.md</loc>`), 'sitemap omits leftover /compute/readme.md');
assert.ok(!sitemapXml.includes(`${WWW}/compute/api.md</loc>`), 'sitemap omits leftover /compute/api.md');
assert.ok(!sitemapXml.includes(`${WWW}/compute/create-key</loc>`), 'sitemap omits leftover /compute/create-key');
assert.ok(!sitemapXml.includes(`${WWW}/compute/guest</loc>`), 'sitemap omits leftover /compute/guest');
assert.ok(!sitemapXml.includes(`${WWW}/compute/guest-key</loc>`), 'sitemap omits leftover /compute/guest-key');
assert.ok(!sitemapXml.includes(`${WWW}/compute/guest-keys</loc>`), 'sitemap omits leftover /compute/guest-keys');

console.log('dasha-compute-agent-discovery-pretty-path: PASS (/compute/agent.md+/agents.md+/AGENTS.md+/README.md+/api.md+/create-key+/guest+/guest-key+/guest-keys 308 skill.md www+lobby GET+HEAD; /compute/agent stays /compute; POST /compute/api/guest-keys still mint; skill.md+mcp.json 200; no plugin.jup.ag)');
