#!/usr/bin/env node
/**
 * Cursor skill alias: GET /compute/skills/dasha-compute/SKILL.md
 * (+ /compute/skills/dasha-compute) returns the same bytes as /compute/skill.md.
 * Bare /compute/skills stays leftover → /compute. No content rewrite. No guest mint.
 * No wrangler. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import {
  COMPUTE_LLMS_TXT,
  COMPUTE_SKILL_CURSOR_URL,
  COMPUTE_SKILL_MD,
  COMPUTE_SKILL_URL,
  computeAgentAeoResponse,
  isComputeSkillFacePath,
} from './dasha-compute-agent.mjs';

const ORIGINS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];
const ALIAS_PATHS = [
  '/compute/skills/dasha-compute/SKILL.md',
  '/compute/skills/dasha-compute',
];

assert.equal(isComputeSkillFacePath('/compute/skill.md'), true);
assert.equal(isComputeSkillFacePath('/compute/skills/dasha-compute/SKILL.md'), true);
assert.equal(isComputeSkillFacePath('/compute/skills/dasha-compute/skill.md'), true);
assert.equal(isComputeSkillFacePath('/compute/skills/dasha-compute'), true);
assert.equal(isComputeSkillFacePath('/compute/skills'), false, 'bare /compute/skills stays leftover');
assert.ok(COMPUTE_LLMS_TXT.includes(COMPUTE_SKILL_URL), 'packet keeps face');
assert.ok(COMPUTE_LLMS_TXT.includes(COMPUTE_SKILL_CURSOR_URL), 'packet links Cursor alias once');
assert.match(COMPUTE_SKILL_MD, /^---\nname: dasha-compute\n/m, 'face bytes unchanged');
assert.doesNotMatch(COMPUTE_LLMS_TXT, /plugin\.jup\.ag/);

assert.equal(potterHome308Dest('/compute/skills/dasha-compute/SKILL.md'), null);
assert.equal(potterHome308Dest('/compute/skills/dasha-compute'), null);
assert.equal(potterHome308Dest('/compute/skills'), 'https://www.getdasha.com/compute');

{
  const direct = computeAgentAeoResponse(
    new Request('https://www.getdasha.com/compute/skills/dasha-compute/SKILL.md'),
  );
  assert.equal(direct.status, 200);
  assert.equal(direct.headers.get('x-dasha-edge'), 'compute-skill-face');
  assert.equal(await direct.text(), COMPUTE_SKILL_MD);
}

for (const origin of ORIGINS) {
  const face = await edgeWorker.fetch(new Request(`${origin}/compute/skill.md`), {});
  assert.equal(face.status, 200, `${origin}/compute/skill.md`);
  const faceBody = await face.text();
  assert.equal(faceBody, COMPUTE_SKILL_MD);

  for (const path of ALIAS_PATHS) {
    const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
    assert.equal(res.status, 200, `${origin}${path}`);
    assert.equal(res.headers.get('x-dasha-edge'), 'compute-skill-face');
    assert.match(res.headers.get('content-type') || '', /text\/markdown/);
    assert.equal(await res.text(), faceBody, `${origin}${path} same bytes as face`);

    const head = await edgeWorker.fetch(new Request(`${origin}${path}`, { method: 'HEAD' }), {});
    assert.equal(head.status, 200, `${origin}${path} HEAD`);
    assert.equal(await head.text(), '');
  }

  const packet = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`), {});
  assert.ok((await packet.text()).includes(COMPUTE_SKILL_CURSOR_URL), `${origin}/compute/llms.txt links alias`);
}

console.log('dasha-compute-skill-cursor-alias: PASS (/compute/skills/dasha-compute/SKILL.md same bytes as /compute/skill.md, packet link, /compute/skills leftover, no plugin.jup.ag)');
