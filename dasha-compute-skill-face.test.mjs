#!/usr/bin/env node
/**
 * Compute agent skills face: GET /compute/skill.md (200 markdown).
 * Leftover pretty /skill.md /compute/skill.md/ /compute/agents/skill.md
 * (+slash / Title-case) 308 → canonical. Exact /compute/skill.md stays 200.
 * /compute/skill + /compute/skill/*.md stay as they were.
 * Linked from /compute/llms.txt + agent.json docs.skill.
 * No wrangler. No version bump. No Room merge. No guest-agent mint.
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
  COMPUTE_AGENTS_BASE,
  COMPUTE_AGENTS_TXT,
  COMPUTE_API_BASE,
  COMPUTE_API_BASE_WWW,
  COMPUTE_FIRST_CALL_TXT,
  COMPUTE_HEALTHZ,
  COMPUTE_LLMS_TXT,
  COMPUTE_LLMS_URL,
  COMPUTE_NETWORK,
  COMPUTE_SKILL_MD,
  COMPUTE_SKILL_URL,
  computeAgentAeoResponse,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const ORIGINS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_SKILL_FACE_308_PATHS/, 'leftover pretty skill → face');
assert.match(workerSrc, /\[\'\/compute\/skill\.md\'/, 'skill.md in product casefold map');
assert.match(workerSrc, /Agent first-call skill is GET \/compute\/skill\.md/, 'tab comment names the face');
assert.doesNotMatch(
  workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0],
  /['"]\/compute\/skill\.md['"]/,
  'exact /compute/skill.md is not a compute-tab leftover',
);

assert.match(COMPUTE_SKILL_MD, /^---\nname: dasha-compute\n/m, 'frontmatter name');
assert.match(COMPUTE_SKILL_MD, /^description: First call on Dasha Compute/m, 'frontmatter description');
assert.match(COMPUTE_SKILL_MD, /^# Dasha Compute/m, 'skill H1');
assert.match(COMPUTE_SKILL_MD, /^## When to use$/m, 'When to use');
assert.match(COMPUTE_SKILL_MD, /Not a ledger\. Not Room\./, 'when-to-use names run factory');
assert.equal(COMPUTE_SKILL_MD.includes(COMPUTE_AGENTS_TXT), true, 'skill embeds Agents');
assert.match(COMPUTE_SKILL_MD, /^## Agents$/m, 'Agents');
assert.match(COMPUTE_SKILL_MD, new RegExp(`^base_url ${COMPUTE_AGENTS_BASE.replace(/\./g, '\\.')}$`, 'm'), 'agents base_url');
assert.match(COMPUTE_SKILL_MD, /OpenAI SDK, Aider, Goose, OpenHands \(BYOK\)/, 'agents BYOK tools');
assert.match(COMPUTE_SKILL_MD, /^Mint: POST \/compute\/api\/guest-keys$/m, 'agents mint pointer');
assert.match(COMPUTE_SKILL_MD, /reasoning_effort low\|medium\|high \(alias effort\)/, 'agents can send reasoning_effort');
assert.equal(
  (COMPUTE_SKILL_MD.match(/curl -sS -X POST https:\/\/lobby\.getdasha\.com\/compute\/api\/guest-keys/g) || []).length,
  1,
  'skill keeps one mint curl',
);
assert.match(COMPUTE_SKILL_MD, /^## Create a key$/m, 'Create a key');
assert.match(COMPUTE_SKILL_MD, /https:\/\/www\.getdasha\.com\/compute#build/, 'key door is /compute#build');
assert.match(COMPUTE_SKILL_MD, /Sign in/, 'key door names Sign in');
assert.equal(COMPUTE_SKILL_MD.includes(COMPUTE_FIRST_CALL_TXT), true, 'skill embeds First call');
assert.match(COMPUTE_SKILL_MD, new RegExp(`^base ${COMPUTE_API_BASE.replace(/\./g, '\\.')}$`, 'm'), 'lobby base');
assert.match(COMPUTE_SKILL_MD, new RegExp(`^www ${COMPUTE_API_BASE_WWW.replace(/\./g, '\\.')}$`, 'm'), 'www mirror');
assert.match(COMPUTE_SKILL_MD, new RegExp(`^curl -sS ${COMPUTE_HEALTHZ.replace(/\./g, '\\.')}$`, 'm'), 'public healthz');
assert.match(COMPUTE_SKILL_MD, new RegExp(`^curl -sS ${COMPUTE_NETWORK.replace(/\./g, '\\.')}$`, 'm'), 'public network');
assert.match(COMPUTE_SKILL_MD, new RegExp(`^curl -sS ${COMPUTE_API_BASE.replace(/\./g, '\\.')}/models$`, 'm'), 'public models');
assert.match(COMPUTE_SKILL_MD, /Authorization: Bearer \$DASHA_API_KEY/, 'keyed Bearer');
assert.match(COMPUTE_SKILL_MD, /\/chat\/completions/, 'keyed chat');
assert.match(COMPUTE_SKILL_MD, /"model":"gemma3-27b"/, 'model from list');
assert.match(COMPUTE_SKILL_MD, /Pick `model` from the models list\./, 'model from models list');
assert.match(COMPUTE_SKILL_MD, /^## Receipts \/ Community \/ Hosted$/m, 'receipts heading');
assert.match(COMPUTE_SKILL_MD, /Receipts: signed, chained\./, 'receipts one-liner');
assert.match(COMPUTE_SKILL_MD, /Job receipts include `route` \(`community`\|`hosted`/, 'skill names receipt route');
assert.match(COMPUTE_SKILL_MD, /`turns` only when already counted/, 'skill never invents turns');
assert.match(COMPUTE_SKILL_MD, /https:\/\/www\.getdasha\.com\/compute\/api\/receipts/, 'receipts URL');
assert.match(COMPUTE_SKILL_MD, /^Community: a peer Mac runs the job\.$/m, 'Community one-liner');
assert.match(COMPUTE_SKILL_MD, /^Hosted: still there when no Mac is online\.$/m, 'Hosted one-liner');
assert.match(COMPUTE_SKILL_MD, /^Hosted Flash: bigger-than-Mac \(Spark \/ Engram-class Flash when offered\)\. Model id `deepseek-flash` \(Hosted\)\. Never Community\. Same base_url\. Watch x-dasha-route\.$/m, 'Hosted Flash option');
assert.match(COMPUTE_SKILL_MD, /Model id `deepseek-flash` \(Hosted\)/, 'skill names deepseek-flash Hosted-when-offered');
assert.match(COMPUTE_SKILL_MD, /^Engram\/SSD-stream local recipes stay Hosted\/Provide-Max — not Air kit\.$/m, 'skill local recipes stay Hosted/Provide-Max');
assert.doesNotMatch(COMPUTE_SKILL_MD, /Community.{0,80}(?:run|runs|serve|serves|host|hosts).{0,40}(?:Flash|763B|Engram|deepseek-flash)/i, 'skill NON-claim Community runs Flash/763B/Engram');
assert.match(COMPUTE_SKILL_MD, /x-dasha-route/, 'skill names spend route header');
assert.match(COMPUTE_SKILL_MD, /x-dasha-spend-usd/, 'skill names spend usd header');
assert.match(COMPUTE_SKILL_MD, /Community omits USD when unknown/, 'skill honesty: no invented community USD');
assert.match(COMPUTE_SKILL_MD, /^## Provide speed$/m, 'skill Provide speed');
assert.match(COMPUTE_SKILL_MD, /OLLAMA_KEEP_ALIVE/, 'skill keepalive');
assert.match(COMPUTE_SKILL_MD, /Hosted-only when offered/, 'skill Hosted-only Flash non-claim');
assert.ok(COMPUTE_SKILL_MD.includes(COMPUTE_LLMS_URL), 'skill links packet');
assert.ok(COMPUTE_SKILL_MD.includes(COMPUTE_AGENT_JSON_URL), 'skill links agent.json');
assert.doesNotMatch(COMPUTE_SKILL_MD, /plugin\.jup\.ag/, 'skill no plugin.jup.ag');
assert.doesNotMatch(COMPUTE_SKILL_MD, /disclaimer|not financial advice|dyor|\bnfa\b/i, 'skill no lecture');
assert.doesNotMatch(COMPUTE_SKILL_MD, /people.?data|email|phone|seed phrase/i, 'skill no people-data');
assert.match(COMPUTE_SKILL_MD, /Guest key: POST \/compute\/api\/guest-keys — 24h chat\+models/, 'skill names live guest key');
assert.match(COMPUTE_SKILL_MD, /curl -sS -X POST https:\/\/lobby\.getdasha\.com\/compute\/api\/guest-keys/, 'skill guest mint curl');
assert.doesNotMatch(COMPUTE_SKILL_MD, /guest-agent/i, 'skill stays Compute, not Room');

assert.ok(COMPUTE_LLMS_TXT.includes(COMPUTE_SKILL_URL), 'packet links skill');
assert.equal(COMPUTE_AGENT_JSON.docs.skill, COMPUTE_SKILL_URL, 'agent.json docs.skill');
assert.equal(COMPUTE_AGENT_JSON.docs.llms, COMPUTE_LLMS_URL, 'docs.llms stays');
assert.equal('examples' in COMPUTE_AGENT_JSON.docs, false, 'docs has no examples field');
assert.equal('quickstart' in COMPUTE_AGENT_JSON.docs, false, 'docs has no quickstart field');

assert.equal(potterHome308Dest('/compute/skill.md'), null, '/compute/skill.md stays 200');
assert.equal(potterHome308Dest('/compute/skill.md/'), COMPUTE_SKILL_URL, '/compute/skill.md/ → face');
assert.equal(potterHome308Dest('/Compute/Skill.md'), COMPUTE_SKILL_URL, 'Title-case /compute/skill.md');
assert.equal(potterHome308Dest('/COMPUTE/SKILL.MD'), COMPUTE_SKILL_URL, 'UPPER /compute/skill.md');
assert.equal(potterHome308Dest('/skill.md'), COMPUTE_SKILL_URL, '/skill.md → face');
assert.equal(potterHome308Dest('/skill.md/'), COMPUTE_SKILL_URL, '/skill.md/ → face');
assert.equal(potterHome308Dest('/Skill.md'), COMPUTE_SKILL_URL, 'Title-case /skill.md');
assert.equal(potterHome308Dest('/compute/agents/skill.md'), COMPUTE_SKILL_URL, '/compute/agents/skill.md → face');
assert.equal(potterHome308Dest('/compute/agents/skill.md/'), COMPUTE_SKILL_URL, '/compute/agents/skill.md/ → face');
assert.equal(potterHome308Dest('/Compute/Agents/Skill.md'), COMPUTE_SKILL_URL, 'Title-case agents skill');
assert.equal(potterHome308Dest('/compute/agent/skill.md'), COMPUTE_SKILL_URL, '/compute/agent/skill.md → face');
assert.equal(potterHome308Dest('/compute/skill'), 'https://www.getdasha.com/compute', '/compute/skill stays Typeform leftover');
assert.equal(potterHome308Dest('/compute/skill/'), 'https://www.getdasha.com/compute', '/compute/skill/ stays Typeform leftover');
assert.equal(potterHome308Dest('/compute/skill/provide.md'), null, '/compute/skill/provide.md stays 200');
assert.equal(potterHome308Dest('/compute/skill/use.md'), null, '/compute/skill/use.md stays 200');
assert.equal(potterHome308Dest('/compute/skills.md'), 'https://www.getdasha.com/compute', 'plural skills.md stays /compute');
assert.equal(potterHome308Dest('/skills.md'), 'https://www.getdasha.com/compute', 'apex /skills.md stays /compute');

{
  const direct = computeAgentAeoResponse(new Request('https://www.getdasha.com/compute/skill.md'));
  assert.equal(direct.status, 200, 'helper serves skill face');
  assert.equal(direct.headers.get('x-dasha-edge'), 'compute-skill-face');
  assert.equal(await direct.text(), COMPUTE_SKILL_MD);
  const miss = computeAgentAeoResponse(new Request('https://www.getdasha.com/privacy'));
  assert.equal(miss, null, 'helper ignores non-AEO paths');
}

for (const origin of ORIGINS) {
  const skill = await edgeWorker.fetch(new Request(`${origin}/compute/skill.md`), {});
  assert.equal(skill.status, 200, `${origin}/compute/skill.md`);
  assert.equal(skill.headers.get('x-dasha-edge'), 'compute-skill-face');
  assert.match(skill.headers.get('content-type') || '', /text\/markdown/);
  assert.equal(skill.headers.get('access-control-allow-origin'), '*');
  const skillBody = await skill.text();
  assert.equal(skillBody, COMPUTE_SKILL_MD);
  assert.match(skillBody, /Authorization: Bearer \$DASHA_API_KEY/);
  assert.match(skillBody, /https:\/\/www\.getdasha\.com\/compute#build/);
  assert.doesNotMatch(skillBody, /plugin\.jup\.ag/);

  const head = await edgeWorker.fetch(new Request(`${origin}/compute/skill.md`, { method: 'HEAD' }), {});
  assert.equal(head.status, 200, `${origin}/compute/skill.md HEAD`);
  assert.equal(head.headers.get('x-dasha-edge'), 'compute-skill-face');
  assert.equal(await head.text(), '');

  const packet = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`), {});
  assert.ok((await packet.text()).includes(COMPUTE_SKILL_URL), `${origin}/compute/llms.txt links skill`);

  const agent = await edgeWorker.fetch(new Request(`${origin}/.well-known/agent.json`), {});
  const agentJson = await agent.json();
  assert.equal(agentJson.docs.skill, COMPUTE_SKILL_URL, `${origin} agent.json docs.skill`);

  const index = await edgeWorker.fetch(new Request(`${origin}/llms.txt`), {});
  const indexBody = await index.text();
  assert.ok(indexBody.includes(COMPUTE_SKILL_URL), `${origin}/llms.txt links skill`);
  assert.doesNotMatch(indexBody, /## When to use/, `${origin}/llms.txt stays the short index`);
  assert.doesNotMatch(indexBody, /## Agents/, `${origin}/llms.txt stays the short index`);

  const full = await edgeWorker.fetch(new Request(`${origin}/llms-full.txt`), {});
  assert.ok((await full.text()).includes(COMPUTE_SKILL_URL), `${origin}/llms-full.txt links skill`);
}

const LEFTOVERS = [
  ['/skill.md', COMPUTE_SKILL_URL],
  ['/skill.md/', COMPUTE_SKILL_URL],
  ['/Skill.md', COMPUTE_SKILL_URL],
  ['/compute/skill.md/', COMPUTE_SKILL_URL],
  ['/Compute/Skill.md', COMPUTE_SKILL_URL],
  ['/compute/agents/skill.md', COMPUTE_SKILL_URL],
  ['/compute/agents/skill.md/', COMPUTE_SKILL_URL],
  ['/Compute/Agents/Skill.md', COMPUTE_SKILL_URL],
];
for (const origin of ORIGINS) {
  const host = new URL(origin).hostname;
  for (const [path, dest] of LEFTOVERS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`${origin}${path}`, { method }), {});
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
}

console.log('dasha-compute-skill-face: PASS (/compute/skill.md 200 + leftovers 308, packet + agent.json docs.skill, no plugin.jup.ag)');
