#!/usr/bin/env node
/**
 * agents.txt / agents.json (CC0 vibe: https://agents-txt.com).
 * GET /agents.txt + /agents.json + /compute/agents.txt on apex+www+lobby.
 * Thin: Skills → /compute/skill.md. base_url + guest-keys stay in the skill.
 * Leftover /agents + /compute/agents stay 308 → /compute.
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
  COMPUTE_AGENTS_TXT,
  COMPUTE_AGENTS_TXT_URL,
  COMPUTE_SKILL_MD,
  COMPUTE_SKILL_URL,
  computeAgentAeoResponse,
  isAgentsJsonPath,
  isAgentsTxtPath,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const ORIGINS = ['https://getdasha.com', 'https://www.getdasha.com', 'https://lobby.getdasha.com'];
const COMPUTE = 'https://www.getdasha.com/compute';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_AGENTS_TXT_308_PATHS/, 'leftover /agents.txt/ → face');
assert.match(workerSrc, /POTTER_AGENTS_JSON_308_PATHS/, 'leftover /agents.json/ → face');
assert.match(workerSrc, /\['\/agents\.txt'/, 'agents.txt in product casefold map');
assert.match(workerSrc, /\['\/agents\.json'/, 'agents.json in product casefold map');
assert.match(workerSrc, /\['\/compute\/agents\.txt'/, 'compute agents.txt in product casefold map');

assert.equal(isAgentsTxtPath('/agents.txt'), true);
assert.equal(isAgentsTxtPath('/compute/agents.txt'), true);
assert.equal(isAgentsTxtPath('/agents.txt/'), false, 'slash is leftover 308');
assert.equal(isAgentsTxtPath('/agents'), false, 'bare /agents stays leftover');
assert.equal(isAgentsTxtPath('/compute/agents'), false, 'bare /compute/agents stays leftover');
assert.equal(isAgentsJsonPath('/agents.json'), true);
assert.equal(isAgentsJsonPath('/agents.json/'), false);
assert.equal(isAgentsJsonPath('/compute/agent.json'), false, 'not the well-known agent.json alias');

assert.match(AGENTS_TXT, /^# agents\.txt\n# Standard: https:\/\/agents-txt\.com\n/m, 'spec header');
assert.match(AGENTS_TXT, new RegExp(`^# JSON: ${AGENTS_JSON_URL.replace(/\./g, '\\.')}$`, 'm'), 'JSON comment');
assert.match(AGENTS_TXT, new RegExp(`^Skills: ${COMPUTE_SKILL_URL.replace(/\./g, '\\.')}$`, 'm'), 'Skills URL');
assert.equal((AGENTS_TXT.match(/^Skills:/gm) || []).length, 1, 'one Skills line');
assert.doesNotMatch(AGENTS_TXT, /plugin\.jup\.ag/, 'txt no plugin.jup.ag');
assert.doesNotMatch(AGENTS_TXT, /disclaimer|not financial advice|dyor|\bnfa\b/i, 'txt no lecture');
assert.doesNotMatch(AGENTS_TXT, /people.?data|email|phone|seed phrase/i, 'txt no people-data');
assert.doesNotMatch(AGENTS_TXT, /guest-agent/i, 'txt stays Compute, not Room');

assert.equal(AGENTS_JSON.standard, 'https://agents-txt.com');
assert.equal(AGENTS_JSON.version, '1.0');
assert.equal(AGENTS_JSON.skills[0].url, COMPUTE_SKILL_URL, 'json Skills URL');
assert.doesNotMatch(JSON.stringify(AGENTS_JSON), /plugin\.jup\.ag/);
assert.doesNotMatch(JSON.stringify(AGENTS_JSON), /people.?data|email|phone|seed phrase/i);
assert.equal('payments' in AGENTS_JSON, false, 'thin: no payments block');
assert.equal(COMPUTE_SKILL_MD.includes(COMPUTE_AGENTS_TXT), true, 'skill keeps Aider/Goose/OpenHands tip');

assert.equal(potterHome308Dest('/agents.txt'), null, '/agents.txt stays 200');
assert.equal(potterHome308Dest('/agents.json'), null, '/agents.json stays 200');
assert.equal(potterHome308Dest('/compute/agents.txt'), null, '/compute/agents.txt stays 200');
assert.equal(potterHome308Dest('/agents.txt/'), AGENTS_TXT_URL, '/agents.txt/ → face');
assert.equal(potterHome308Dest('/agents.json/'), AGENTS_JSON_URL, '/agents.json/ → face');
assert.equal(potterHome308Dest('/compute/agents.txt/'), COMPUTE_AGENTS_TXT_URL, '/compute/agents.txt/ → face');
assert.equal(potterHome308Dest('/Agents.txt'), AGENTS_TXT_URL, 'Title-case /agents.txt');
assert.equal(potterHome308Dest('/Agents.json'), AGENTS_JSON_URL, 'Title-case /agents.json');
assert.equal(potterHome308Dest('/Compute/Agents.txt'), COMPUTE_AGENTS_TXT_URL, 'Title-case /compute/agents.txt');
assert.equal(potterHome308Dest('/agents'), COMPUTE, 'bare /agents stays leftover');
assert.equal(potterHome308Dest('/compute/agents'), COMPUTE, 'bare /compute/agents stays leftover');
assert.equal(potterHome308Dest('/compute/agents/skill.md'), COMPUTE_SKILL_URL, '/compute/agents/skill.md stays skill face');

{
  const txt = computeAgentAeoResponse(new Request('https://www.getdasha.com/agents.txt'));
  assert.equal(txt.status, 200, 'helper serves agents.txt');
  assert.equal(txt.headers.get('x-dasha-edge'), 'agents-txt');
  assert.equal(await txt.text(), AGENTS_TXT);
  const json = computeAgentAeoResponse(new Request('https://www.getdasha.com/agents.json'));
  assert.equal(json.status, 200, 'helper serves agents.json');
  assert.equal(json.headers.get('x-dasha-edge'), 'agents-json');
  assert.deepEqual(JSON.parse(await json.text()), AGENTS_JSON);
  const miss = computeAgentAeoResponse(new Request('https://www.getdasha.com/privacy'));
  assert.equal(miss, null, 'helper ignores non-AEO paths');
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
    assert.match(body, new RegExp(`^Skills: ${COMPUTE_SKILL_URL.replace(/\./g, '\\.')}$`, 'm'), `${host} ${path} Skills URL`);
    assert.doesNotMatch(body, /plugin\.jup\.ag/);

    const head = await edgeWorker.fetch(new Request(`${origin}${path}`, { method: 'HEAD' }), {});
    assert.equal(head.status, 200, `${host} ${path} HEAD`);
    assert.equal(await head.text(), '');
  }

  const json = await edgeWorker.fetch(new Request(`${origin}/agents.json`), {});
  assert.equal(json.status, 200, `${host} /agents.json`);
  assert.equal(json.headers.get('x-dasha-edge'), 'agents-json');
  assert.match(json.headers.get('content-type') || '', /application\/json/);
  assert.equal(json.headers.get('access-control-allow-origin'), '*');
  const parsed = await json.json();
  assert.deepEqual(parsed, AGENTS_JSON);
  assert.equal(parsed.skills[0].url, COMPUTE_SKILL_URL, `${host} /agents.json Skills URL`);
  const opt = await edgeWorker.fetch(new Request(`${origin}/agents.json`, { method: 'OPTIONS' }), {});
  assert.equal(opt.status, 204, `${host} /agents.json OPTIONS`);
  const jsonHead = await edgeWorker.fetch(new Request(`${origin}/agents.json`, { method: 'HEAD' }), {});
  assert.equal(jsonHead.status, 200, `${host} /agents.json HEAD`);
  assert.equal(await jsonHead.text(), '');
}

for (const origin of ORIGINS) {
  const host = new URL(origin).hostname;
  for (const [path, dest] of [
    ['/agents.txt/', AGENTS_TXT_URL],
    ['/agents.json/', AGENTS_JSON_URL],
    ['/compute/agents.txt/', COMPUTE_AGENTS_TXT_URL],
    ['/Agents.txt', AGENTS_TXT_URL],
    ['/agents', COMPUTE],
    ['/compute/agents', COMPUTE],
  ]) {
    const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
    assert.equal(res.status, 308, `${host} ${path}`);
    assert.equal(res.headers.get('location'), dest, `${host} ${path} loc`);
    assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
  }
}

console.log('dasha-agents-txt: PASS (/agents.txt + /agents.json + /compute/agents.txt 200 Skills URL, leftovers 308, no plugin.jup.ag)');
