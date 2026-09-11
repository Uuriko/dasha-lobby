#!/usr/bin/env node
/**
 * agents.txt / agents.json (CC0 vibe: https://agents-txt.com).
 * GET /agents.txt + /agents.json + /compute/agents.txt + /compute/agents.json
 * on apex+www+lobby. Skills → /compute/skill.md (+ lobby). Brief base_url + guest mint.
 * Exact path before leftover /agents fold. Bare /agents + /compute/agents stay 308 → /compute.
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
  COMPUTE_AGENTS_BASE,
  COMPUTE_AGENTS_JSON_URL,
  COMPUTE_AGENTS_TXT,
  COMPUTE_AGENTS_TXT_URL,
  COMPUTE_SKILL_MD,
  COMPUTE_SKILL_URL,
  COMPUTE_SKILL_URL_LOBBY,
  agentsDiscoveryResponse,
  computeAgentAeoResponse,
  isAgentsDiscoveryPath,
  isAgentsJsonPath,
  isAgentsTxtPath,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const ORIGINS = ['https://getdasha.com', 'https://www.getdasha.com', 'https://lobby.getdasha.com'];
const COMPUTE = 'https://www.getdasha.com/compute';
const DISCOVERY_PATHS = ['/agents.txt', '/agents.json', '/compute/agents.txt', '/compute/agents.json'];

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
assert.doesNotMatch(tab, /["']\/compute\/agents\.json["']/, 'leftover must not list /compute/agents.json');
assert.match(
  workerSrc,
  /Leftover \/agents\|\/compute\/agents must not catch \*\.txt\/\*\.json/,
  'leftover comment names exact-path rule',
);
assert.match(workerSrc, /POTTER_AGENTS_TXT_308_PATHS/, 'leftover /agents.txt/ → face');
assert.match(workerSrc, /POTTER_AGENTS_JSON_308_PATHS/, 'leftover /agents.json/ → face');
assert.match(workerSrc, /\['\/agents\.txt'/, 'agents.txt in product casefold map');
assert.match(workerSrc, /\['\/agents\.json'/, 'agents.json in product casefold map');
assert.match(workerSrc, /\['\/compute\/agents\.txt'/, 'compute agents.txt in product casefold map');
assert.match(workerSrc, /\['\/compute\/agents\.json'/, 'compute agents.json in product casefold map');

assert.equal(isAgentsTxtPath('/agents.txt'), true);
assert.equal(isAgentsTxtPath('/compute/agents.txt'), true);
assert.equal(isAgentsTxtPath('/agents.txt/'), false, 'slash is leftover 308');
assert.equal(isAgentsTxtPath('/agents'), false, 'bare /agents stays leftover');
assert.equal(isAgentsTxtPath('/compute/agents'), false, 'bare /compute/agents stays leftover');
assert.equal(isAgentsTxtPath('/Agents.txt'), false, 'Title-case is leftover casefold, not the 200 face');
assert.equal(isAgentsJsonPath('/agents.json'), true);
assert.equal(isAgentsJsonPath('/compute/agents.json'), true);
assert.equal(isAgentsJsonPath('/agents.json/'), false);
assert.equal(isAgentsJsonPath('/compute/agent.json'), false, 'not the well-known agent.json alias');
assert.equal(isAgentsDiscoveryPath('/agents.txt'), true);
assert.equal(isAgentsDiscoveryPath('/compute/agents.json'), true);
assert.equal(isAgentsDiscoveryPath('/agents'), false);

assert.match(AGENTS_TXT, /^# agents\.txt\n# Standard: https:\/\/agents-txt\.com\n/m, 'spec header');
assert.match(AGENTS_TXT, new RegExp(`^# JSON: ${AGENTS_JSON_URL.replace(/\./g, '\\.')}$`, 'm'), 'JSON comment');
assert.match(AGENTS_TXT, new RegExp(`^Skills: ${COMPUTE_SKILL_URL.replace(/\./g, '\\.')}$`, 'm'), 'Skills URL');
assert.match(AGENTS_TXT, new RegExp(`^Skills: ${COMPUTE_SKILL_URL_LOBBY.replace(/\./g, '\\.')}$`, 'm'), 'lobby Skills URL');
assert.match(AGENTS_TXT, /skill\.md/, 'Skills/skill.md marker');
assert.equal((AGENTS_TXT.match(/^Skills:/gm) || []).length, 2, 'www + lobby Skills lines');
assert.match(AGENTS_TXT, new RegExp(`OpenAI-compat base_url ${COMPUTE_AGENTS_BASE.replace(/\./g, '\\.')}`), 'txt names base_url');
assert.match(AGENTS_TXT, /Guest mint POST \/compute\/api\/guest-keys/, 'txt names guest mint');
assert.doesNotMatch(AGENTS_TXT, /plugin\.jup\.ag/, 'txt no plugin.jup.ag');
assert.doesNotMatch(AGENTS_TXT, /disclaimer|not financial advice|dyor|\bnfa\b/i, 'txt no lecture');
assert.doesNotMatch(AGENTS_TXT, /people.?data|email|phone|seed phrase/i, 'txt no people-data');
assert.doesNotMatch(AGENTS_TXT, /guest-agent/i, 'txt stays Compute, not Room');

assert.equal(AGENTS_JSON.standard, 'https://agents-txt.com');
assert.equal(AGENTS_JSON.version, '1.0');
assert.equal(AGENTS_JSON.skills[0].url, COMPUTE_SKILL_URL, 'json Skills URL');
assert.equal(AGENTS_JSON.skills[1].url, COMPUTE_SKILL_URL_LOBBY, 'json lobby Skills URL');
assert.match(AGENTS_JSON.site.description, /skill\.md|base_url|guest mint/i, 'json mentions door');
assert.match(AGENTS_JSON.site.description, new RegExp(COMPUTE_AGENTS_BASE.replace(/\./g, '\\.')), 'json names base_url');
assert.match(AGENTS_JSON.site.description, /POST \/compute\/api\/guest-keys/, 'json names guest mint');
assert.doesNotMatch(JSON.stringify(AGENTS_JSON), /plugin\.jup\.ag/);
assert.doesNotMatch(JSON.stringify(AGENTS_JSON), /people.?data|email|phone|seed phrase/i);
assert.equal('payments' in AGENTS_JSON, false, 'thin: no payments block');
assert.equal(COMPUTE_SKILL_MD.includes(COMPUTE_AGENTS_TXT), true, 'skill keeps Aider/Goose/OpenHands tip');

assert.equal(potterHome308Dest('/agents.txt'), null, '/agents.txt stays 200');
assert.equal(potterHome308Dest('/agents.json'), null, '/agents.json stays 200');
assert.equal(potterHome308Dest('/compute/agents.txt'), null, '/compute/agents.txt stays 200');
assert.equal(potterHome308Dest('/compute/agents.json'), null, '/compute/agents.json stays 200');
assert.equal(potterHome308Dest('/agents.txt/'), AGENTS_TXT_URL, '/agents.txt/ → face');
assert.equal(potterHome308Dest('/agents.json/'), AGENTS_JSON_URL, '/agents.json/ → face');
assert.equal(potterHome308Dest('/compute/agents.txt/'), COMPUTE_AGENTS_TXT_URL, '/compute/agents.txt/ → face');
assert.equal(potterHome308Dest('/compute/agents.json/'), COMPUTE_AGENTS_JSON_URL, '/compute/agents.json/ → face');
assert.equal(potterHome308Dest('/Agents.txt'), AGENTS_TXT_URL, 'Title-case /agents.txt');
assert.equal(potterHome308Dest('/Agents.json'), AGENTS_JSON_URL, 'Title-case /agents.json');
assert.equal(potterHome308Dest('/Compute/Agents.txt'), COMPUTE_AGENTS_TXT_URL, 'Title-case /compute/agents.txt');
assert.equal(potterHome308Dest('/Compute/Agents.json'), COMPUTE_AGENTS_JSON_URL, 'Title-case /compute/agents.json');
assert.equal(potterHome308Dest('/agents'), COMPUTE, 'bare /agents stays leftover');
assert.equal(potterHome308Dest('/compute/agents'), COMPUTE, 'bare /compute/agents stays leftover');
assert.equal(potterHome308Dest('/Agents'), COMPUTE, 'Title-case leftover /agents');
assert.equal(potterHome308Dest('/compute/agents/skill.md'), COMPUTE_SKILL_URL, '/compute/agents/skill.md stays skill face');

{
  const txt = agentsDiscoveryResponse(new Request('https://www.getdasha.com/agents.txt'));
  assert.equal(txt.status, 200, 'helper serves agents.txt');
  assert.equal(txt.headers.get('x-dasha-edge'), 'agents-txt');
  assert.equal(await txt.text(), AGENTS_TXT);
  const json = agentsDiscoveryResponse(new Request('https://www.getdasha.com/agents.json'));
  assert.equal(json.status, 200, 'helper serves agents.json');
  assert.equal(json.headers.get('x-dasha-edge'), 'agents-json');
  assert.deepEqual(JSON.parse(await json.text()), AGENTS_JSON);
  const computeJson = agentsDiscoveryResponse(new Request('https://www.getdasha.com/compute/agents.json'));
  assert.equal(computeJson.status, 200, 'helper serves /compute/agents.json');
  assert.deepEqual(JSON.parse(await computeJson.text()), AGENTS_JSON);
  const miss = agentsDiscoveryResponse(new Request('https://www.getdasha.com/agents'));
  assert.equal(miss, null, 'helper ignores leftover /agents');
  const aeo = computeAgentAeoResponse(new Request('https://www.getdasha.com/agents.txt'));
  assert.equal(aeo.status, 200, 'AEO helper still serves agents.txt');
}

for (const origin of ORIGINS) {
  const host = new URL(origin).hostname;
  for (const path of DISCOVERY_PATHS) {
    const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
    const wantEdge = path.endsWith('.json') ? 'agents-json' : 'agents-txt';
    assert.equal(res.status, 200, `${host} ${path}`);
    assert.equal(res.headers.get('x-dasha-edge'), wantEdge, `${host} ${path} edge`);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    if (path.endsWith('.json')) {
      assert.match(res.headers.get('content-type') || '', /application\/json/);
      const parsed = await res.json();
      assert.deepEqual(parsed, AGENTS_JSON);
      assert.equal(parsed.skills[0].url, COMPUTE_SKILL_URL, `${host} ${path} Skills URL`);
      assert.match(JSON.stringify(parsed), /skill\.md/, `${host} ${path} skill.md marker`);
      assert.doesNotMatch(JSON.stringify(parsed), /plugin\.jup\.ag/);
    } else {
      assert.match(res.headers.get('content-type') || '', /text\/plain/);
      const body = await res.text();
      assert.equal(body, AGENTS_TXT);
      assert.match(body, new RegExp(`^Skills: ${COMPUTE_SKILL_URL.replace(/\./g, '\\.')}$`, 'm'), `${host} ${path} Skills URL`);
      assert.match(body, /skill\.md/, `${host} ${path} Skills/skill.md marker`);
      assert.match(body, /OpenAI-compat base_url https:\/\/lobby\.getdasha\.com\/compute\/api/);
      assert.match(body, /Guest mint POST \/compute\/api\/guest-keys/);
      assert.doesNotMatch(body, /plugin\.jup\.ag/);
    }

    const head = await edgeWorker.fetch(new Request(`${origin}${path}`, { method: 'HEAD' }), {});
    assert.equal(head.status, 200, `${host} ${path} HEAD`);
    assert.equal(await head.text(), '');
  }

  const opt = await edgeWorker.fetch(new Request(`${origin}/agents.json`, { method: 'OPTIONS' }), {});
  assert.equal(opt.status, 204, `${host} /agents.json OPTIONS`);
}

for (const origin of ORIGINS) {
  const host = new URL(origin).hostname;
  for (const [path, dest] of [
    ['/agents', COMPUTE],
    ['/compute/agents', COMPUTE],
    ['/Agents', COMPUTE],
    ['/agents.txt/', AGENTS_TXT_URL],
    ['/agents.json/', AGENTS_JSON_URL],
    ['/compute/agents.txt/', COMPUTE_AGENTS_TXT_URL],
    ['/compute/agents.json/', COMPUTE_AGENTS_JSON_URL],
    ['/Agents.txt', AGENTS_TXT_URL],
    ['/Agents.json', AGENTS_JSON_URL],
  ]) {
    const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
    assert.equal(res.status, 308, `${host} ${path}`);
    assert.equal(res.headers.get('location'), dest, `${host} ${path} loc`);
    assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
  }
}

console.log('dasha-agents-txt: PASS (/agents.txt + /agents.json + compute aliases 200 Skills/skill.md, leftover /agents 308, exact face before leftover fold, no plugin.jup.ag)');
