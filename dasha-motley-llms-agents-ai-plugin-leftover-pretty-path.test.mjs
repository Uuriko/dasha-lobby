#!/usr/bin/env node
/**
 * Motley leftover nested machine doors: live GET/HEAD /compute/api/llms
 * /compute/api/agents (+slash / Title-case via toLowerCase) JSON-404 while
 * /compute/llms.txt + /compute/agents.txt already 200. Live GET/HEAD
 * /.well-known/ai-plugin.json (+slash / Title-case) html-404 while
 * /.well-known/mcp.json is already 200. Fold to those faces.
 * Must win over the /compute/api/ casefold catch-all.
 * /compute/api/agents.md stays skill leftover. Bare /compute/agents
 * 308 → /compute/agents.txt. Do not invent /api/llms /api/agents
 * /ai-plugin.json. Disk only. No Designer. Never plugin.jup.ag.
 * No Muse HTML. No Room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_API_LLMS_308_PATHS/, 'nested llms leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_AGENTS_308_PATHS/, 'nested agents leftover set');
assert.match(workerSrc, /POTTER_AI_PLUGIN_JSON_308_PATHS/, 'ai-plugin leftover set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map/set beat casefold catch-all');
assert.doesNotMatch(workerSrc, /dasha-muse-product/, 'do not import Muse #225 HTML');

const llmsSet = workerSrc.match(/const POTTER_COMPUTE_API_LLMS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const agentsSet = workerSrc.match(/const POTTER_COMPUTE_API_AGENTS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const pluginSet = workerSrc.match(/const POTTER_AI_PLUGIN_JSON_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
for (const path of ['/compute/api/llms', '/compute/api/llms/']) {
  assert.match(
    llmsSet,
    new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `llms set lists ${path}`,
  );
}
for (const path of ['/compute/api/agents', '/compute/api/agents/']) {
  assert.match(
    agentsSet,
    new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `agents set lists ${path}`,
  );
}
for (const path of ['/.well-known/ai-plugin.json', '/.well-known/ai-plugin.json/']) {
  assert.match(
    pluginSet,
    new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `ai-plugin set lists ${path}`,
  );
}
assert.doesNotMatch(llmsSet, /['"]\/api\/llms['"]/, 'do not invent apex /api/llms');
assert.doesNotMatch(agentsSet, /['"]\/api\/agents['"]/, 'do not invent apex /api/agents');
assert.doesNotMatch(pluginSet, /['"]\/ai-plugin\.json['"]/, 'do not invent apex /ai-plugin.json');
assert.doesNotMatch(agentsSet, /['"]\/compute\/api\/agents\.md['"]/, 'agents.md stays skill leftover');
assert.doesNotMatch(llmsSet, /['"]\/invent['"]/, 'do not restack /invent');
assert.doesNotMatch(agentsSet, /['"]\/contribute\.md['"]/, 'do not restack /contribute.md');
assert.doesNotMatch(pluginSet, /['"]\/compute\/api\/robots['"]/, 'do not restack nested robots');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
assert.match(discoveryMap, /['"]\/compute\/api\/agents\.md['"]/, 'keep /compute/api/agents.md skill leftover');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/llms['"]/, 'llms leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/agents['"]/, 'bare /compute/api/agents lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/\.well-known\/ai-plugin\.json['"]/, 'ai-plugin leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'do not invent /api/v1 leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'do not invent /api/models leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'do not invent /api/providers leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1\/status['"]/, 'do not invent /api/v1/status leftover');

const WWW = 'https://www.getdasha.com';
const LLMS = `${WWW}/compute/llms.txt`;
const AGENTS_TXT = `${WWW}/compute/agents.txt`;
const MCP = `${WWW}/.well-known/mcp.json`;
const SKILL = `${WWW}/compute/skill.md`;

const LLMS_FOLDS = [
  '/compute/api/llms',
  '/compute/api/llms/',
  '/Compute/api/llms',
  '/COMPUTE/API/LLMS',
  '/Compute/Api/Llms/',
];
const AGENTS_FOLDS = [
  '/compute/api/agents',
  '/compute/api/agents/',
  '/Compute/api/agents',
  '/COMPUTE/API/AGENTS',
  '/Compute/Api/Agents/',
];
const PLUGIN_FOLDS = [
  '/.well-known/ai-plugin.json',
  '/.well-known/ai-plugin.json/',
  '/.well-known/Ai-Plugin.json',
  '/.well-known/AI-PLUGIN.JSON',
  '/.well-known/Ai-Plugin.json/',
];

const STAY_200 = [
  '/compute/llms.txt',
  '/compute/agents.txt',
  '/.well-known/mcp.json',
];
const STAY_OUT = [
  '/api/v1',
  '/api/v1/',
  '/api/models',
  '/api/providers',
  '/api/v1/status',
  '/api/llms',
  '/api/agents',
  '/ai-plugin.json',
  '/ai-plugin.json/',
  '/compute/.well-known/ai-plugin.json',
];

for (const path of LLMS_FOLDS) {
  assert.equal(potterHome308Dest(path), LLMS, `${path} → /compute/llms.txt`);
}
for (const path of AGENTS_FOLDS) {
  assert.equal(potterHome308Dest(path), AGENTS_TXT, `${path} → /compute/agents.txt`);
  assert.notEqual(potterHome308Dest(path), SKILL, `${path} is not skill.md`);
}
for (const path of PLUGIN_FOLDS) {
  assert.equal(potterHome308Dest(path), MCP, `${path} → /.well-known/mcp.json`);
  assert.notEqual(potterHome308Dest(path), `${WWW}/compute/mcp.json`, `${path} prefers well-known mcp.json face`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/compute/llms'), LLMS, '/compute/llms still AEO leftover');
assert.equal(potterHome308Dest('/compute/llms/'), LLMS, '/compute/llms/ still AEO leftover');
assert.equal(potterHome308Dest('/compute/api/agents.md'), SKILL, '/compute/api/agents.md still skill leftover');
assert.equal(potterHome308Dest('/compute/api/agents.md/'), SKILL, '/compute/api/agents.md/ still skill leftover');
assert.equal(potterHome308Dest('/compute/agents'), AGENTS_TXT, '/compute/agents folds to agents.txt');
assert.equal(potterHome308Dest('/compute/agents/'), AGENTS_TXT, '/compute/agents/ folds to agents.txt');
assert.equal(potterHome308Dest('/compute/mcp.json'), null, '/compute/mcp.json stays 200');

const env = {
  LOBBY_SESSION_SECRET: 'motley-llms-agents-ai-plugin-leftover-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [
    ...LLMS_FOLDS.map((p) => [p, LLMS]),
    ...AGENTS_FOLDS.map((p) => [p, AGENTS_TXT]),
    ...PLUGIN_FOLDS.map((p) => [p, MCP]),
    ['/compute/agents', AGENTS_TXT],
    ['/compute/agents/', AGENTS_TXT],
    ['/Compute/Agents', AGENTS_TXT],
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of STAY_200) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method} stays 200`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of ['/api/v1', '/api/models', '/api/providers', '/api/v1/status']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
  const foo = await edgeWorker.fetch(new Request(`https://${host}/compute/api/foo`), env);
  assert.equal(foo.status, 404, `${host} /compute/api/foo stays JSON 404`);
  assert.notEqual(foo.headers.get('location'), LLMS, `${host} /compute/api/foo not llms`);
  assert.notEqual(foo.headers.get('location'), AGENTS_TXT, `${host} /compute/api/foo not agents.txt`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/compute/api/llms',
  '/compute/api/agents',
  '/.well-known/ai-plugin.json',
]) {
  assert.ok(!sitemapXml.includes(`${WWW}${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-motley-llms-agents-ai-plugin-leftover-pretty-path: PASS (/compute/api/llms 308 /compute/llms.txt; /compute/api/agents + /compute/agents 308 /compute/agents.txt; /.well-known/ai-plugin.json 308 /.well-known/mcp.json; Title-case+slash; www+lobby GET+HEAD; dests 200; stay-out /api/v1|/api/models|/api/providers|/api/v1/status; no plugin.jup.ag)');
