#!/usr/bin/env node
/**
 * Leftover pretty path (2026-09-11): live GET/HEAD /room/skill.md
 * /room/agents.md + extensionless / README/GEMINI/CURSOR family
 * (+slash / Title-case) html-404 on www+lobby while /room/llms.txt
 * is the Project Room packet. Staging has no /skill.md.
 * Fold this Room-prefix family to /room/llms.txt (lobby same-host).
 * /room/AGENTS.md /room/CLAUDE.md same dest (set stores lowercase).
 * Card leftover /room/agent.json → /room/.well-known/agent.json.
 * Probe leftover /room/health → /room/api/health (not the llms set).
 * Apex /skill.md /agents.md /AGENTS.md /CLAUDE.md stay Compute →
 * /compute/skill.md. Exact /room /room/llms.txt /room/.well-known/agent.json
 * /room/api/health stay 200 dest. Do not invent apex /join.
 * Do not overwrite site-root /.well-known/agent.json. Do not fold
 * Compute into Room. Disk only. No Designer. No wrangler.
 * Never plugin.jup.ag.
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
assert.match(
  workerSrc,
  /extensionless \+ README\/GEMINI\/CURSOR/,
  'leftover comment names 2026-09-11 extensionless + README/GEMINI/CURSOR family',
);
assert.match(workerSrc, /Staging has no \/skill\.md/, 'honest: staging has no skill bytes');
assert.match(workerSrc, /Apex \/skill\.md \/agents\.md/, 'apex Compute discovery stays Compute');
assert.match(workerSrc, /Leftover \/room\/agent\.json \(2026-09-11\)/, 'card leftover dest special-case');
assert.match(workerSrc, /Leftover \/room\/health \(2026-09-11\)/, 'probe leftover dest special-case');
assert.doesNotMatch(workerSrc, /["']\/join["']/, 'do not invent apex /join');

const discoverySet = workerSrc.match(/const POTTER_ROOM_AGENT_DISCOVERY_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/room/skill.md', '/room/skill.md/',
  '/room/agents.md', '/room/agents.md/',
  '/room/claude.md', '/room/claude.md/',
  '/room/skill', '/room/skill/',
  '/room/agents', '/room/agents/',
  '/room/llms', '/room/llms/',
  '/room/readme.md', '/room/readme.md/',
  '/room/gemini.md', '/room/gemini.md/',
  '/room/cursor.md', '/room/cursor.md/',
]) {
  assert.match(discoverySet, new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), `set lists ${path}`);
}
assert.doesNotMatch(discoverySet, /['"]\/skill\.md['"]/, 'do not claim apex /skill.md');
assert.doesNotMatch(discoverySet, /['"]\/agents\.md['"]/, 'do not claim apex /agents.md');
assert.doesNotMatch(discoverySet, /['"]\/claude\.md['"]/, 'do not claim apex /claude.md');
assert.doesNotMatch(discoverySet, /['"]\/join['"]/, 'do not invent /join');
assert.doesNotMatch(discoverySet, /['"]\/room\/join['"]/, 'do not invent /room/join');
assert.doesNotMatch(discoverySet, /['"]\/room\/agent\.json['"]/, 'card leftover is dest special-case, not llms set');
assert.doesNotMatch(discoverySet, /['"]\/room\/health['"]/, 'probe leftover is dest special-case, not llms set');
assert.doesNotMatch(discoverySet, /['"]\/compute\/room/, 'do not fold Compute into Room');
assert.doesNotMatch(proxySrc, /\/room\/skill\.md/, 'do not invent Room skill proxy');
assert.doesNotMatch(proxySrc, /\/room\/agents\.md/, 'do not invent Room agents.md proxy');
assert.match(
  workerSrc,
  /p === ["']\/room\/agent\.json["'] \|\| p === ["']\/room\/agent\.json\/["']/,
  'card leftover dest special-case in potterHome308Dest',
);
assert.match(
  workerSrc,
  /https:\/\/www\.getdasha\.com\/room\/\.well-known\/agent\.json/,
  'card leftover dest is Room well-known card',
);
assert.match(
  workerSrc,
  /p === ["']\/room\/health["'] \|\| p === ["']\/room\/health\/["']/,
  'probe leftover dest special-case in potterHome308Dest',
);
assert.match(
  workerSrc,
  /https:\/\/www\.getdasha\.com\/room\/api\/health/,
  'probe leftover dest is Room api/health',
);

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const ROOM_PACKET = `${WWW}/room/llms.txt`;
const LOBBY_PACKET = `${LOBBY}/room/llms.txt`;
const ROOM_CARD = `${WWW}/room/.well-known/agent.json`;
const LOBBY_CARD = `${LOBBY}/room/.well-known/agent.json`;
const ROOM_HEALTH = `${WWW}/room/api/health`;
const LOBBY_HEALTH = `${LOBBY}/room/api/health`;
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
  '/room/skill',
  '/room/skill/',
  '/Room/skill',
  '/ROOM/SKILL',
  '/Room/Skill',
  '/Room/Skill/',
  '/ROOM/SKILL/',
  '/room/agents',
  '/room/agents/',
  '/Room/agents',
  '/ROOM/AGENTS',
  '/Room/Agents',
  '/Room/Agents/',
  '/ROOM/AGENTS/',
  '/room/llms',
  '/room/llms/',
  '/Room/llms',
  '/ROOM/LLMS',
  '/Room/Llms',
  '/Room/Llms/',
  '/ROOM/LLMS/',
  '/room/readme.md',
  '/room/readme.md/',
  '/room/README.md',
  '/Room/README.md',
  '/ROOM/README.MD',
  '/Room/Readme.md/',
  '/ROOM/README.MD/',
  '/room/gemini.md',
  '/room/gemini.md/',
  '/room/GEMINI.md',
  '/Room/Gemini.md',
  '/ROOM/GEMINI.MD',
  '/Room/Gemini.md/',
  '/ROOM/GEMINI.MD/',
  '/room/cursor.md',
  '/room/cursor.md/',
  '/room/CURSOR.md',
  '/Room/Cursor.md',
  '/ROOM/CURSOR.MD',
  '/Room/Cursor.md/',
  '/ROOM/CURSOR.MD/',
];

const CARD_FOLDS = [
  '/room/agent.json',
  '/room/agent.json/',
  '/Room/agent.json',
  '/ROOM/AGENT.JSON',
  '/Room/Agent.json',
  '/Room/Agent.json/',
  '/ROOM/AGENT.JSON/',
];

const HEALTH_FOLDS = [
  '/room/health',
  '/room/health/',
  '/Room/health',
  '/ROOM/HEALTH',
  '/Room/Health',
  '/Room/Health/',
  '/ROOM/HEALTH/',
];

const APEX_COMPUTE = [
  '/skill.md',
  '/skill.md/',
  '/agents.md',
  '/agents.md/',
  '/AGENTS.md',
  '/CLAUDE.md',
];

const STAY_NULL = [
  '/room',
  '/room/',
  '/room/llms.txt',
  '/room/.well-known/agent.json',
  '/room/api/health',
  '/rooms',
  '/chatroom',
  '/project-rooms',
  '/room/join',
  '/room/open',
  '/room/connect',
  '/join',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), ROOM_PACKET, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE_SKILL, `${path} is not Compute skill`);
  assert.notEqual(potterHome308Dest(path), ROOM_CARD, `${path} is not Room card`);
  assert.notEqual(potterHome308Dest(path), ROOM_HEALTH, `${path} is not Room health`);
}
for (const path of CARD_FOLDS) {
  assert.equal(potterHome308Dest(path), ROOM_CARD, path);
  assert.notEqual(potterHome308Dest(path), ROOM_PACKET, `${path} is not llms packet`);
  assert.notEqual(potterHome308Dest(path), COMPUTE_SKILL, `${path} is not Compute skill`);
}
for (const path of HEALTH_FOLDS) {
  assert.equal(potterHome308Dest(path), ROOM_HEALTH, path);
  assert.notEqual(potterHome308Dest(path), ROOM_PACKET, `${path} is not llms packet`);
  assert.notEqual(potterHome308Dest(path), COMPUTE_SKILL, `${path} is not Compute skill`);
}
for (const path of APEX_COMPUTE) {
  assert.equal(potterHome308Dest(path), COMPUTE_SKILL, `apex ${path} stays Compute`);
}
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, `${path} stays out`);
}
assert.equal(potterHome308Dest('/.well-known/agent.json'), null, 'site-root agent.json stays Compute 200');
assert.notEqual(potterHome308Dest('/compute/skill.md'), ROOM_PACKET, 'do not fold Compute skill into Room');
assert.equal(potterHome308Dest('/compute/skill.md'), null, '/compute/skill.md stays 200');

const env = {
  LOBBY_SESSION_SECRET: 'room-agent-discovery-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};

const APEX_DISCOVERY = new Set(['/agents.md', '/agents.md/', '/claude.md', '/claude.md/']);

function assertLeftover308(res, host, path, method, loc) {
  assert.equal(res.status, 308, `${host} ${path} ${method}`);
  assert.equal(res.headers.get('location'), loc, `${host} ${path} ${method} loc`);
  assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
  assert.doesNotMatch(res.headers.get('location') || '', /project-room-staging/, `${host} ${path} ${method} not origin`);
  assert.doesNotMatch(res.headers.get('location') || '', /\/compute\//, `${host} ${path} ${method} not Compute`);
}

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const packet = host === 'lobby.getdasha.com' ? LOBBY_PACKET : ROOM_PACKET;
  const cardLoc = host === 'lobby.getdasha.com' ? LOBBY_CARD : ROOM_CARD;
  const healthLoc = host === 'lobby.getdasha.com' ? LOBBY_HEALTH : ROOM_HEALTH;
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assertLeftover308(res, host, path, method, packet);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of CARD_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assertLeftover308(res, host, path, method, cardLoc);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of HEALTH_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assertLeftover308(res, host, path, method, healthLoc);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of APEX_COMPUTE) {
    const computeSkill = host === 'lobby.getdasha.com' && APEX_DISCOVERY.has(path.toLowerCase())
      ? LOBBY_COMPUTE_SKILL
      : COMPUTE_SKILL;
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
for (const path of [
  '/room/skill.md', '/room/agents.md', '/room/claude.md',
  '/room/skill', '/room/agents', '/room/llms',
  '/room/readme.md', '/room/gemini.md', '/room/cursor.md',
  '/room/agent.json', '/room/health',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-room-agent-discovery-pretty-path: PASS (/room/skill.md+/room/agents.md+/room/AGENTS.md+/room/CLAUDE.md+/room/skill+/room/agents+/room/llms+/room/README.md+/room/GEMINI.md+/room/CURSOR.md +slash +Title-case 308 /room/llms.txt; /room/agent.json 308 /room/.well-known/agent.json; /room/health 308 /room/api/health www+lobby GET+HEAD same-host; apex /skill.md+/agents.md stay Compute; /room+/room/llms.txt+/room/.well-known/agent.json+/room/api/health 200 dest; no /join; site-root agent.json Compute; no plugin.jup.ag)');
