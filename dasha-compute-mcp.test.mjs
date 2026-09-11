#!/usr/bin/env node
/**
 * Compute MCP catalog for agent attach.
 * GET /compute/mcp.json + /.well-known/mcp.json (+ /compute/.well-known/mcp.json)
 * is a static tool list: healthz / models / network / guest-keys + skill.md.
 * Chat is OpenAI-compat Bearer at base_url — not a second protocol.
 * skill.md carries MCP: … Leftover /mcp|/compute/mcp stay 308 /compute.
 * No streamable MCP session. No Hosted Flash SKU. No wrangler. No Room.
 * Never plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import {
  COMPUTE_AGENT_JSON,
  COMPUTE_AGENT_JSON_URL,
  COMPUTE_API_BASE,
  COMPUTE_GUEST_KEYS_URL,
  COMPUTE_HEALTHZ,
  COMPUTE_LLMS_FULL_TXT,
  COMPUTE_LLMS_TXT,
  COMPUTE_MCP_JSON,
  COMPUTE_MCP_JSON_URL,
  COMPUTE_MCP_WELLKNOWN_COMPUTE_URL,
  COMPUTE_MCP_WELLKNOWN_URL,
  COMPUTE_NETWORK,
  COMPUTE_SKILL_MD,
  COMPUTE_SKILL_URL,
  computeAgentAeoResponse,
  isComputeMcpJsonPath,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const ORIGINS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];
const COMPUTE = 'https://www.getdasha.com/compute';
const MCP_PATHS = [
  '/compute/mcp.json',
  '/.well-known/mcp.json',
  '/compute/.well-known/mcp.json',
];
const LIVE_FLASH = /Hosted Flash is live|Flash is live|now offering Flash|Flash model id/i;
const TOOL_NAMES = ['healthz', 'models', 'network', 'guest-keys', 'chat.completions'];

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_MCP_JSON_308_PATHS/, 'leftover /mcp.json → catalog');
assert.match(workerSrc, /\['\/compute\/mcp\.json'/, 'mcp.json in product casefold map');
assert.match(workerSrc, /\['\/\.well-known\/mcp\.json'/, 'well-known mcp.json in product casefold map');
assert.match(
  workerSrc,
  /Leftover \/mcp\|\/compute\/mcp must not catch \*\.json/,
  'leftover comment keeps /mcp tab off *.json',
);

const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
assert.match(tab, /["']\/mcp["']/, 'leftover keeps bare /mcp');
assert.match(tab, /["']\/compute\/mcp["']/, 'leftover keeps bare /compute/mcp');
assert.doesNotMatch(tab, /["']\/compute\/mcp\.json["']/, 'leftover must not list /compute/mcp.json');
assert.doesNotMatch(tab, /["']\/\.well-known\/mcp\.json["']/, 'leftover must not list well-known mcp.json');

assert.equal(isComputeMcpJsonPath('/compute/mcp.json'), true);
assert.equal(isComputeMcpJsonPath('/.well-known/mcp.json'), true);
assert.equal(isComputeMcpJsonPath('/compute/.well-known/mcp.json'), true);
assert.equal(isComputeMcpJsonPath('/compute/mcp.json/'), false, 'slash is leftover 308');
assert.equal(isComputeMcpJsonPath('/mcp'), false, 'bare /mcp stays leftover');
assert.equal(isComputeMcpJsonPath('/compute/mcp'), false, 'bare /compute/mcp stays leftover');
assert.equal(isComputeMcpJsonPath('/mcp.json'), false, '/mcp.json leftover folds to catalog');

assert.equal(COMPUTE_MCP_JSON.name, 'Dasha Compute');
assert.match(COMPUTE_MCP_JSON.description, /run factory, not a ledger/);
assert.match(COMPUTE_MCP_JSON.description, /Not Room/);
assert.equal(COMPUTE_MCP_JSON.protocol, 'catalog');
assert.equal(COMPUTE_MCP_JSON.transport, 'http');
assert.match(COMPUTE_MCP_JSON.note, /Not a streamable MCP session/);
assert.equal(COMPUTE_MCP_JSON.skill, COMPUTE_SKILL_URL);
assert.equal(COMPUTE_MCP_JSON.base_url, COMPUTE_API_BASE);
assert.equal(COMPUTE_MCP_JSON.auth.scheme, 'Bearer');
assert.equal(COMPUTE_MCP_JSON.auth.chat, 'bearer');
assert.deepEqual(COMPUTE_MCP_JSON.auth.public_reads, ['healthz', 'network', 'models']);
assert.equal(COMPUTE_MCP_JSON.auth.guest_key.rate, '3/hour/IP');
assert.equal(COMPUTE_MCP_JSON.auth.guest_key.ttl_seconds, 86400);
assert.deepEqual(COMPUTE_MCP_JSON.auth.guest_key.scopes, ['chat', 'models']);
assert.deepEqual(COMPUTE_MCP_JSON.tools.map((t) => t.name), TOOL_NAMES);

const byName = Object.fromEntries(COMPUTE_MCP_JSON.tools.map((t) => [t.name, t]));
assert.equal(byName.healthz.method, 'GET');
assert.equal(byName.healthz.url, COMPUTE_HEALTHZ);
assert.equal(byName.healthz.auth, 'none');
assert.equal(byName.models.method, 'GET');
assert.equal(byName.models.url, `${COMPUTE_API_BASE}/models`);
assert.equal(byName.models.auth, 'none');
assert.equal(byName.network.method, 'GET');
assert.equal(byName.network.url, COMPUTE_NETWORK);
assert.equal(byName.network.auth, 'none');
assert.equal(byName['guest-keys'].method, 'POST');
assert.equal(byName['guest-keys'].url, COMPUTE_GUEST_KEYS_URL);
assert.equal(byName['guest-keys'].auth, 'none');
assert.equal(byName['guest-keys'].rate, '3/hour/IP');
assert.equal(byName['chat.completions'].method, 'POST');
assert.equal(byName['chat.completions'].url, `${COMPUTE_API_BASE}/chat/completions`);
assert.equal(byName['chat.completions'].auth, 'bearer');
assert.match(byName['chat.completions'].description, /OpenAI-compatible/);
assert.match(byName['chat.completions'].description, /Bearer required/);

const catalogJson = JSON.stringify(COMPUTE_MCP_JSON);
assert.doesNotMatch(catalogJson, /plugin\.jup\.ag/);
assert.doesNotMatch(catalogJson, /people.?data|email|phone|seed phrase/i);
assert.doesNotMatch(catalogJson, /project-room|guest-agent/i);
assert.doesNotMatch(catalogJson, /potter[_-]?key|DASHA_POTTER/i);
assert.doesNotMatch(catalogJson, LIVE_FLASH, 'catalog no live-Flash SKU');
assert.match(catalogJson, /Not a streamable MCP session/, 'catalog is honest: no MCP stream');
assert.doesNotMatch(catalogJson, /text\/event-stream|"\/sse"/i, 'catalog has no SSE door');
assert.doesNotMatch(catalogJson, /disclaimer|not financial advice|dyor|\bnfa\b/i);

assert.match(COMPUTE_SKILL_MD, new RegExp(`^MCP: ${COMPUTE_MCP_JSON_URL.replace(/\./g, '\\.')}$`, 'm'), 'skill MCP: bullet');
assert.equal((COMPUTE_SKILL_MD.match(/^MCP:/gm) || []).length, 1, 'skill MCP: once');
assert.ok(COMPUTE_SKILL_MD.includes(`agent.json ${COMPUTE_AGENT_JSON_URL}`), 'skill keeps agent.json');
assert.ok(
  COMPUTE_SKILL_MD.indexOf('## More') < COMPUTE_SKILL_MD.indexOf(`MCP: ${COMPUTE_MCP_JSON_URL}`),
  'skill MCP: sits in More',
);

assert.match(COMPUTE_LLMS_TXT, new RegExp(`^mcp ${COMPUTE_MCP_JSON_URL.replace(/\./g, '\\.')}$`, 'm'), 'packet mcp line');
assert.ok(COMPUTE_LLMS_FULL_TXT.includes(`GET ${COMPUTE_MCP_JSON_URL}`), 'full packet Discovery catalog');
assert.ok(COMPUTE_LLMS_FULL_TXT.includes(`GET ${COMPUTE_MCP_WELLKNOWN_URL}`), 'full packet Discovery well-known');
assert.equal(COMPUTE_AGENT_JSON.docs.mcp, COMPUTE_MCP_JSON_URL, 'agent.json docs.mcp');

assert.equal(potterHome308Dest('/compute/mcp.json'), null, '/compute/mcp.json stays 200');
assert.equal(potterHome308Dest('/.well-known/mcp.json'), null, '/.well-known/mcp.json stays 200');
assert.equal(potterHome308Dest('/compute/.well-known/mcp.json'), null, '/compute/.well-known/mcp.json stays 200');
assert.equal(potterHome308Dest('/compute/mcp.json/'), COMPUTE_MCP_JSON_URL, '/compute/mcp.json/ → catalog');
assert.equal(potterHome308Dest('/mcp.json'), COMPUTE_MCP_JSON_URL, '/mcp.json → catalog');
assert.equal(potterHome308Dest('/mcp.json/'), COMPUTE_MCP_JSON_URL, '/mcp.json/ → catalog');
assert.equal(potterHome308Dest('/.well-known/mcp.json/'), COMPUTE_MCP_WELLKNOWN_URL, 'well-known slash → face');
assert.equal(
  potterHome308Dest('/compute/.well-known/mcp.json/'),
  COMPUTE_MCP_WELLKNOWN_COMPUTE_URL,
  'compute well-known slash → face',
);
assert.equal(potterHome308Dest('/Compute/Mcp.json'), COMPUTE_MCP_JSON_URL, 'Title-case /compute/mcp.json');
assert.equal(potterHome308Dest('/.well-known/Mcp.json'), COMPUTE_MCP_WELLKNOWN_URL, 'Title-case well-known mcp.json');
assert.equal(potterHome308Dest('/mcp'), COMPUTE, 'bare /mcp stays leftover');
assert.equal(potterHome308Dest('/mcp/'), COMPUTE, 'bare /mcp/ stays leftover');
assert.equal(potterHome308Dest('/compute/mcp'), COMPUTE, 'bare /compute/mcp stays leftover');
assert.equal(potterHome308Dest('/compute/mcp/'), COMPUTE, 'bare /compute/mcp/ stays leftover');
assert.equal(potterHome308Dest('/MCP'), COMPUTE, 'UPPER /mcp stays leftover');

{
  const direct = computeAgentAeoResponse(new Request('https://www.getdasha.com/compute/mcp.json'));
  assert.equal(direct.status, 200, 'helper serves catalog');
  assert.equal(direct.headers.get('x-dasha-edge'), 'compute-mcp');
  assert.deepEqual(JSON.parse(await direct.text()), COMPUTE_MCP_JSON);
  const miss = computeAgentAeoResponse(new Request('https://www.getdasha.com/privacy'));
  assert.equal(miss, null, 'helper ignores non-AEO paths');
}

for (const origin of ORIGINS) {
  const host = new URL(origin).hostname;
  for (const path of MCP_PATHS) {
    const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
    assert.equal(res.status, 200, `${host} ${path}`);
    assert.equal(res.headers.get('x-dasha-edge'), 'compute-mcp');
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    const parsed = await res.json();
    assert.deepEqual(parsed, COMPUTE_MCP_JSON);
    assert.deepEqual(parsed.tools.map((t) => t.name), TOOL_NAMES);
    assert.equal(parsed.skill, COMPUTE_SKILL_URL);
    assert.equal(parsed.auth.chat, 'bearer');
    assert.doesNotMatch(JSON.stringify(parsed), LIVE_FLASH);

    const opt = await edgeWorker.fetch(new Request(`${origin}${path}`, { method: 'OPTIONS' }), {});
    assert.equal(opt.status, 204, `${host} ${path} OPTIONS`);
    assert.equal(opt.headers.get('access-control-allow-origin'), '*');

    const head = await edgeWorker.fetch(new Request(`${origin}${path}`, { method: 'HEAD' }), {});
    assert.equal(head.status, 200, `${host} ${path} HEAD`);
    assert.equal(head.headers.get('x-dasha-edge'), 'compute-mcp');
    assert.equal(await head.text(), '');
  }

  const skill = await edgeWorker.fetch(new Request(`${origin}/compute/skill.md`), {});
  assert.equal(skill.status, 200, `${host} /compute/skill.md`);
  const skillBody = await skill.text();
  assert.equal(skillBody, COMPUTE_SKILL_MD);
  assert.match(skillBody, new RegExp(`^MCP: ${COMPUTE_MCP_JSON_URL.replace(/\./g, '\\.')}$`, 'm'), `${host} skill MCP: bullet`);
  assert.doesNotMatch(skillBody, LIVE_FLASH);

  const packet = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`), {});
  assert.ok((await packet.text()).includes(COMPUTE_MCP_JSON_URL), `${host} packet links catalog`);

  const agent = await edgeWorker.fetch(new Request(`${origin}/.well-known/agent.json`), {});
  const agentJson = await agent.json();
  assert.equal(agentJson.docs.mcp, COMPUTE_MCP_JSON_URL, `${host} agent.json docs.mcp`);

  const index = await edgeWorker.fetch(new Request(`${origin}/llms.txt`), {});
  const indexBody = await index.text();
  assert.ok(indexBody.includes(COMPUTE_MCP_JSON_URL), `${host} /llms.txt links catalog`);
  assert.doesNotMatch(indexBody, /^MCP:/m, `${host} /llms.txt stays the short index`);
}

for (const origin of ORIGINS) {
  const host = new URL(origin).hostname;
  for (const [path, dest] of [
    ['/compute/mcp.json/', COMPUTE_MCP_JSON_URL],
    ['/mcp.json', COMPUTE_MCP_JSON_URL],
    ['/mcp.json/', COMPUTE_MCP_JSON_URL],
    ['/Compute/Mcp.json', COMPUTE_MCP_JSON_URL],
    ['/.well-known/mcp.json/', COMPUTE_MCP_WELLKNOWN_URL],
    ['/mcp', COMPUTE],
    ['/compute/mcp', COMPUTE],
  ]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`${origin}${path}`, { method }), {});
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
}

console.log('dasha-compute-mcp: PASS (/compute/mcp.json + well-known catalog, skill MCP: bullet, leftover /mcp stays /compute, no Hosted Flash SKU, no plugin.jup.ag)');
