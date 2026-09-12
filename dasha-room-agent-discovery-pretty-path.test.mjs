#!/usr/bin/env node
/**
 * Leftover pretty path (2026-09-11): live GET/HEAD /room/skill.md
 * /room/agents.md (+slash / Title-case) html-404 on www+lobby while
 * /room/llms.txt is the Project Room packet. Staging has no /skill.md.
 * Fold this Room-prefix family to /room/llms.txt (lobby same-host).
 * /room/AGENTS.md /room/CLAUDE.md same dest (set stores lowercase).
 * Apex /skill.md /agents.md /AGENTS.md /CLAUDE.md stay Compute →
 * /compute/skill.md. Exact /room /room/llms.txt stay 200 dest.
 * Do not invent apex /join. Do not overwrite site-root
 * /.well-known/agent.json. Do not fold Compute into Room.
 * Disk only. No Designer. No wrangler. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { COMPUTE_AGENT_JSON } from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const proxySrc = readFileSync(join(root, 'dasha-room-edge-proxy.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(proxySrc, /plugin\.jup\.ag/, 'proxy must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_ROOM_AGENT_DISCOVERY_308_PATHS/, 'room agent-discovery leftover set');
assert.match(
  workerSrc,
  /Leftover \/room\/skill\.md \(2026-09-11\)/,
  'leftover comment names /room/skill.md family',
);
assert.match(workerSrc, /staging has no \/skill\.md/, 'honest: staging has no skill bytes');
assert.match(workerSrc, /Apex \/skill\.md \/agents\.md/, 'apex Compute discovery stays Compute');
assert.doesNotMatch(workerSrc, /["']\/join["']/, 'do not invent apex /join');

const discoverySet = workerSrc.match(/const POTTER_ROOM_AGENT_DISCOVERY_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/room/skill.md', '/room/skill.md/',
  '/room/agents.md', '/room/agents.md/',
  '/room/claude.md', '/room/claude.md/',
]) {
  assert.match(discoverySet, new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), `set lists ${path}`);
}
assert.doesNotMatch(discoverySet, /['"]\/skill\.md['"]/, 'do not claim apex /skill.md');
assert.doesNotMatch(discoverySet, /['"]\/agents\.md['"]/, 'do not claim apex /agents.md');
assert.doesNotMatch(discoverySet, /['"]\/claude\.md['"]/, 'do not claim apex /claude.md');
assert.doesNotMatch(discoverySet, /['"]\/join['"]/, 'do not invent /join');
assert.doesNotMatch(discoverySet, /['"]\/room\/join['"]/, 'do not invent /room/join');
assert.doesNotMatch(discoverySet, /['"]\/compute\/room/, 'do not fold Compute into Room');
assert.doesNotMatch(proxySrc, /\/room\/skill\.md/, 'do not invent Room skill proxy');
assert.doesNotMatch(proxySrc, /\/room\/agents\.md/, 'do not invent Room agents.md proxy');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const ROOM_PACKET = `${WWW}/room/llms.txt`;
const LOBBY_PACKET = `${LOBBY}/room/llms.txt`;
const COMPUTE_SKILL = `${WWW}/compute/skill.md`;
const LOBBY_COMPUTE_SKILL = `${LOBBY}/compute/skill.md`;

const FOLDS = [
  '/room/skill.md',
  '/room/skill.md/',
  '/Room/skill.md',
  '/ROOM/SKILL.MD',
  '/Room/Skill.md',
  '/Room/Skill.md/',
  '/ROOM/SKILL.MD/',
  '/room/agents.md',
  '/room/agents.md/',
  '/room/AGENTS.md',
  '/Room/agents.md',
  '/ROOM/AGENTS.MD',
  '/Room/Agents.md',
  '/Room/Agents.md/',
  '/ROOM/AGENTS.MD/',
  '/room/claude.md',
  '/room/claude.md/',
  '/room/CLAUDE.md',
  '/Room/claude.md',
  '/ROOM/CLAUDE.MD',
  '/Room/Claude.md',
  '/Room/Claude.md/',
  '/ROOM/CLAUDE.MD/',
];

const APEX_COMPUTE = [
  '/skill.md',
  '/skill.md/',
  '/agents.md',
  '/agents.md/',
  '/AGENTS.md',
  '/CLAUDE.md',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), ROOM_PACKET, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE_SKILL, `${path} is not Compute skill`);
}
for (const path of APEX_COMPUTE) {
  assert.equal(potterHome308Dest(path), COMPUTE_SKILL, `apex ${path} stays Compute`);
}
assert.equal(potterHome308Dest('/room'), null, '/room stays 200 dest');
assert.equal(potterHome308Dest('/room/'), null, '/room/ stays 200 dest');
assert.equal(potterHome308Dest('/room/llms.txt'), null, '/room/llms.txt stays 200 dest');
assert.equal(potterHome308Dest('/join'), null, 'do not invent apex /join');
assert.equal(potterHome308Dest('/room/join'), null, 'do not invent /room/join');
assert.equal(potterHome308Dest('/.well-known/agent.json'), null, 'site-root agent.json stays Compute 200');
assert.notEqual(potterHome308Dest('/compute/skill.md'), ROOM_PACKET, 'do not fold Compute skill into Room');
assert.equal(potterHome308Dest('/compute/skill.md'), null, '/compute/skill.md stays 200');

const env = {
  LOBBY_SESSION_SECRET: 'room-agent-discovery-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const packet = host === 'lobby.getdasha.com' ? LOBBY_PACKET : ROOM_PACKET;
  const computeSkill = host === 'lobby.getdasha.com' ? LOBBY_COMPUTE_SKILL : COMPUTE_SKILL;
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), packet, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      assert.doesNotMatch(res.headers.get('location') || '', /project-room-staging/, `${host} ${path} ${method} not origin`);
      assert.doesNotMatch(res.headers.get('location') || '', /\/compute\/skill\.md/, `${host} ${path} ${method} not Compute`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of APEX_COMPUTE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method} stays Compute leftover`);
      assert.equal(res.headers.get('location'), computeSkill, `${host} ${path} ${method} Compute loc`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const join = await edgeWorker.fetch(new Request(`https://${host}/join`), env);
  assert.notEqual(join.headers.get('location'), packet, `${host} /join not Room packet`);
  assert.notEqual(join.headers.get('location'), ROOM_PACKET, `${host} /join not invented Room`);
  assert.equal(potterHome308Dest('/join'), null, `${host} /join dest stays null`);

  const card = await edgeWorker.fetch(new Request(`https://${host}/.well-known/agent.json`), env);
  assert.equal(card.status, 200, `${host} site-root agent.json`);
  assert.equal(card.headers.get('x-dasha-edge'), 'compute-agent', `${host} site-root stays Compute`);
  const json = await card.json();
  assert.equal(json.name, 'Dasha Compute', `${host} site-root name`);
  assert.deepEqual(json, COMPUTE_AGENT_JSON, `${host} site-root Compute card`);
  assert.doesNotMatch(JSON.stringify(json), /Project Room/, `${host} site-root is not Room`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/room/skill.md', '/room/agents.md', '/room/claude.md']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-room-agent-discovery-pretty-path: PASS (/room/skill.md+/room/agents.md+/room/AGENTS.md+/room/CLAUDE.md +slash +Title-case 308 /room/llms.txt www+lobby GET+HEAD same-host; apex /skill.md+/agents.md stay Compute; /room+/room/llms.txt 200 dest; no /join; site-root agent.json Compute; no plugin.jup.ag)');
