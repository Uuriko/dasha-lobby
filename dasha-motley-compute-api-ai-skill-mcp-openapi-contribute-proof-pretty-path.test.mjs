#!/usr/bin/env node
/**
 * Motley leftover nested machine doors: live GET/HEAD /compute/api/ai
 * /compute/api/skill /compute/api/mcp /compute/api/openapi
 * /compute/api/contribute /compute/api/proof (+slash / Title-case via
 * toLowerCase) JSON-404 while faces already 200. Fold to those faces.
 * Must win over the /compute/api/ casefold catch-all.
 * /compute/api/docs stays skill leftover. /compute/api/openapi.json stays
 * uninvented. Bare /compute/agents 308 → /compute/agents.txt.
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
assert.match(workerSrc, /POTTER_COMPUTE_API_AI_308_PATHS/, 'nested ai leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_SKILL_308_PATHS/, 'nested skill leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_MCP_308_PATHS/, 'nested mcp leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_OPENAPI_308_PATHS/, 'nested openapi leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_CONTRIBUTE_308_PATHS/, 'nested contribute leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_PROOF_308_PATHS/, 'nested proof leftover set');
assert.match(workerSrc, /(?:String\(path \|\| ""\)|raw)\.toLowerCase\(\)/, '308 dest must case-fold');
assert.match(workerSrc, /Must win over the \/compute\/api\/ casefold/, 'map/set beat casefold catch-all');
assert.match(workerSrc, /dasha-muse-product/, 'Muse #225 faces imported; leftover maps stay out');

const aiSet = workerSrc.match(/const POTTER_COMPUTE_API_AI_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const skillSet = workerSrc.match(/const POTTER_COMPUTE_API_SKILL_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const mcpSet = workerSrc.match(/const POTTER_COMPUTE_API_MCP_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const openapiSet = workerSrc.match(/const POTTER_COMPUTE_API_OPENAPI_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const contributeSet = workerSrc.match(/const POTTER_COMPUTE_API_CONTRIBUTE_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const proofSet = workerSrc.match(/const POTTER_COMPUTE_API_PROOF_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

function listed(src, path) {
  return new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(src);
}
for (const path of ['/compute/api/ai', '/compute/api/ai/']) {
  assert.ok(listed(aiSet, path), `ai set lists ${path}`);
}
for (const path of ['/compute/api/skill', '/compute/api/skill/']) {
  assert.ok(listed(skillSet, path), `skill set lists ${path}`);
}
for (const path of ['/compute/api/mcp', '/compute/api/mcp/']) {
  assert.ok(listed(mcpSet, path), `mcp set lists ${path}`);
}
for (const path of ['/compute/api/openapi', '/compute/api/openapi/']) {
  assert.ok(listed(openapiSet, path), `openapi set lists ${path}`);
}
for (const path of ['/compute/api/contribute', '/compute/api/contribute/']) {
  assert.ok(listed(contributeSet, path), `contribute set lists ${path}`);
}
for (const path of ['/compute/api/proof', '/compute/api/proof/']) {
  assert.ok(listed(proofSet, path), `proof set lists ${path}`);
}
assert.doesNotMatch(aiSet, /['"]\/api\/ai['"]/, 'do not invent apex /api/ai');
assert.doesNotMatch(skillSet, /['"]\/api\/skill['"]/, 'do not invent apex /api/skill');
assert.doesNotMatch(mcpSet, /['"]\/api\/mcp['"]/, 'do not invent apex /api/mcp');
assert.doesNotMatch(openapiSet, /['"]\/api\/openapi['"]/, 'do not invent apex /api/openapi');
assert.doesNotMatch(openapiSet, /['"]\/compute\/api\/openapi\.json['"]/, 'do not invent /compute/api/openapi.json');
assert.doesNotMatch(contributeSet, /['"]\/api\/contribute['"]/, 'apex /api/contribute stays Motley #235');
assert.doesNotMatch(contributeSet, /['"]\/contribute\.md['"]/, 'contribute.md stays Motley map');
assert.doesNotMatch(proofSet, /['"]\/api\/proof['"]/, 'do not invent apex /api/proof');
assert.doesNotMatch(proofSet, /['"]\/compute\/api\/proof\.json['"]/, 'proof.json stays Motley #235');
assert.doesNotMatch(aiSet, /['"]\/invent['"]/, 'do not restack /invent');
assert.doesNotMatch(skillSet, /['"]\/compute\/api\/llms['"]/, 'llms leftover lives in its Set');
assert.doesNotMatch(mcpSet, /['"]\/compute\/api\/robots['"]/, 'robots leftover lives in its Set');
assert.doesNotMatch(openapiSet, /['"]\/\.well-known\/ai-plugin\.json['"]/, 'ai-plugin leftover lives in its Set');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/ai['"]/, 'ai leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/skill['"]/, 'skill leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/mcp['"]/, 'mcp leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/openapi['"]/, 'openapi leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/contribute['"]/, 'contribute leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/proof['"]/, 'proof leftover lives in its Set, not Motley map');
assert.doesNotMatch(discoveryMap, /['"]\/compute\/api\/openapi\.json['"]/, 'do not invent nested openapi leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/v1['"]/, 'do not invent /api/v1 leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/models['"]/, 'do not invent /api/models leftover');
assert.doesNotMatch(discoveryMap, /['"]\/api\/providers['"]/, 'do not invent /api/providers leftover');
assert.match(discoveryMap, /['"]\/compute\/api\/agents\.md['"]/, 'keep /compute/api/agents.md skill leftover');

const WWW = 'https://www.getdasha.com';
const LOBBY = 'https://lobby.getdasha.com';
const AI = `${WWW}/ai.txt`;
const SKILL = `${WWW}/compute/skill.md`;
const LOBBY_SKILL = `${LOBBY}/compute/skill.md`;
const MCP = `${WWW}/compute/mcp.json`;
const OPENAPI = `${WWW}/compute/openapi.json`;
const CONTRIBUTE = `${WWW}/contribute`;
const PROOF_MD = `${WWW}/compute/proof.md`;
const AGENTS_TXT = `${WWW}/compute/agents.txt`;

const AI_FOLDS = [
  '/compute/api/ai',
  '/compute/api/ai/',
  '/Compute/api/ai',
  '/COMPUTE/API/AI',
  '/Compute/Api/Ai/',
];
const SKILL_FOLDS = [
  '/compute/api/skill',
  '/compute/api/skill/',
  '/Compute/api/skill',
  '/COMPUTE/API/SKILL',
  '/Compute/Api/Skill/',
];
const MCP_FOLDS = [
  '/compute/api/mcp',
  '/compute/api/mcp/',
  '/Compute/api/mcp',
  '/COMPUTE/API/MCP',
  '/Compute/Api/Mcp/',
];
const OPENAPI_FOLDS = [
  '/compute/api/openapi',
  '/compute/api/openapi/',
  '/Compute/api/openapi',
  '/COMPUTE/API/OPENAPI',
  '/Compute/Api/Openapi/',
];
const CONTRIBUTE_FOLDS = [
  '/compute/api/contribute',
  '/compute/api/contribute/',
  '/Compute/api/contribute',
  '/COMPUTE/API/CONTRIBUTE',
  '/Compute/Api/Contribute/',
];
const PROOF_FOLDS = [
  '/compute/api/proof',
  '/compute/api/proof/',
  '/Compute/api/proof',
  '/COMPUTE/API/PROOF',
  '/Compute/Api/Proof/',
];

const STAY_200 = [
  '/ai.txt',
  '/compute/skill.md',
  '/compute/mcp.json',
  '/compute/openapi.json',
  '/contribute',
  '/compute/proof.md',
];
const STAY_OUT = [
  '/api/v1',
  '/api/v1/',
  '/api/models',
  '/api/providers',
  '/api/ai',
  '/api/skill',
  '/api/mcp',
  '/api/proof',
  '/compute/api/openapi.json',
];

for (const path of AI_FOLDS) {
  assert.equal(potterHome308Dest(path), AI, `${path} → /ai.txt`);
}
for (const path of SKILL_FOLDS) {
  assert.equal(potterHome308Dest(path), SKILL, `${path} → /compute/skill.md`);
}
for (const path of MCP_FOLDS) {
  assert.equal(potterHome308Dest(path), MCP, `${path} → /compute/mcp.json`);
  assert.notEqual(potterHome308Dest(path), SKILL, `${path} is not skill.md`);
}
for (const path of OPENAPI_FOLDS) {
  assert.equal(potterHome308Dest(path), OPENAPI, `${path} → /compute/openapi.json`);
  assert.notEqual(potterHome308Dest(path), SKILL, `${path} is not skill.md`);
}
for (const path of CONTRIBUTE_FOLDS) {
  assert.equal(potterHome308Dest(path), CONTRIBUTE, `${path} → /contribute`);
}
for (const path of PROOF_FOLDS) {
  assert.equal(potterHome308Dest(path), PROOF_MD, `${path} → /compute/proof.md`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay-out ${path}`);
}
assert.equal(potterHome308Dest('/compute/api/docs'), SKILL, '/compute/api/docs still skill leftover');
assert.equal(potterHome308Dest('/compute/api/agents.md'), SKILL, '/compute/api/agents.md still skill leftover');
assert.equal(potterHome308Dest('/compute/agents'), AGENTS_TXT, '/compute/agents folds to agents.txt');
assert.equal(potterHome308Dest('/compute/agents/'), AGENTS_TXT, '/compute/agents/ folds to agents.txt');
assert.equal(potterHome308Dest('/compute/mcp'), MCP, '/compute/mcp still catalog leftover');
assert.equal(potterHome308Dest('/ai'), AI, '/ai still /ai.txt leftover');
assert.equal(potterHome308Dest('/compute/openapi'), SKILL, '/compute/openapi still skill leftover');
assert.equal(potterHome308Dest('/api/openapi'), `${WWW}/compute/api`, '/api/openapi stays gateway leftover');
assert.notEqual(potterHome308Dest('/api/openapi'), OPENAPI, '/api/openapi is not nested openapi leftover');

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  if (dest === SKILL) return LOBBY_SKILL;
  return dest;
}

const env = {
  LOBBY_SESSION_SECRET: 'motley-compute-api-ai-skill-mcp-leftover-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName: () => 'public',
    get: () => ({
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === '/compute/api/network') {
          return new Response(JSON.stringify({
            providers_online: 1,
            models_available: ['qwen3-4b'],
            capacity: [{ model: 'qwen3-4b', providers: 1, tokens_per_second: 40 }],
            jobs_queued: 0,
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/readyz') {
          return new Response(JSON.stringify({
            ok: true,
            service: 'dasha-compute',
            can_serve: true,
            reason: 'community_or_hosted',
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/verify') {
          return new Response(JSON.stringify({
            chain: { length: 2, tip: 'abc' },
            verdict: { tier: 'ANCHORED', why: 'test' },
            checked_at: '2026-09-13T00:00:00.000Z',
          }), { headers: { 'content-type': 'application/json' } });
        }
        if (path === '/compute/api/factory') {
          return new Response(JSON.stringify({ settled_24h: 0, jobs: 0 }), {
            headers: { 'content-type': 'application/json' },
          });
        }
        if (path === '/compute/api/pricing') {
          return new Response(JSON.stringify({
            unit: 'successful_chat_completion',
            request_usd: '0.05',
            currency: 'USD',
            card_available: false,
            card_note: 'no card yet',
          }), { headers: { 'content-type': 'application/json' } });
        }
        return new Response('nope', { status: 404 });
      },
    }),
  },
};

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of [
    ...AI_FOLDS.map((p) => [p, AI]),
    ...SKILL_FOLDS.map((p) => [p, SKILL]),
    ...MCP_FOLDS.map((p) => [p, MCP]),
    ...OPENAPI_FOLDS.map((p) => [p, OPENAPI]),
    ...CONTRIBUTE_FOLDS.map((p) => [p, CONTRIBUTE]),
    ...PROOF_FOLDS.map((p) => [p, PROOF_MD]),
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, dest), `${host} ${path} ${method} loc`);
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
  for (const path of ['/api/v1', '/api/models', '/api/providers']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.status, 308, `${host} ${path} is not leftover 308`);
    assert.equal(res.status, 404, `${host} ${path} stays 404`);
  }
  const foo = await edgeWorker.fetch(new Request(`https://${host}/compute/api/foo`), env);
  assert.equal(foo.status, 404, `${host} /compute/api/foo stays JSON 404`);
  assert.notEqual(foo.headers.get('location'), AI, `${host} /compute/api/foo not ai.txt`);
  assert.notEqual(foo.headers.get('location'), SKILL, `${host} /compute/api/foo not skill`);
  const agents = await edgeWorker.fetch(new Request(`https://${host}/compute/agents`), env);
  assert.equal(agents.status, 308, `${host} /compute/agents leftover 308`);
  assert.equal(agents.headers.get('location'), AGENTS_TXT, `${host} /compute/agents loc is agents.txt`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/compute/api/ai',
  '/compute/api/skill',
  '/compute/api/mcp',
  '/compute/api/openapi',
  '/compute/api/contribute',
  '/compute/api/proof',
]) {
  assert.ok(!sitemapXml.includes(`${WWW}${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-motley-compute-api-ai-skill-mcp-openapi-contribute-proof-pretty-path: PASS (/compute/api/ai 308 /ai.txt; /compute/api/skill 308 /compute/skill.md; /compute/api/mcp 308 /compute/mcp.json; /compute/api/openapi 308 /compute/openapi.json; /compute/api/contribute 308 /contribute; /compute/api/proof 308 /compute/proof.md; Title-case+slash; www+lobby GET+HEAD; dests 200; stay-out /api/v1|/api/models|/api/providers; no plugin.jup.ag)');
