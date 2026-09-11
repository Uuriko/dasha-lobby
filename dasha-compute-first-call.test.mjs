#!/usr/bin/env node
/**
 * Compute agent packet First call: public curls + keyed chat + OpenAI clients.
 * Markers live in /compute/llms.txt and site /llms-full.txt Compute section.
 * agent.json keeps docs.llms (no examples/quickstart URL field on this schema).
 * No wrangler. No version bump. No soft-guest auth change. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import {
  COMPUTE_AGENT_JSON,
  COMPUTE_API_BASE,
  COMPUTE_API_BASE_WWW,
  COMPUTE_FIRST_CALL_TXT,
  COMPUTE_HEALTHZ,
  COMPUTE_LLMS_TXT,
  COMPUTE_LLMS_URL,
  COMPUTE_NETWORK,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const ORIGINS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];

function assertFirstCall(body, label) {
  assert.match(body, /^## First call$/m, `${label} First call heading`);
  assert.match(body, new RegExp(`^base ${COMPUTE_API_BASE.replace(/\./g, '\\.')}$`, 'm'), `${label} lobby base`);
  assert.match(body, new RegExp(`^www ${COMPUTE_API_BASE_WWW.replace(/\./g, '\\.')}$`, 'm'), `${label} www mirror`);
  assert.match(body, new RegExp(`^curl -sS ${COMPUTE_HEALTHZ.replace(/\./g, '\\.')}$`, 'm'), `${label} public healthz`);
  assert.match(body, new RegExp(`^curl -sS ${COMPUTE_NETWORK.replace(/\./g, '\\.')}$`, 'm'), `${label} public network`);
  assert.match(body, new RegExp(`^curl -sS ${COMPUTE_API_BASE.replace(/\./g, '\\.')}/models$`, 'm'), `${label} public models`);
  assert.match(body, /Authorization: Bearer \$DASHA_API_KEY/, `${label} keyed Bearer`);
  assert.match(body, /\/chat\/completions/, `${label} keyed chat`);
  assert.match(body, /"model":"gemma3-27b"/, `${label} model from list`);
  assert.match(
    body,
    new RegExp(`OpenAI\\(base_url="${COMPUTE_API_BASE.replace(/\./g, '\\.')}", api_key=os\\.environ\\["DASHA_API_KEY"\\]\\)`),
    `${label} OpenAI Python`,
  );
  assert.match(
    body,
    new RegExp(`new OpenAI\\(\\{ baseURL: "${COMPUTE_API_BASE.replace(/\./g, '\\.')}", apiKey: process\\.env\\.DASHA_API_KEY \\}\\)`),
    `${label} OpenAI JS`,
  );
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
  assert.doesNotMatch(body, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(body, /people.?data|phone|seed phrase/i, `${label} no people-data`);
  assert.doesNotMatch(body, /project-room|guest-agent/i, `${label} stays Compute`);
}

assert.equal(COMPUTE_LLMS_TXT.includes(COMPUTE_FIRST_CALL_TXT), true, 'packet embeds shared First call');
assertFirstCall(COMPUTE_FIRST_CALL_TXT, 'shared First call');
assertFirstCall(COMPUTE_LLMS_TXT, 'packet');
assert.match(workerSrc, /COMPUTE_FIRST_CALL_TXT/, 'worker mirrors shared First call');
assert.match(workerSrc, /\$\{COMPUTE_FIRST_CALL_TXT\}/, 'llms-full interpolates shared First call');

assert.equal(COMPUTE_AGENT_JSON.docs.llms, COMPUTE_LLMS_URL, 'agent.json docs.llms is the packet');
assert.equal(COMPUTE_AGENT_JSON.docs.skill, 'https://www.getdasha.com/compute/skill.md', 'agent.json docs.skill is the face');
assert.equal('examples' in COMPUTE_AGENT_JSON, false, 'agent.json has no examples field (schema)');
assert.equal('quickstart' in COMPUTE_AGENT_JSON, false, 'agent.json has no quickstart field (schema)');
assert.equal('examples' in COMPUTE_AGENT_JSON.docs, false, 'docs has no examples URL field');
assert.equal('quickstart' in COMPUTE_AGENT_JSON.docs, false, 'docs has no quickstart URL field');

for (const origin of ORIGINS) {
  const packet = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`), {});
  assert.equal(packet.status, 200, `${origin}/compute/llms.txt`);
  const packetBody = await packet.text();
  assert.equal(packetBody, COMPUTE_LLMS_TXT);
  assertFirstCall(packetBody, `${origin}/compute/llms.txt`);

  const full = await edgeWorker.fetch(new Request(`${origin}/llms-full.txt`), {});
  assert.equal(full.status, 200, `${origin}/llms-full.txt`);
  const fullBody = await full.text();
  assert.equal(fullBody.includes(COMPUTE_FIRST_CALL_TXT), true, `${origin}/llms-full.txt embeds First call`);
  assertFirstCall(fullBody, `${origin}/llms-full.txt`);
  const beforeFaq = fullBody.split('## Compute buyer FAQ')[0];
  assert.match(beforeFaq, /^## First call$/m, `${origin}/llms-full.txt First call sits in Compute section`);
  assert.match(beforeFaq, /First path: POST \/compute\/api\/guest-keys\. Or sign in at \/compute#build for dsk_\./);

  const index = await edgeWorker.fetch(new Request(`${origin}/llms.txt`), {});
  const indexBody = await index.text();
  assert.ok(indexBody.includes(COMPUTE_LLMS_URL), `${origin}/llms.txt still points at packet`);
  assert.doesNotMatch(indexBody, /## First call/, `${origin}/llms.txt stays the short index`);
  assert.doesNotMatch(indexBody, /## Agents/, `${origin}/llms.txt stays the short index`);
  assert.doesNotMatch(indexBody, /gemma3-27b/, `${origin}/llms.txt no First call wall`);
}

console.log('dasha-compute-first-call: PASS (First call curls + OpenAI clients in packet + llms-full; agent.json unchanged; no plugin.jup.ag)');
