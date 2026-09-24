#!/usr/bin/env node
/**
 * Honest /humans.txt face: GET/HEAD 200 text/plain on www + lobby.
 * Body prefix is humans.txt TEAM, not Contribute HTML.
 * Slash + Title-case 308 → /humans.txt. Nested /compute/api/humans same dest.
 * /compute/humans + /compute/humans.txt leftover lives in
 * POTTER_COMPUTE_HUMANS_308_PATHS. Exact /humans.txt dest is null.
 * Do not invent apex /humans.
 * Disk only. No Designer. Never plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /const HUMANS_TXT = /, 'humans.txt face constant');
assert.match(workerSrc, /Exact \/humans\.txt is a 200 text\/plain/, 'humans face comment');
assert.match(workerSrc, /POTTER_HUMANS_TXT_308_PATHS/, 'slash leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_API_HUMANS_308_PATHS/, 'nested leftover set');
assert.match(workerSrc, /POTTER_COMPUTE_HUMANS_308_PATHS/, 'compute humans leftover set');
const humansConst = workerSrc.match(/const HUMANS_TXT = `[\s\S]*?`;/)[0];
assert.doesNotMatch(humansConst, /trydemigod|demigod/i, 'humans.txt face stays off Demigod');

const WWW = 'https://www.getdasha.com';
const HUMANS = `${WWW}/humans.txt`;
const CONTRIBUTE = `${WWW}/contribute`;

assert.equal(potterHome308Dest('/humans.txt'), null, 'exact /humans.txt stays 200');
assert.equal(potterHome308Dest('/humans.txt/'), HUMANS);
assert.equal(potterHome308Dest('/Humans.txt'), HUMANS);
assert.equal(potterHome308Dest('/HUMANS.TXT'), HUMANS);
assert.equal(potterHome308Dest('/Humans.txt/'), HUMANS);
assert.equal(potterHome308Dest('/compute/api/humans'), HUMANS);
assert.equal(potterHome308Dest('/compute/api/humans/'), HUMANS);
assert.equal(potterHome308Dest('/Compute/Api/Humans'), HUMANS);
assert.equal(potterHome308Dest('/humans'), null, 'do not invent apex /humans');
assert.notEqual(potterHome308Dest('/humans.txt/'), CONTRIBUTE);

const FOLDS = [
  '/humans.txt/',
  '/Humans.txt',
  '/HUMANS.TXT',
  '/Humans.txt/',
  '/compute/api/humans',
  '/compute/api/humans/',
  '/Compute/Api/Humans',
];

const env = { LOBBY_SESSION_SECRET: 'humans-txt-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const method of ['GET', 'HEAD']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}/humans.txt`, { method }), env);
    assert.equal(res.status, 200, `${host} /humans.txt ${method}`);
    assert.match(res.headers.get('content-type') || '', /^text\/plain; charset=utf-8$/i, `${host} /humans.txt ${method} content-type`);
    assert.equal(res.headers.get('x-dasha-edge'), 'humans', `${host} /humans.txt ${method} edge`);
    assert.doesNotMatch(res.headers.get('content-type') || '', /text\/html/i);
    if (method === 'HEAD') {
      assert.equal(await res.text(), '');
    } else {
      const body = await res.text();
      assert.equal(body.slice(0, 10), '/* TEAM */', `${host} /humans.txt body prefix`);
      assert.match(body, /Contribute: https:\/\/www\.getdasha\.com\/contribute/);
      assert.match(body, /Crew: https:\/\/www\.getdasha\.com\/crew/);
      assert.doesNotMatch(body, /Contribute to Dasha/);
      assert.doesNotMatch(body, /<html/i);
      assert.doesNotMatch(body, /<title>/i);
      assert.doesNotMatch(body, /canonical/i);
      assert.doesNotMatch(body, /@gmail\.|@getdasha\.|mailto:/i, 'no people-data');
    }
  }
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), HUMANS, `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), CONTRIBUTE, `${host} ${path} ${method} not /contribute`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
}

console.log('dasha-humans-txt-pretty-path: PASS (GET/HEAD /humans.txt 200 text/plain; prefix /* TEAM */; www+lobby; slash+Title-case+/compute/api/humans 308 /humans.txt; not contribute HTML; no people-data; no plugin.jup.ag)');
