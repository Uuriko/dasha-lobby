#!/usr/bin/env node
/** /faucet share card: Fill the jar. Claim / fill / Buy. Empty tape stays honest. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { FAUCET_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const pageSrc = readFileSync(join(root, 'dasha-faucet-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const TITLE = 'Fill the jar';
const DESC = 'Claim. Fill. Buy.';

function assertShare(html, label) {
  assert.match(html, /<title>Fill the jar<\/title>/, `${label} title`);
  assert.match(html, /property="og:title" content="Fill the jar"/, `${label} og:title`);
  assert.match(html, /property="og:description" content="Claim\. Fill\. Buy\."/, `${label} og:desc`);
  assert.match(html, /property="og:url" content="https:\/\/www\.getdasha\.com\/faucet"/, `${label} og:url`);
  assert.match(html, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/, `${label} og:image`);
  assert.match(html, /name="twitter:card" content="summary_large_image"/, `${label} twitter:card`);
  assert.match(html, /name="twitter:title" content="Fill the jar"/, `${label} twitter:title`);
  assert.match(html, /name="twitter:description" content="Claim\. Fill\. Buy\."/, `${label} twitter:desc`);
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  assert.doesNotMatch(head, /Studio|\/studio/i, `${label} no Studio on card`);
  assert.doesNotMatch(head, /airdrop|not an airdrop|not earn|not advice|disclaimer/i, `${label} no lecture`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup`);
  assert.doesNotMatch(html, /airdrop/i, `${label} no airdrop`);
  assert.match(html, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, /id=["']dasha-faucet["']/, `${label} jar`);
  assert.match(html, />Buy</, `${label} Buy`);
}

assert.equal(TITLE, 'Fill the jar');
assert.equal(DESC, 'Claim. Fill. Buy.');
assertShare(pageSrc, 'disk source');
assertShare(FAUCET_PAGE_HTML, 'bundled');

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet'), {});
  assert.equal(res.status, 200, '/faucet 200');
  assert.equal(res.headers.get('x-dasha-edge'), 'faucet');
  assertShare(await res.text(), 'served /faucet');
}

{
  const slash = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/'), {});
  assert.equal(slash.status, 200);
}

{
  const tape = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/tape'), {});
  assert.equal(tape.status, 200);
  const body = await tape.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.fills));
  assert.equal(body.fills.length, 0, 'empty tape stays honest');
}

const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
assert.equal(studio.status, 308);

console.log('dasha-faucet-share: PASS (Fill the jar OG, Claim. Fill. Buy., empty tape honest, no airdrop)');
