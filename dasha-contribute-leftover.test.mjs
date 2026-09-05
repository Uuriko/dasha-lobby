#!/usr/bin/env node
/** /contribute leftover lecture + Simp Board footer. Honest: Build Dasha. Open a PR. first-issue / guide / ideas. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

assert.doesNotMatch(worker, /plugin\.jup\.ag/);
assert.doesNotMatch(worker, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);

const m = worker.match(/const CONTRIBUTE_HTML = htmlPage\([\s\S]*?\);\n/);
assert.ok(m, 'CONTRIBUTE_HTML');
const html = m[0];
assert.match(html, /<h1>Build Dasha\.<\/h1>/);
assert.match(html, /Open a pull request\./);
assert.match(html, /github\.com\/Uuriko\/dasha-desk\/contribute/);
assert.match(html, /CONTRIBUTING\.md/);
assert.match(html, /discussions\/categories\/ideas/);
assert.match(html, /href="https:\/\/www\.getdasha\.com\/lobby"/);
assert.doesNotMatch(html, /nothing to join/i);
assert.doesNotMatch(html, /Simp Points/);
assert.doesNotMatch(html, /PR points are not live/);
assert.doesNotMatch(html, /Simp Board/);
assert.doesNotMatch(html, /href="https:\/\/www\.getdasha\.com\/simp"/);
assert.doesNotMatch(html, /plugin\.jup\.ag/);
assert.doesNotMatch(html, /wallet, holder status/);
assert.match(html, /description: 'Build Dasha\. Open a pull request\.'/);
assert.doesNotMatch(html, /beginner-friendly/);

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/contribute', '/contribute/']) {
    for (const method of ['GET', 'HEAD']) {
      const r = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), {});
      assert.equal(r.status, 200, `${host} ${path} ${method}`);
      assert.equal(r.headers.get('x-dasha-edge'), 'contribute', `${host} ${path} ${method} edge`);
      if (method === 'HEAD') assert.equal(await r.text(), '');
    }
  }
}

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/contribute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'contribute');
const body = await res.text();
assert.match(body, /<h1>Build Dasha\.<\/h1>/);
assert.match(body, /Open a pull request\./);
assert.match(body, /Pick a first issue/);
assert.match(body, /Read the guide/);
assert.match(body, /Propose an idea/);
assert.doesNotMatch(body, /nothing to join/i);
assert.doesNotMatch(body, /Simp Points/);
assert.doesNotMatch(body, /PR points are not live/);
assert.doesNotMatch(body, /Simp Board/);
assert.doesNotMatch(body, /plugin\.jup\.ag/);
assert.match(body, /og:description" content="Build Dasha\. Open a pull request\."/);
assert.match(body, /twitter:description" content="Build Dasha\. Open a pull request\."/);
assert.match(body, /name="description" content="Build Dasha\. Open a pull request\."/);
assert.doesNotMatch(body, /beginner-friendly/);

const full = worker.match(/const LLMS_FULL_TXT = `([\s\S]*?)`;/)[1];
assert.match(full, /Contribute: Build Dasha\. Open a pull request\./);
assert.doesNotMatch(full, /no application, wallet or points gate/);
assert.doesNotMatch(full, /points gate/);

const llmsRes = await edgeWorker.fetch(new Request('https://www.getdasha.com/llms-full.txt'), {});
assert.equal(llmsRes.status, 200);
const llmsBody = await llmsRes.text();
assert.match(llmsBody, /Contribute: Build Dasha\. Open a pull request\./);
assert.doesNotMatch(llmsBody, /no application, wallet or points gate/);

console.log('dasha-contribute-leftover: PASS (Build Dasha. Open a PR. no Simp footer. llms-full matches)');
