#!/usr/bin/env node
/** /compute share card: Ask a Mac + OpenAI-compatible API. Title stays Dasha Compute. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const TITLE = 'Dasha Compute';
const DESC = 'Ask a Mac. OpenAI-compatible. https://lobby.getdasha.com/compute/api/v1';
const OLD_DESC = 'Start. Ask. Provide. Pay. Credits.';

assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs');
assert.doesNotMatch(html, /plugin\.jup\.ag/);

function assertShare(page, label) {
  const head = (page.match(/<head[\s\S]*?<\/head>/i) || [page])[0];
  assert.match(head, /property="og:title" content="Dasha Compute"/, `${label} og:title`);
  assert.match(head, /name="twitter:title" content="Dasha Compute"/, `${label} twitter:title`);
  const ogDesc = head.match(/property="og:description" content="([^"]*)"/);
  const twDesc = head.match(/name="twitter:description" content="([^"]*)"/);
  assert.equal(ogDesc?.[1], DESC, `${label} og:desc`);
  assert.equal(twDesc?.[1], DESC, `${label} twitter:desc`);
  assert.notEqual(ogDesc?.[1], OLD_DESC, `${label} og not leftover slogan`);
  assert.notEqual(twDesc?.[1], OLD_DESC, `${label} twitter not leftover slogan`);
  assert.equal((head.match(/property="og:title"/g) || []).length, 1, `${label} one og:title`);
  assert.equal((head.match(/property="og:description"/g) || []).length, 1, `${label} one og:desc`);
  assert.equal((head.match(/name="twitter:title"/g) || []).length, 1, `${label} one twitter:title`);
  assert.equal((head.match(/name="twitter:description"/g) || []).length, 1, `${label} one twitter:desc`);
  assert.equal(TITLE, 'Dasha Compute');
  for (const [tag, text] of [['og', ogDesc[1]], ['twitter', twDesc[1]]]) {
    assert.doesNotMatch(text, /free model|free tier|3 free/i, `${label} ${tag} no free model`);
    assert.doesNotMatch(text, /\d+\s*Mac/i, `${label} ${tag} no Mac count`);
    assert.doesNotMatch(text, /\$0\.05/, `${label} ${tag} no $0.05/job`);
  }
  assert.doesNotMatch(head, /plugin\.jup\.ag/, `${label} no plugin.jup`);
  const ask = page.match(/<section[^>]*id=["']step-ask["'][\s\S]*?<\/section>/i);
  assert.ok(ask, `${label} Ask step`);
  assert.doesNotMatch(ask[0], /\$0\.05\/job/, `${label} Ask has no $0.05/job`);
}

assertShare(html, 'disk');
assertShare(COMPUTE_PAGE_HTML, 'embed');

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
const served = await res.text();
assertShare(served, 'served /compute');
assert.match(served, /name="description" content="Start\. Ask\. Provide\. Pay\. Credits\."/, 'page meta stays doors line');

console.log('dasha-compute-og: PASS (Dasha Compute / Ask a Mac. OpenAI-compatible. API v1)');
