#!/usr/bin/env node
/**
 * agents.txt / agents.json (CC0 vibe: https://agents-txt.com).
 * GET /agents.txt + /agents.json + /compute/agents.txt on apex+www+lobby.
 * Thin: Skills → /compute/skill.md. Exact path before leftover /agents fold.
 * Leftover /agents + /compute/agents stay 308 → /compute (no *.txt/*.json).
 * No wrangler. No guest-mint rewrite. Never plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import {
  AGENTS_JSON,
  AGENTS_JSON_URL,
  AGENTS_TXT,
  AGENTS_TXT_URL,
  COMPUTE_AGENTS_TXT_URL,
  COMPUTE_SKILL_URL,
  agentsDiscoveryResponse,
  isAgentsDiscoveryPath,
  isAgentsJsonPath,
  isAgentsTxtPath,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const ORIGINS = ['https://getdasha.com', 'https://www.getdasha.com', 'https://lobby.getdasha.com'];
const COMPUTE = 'https://www.getdasha.com/compute';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /agentsDiscoveryResponse\(request\)/, 'exact agents face before leftover');
assert.equal(
  (workerSrc.match(/const agentsFace = agentsDiscoveryResponse\(request\);/g) || []).length,
  2,
  'agents face on productEdge + default fetch',
);
{
  const product = workerSrc.match(/async function productEdge[\s\S]*?const potter308 = potterHome308Response/);
  assert.ok(product, 'productEdge leftover after agents face');
  assert.match(product[0], /agentsDiscoveryResponse\(request\)/, 'productEdge exact face before leftover fold');
}
{
  const def = workerSrc.match(/export default \{[\s\S]*?const potter308 = potterHome308Response/);
  assert.ok(def, 'default fetch leftover after agents face');
  assert.match(def[0], /agentsDiscoveryResponse\(request\)/, 'default fetch exact face before leftover fold');
}

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(tab, /["']\/agents["']/, 'leftover keeps bare /agents');
assert.match(tab, /["']\/compute\/agents["']/, 'leftover keeps bare /compute/agents');
assert.doesNotMatch(tab, /["']\/agents\.txt["']/, 'leftover must not list /agents.txt');
assert.doesNotMatch(tab, /["']\/agents\.json["']/, 'leftover must not list /agents.json');
assert.doesNotMatch(tab, /["']\/compute\/agents\.txt["']/, 'leftover must not list /compute/agents.txt');
assert.match(
  workerSrc,
  /Leftover \/agents\|\/compute\/agents must not catch \*\.txt\/\*\.json/,
  'leftover comment names exact-path rule',
);

assert.equal(isAgentsTxtPath('/agents.txt'), true);
assert.equal(isAgentsTxtPath('/compute/agents.txt'), true);
assert.equal(isAgentsTxtPath('/agents'), false, 'bare /agents is leftover, not the face');
assert.equal(isAgentsTxtPath('/compute/agents'), false);
assert.equal(isAgentsTxtPath('/Agents.txt'), false, 'Title-case is leftover casefold, not the 200 face');
assert.equal(isAgentsJsonPath('/agents.json'), true);
assert.equal(isAgentsJsonPath('/compute/agent.json'), false);
assert.equal(isAgentsDiscoveryPath('/agents.txt'), true);
assert.equal(isAgentsDiscoveryPath('/agents'), false);

assert.match(AGENTS_TXT, /^# agents\.txt\n# Standard: https:\/\/agents-txt\.com\n/m, 'spec header');
assert.match(AGENTS_TXT, new RegExp(`^# JSON: ${AGENTS_JSON_URL.replace(/\./g, '\\.')}$`, 'm'), 'JSON comment');
assert.match(AGENTS_TXT, new RegExp(`^Skills: ${COMPUTE_SKILL_URL.replace(/\./g, '\\.')}$`, 'm'), 'Skills URL');
assert.equal((AGENTS_TXT.match(/^Skills:/gm) || []).length, 1, 'one Skills line');
assert.doesNotMatch(AGENTS_TXT, /plugin\.jup\.ag/);
assert.doesNotMatch(AGENTS_TXT, /disclaimer|not financial advice|dyor|\bnfa\b/i);
assert.doesNotMatch(AGENTS_TXT, /people.?data|email|phone|seed phrase/i);

assert.equal(AGENTS_JSON.skills[0].url, COMPUTE_SKILL_URL, 'json Skills URL');
assert.equal(AGENTS_JSON.standard, 'https://agents-txt.com');
assert.doesNotMatch(JSON.stringify(AGENTS_JSON), /plugin\.jup\.ag/);

assert.equal(potterHome308Dest('/agents.txt'), null, '/agents.txt stays 200');
assert.equal(potterHome308Dest('/agents.json'), null, '/agents.json stays 200');
assert.equal(potterHome308Dest('/compute/agents.txt'), null, '/compute/agents.txt stays 200');
assert.equal(potterHome308Dest('/agents'), COMPUTE, 'bare /agents leftover');
assert.equal(potterHome308Dest('/compute/agents'), COMPUTE, 'bare /compute/agents leftover');
assert.equal(potterHome308Dest('/Agents'), COMPUTE, 'Title-case leftover /agents');
assert.equal(potterHome308Dest('/agents.txt/'), AGENTS_TXT_URL, '/agents.txt/ → face');
assert.equal(potterHome308Dest('/agents.json/'), AGENTS_JSON_URL, '/agents.json/ → face');
assert.equal(potterHome308Dest('/compute/agents.txt/'), COMPUTE_AGENTS_TXT_URL, '/compute/agents.txt/ → face');
assert.equal(potterHome308Dest('/Agents.txt'), AGENTS_TXT_URL, 'Title-case /agents.txt');
assert.equal(potterHome308Dest('/Agents.json'), AGENTS_JSON_URL, 'Title-case /agents.json');
assert.equal(potterHome308Dest('/compute/agents/skill.md'), COMPUTE_SKILL_URL, 'skill leftover unchanged');

{
  const txt = agentsDiscoveryResponse(new Request('https://www.getdasha.com/agents.txt'));
  assert.equal(txt.status, 200);
  assert.equal(txt.headers.get('x-dasha-edge'), 'agents-txt');
  assert.equal(await txt.text(), AGENTS_TXT);
  const miss = agentsDiscoveryResponse(new Request('https://www.getdasha.com/agents'));
  assert.equal(miss, null, 'helper ignores leftover /agents');
}

for (const origin of ORIGINS) {
  const host = new URL(origin).hostname;
  for (const path of ['/agents.txt', '/compute/agents.txt']) {
    const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
    assert.equal(res.status, 200, `${host} ${path}`);
    assert.equal(res.headers.get('x-dasha-edge'), 'agents-txt');
    assert.match(res.headers.get('content-type') || '', /text\/plain/);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    const body = await res.text();
    assert.equal(body, AGENTS_TXT);
    assert.match(body, new RegExp(`^Skills: ${COMPUTE_SKILL_URL.replace(/\./g, '\\.')}$`, 'm'), `${host} ${path} Skills`);
    assert.doesNotMatch(body, /plugin\.jup\.ag/);
    const head = await edgeWorker.fetch(new Request(`${origin}${path}`, { method: 'HEAD' }), {});
    assert.equal(head.status, 200, `${host} ${path} HEAD`);
    assert.equal(await head.text(), '');
  }

  const json = await edgeWorker.fetch(new Request(`${origin}/agents.json`), {});
  assert.equal(json.status, 200, `${host} /agents.json`);
  assert.equal(json.headers.get('x-dasha-edge'), 'agents-json');
  const parsed = await json.json();
  assert.deepEqual(parsed, AGENTS_JSON);
  assert.equal(parsed.skills[0].url, COMPUTE_SKILL_URL, `${host} /agents.json Skills`);
}

for (const origin of ORIGINS) {
  const host = new URL(origin).hostname;
  for (const [path, dest] of [
    ['/agents', COMPUTE],
    ['/compute/agents', COMPUTE],
    ['/Agents', COMPUTE],
    ['/agents.txt/', AGENTS_TXT_URL],
    ['/Agents.txt', AGENTS_TXT_URL],
  ]) {
    const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
    assert.equal(res.status, 308, `${host} ${path}`);
    assert.equal(res.headers.get('location'), dest, `${host} ${path} loc`);
    assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
  }
}

console.log('dasha-agents-txt: PASS (/agents.txt + /agents.json + /compute/agents.txt 200 Skills URL; leftover /agents exact-only; no plugin.jup.ag)');
