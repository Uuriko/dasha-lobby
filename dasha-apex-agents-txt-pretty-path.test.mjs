#!/usr/bin/env node
/**
 * Leftover pretty path: live GET/HEAD /agents /agents/ (+ Title-case)
 * 308 https://www.getdasha.com/compute while canonical agent discovery
 * is already 200 at /agents.txt (+ /agents.json). Bare /agents should
 * land on the agents.txt standard, not the Compute HTML tab.
 * Exact /agents.json stays 200. Do not invent /agent (singular stays
 * existing compute-tab leftover). /agents.md is not in this leftover
 * set — agent-discovery leftover folds it to skill.md. /compute/agents
 * stays tab → /compute.
 * Disk only. No Designer. Never plugin.jup.ag. PR-mirror only — no wrangler.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /(?:String\(path \|\| ''\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /POTTER_AGENTS_TXT_308_PATHS/, 'agents.txt leftover set');
assert.match(
  workerSrc,
  /Bare leftover \/agents\|\/agents\/ fold via POTTER_AGENTS_TXT_308_PATHS/,
  'tab comment retargets bare /agents to agents.txt',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.doesNotMatch(tab, /["']\/agents["']/, 'tab no longer lists /agents');
assert.doesNotMatch(tab, /["']\/agents\/["']/, 'tab no longer lists /agents/');
assert.match(tab, /["']\/agent["']/, 'singular /agent stays compute-tab leftover');
assert.match(tab, /["']\/compute\/agents["']/, '/compute/agents stays compute-tab leftover');

const agentsTxtSet = workerSrc.match(/const POTTER_AGENTS_TXT_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(agentsTxtSet, /['"]\/agents['"]/, 'agents.txt set lists /agents');
assert.match(agentsTxtSet, /['"]\/agents\/['"]/, 'agents.txt set lists /agents/');
assert.doesNotMatch(agentsTxtSet, /['"]\/agents\.md['"]/, 'this PR does not claim /agents.md');
assert.doesNotMatch(agentsTxtSet, /['"]\/agent['"]/, 'do not invent singular /agent in agents.txt set');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const AGENTS_TXT = `${WWW}/agents.txt`;
const COMPUTE = `${WWW}/compute`;
const SKILL = `${WWW}/compute/skill.md`;

const FOLDS = [
  '/agents',
  '/agents/',
  '/Agents',
  '/AGENTS',
  '/Agents/',
  '/AGENTS/',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), AGENTS_TXT, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not Compute HTML`);
}
assert.equal(potterHome308Dest('/agents.json'), null, '/agents.json stays 200');
assert.equal(potterHome308Dest('/agents.txt'), null, '/agents.txt stays 200');
assert.equal(potterHome308Dest('/agents.txt/'), AGENTS_TXT, '/agents.txt/ peer still → face');
assert.equal(potterHome308Dest('/agent'), COMPUTE, 'singular /agent stays compute leftover');
assert.equal(potterHome308Dest('/agent/'), COMPUTE, 'singular /agent/ stays compute leftover');
assert.equal(potterHome308Dest('/compute/agents'), COMPUTE, '/compute/agents stays tab leftover');
assert.equal(potterHome308Dest('/compute/agents/'), COMPUTE, '/compute/agents/ stays tab leftover');
assert.notEqual(potterHome308Dest('/agents.md'), AGENTS_TXT, '/agents.md not claimed by agents.txt leftover');
assert.equal(potterHome308Dest('/agents.md'), SKILL, '/agents.md folds via agent-discovery leftover');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');

const env = {
  LOBBY_SESSION_SECRET: 'apex-agents-txt-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), AGENTS_TXT, `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), COMPUTE, `${host} ${path} ${method} not /compute`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/agents.json', '/agents.txt']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method} stays 200`);
      assert.equal(res.headers.get('location'), null, `${host} ${path} ${method} no 308`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  const md = await edgeWorker.fetch(new Request(`https://${host}/agents.md`), env);
  const skillLoc = host === 'lobby.getdasha.com' ? `${LOBBY}/compute/skill.md` : SKILL;
  assert.notEqual(md.headers.get('location'), AGENTS_TXT, `${host} /agents.md not agents.txt`);
  assert.equal(md.status, 308, `${host} /agents.md leftover 308 via agent-discovery`);
  assert.equal(md.headers.get('location'), skillLoc, `${host} /agents.md → skill.md`);
  const agent = await edgeWorker.fetch(new Request(`https://${host}/agent`), env);
  assert.equal(agent.status, 308, `${host} /agent stays leftover`);
  assert.equal(agent.headers.get('location'), COMPUTE, `${host} /agent loc`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(!sitemapXml.includes(`${WWW}/agents</loc>`), 'sitemap omits leftover /agents');

console.log('dasha-apex-agents-txt-pretty-path: PASS (/agents+/agents/ 308 agents.txt; Title-case; /agents.json 200; /agents.md skill leftover not this set; /agent stays /compute; www+lobby GET+HEAD; no plugin.jup.ag)');
