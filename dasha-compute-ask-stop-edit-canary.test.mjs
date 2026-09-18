#!/usr/bin/env node
/**
 * T039 / T040 — Ask quiet-shell Stop-aborts + Edit-truncates canaries.
 *
 * Prefer worker source on main, not live HTML. Live /compute is still
 * Typeform until Instinct wrangler of dasha-lobby tip (#246/#249/#255).
 * Set LIVE_ASK_CANARY=1 to fail honestly on that Typeform gap.
 *
 * Disk == embed == worker.fetch. No wrangler. No Designer. No Quill
 * dasha-compute.html edit (#260 owns HTML). Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function extractFn(html, name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name}(`);
  let i = html.indexOf('{', start);
  assert.ok(i > start, `${name} body`);
  let depth = 0;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  assert.fail(`${name} unclosed`);
}

function hasAskQuietShell(html) {
  return (
    /id=["']ask-composer["']/.test(html) &&
    /id=["']ask-model["']/.test(html) &&
    /id=["']ask-thread["']/.test(html) &&
    /function stopAskRun\(/.test(html) &&
    /function editLastUserAsk\(/.test(html)
  );
}

function assertAskQuietShellGate(html, label) {
  assert.ok(hasAskQuietShell(html), `${label} Ask quiet-shell present in source (tip #246/#249/#255)`);
  assert.match(html, /id=["']step-ask["']/, `${label} #step-ask`);
  assert.match(html, /id=["']ask-input["']/, `${label} #ask-input`);
  assert.match(html, /id=["']ask-send["']/, `${label} #ask-send`);
  assert.match(html, /id=["']run-demo["']/, `${label} #run-demo`);
  assert.match(html, /id=["']prompt["']/, `${label} #prompt`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

function assertStopAborts(html, label) {
  const stop = extractFn(html, 'stopAskRun');
  assert.match(stop, /if\(!askBusy&&!runAbort\)return/, `${label} T039 idle Stop is a no-op`);
  assert.match(stop, /jobCancelled=true/, `${label} T039 marks the job cancelled`);
  assert.match(stop, /runAbort\?\.abort\(\)/, `${label} T039 AbortController.abort`);
  assert.match(
    stop,
    /api\(['"]\/compute\/api\/jobs\/['"]\+activeJob,\{method:['"]DELETE['"]\}\)/,
    `${label} T039 DELETE active job`,
  );
  assert.doesNotMatch(stop, /askBusy=false/, `${label} T039 Stop does not locally clear busy (stream teardown does)`);

  assert.match(html, /if\(askBusy\)\{stopAskRun\(\);return\}/, `${label} T039 primary click is Stop`);
  assert.match(html, /if\(askBusy\)\$\(['"]run-demo['"]\)\.textContent=['"]Stop['"]/, `${label} T039 Stop label`);
  assert.match(html, /runAbort=new AbortController\(\)/, `${label} T039 new AbortController per run`);
  assert.match(html, /signal:runAbort\.signal/, `${label} T039 fetch uses abort signal`);
  assert.match(html, /commitAskLive\(['"]stopped['"]/, `${label} T039 keep partial as stopped`);
  assert.match(html, /setAskRunChip\(['"]stopped['"]\)/, `${label} T039 chip stopped`);

  const commit = extractFn(html, 'commitAskLive');
  assert.match(commit, /state==='stopped'\?'Stopped\.'/, `${label} T039 stopped fallback copy`);
  assert.match(commit, /kept\.push\(\{role:'assistant',content:content\|\|fallback,state:state\|\|'complete'\}\)/, `${label} T039 commit keeps assistant text`);
}

function assertEditTruncates(html, label) {
  const edit = extractFn(html, 'editLastUserAsk');
  assert.match(edit, /if\(askBusy\)return/, `${label} T040 Edit waits while streaming`);
  assert.match(edit, /lastAskIndex\(conversation,'user'\)/, `${label} T040 finds last user turn`);
  assert.match(edit, /askEditAt=u/, `${label} T040 pins truncate index`);
  assert.match(edit, /\$\(['"]prompt['"]\)\.value=conversation\[u\]\.content/, `${label} T040 refills composer`);
  assert.doesNotMatch(edit, /conversation\s*=/, `${label} T040 Edit itself does not splice yet`);

  assert.match(
    html,
    /if\(askEditAt>=0\)\{\s*conversation=conversation\.slice\(0,askEditAt\);\s*askEditAt=-1;\s*\}/,
    `${label} T040 Send truncates after last edited user`,
  );
  assert.match(html, /askAct\(['"]Edit['"],['"]edit['"]\)/, `${label} T040 Edit control`);
  assert.match(html, /function regenerateLastAsk\(/, `${label} T040 sibling Regen stays`);
}

assertAskQuietShellGate(disk, 'disk');
assertAskQuietShellGate(COMPUTE_PAGE_HTML, 'embed');
assertStopAborts(disk, 'disk');
assertStopAborts(COMPUTE_PAGE_HTML, 'embed');
assertEditTruncates(disk, 'disk');
assertEditTruncates(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
const servedHtml = await served.text();
assertAskQuietShellGate(servedHtml, 'worker.fetch');
assertStopAborts(servedHtml, 'worker.fetch');
assertEditTruncates(servedHtml, 'worker.fetch');

const liveCanary = process.env.LIVE_ASK_CANARY === '1';
if (liveCanary) {
  const live = await fetch('https://lobby.getdasha.com/compute', {
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'dasha-compute-ask-stop-edit-canary.test', Accept: 'text/html' },
  });
  assert.equal(live.status, 200, 'LIVE_ASK_CANARY live /compute 200');
  const liveHtml = await live.text();
  if (!hasAskQuietShell(liveHtml)) {
    assert.fail(
      'LIVE_ASK_CANARY: live /compute is still Typeform (no #ask-composer / stopAskRun / editLastUserAsk). Instinct wrangler of Uuriko/dasha-lobby tip still outstanding — source canaries on COMPUTE_PAGE_HTML already hold.',
    );
  }
  assertAskQuietShellGate(liveHtml, 'live');
  assertStopAborts(liveHtml, 'live');
  assertEditTruncates(liveHtml, 'live');
  console.log('dasha-compute-ask-stop-edit-canary: PASS (T039 Stop aborts + T040 Edit truncates; live Ask shell too)');
} else {
  console.log('dasha-compute-ask-stop-edit-canary: PASS (T039 Stop aborts + T040 Edit truncates; source only — live Typeform until tip)');
}
