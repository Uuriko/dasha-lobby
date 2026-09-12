#!/usr/bin/env node
/**
 * Compute agent AEO: /compute/llms.txt + /.well-known/agent.json
 * + /compute/.well-known/agent.json + /compute/agent.json alias
 * + /compute/llms-full.txt. Run factory, not a ledger.
 * Quiet /compute describedby door. No wrangler. No Designer.
 * Never plugin.jup.ag. No people-data. No guest-agent mint.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import {
  COMPUTE_AGENT_JSON,
  COMPUTE_AGENT_JSON_ALIAS_URL,
  COMPUTE_AGENT_JSON_URL,
  COMPUTE_AGENTS_BASE,
  COMPUTE_AGENTS_TXT,
  COMPUTE_API_BASE,
  COMPUTE_API_BASE_WWW,
  COMPUTE_FIRST_CALL_TXT,
  COMPUTE_HEALTHZ,
  COMPUTE_LLMS_FULL_TXT,
  COMPUTE_LLMS_FULL_URL,
  COMPUTE_LLMS_TXT,
  COMPUTE_LLMS_URL,
  COMPUTE_NETWORK,
  COMPUTE_SKILL_MD,
  COMPUTE_SKILL_URL,
  COMPUTE_WHICH_KEY_TXT,
  OCM_API_BASE,
  attachComputeLlmsHtmlLinks,
  computeAgentAeoResponse,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const ORIGINS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];
const AGENT_PATHS = [
  '/.well-known/agent.json',
  '/compute/.well-known/agent.json',
  '/compute/agent.json',
];

function extractConst(name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`);
  const m = workerSrc.match(re);
  assert.ok(m, `${name} must be embedded in the worker`);
  return m[1];
}

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /from '\.\/dasha-compute-agent\.mjs'/, 'worker imports shared Compute AEO module');
assert.match(workerSrc, /computeAgentAeoResponse/, 'worker serves shared Compute AEO helper');
assert.equal(
  (workerSrc.match(/computeAgentAeoResponse\(request\)/g) || []).length,
  2,
  'Compute AEO on productEdge + default fetch',
);
assert.match(workerSrc, /attachComputeLlmsHtmlLinks/, 'compute page attaches packet door');
assert.match(workerSrc, /POTTER_COMPUTE_LLMS_AEO_308_PATHS/, 'leftover /compute/llms → packet');
assert.match(workerSrc, /POTTER_COMPUTE_LLMS_FULL_AEO_308_PATHS/, 'leftover /compute/llms-full → full packet');
assert.match(workerSrc, /POTTER_COMPUTE_AGENT_JSON_ALIAS_308_PATHS/, 'leftover /compute/agent.json/ → alias');
assert.match(workerSrc, /\[\'\/compute\/agent\.json\'/, 'alias in product casefold map');
assert.match(workerSrc, /\[\'\/compute\/llms-full\.txt\'/, 'compute llms-full in product casefold map');
assert.match(workerSrc, /POTTER_COMPUTE_SKILL_FACE_308_PATHS/, 'leftover pretty skill → face');

assert.match(COMPUTE_LLMS_TXT, /^# Dasha Compute/m, 'packet H1');
assert.match(COMPUTE_LLMS_TXT, /run factory, not a ledger/, 'packet names run factory');
assert.match(COMPUTE_LLMS_TXT, new RegExp(`^base ${COMPUTE_API_BASE.replace(/\./g, '\\.')}$`, 'm'));
assert.match(COMPUTE_LLMS_TXT, new RegExp(`^www ${COMPUTE_API_BASE_WWW.replace(/\./g, '\\.')}$`, 'm'));
assert.match(COMPUTE_LLMS_TXT, new RegExp(`^healthz ${COMPUTE_HEALTHZ.replace(/\./g, '\\.')}$`, 'm'));
assert.match(COMPUTE_LLMS_TXT, new RegExp(`^network ${COMPUTE_NETWORK.replace(/\./g, '\\.')}$`, 'm'));
assert.match(COMPUTE_LLMS_TXT, /auth Bearer API key/, 'packet names Bearer auth');
assert.match(COMPUTE_LLMS_TXT, /^no key needed for healthz \+ network \+ models; key needed for chat$/m, 'packet soft-guest line');
assert.equal(COMPUTE_LLMS_TXT.includes(COMPUTE_WHICH_KEY_TXT), true, 'packet names which key');
assert.match(COMPUTE_LLMS_TXT, /ocm_live_/, 'packet names OCM key');
assert.match(COMPUTE_LLMS_TXT, new RegExp(OCM_API_BASE.replace(/\./g, '\\.')), 'packet names OCM base');
assert.match(COMPUTE_SKILL_MD, /Which key \/ which base/, 'skill names which key');
assert.equal(COMPUTE_AGENT_JSON.ocm.base_url, OCM_API_BASE);
assert.equal(COMPUTE_AGENT_JSON.ocm.key, 'ocm_live_');
assert.equal(COMPUTE_AGENT_JSON.endpoints.ocm_v1, OCM_API_BASE);
assert.match(COMPUTE_LLMS_TXT, /^guest key POST \/compute\/api\/guest-keys — 24h chat\+models, 3\/hour\/IP$/m, 'packet guest key mint');
assert.match(COMPUTE_LLMS_TXT, /curl -sS -X POST https:\/\/lobby\.getdasha\.com\/compute\/api\/guest-keys/, 'packet guest mint curl');
assert.equal(COMPUTE_LLMS_TXT.includes(COMPUTE_AGENTS_TXT), true, 'packet embeds Agents');
assert.match(COMPUTE_LLMS_TXT, /^## Agents$/m, 'packet Agents');
assert.match(COMPUTE_LLMS_TXT, new RegExp(`^base_url ${COMPUTE_AGENTS_BASE.replace(/\./g, '\\.')}$`, 'm'), 'packet agents base_url');
assert.match(COMPUTE_LLMS_TXT, /OpenAI SDK, Aider, Goose, OpenHands \(BYOK\)/, 'packet agents BYOK tools');
assert.match(COMPUTE_LLMS_TXT, /^Mint: POST \/compute\/api\/guest-keys$/m, 'packet agents mint pointer');
assert.match(COMPUTE_LLMS_TXT, /reasoning_effort low\|medium\|high \(alias effort\)/, 'packet names reasoning_effort');
assert.equal(
  (COMPUTE_LLMS_TXT.match(/curl -sS -X POST https:\/\/lobby\.getdasha\.com\/compute\/api\/guest-keys/g) || []).length,
  1,
  'packet keeps one mint curl',
);
assert.match(COMPUTE_LLMS_TXT, /First path: POST \/compute\/api\/guest-keys\. Or sign in at \/compute#build for dsk_\./, 'packet first path');
assert.match(
  COMPUTE_SKILL_MD,
  /Guest key: POST \/compute\/api\/guest-keys[\s\S]*Or sign in at https:\/\/www\.getdasha\.com\/compute#build for lasting dsk_/,
  'skill Create a key is guest-first',
);
assert.match(
  COMPUTE_LLMS_FULL_TXT,
  /## Create a key\n\nGuest key: POST \/compute\/api\/guest-keys[\s\S]*Or sign in at https:\/\/www\.getdasha\.com\/compute#build for lasting dsk_/,
  'full packet embeds guest-first Create a key',
);
assert.equal(COMPUTE_LLMS_TXT.includes(COMPUTE_FIRST_CALL_TXT), true, 'packet embeds First call');
assert.match(COMPUTE_LLMS_TXT, /^## First call$/m, 'packet First call heading');
assert.match(COMPUTE_LLMS_TXT, /Authorization: Bearer \$DASHA_API_KEY/, 'packet keyed curl');
assert.match(COMPUTE_LLMS_TXT, /"model":"gemma3-27b"/, 'packet first-call model');
assert.match(COMPUTE_LLMS_TXT, /^Community: a peer Mac runs the job\.$/m, 'Community one-liner');
assert.match(COMPUTE_LLMS_TXT, /^Hosted: still there when no Mac is online\.$/m, 'Hosted one-liner');
assert.match(COMPUTE_LLMS_TXT, /^Hosted Flash: bigger-than-Mac \(Spark \/ Engram-class Flash when offered\)\. Model id `deepseek-flash` \(Hosted\)\. Never Community\. Same base_url\. Watch x-dasha-route\.$/m, 'Hosted Flash option');
assert.match(COMPUTE_LLMS_TXT, /Model id `deepseek-flash` \(Hosted\)/, 'packet names deepseek-flash Hosted-when-offered');
assert.match(COMPUTE_LLMS_TXT, /^Engram\/SSD-stream local recipes stay Hosted\/Provide-Max — not Air kit\.$/m, 'packet local recipes stay Hosted/Provide-Max');
assert.doesNotMatch(COMPUTE_LLMS_TXT, /Community.{0,80}(?:run|runs|serve|serves|host|hosts).{0,40}(?:Flash|763B|Engram|deepseek-flash)/i, 'packet NON-claim Community runs Flash/763B/Engram');
assert.match(COMPUTE_LLMS_TXT, /^Hosted Astra: GPT-6 when offered\. Model id `gpt-6-astra` \(Hosted\)\. Never Community\. Same base_url\. Watch x-dasha-route · x-dasha-model\.$/m, 'Hosted Astra option');
assert.match(COMPUTE_LLMS_TXT, /Model id `gpt-6-astra` \(Hosted\)/, 'packet names gpt-6-astra Hosted-when-offered');
assert.match(COMPUTE_LLMS_TXT, /^Async tools \/ mid-turn steering \/ computer use stay Hosted-class only\.$/m, 'packet Astra Hosted-class only');
assert.doesNotMatch(COMPUTE_LLMS_TXT, /Community.{0,80}(?:run|runs|serve|serves|host|hosts).{0,40}(?:Astra|gpt-6-astra|GPT-6)/i, 'packet NON-claim Community runs Astra');
assert.match(COMPUTE_LLMS_TXT, /x-dasha-route/, 'packet names spend route header');
assert.match(COMPUTE_LLMS_TXT, /x-dasha-spend-usd/, 'packet names spend usd header');
assert.match(COMPUTE_LLMS_TXT, /Community omits unknown USD/, 'packet honesty: no invented community USD');
assert.match(COMPUTE_LLMS_TXT, /receipts include route community\|hosted/, 'packet names receipt route');
assert.match(COMPUTE_LLMS_TXT, /turns only when counted/, 'packet never invents turns');
assert.match(COMPUTE_LLMS_TXT, /^## Provide speed$/m, 'packet Provide speed');
assert.match(COMPUTE_LLMS_TXT, /OLLAMA_KEEP_ALIVE/, 'packet keepalive');
assert.match(COMPUTE_LLMS_TXT, /Hosted-only when offered/, 'packet Hosted-only Flash non-claim');
assert.match(COMPUTE_LLMS_TXT, /https:\/\/www\.getdasha\.com\/llms\.txt/, 'packet links site llms');
assert.match(COMPUTE_LLMS_TXT, /https:\/\/www\.getdasha\.com\/llms-full\.txt/, 'packet links site llms-full');
assert.doesNotMatch(COMPUTE_LLMS_TXT, /plugin\.jup\.ag/, 'packet no plugin.jup.ag');
assert.doesNotMatch(COMPUTE_LLMS_TXT, /disclaimer|not financial advice|dyor|\bnfa\b/i, 'packet no lecture');
assert.doesNotMatch(COMPUTE_LLMS_TXT, /people.?data|email|phone|seed phrase/i, 'packet no people-data');
assert.doesNotMatch(COMPUTE_LLMS_TXT, /project-room|guest-agent/i, 'packet stays Compute, not Room');

assert.ok(COMPUTE_LLMS_FULL_TXT.startsWith(COMPUTE_LLMS_TXT), 'full packet starts with short packet');
assert.ok(COMPUTE_LLMS_FULL_TXT.length > COMPUTE_LLMS_TXT.length, 'full packet is longer');
assert.ok(COMPUTE_LLMS_FULL_TXT.includes(COMPUTE_AGENT_JSON_ALIAS_URL), 'full packet names alias');
assert.ok(COMPUTE_LLMS_FULL_TXT.includes(COMPUTE_SKILL_MD), 'full packet embeds skill');
assert.match(COMPUTE_LLMS_FULL_TXT, /^## Discovery$/m, 'full packet Discovery');
assert.doesNotMatch(COMPUTE_LLMS_FULL_TXT, /plugin\.jup\.ag/, 'full packet no plugin.jup.ag');
assert.doesNotMatch(COMPUTE_LLMS_FULL_TXT, /people.?data|email|phone|seed phrase/i, 'full packet no people-data');

assert.equal(COMPUTE_AGENT_JSON.name, 'Dasha Compute');
assert.match(COMPUTE_AGENT_JSON.description, /OpenAI-compatible inference marketplace/);
assert.match(COMPUTE_AGENT_JSON.description, /run factory/);
assert.equal(COMPUTE_AGENT_JSON.base_url, COMPUTE_API_BASE);
assert.equal(COMPUTE_AGENT_JSON.base_url_www, COMPUTE_API_BASE_WWW);
assert.equal(COMPUTE_AGENT_JSON.auth.type, 'api_key');
assert.equal(COMPUTE_AGENT_JSON.auth.scheme, 'Bearer');
assert.deepEqual(COMPUTE_AGENT_JSON.auth.public_reads, ['healthz', 'network', 'models']);
assert.equal(COMPUTE_AGENT_JSON.auth.chat, 'bearer');
assert.equal(COMPUTE_AGENT_JSON.auth.guest_key.method, 'POST');
assert.equal(COMPUTE_AGENT_JSON.auth.guest_key.ttl_seconds, 86400);
assert.match(COMPUTE_AGENT_JSON.auth.guest_key.curl, /POST https:\/\/lobby\.getdasha\.com\/compute\/api\/guest-keys/);
assert.equal(COMPUTE_AGENT_JSON.endpoints.chat_completions, `${COMPUTE_API_BASE}/chat/completions`);
assert.equal(COMPUTE_AGENT_JSON.endpoints.models, `${COMPUTE_API_BASE}/models`);
assert.equal(COMPUTE_AGENT_JSON.endpoints.healthz, COMPUTE_HEALTHZ);
assert.equal(COMPUTE_AGENT_JSON.endpoints.network, COMPUTE_NETWORK);
assert.equal(COMPUTE_AGENT_JSON.endpoints.guest_keys, 'https://lobby.getdasha.com/compute/api/guest-keys');
assert.equal(COMPUTE_AGENT_JSON.docs.llms, COMPUTE_LLMS_URL);
assert.equal(COMPUTE_AGENT_JSON.docs.skill, COMPUTE_SKILL_URL);
assert.doesNotMatch(JSON.stringify(COMPUTE_AGENT_JSON), /plugin\.jup\.ag/);
assert.doesNotMatch(JSON.stringify(COMPUTE_AGENT_JSON), /secret|password|potter/i);

const llms = extractConst('LLMS_TXT');
const full = extractConst('LLMS_FULL_TXT');
for (const [name, body] of [['LLMS_TXT', llms], ['LLMS_FULL_TXT', full]]) {
  assert.ok(body.includes(COMPUTE_LLMS_URL), `${name} points at /compute/llms.txt`);
  assert.ok(body.includes(COMPUTE_SKILL_URL), `${name} points at /compute/skill.md`);
  assert.ok(body.includes(COMPUTE_AGENT_JSON_URL), `${name} points at /.well-known/agent.json`);
  assert.ok(body.includes(MINT), `${name} keeps associated mint`);
  assert.ok(body.includes(PAIR), `${name} keeps pair`);
  assert.match(body, /First path: POST \/compute\/api\/guest-keys\. Or sign in at \/compute#build for dsk_\./, `${name} first path`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${name} no plugin.jup.ag`);
}

assert.equal(potterHome308Dest('/compute/llms'), COMPUTE_LLMS_URL, '/compute/llms → packet');
assert.equal(potterHome308Dest('/compute/llms/'), COMPUTE_LLMS_URL, '/compute/llms/ → packet');
assert.equal(potterHome308Dest('/Compute/Llms'), COMPUTE_LLMS_URL, 'Title-case /compute/llms');
assert.equal(potterHome308Dest('/compute/llms.txt'), null, '/compute/llms.txt stays 200');
assert.equal(potterHome308Dest('/compute/llms-full.txt'), null, '/compute/llms-full.txt stays 200');
assert.equal(potterHome308Dest('/compute/llms-full'), COMPUTE_LLMS_FULL_URL, '/compute/llms-full → full packet');
assert.equal(potterHome308Dest('/compute/llms-full/'), COMPUTE_LLMS_FULL_URL, '/compute/llms-full/ → full packet');
assert.equal(potterHome308Dest('/Compute/Llms-Full.txt'), COMPUTE_LLMS_FULL_URL, 'Title-case /compute/llms-full.txt');
assert.equal(potterHome308Dest('/compute/skill.md'), null, '/compute/skill.md stays 200');
assert.equal(potterHome308Dest('/compute/skill.md/'), COMPUTE_SKILL_URL, '/compute/skill.md/ → face');
assert.equal(potterHome308Dest('/skill.md'), COMPUTE_SKILL_URL, '/skill.md → face');
assert.equal(potterHome308Dest('/.well-known/agent.json'), null, '/.well-known/agent.json stays 200');
assert.equal(potterHome308Dest('/compute/.well-known/agent.json'), null, '/compute/.well-known/agent.json stays 200');
assert.equal(potterHome308Dest('/compute/agent.json'), null, '/compute/agent.json stays 200');
assert.equal(potterHome308Dest('/compute/agent.json/'), COMPUTE_AGENT_JSON_ALIAS_URL, '/compute/agent.json/ → alias');
assert.equal(potterHome308Dest('/.well-known/Agent.json'), COMPUTE_AGENT_JSON_URL, 'Title-case site agent.json');
assert.equal(
  potterHome308Dest('/compute/.well-known/AGENT.JSON'),
  'https://www.getdasha.com/compute/.well-known/agent.json',
  'Title-case compute well-known agent.json',
);
assert.equal(potterHome308Dest('/compute/Agent.json'), COMPUTE_AGENT_JSON_ALIAS_URL, 'Title-case /compute/agent.json');
assert.equal(potterHome308Dest('/COMPUTE/AGENT.JSON'), COMPUTE_AGENT_JSON_ALIAS_URL, 'UPPER /compute/agent.json');
assert.equal(potterHome308Dest('/agent'), 'https://www.getdasha.com/compute', '/agent stays Compute leftover, not agent.json');
assert.equal(potterHome308Dest('/agent.json'), null, 'apex /agent.json stays out (not a 200 alias)');
assert.equal(potterHome308Dest('/compute/agent'), 'https://www.getdasha.com/compute', '/compute/agent stays leftover');
assert.equal(potterHome308Dest('/compute/llms-api'), 'https://www.getdasha.com/compute', '/compute/llms-api stays leftover');

{
  const injected = attachComputeLlmsHtmlLinks('<html><head></head><body></body></html>');
  assert.match(injected, /<link rel="describedby" href="\/compute\/llms\.txt" type="text\/plain">/);
  const again = attachComputeLlmsHtmlLinks(injected);
  assert.equal((again.match(/href="\/compute\/llms\.txt"/g) || []).length, 1);
  const bodyHref = attachComputeLlmsHtmlLinks(
    '<html><head><link rel="describedby" href="/llms.txt" type="text/plain"></head><body><a href="/compute/llms.txt">packet</a></body></html>',
  );
  assert.match(bodyHref, /<link rel="describedby" href="\/compute\/llms\.txt" type="text\/plain">/);
}

for (const origin of ORIGINS) {
  const packet = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`), {});
  assert.equal(packet.status, 200, `${origin}/compute/llms.txt`);
  assert.equal(packet.headers.get('x-dasha-edge'), 'compute-llms');
  assert.match(packet.headers.get('content-type') || '', /text\/plain/);
  const packetBody = await packet.text();
  assert.equal(packetBody, COMPUTE_LLMS_TXT);
  assert.match(packetBody, /Mac Ask \/ Provide \/ OpenAI-compatible API/);
  assert.match(packetBody, /https:\/\/lobby\.getdasha\.com\/compute\/api\/v1/);
  assert.doesNotMatch(packetBody, /plugin\.jup\.ag/);

  const head = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`, { method: 'HEAD' }), {});
  assert.equal(head.status, 200, `${origin}/compute/llms.txt HEAD`);
  assert.equal(await head.text(), '');

  const computeFull = await edgeWorker.fetch(new Request(`${origin}/compute/llms-full.txt`), {});
  assert.equal(computeFull.status, 200, `${origin}/compute/llms-full.txt`);
  assert.equal(computeFull.headers.get('x-dasha-edge'), 'compute-llms-full');
  assert.match(computeFull.headers.get('content-type') || '', /text\/plain/);
  const computeFullBody = await computeFull.text();
  assert.equal(computeFullBody, COMPUTE_LLMS_FULL_TXT);
  assert.ok(computeFullBody.includes(COMPUTE_AGENT_JSON_ALIAS_URL));
  assert.ok(computeFullBody.includes(COMPUTE_SKILL_MD));
  assert.doesNotMatch(computeFullBody, /plugin\.jup\.ag/);
  const computeFullHead = await edgeWorker.fetch(new Request(`${origin}/compute/llms-full.txt`, { method: 'HEAD' }), {});
  assert.equal(computeFullHead.status, 200, `${origin}/compute/llms-full.txt HEAD`);
  assert.equal(await computeFullHead.text(), '');

  for (const path of AGENT_PATHS) {
    const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
    assert.equal(res.status, 200, `${origin}${path}`);
    assert.equal(res.headers.get('x-dasha-edge'), 'compute-agent');
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.deepEqual(await res.json(), COMPUTE_AGENT_JSON);
    const opt = await edgeWorker.fetch(new Request(`${origin}${path}`, { method: 'OPTIONS' }), {});
    assert.equal(opt.status, 204, `${origin}${path} OPTIONS`);
    const agentHead = await edgeWorker.fetch(new Request(`${origin}${path}`, { method: 'HEAD' }), {});
    assert.equal(agentHead.status, 200, `${origin}${path} HEAD`);
    assert.equal(await agentHead.text(), '');
  }

  const index = await edgeWorker.fetch(new Request(`${origin}/llms.txt`), {});
  assert.equal(index.status, 200, `${origin}/llms.txt`);
  const indexBody = await index.text();
  assert.ok(indexBody.includes(COMPUTE_LLMS_URL), `${origin}/llms.txt links compute packet`);
  assert.ok(indexBody.includes(COMPUTE_SKILL_URL), `${origin}/llms.txt links compute skill`);
  assert.ok(indexBody.includes(COMPUTE_AGENT_JSON_URL), `${origin}/llms.txt links agent.json`);
  assert.ok(indexBody.includes(MINT), `${origin}/llms.txt keeps mint`);
  assert.match(indexBody, /First path: POST \/compute\/api\/guest-keys\. Or sign in at \/compute#build for dsk_\./);
  assert.doesNotMatch(indexBody, /plugin\.jup\.ag/);

  const fullRes = await edgeWorker.fetch(new Request(`${origin}/llms-full.txt`), {});
  assert.equal(fullRes.status, 200, `${origin}/llms-full.txt`);
  const fullBody = await fullRes.text();
  assert.ok(fullBody.includes(COMPUTE_LLMS_URL), `${origin}/llms-full.txt links compute packet`);
  assert.ok(fullBody.includes(COMPUTE_SKILL_URL), `${origin}/llms-full.txt links compute skill`);
  assert.ok(fullBody.includes(COMPUTE_AGENT_JSON_URL), `${origin}/llms-full.txt links agent.json`);
  assert.ok(fullBody.includes(MINT), `${origin}/llms-full.txt keeps mint`);
  assert.match(fullBody, /First path: POST \/compute\/api\/guest-keys\. Or sign in at \/compute#build for dsk_\./);
  assert.equal(fullBody.includes(COMPUTE_FIRST_CALL_TXT), true, `${origin}/llms-full.txt First call`);
  assert.match(fullBody, /^## First call$/m, `${origin}/llms-full.txt First call heading`);
  assert.doesNotMatch(fullBody, /plugin\.jup\.ag/);

  const page = await edgeWorker.fetch(new Request(`${origin}/compute`), {});
  assert.equal(page.status, 200, `${origin}/compute`);
  const link = page.headers.get('link') || '';
  assert.match(link, /<\/llms\.txt>; rel="describedby"/, `${origin}/compute keeps site llms Link`);
  assert.match(link, /<\/compute\/llms\.txt>; rel="describedby"/, `${origin}/compute Link packet`);
  const html = await page.text();
  assert.match(html, /<link rel="describedby" href="\/compute\/llms\.txt"/, `${origin}/compute HTML packet door`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const leftover = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute/llms'), {});
  assert.equal(leftover.status, 308, '/compute/llms 308');
  assert.equal(leftover.headers.get('location'), COMPUTE_LLMS_URL);
}

{
  const leftoverFull = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute/llms-full'), {});
  assert.equal(leftoverFull.status, 308, '/compute/llms-full 308');
  assert.equal(leftoverFull.headers.get('location'), COMPUTE_LLMS_FULL_URL);
}

{
  const leftoverAlias = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute/agent.json/'), {});
  assert.equal(leftoverAlias.status, 308, '/compute/agent.json/ 308');
  assert.equal(leftoverAlias.headers.get('location'), COMPUTE_AGENT_JSON_ALIAS_URL);
}

{
  const titleAlias = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute/Agent.json'), {});
  assert.equal(titleAlias.status, 308, '/compute/Agent.json 308');
  assert.equal(titleAlias.headers.get('location'), COMPUTE_AGENT_JSON_ALIAS_URL);
}

{
  const direct = computeAgentAeoResponse(new Request('https://www.getdasha.com/privacy'));
  assert.equal(direct, null, 'helper ignores non-AEO paths');
}

console.log('dasha-compute-agent-aeo: PASS (/compute/llms.txt + well-known agent.json + /compute/agent.json alias + /compute/llms-full.txt, site llms pointers, /compute door, leftover /compute/llms, no plugin.jup.ag)');
