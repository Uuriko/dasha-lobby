#!/usr/bin/env node
/**
 * Motley leftover agent-discovery doors: live GET/HEAD /api/lobby + nested
 * /compute/api/{agents.md,agent.md,AGENTS.md,swagger.json,faucet,lobby,bag,
 * crew,which,simp,forum,robots.txt,sitemap.xml,security.txt,digest,digest.json}
 * (+slash / Title-case) html-404 while faces already 200.
 * Fold to documented faces. /forum dest is /lobby (forum 308). Nested
 * swagger.json dest is /compute/api (same as apex /swagger.json leftover).
 * Agent.md family dest is /compute/skill.md. Lobby skill + /compute/api
 * dests stay same-host via potterHome308Response. Exact faces stay 200.
 * Apex /api/benchmarks.json (+/) Title-case 308 → /benchmarks (lobby same-host).
 * Nested /compute/api/benchmarks.json already live leftover — keep it.
 * Bare /compute/api/digest (+/) Title-case 308 → /digest.json (sibling
 * digest.json keep). Do not retarget apex /api/digest.
 * Do not invent /api/models /api/providers /api/v1 /api/v1/status.
 * Disk only. No Designer. Never plugin.jup.ag. No Muse HTML. No Room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /Motley leftover agent-discovery doors/, 'motley leftover comment');
assert.match(workerSrc, /POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST/, 'motley leftover map');
assert.match(
  workerSrc,
  /\/compute\/api\/\{agents\.md,agent\.md,AGENTS\.md,swagger\.json,faucet,lobby,bag/,
  'nested leftover comment lists Motley stems',
);
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map beats casefold catch-all');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/api/lobby', '/api/lobby/',
  '/api/benchmarks.json', '/api/benchmarks.json/',
  '/compute/api/benchmarks.json', '/compute/api/benchmarks.json/',
  '/compute/api/agents.md', '/compute/api/agents.md/',
  '/compute/api/agent.md', '/compute/api/agent.md/',
  '/compute/api/swagger.json', '/compute/api/swagger.json/',
  '/compute/api/faucet', '/compute/api/faucet/',
  '/compute/api/lobby', '/compute/api/lobby/',
  '/compute/api/bag', '/compute/api/bag/',
  '/compute/api/crew', '/compute/api/crew/',
  '/compute/api/which', '/compute/api/which/',
  '/compute/api/simp', '/compute/api/simp/',
  '/compute/api/forum', '/compute/api/forum/',
  '/compute/api/robots.txt', '/compute/api/robots.txt/',
  '/compute/api/sitemap.xml', '/compute/api/sitemap.xml/',
  '/compute/api/security.txt', '/compute/api/security.txt/',
  '/compute/api/digest.json', '/compute/api/digest.json/',
  '/compute/api/digest', '/compute/api/digest/',
]) {
  assert.match(discoveryMap, new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), `map lists ${path}`);
}
assert.doesNotMatch(discoveryMap, /['"]\/api\/forum['"]/, 'do not invent apex /api/forum');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/openapi\.json['"]/, 'openapi.json leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/benchmarks\.json['"]/, 'do not invent apex /benchmarks.json leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/digest['"]/, 'do not retarget apex /api/digest');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'do not invent /api/models leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'do not invent /api/providers leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'do not invent /api/v1 leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1\/status['"]/, 'do not invent /api/v1/status leftover');
assert.match(
  workerSrc,
  /u\.pathname === '\/benchmarks' && \(/,
  'lobby same-host rewrite lists /benchmarks leftover dest',
);

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const SKILL = `${WWW}/compute/skill.md`;
const API = `${WWW}/compute/api`;
const LOBBY_FACE = `${WWW}/lobby`;
const FAUCET = `${WWW}/faucet`;
const BAG = `${WWW}/bag`;
const CREW = `${WWW}/crew`;
const WHICH = `${WWW}/which`;
const SIMP = `${WWW}/simp`;
const ROBOTS = `${WWW}/robots.txt`;
const SITEMAP = `${WWW}/sitemap.xml`;
const SECURITY = `${WWW}/.well-known/security.txt`;
const DIGEST = `${WWW}/digest.json`;
const BENCHMARKS = `${WWW}/benchmarks`;

const FOLDS = [
  ['/api/lobby', LOBBY_FACE],
  ['/api/lobby/', LOBBY_FACE],
  ['/Api/Lobby', LOBBY_FACE],
  ['/API/LOBBY', LOBBY_FACE],
  ['/Api/Lobby/', LOBBY_FACE],
  ['/API/LOBBY/', LOBBY_FACE],
  ['/api/benchmarks.json', BENCHMARKS],
  ['/api/benchmarks.json/', BENCHMARKS],
  ['/Api/Benchmarks.json', BENCHMARKS],
  ['/API/BENCHMARKS.JSON', BENCHMARKS],
  ['/Api/Benchmarks.json/', BENCHMARKS],
  ['/compute/api/benchmarks.json', BENCHMARKS],
  ['/compute/api/benchmarks.json/', BENCHMARKS],
  ['/Compute/api/benchmarks.json', BENCHMARKS],
  ['/COMPUTE/API/BENCHMARKS.JSON', BENCHMARKS],
  ['/Compute/Api/Benchmarks.json/', BENCHMARKS],
  ['/compute/api/agents.md', SKILL],
  ['/compute/api/agents.md/', SKILL],
  ['/Compute/api/agents.md', SKILL],
  ['/COMPUTE/API/AGENTS.MD', SKILL],
  ['/Compute/Api/Agents.md/', SKILL],
  ['/compute/api/AGENTS.md', SKILL],
  ['/compute/api/AGENTS.MD/', SKILL],
  ['/compute/api/agent.md', SKILL],
  ['/compute/api/agent.md/', SKILL],
  ['/Compute/api/agent.md', SKILL],
  ['/COMPUTE/API/AGENT.MD', SKILL],
  ['/Compute/Api/Agent.md/', SKILL],
  ['/compute/api/swagger.json', API],
  ['/compute/api/swagger.json/', API],
  ['/Compute/api/swagger.json', API],
  ['/COMPUTE/API/SWAGGER.JSON', API],
  ['/Compute/Api/Swagger.json/', API],
  ['/compute/api/faucet', FAUCET],
  ['/compute/api/faucet/', FAUCET],
  ['/Compute/api/faucet', FAUCET],
  ['/COMPUTE/API/FAUCET', FAUCET],
  ['/Compute/Api/Faucet/', FAUCET],
  ['/compute/api/lobby', LOBBY_FACE],
  ['/compute/api/lobby/', LOBBY_FACE],
  ['/Compute/api/lobby', LOBBY_FACE],
  ['/COMPUTE/API/LOBBY', LOBBY_FACE],
  ['/Compute/Api/Lobby/', LOBBY_FACE],
  ['/compute/api/bag', BAG],
  ['/compute/api/bag/', BAG],
  ['/Compute/api/bag', BAG],
  ['/COMPUTE/API/BAG', BAG],
  ['/Compute/Api/Bag/', BAG],
  ['/compute/api/crew', CREW],
  ['/compute/api/crew/', CREW],
  ['/Compute/api/crew', CREW],
  ['/COMPUTE/API/CREW', CREW],
  ['/Compute/Api/Crew/', CREW],
  ['/compute/api/which', WHICH],
  ['/compute/api/which/', WHICH],
  ['/Compute/api/which', WHICH],
  ['/COMPUTE/API/WHICH', WHICH],
  ['/Compute/Api/Which/', WHICH],
  ['/compute/api/simp', SIMP],
  ['/compute/api/simp/', SIMP],
  ['/Compute/api/simp', SIMP],
  ['/COMPUTE/API/SIMP', SIMP],
  ['/Compute/Api/Simp/', SIMP],
  ['/compute/api/forum', LOBBY_FACE],
  ['/compute/api/forum/', LOBBY_FACE],
  ['/Compute/api/forum', LOBBY_FACE],
  ['/COMPUTE/API/FORUM', LOBBY_FACE],
  ['/Compute/Api/Forum/', LOBBY_FACE],
  ['/compute/api/robots.txt', ROBOTS],
  ['/compute/api/robots.txt/', ROBOTS],
  ['/Compute/api/robots.txt', ROBOTS],
  ['/COMPUTE/API/ROBOTS.TXT', ROBOTS],
  ['/Compute/Api/Robots.txt/', ROBOTS],
  ['/compute/api/sitemap.xml', SITEMAP],
  ['/compute/api/sitemap.xml/', SITEMAP],
  ['/Compute/api/sitemap.xml', SITEMAP],
  ['/COMPUTE/API/SITEMAP.XML', SITEMAP],
  ['/Compute/Api/Sitemap.xml/', SITEMAP],
  ['/compute/api/security.txt', SECURITY],
  ['/compute/api/security.txt/', SECURITY],
  ['/Compute/api/security.txt', SECURITY],
  ['/COMPUTE/API/SECURITY.TXT', SECURITY],
  ['/Compute/Api/Security.txt/', SECURITY],
  ['/compute/api/digest.json', DIGEST],
  ['/compute/api/digest.json/', DIGEST],
  ['/Compute/api/digest.json', DIGEST],
  ['/COMPUTE/API/DIGEST.JSON', DIGEST],
  ['/Compute/Api/Digest.json/', DIGEST],
  ['/compute/api/digest', DIGEST],
  ['/compute/api/digest/', DIGEST],
  ['/Compute/api/digest', DIGEST],
  ['/COMPUTE/API/DIGEST', DIGEST],
  ['/Compute/Api/Digest/', DIGEST],
];

const STAY_200 = [
  ['/lobby', null],
  ['/compute/skill.md', null],
  ['/compute/api', null],
  ['/compute/api/', null],
  ['/faucet', null],
  ['/bag', null],
  ['/crew', null],
  ['/which', null],
  ['/simp', null],
  ['/robots.txt', null],
  ['/sitemap.xml', null],
  ['/digest.json', null],
  ['/benchmarks', null],
];

const STAY_OUT = [
  '/api/forum',
  '/api/forum/',
  '/compute/api/foo',
  '/benchmarks.json',
  '/api/models',
  '/api/providers',
  '/api/v1',
  '/api/v1/status',
  '/api/digest',
];

for (const [path, dest] of FOLDS) {
  assert.equal(potterHome308Dest(path), dest, path);
}
for (const [path, dest] of STAY_200) {
  assert.equal(potterHome308Dest(path), dest, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
}
assert.equal(potterHome308Dest('/compute/api/docs'), SKILL, '/compute/api/docs still skill leftover');
assert.equal(potterHome308Dest('/compute/agents.md'), SKILL, '/compute/agents.md still skill leftover');
assert.equal(potterHome308Dest('/swagger.json'), API, 'apex /swagger.json still /compute/api');
assert.equal(potterHome308Dest('/compute/faucet'), FAUCET, '/compute/faucet still /faucet');
assert.equal(potterHome308Dest('/forum'), null, '/forum stays forumToLobby, not leftover dest');

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  const u = new URL(dest);
  if (u.pathname === '/compute/api' || u.pathname.startsWith('/compute/api/') || u.pathname === '/compute/skill.md' || u.pathname === '/benchmarks') {
    return LOBBY + u.pathname + u.search + u.hash;
  }
  return dest;
}

const env = { LOBBY_SESSION_SECRET: 'motley-agent-discovery-leftover-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, dest), `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const lobby = await edgeWorker.fetch(new Request(`https://${host}/lobby`, { method }), env);
    assert.equal(lobby.status, 200, `${host} /lobby ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await lobby.text(), '');
    const skill = await edgeWorker.fetch(new Request(`https://${host}/compute/skill.md`, { method }), env);
    assert.equal(skill.status, 200, `${host} /compute/skill.md ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await skill.text(), '');
    const api = await edgeWorker.fetch(new Request(`https://${host}/compute/api`, { method }), env);
    assert.equal(api.status, 200, `${host} /compute/api ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await api.text(), '');
    const benches = await edgeWorker.fetch(new Request(`https://${host}/benchmarks`, { method }), env);
    assert.equal(benches.status, 200, `${host} /benchmarks ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await benches.text(), '');
  }
  const foo = await edgeWorker.fetch(new Request(`https://${host}/compute/api/foo`), env);
  assert.equal(foo.status, 404, `${host} /compute/api/foo stays JSON 404`);
  assert.notEqual(foo.headers.get('location'), SKILL, `${host} /compute/api/foo not skill`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/api/lobby',
  '/api/benchmarks.json',
  '/compute/api/benchmarks.json',
  '/compute/api/agents.md',
  '/compute/api/agent.md',
  '/compute/api/swagger.json',
  '/compute/api/faucet',
  '/compute/api/lobby',
  '/compute/api/bag',
  '/compute/api/crew',
  '/compute/api/which',
  '/compute/api/simp',
  '/compute/api/forum',
  '/compute/api/robots.txt',
  '/compute/api/sitemap.xml',
  '/compute/api/security.txt',
  '/compute/api/digest.json',
  '/compute/api/digest',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-motley-agent-discovery-leftover-pretty-path: PASS (/api/lobby 308 /lobby; /api/benchmarks.json 308 same-host /benchmarks; nested /compute/api/benchmarks.json keep-live; nested /compute/api/{agents.md,agent.md,AGENTS.md,swagger.json,faucet,lobby,bag,crew,which,simp,forum,robots.txt,sitemap.xml,security.txt,digest,digest.json} 308 faces; Title-case+slash; www+lobby GET+HEAD; dests 200; no /api/models|/api/providers|/api/v1|/api/v1/status; no apex /api/digest retarget; no plugin.jup.ag)');
