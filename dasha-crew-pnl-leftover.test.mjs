#!/usr/bin/env node
/**
 * Leftover after crew equity-curve DRY.
 * Live /crew 200 still serializes leftover lecture in view-source meta description:
 *   "No fake P&L"
 * Five jobs + keys + Scout/Trace/Vibe/Clock/Kill + tape stay. OG stays short.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { CREW_PAGE_HTML } from './dasha-crew-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const html = readFileSync(join(root, 'dasha-crew.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.equal(html, CREW_PAGE_HTML, 'embed matches dasha-crew.html');

function afterStyleScript(src) {
  return String(src)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

for (const [label, body] of [
  ['disk', html],
  ['embed', CREW_PAGE_HTML],
]) {
  const visible = afterStyleScript(body);
  assert.doesNotMatch(visible, /No fake P&(?:amp;)?L/, `${label} drops leftover P&L lecture after style/script strip`);
  assert.doesNotMatch(visible, /fake P/i, `${label} drops leftover fake-P lecture`);
  assert.match(visible, /Five jobs\. You keep the keys\./, `${label} five jobs stay`);
  assert.match(visible, /Scout/, `${label} Scout stays`);
  assert.match(visible, /Trace/, `${label} Trace stays`);
  assert.match(visible, /Vibe/, `${label} Vibe stays`);
  assert.match(visible, /Clock/, `${label} Clock stays`);
  assert.match(visible, /Kill/, `${label} Kill stays`);
  assert.match(visible, /Live tape/, `${label} tape stays`);
  assert.match(visible, /property="og:description" content="Five jobs\. You keep the keys\."/, `${label} OG stays`);
  assert.match(visible, new RegExp(MINT), `${label} mint stays`);
  assert.match(visible, /jup\.ag\/swap/, `${label} jup.ag stays`);
  assert.doesNotMatch(visible, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/crew'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'crew');
const body = await res.text();
assert.doesNotMatch(afterStyleScript(body), /No fake P&(?:amp;)?L/, 'worker /crew drops leftover P&L lecture');
assert.doesNotMatch(body, /fake P/i, 'worker /crew drops leftover fake-P lecture');
assert.match(body, /Five jobs\. You keep the keys\./);
assert.match(body, /<h1>Dasha Crew<\/h1>/);
assert.match(body, />Buy</);
assert.match(body, /jup\.ag\/swap/);
assert.match(body, new RegExp(MINT));
assert.doesNotMatch(body, /plugin\.jup\.ag/);
assert.match(body, /id=["']chat-door["']|href="\/lobby"|\$dasha/, 'crew still has $dasha / lobby');

console.log('dasha-crew-pnl-leftover: PASS (No fake P&L lecture gone; five jobs + OG stay; no plugin.jup.ag)');
