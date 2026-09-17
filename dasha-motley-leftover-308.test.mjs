#!/usr/bin/env node
/**
 * Motley leftover 308s at live tip 2c9aa2bf (2026-09-17).
 * /skill.json → skill face; /openapi.yaml → OpenAPI JSON;
 * /compute/api/humans → /humans.txt (which already → /contribute).
 * Muse #225 faces stay dest-null (/providers 200). Leftover cases unchanged.
 */
import assert from 'node:assert/strict';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const WWW = 'https://www.getdasha.com';
const CASES = [
  ['/skill.json', `${WWW}/compute/skill.md`],
  ['/skill.json/', `${WWW}/compute/skill.md`],
  ['/Skill.JSON', `${WWW}/compute/skill.md`],
  ['/openapi.yaml', `${WWW}/compute/openapi.json`],
  ['/openapi.yaml/', `${WWW}/compute/openapi.json`],
  ['/OpenAPI.YAML', `${WWW}/compute/openapi.json`],
  ['/compute/api/humans', `${WWW}/humans.txt`],
  ['/compute/api/humans/', `${WWW}/humans.txt`],
  ['/Compute/Api/Humans', `${WWW}/humans.txt`],
];

for (const [path, dest] of CASES) assert.equal(potterHome308Dest(path), dest, `dest ${path}`);
assert.equal(potterHome308Dest('/muse'), `${WWW}/`);
assert.equal(potterHome308Dest('/providers'), null, '/providers is Muse face 200');

const env = { LOBBY_SESSION_SECRET: 'motley-leftover-308-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com']) {
  for (const [path, dest] of CASES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} location`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
}

console.log('dasha-motley-leftover-308: PASS');
