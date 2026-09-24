#!/usr/bin/env node
/**
 * T027–T030 — Ask quiet-shell chrome canaries against tip source.
 * T027 empty state ≤4 starters (strengthen / cross-assert #268 T047).
 * T028 hover-only Copy / Regen / Edit (CSS/class markers, not always-visible).
 * T029 Thinking… + Stop stream chrome.
 * T030 model whisper pill in composer (#ask-model quiet).
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

function sliceId(html, id, untilId) {
  const start = html.search(new RegExp(`id=["']${id}["']`));
  assert.ok(start >= 0, `#${id}`);
  if (!untilId) return html.slice(start);
  const end = html.search(new RegExp(`id=["']${untilId}["']`));
  assert.ok(end > start, `#${id} before #${untilId}`);
  return html.slice(start, end);
}

function hasAskQuietShell(html) {
  return (
    /id=["']ask-composer["']/.test(html) &&
    /id=["']ask-model["']/.test(html) &&
    /id=["']ask-thread["']/.test(html) &&
    /id=["']ask-starters["']/.test(html) &&
    /id=["']ask-scroll["']/.test(html)
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

function assertEmptyStateFourStarters(html, label) {
  const canvas = sliceId(html, 'ask-scroll', 'ask-composer');
  const starters = (canvas.match(/<div class=["']ask-starters["'] id=["']ask-starters["'][\s\S]*?<\/div>/) || [''])[0];
  const chips = [...starters.matchAll(/id=["']ask-starter(?:-\d+)?["'][^>]*>([^<]+)</g)].map((m) => m[1]);
  const prompts = [...starters.matchAll(/\bdata-prompt=/g)];

  assert.match(canvas, /id=["']ask-greet["'][^>]*>What\.</, `${label} T027 one empty line`);
  assert.match(canvas, /id=["']ask-starters["']/, `${label} T027 starters on empty canvas`);
  assert.equal(chips.length, 4, `${label} T027 exactly 4 starter labels`);
  assert.equal(prompts.length, 4, `${label} T027 exactly 4 data-prompt chips`);
  assert.deepEqual(chips, ['Write code', 'Fix a bug', 'Do the thing', 'Explain this'], `${label} T027 starter labels`);
  assert.match(starters, /id=["']ask-starter["'][^>]*>Write code</, `${label} T027 chip 1`);
  assert.match(starters, /id=["']ask-starter-2["'][^>]*>Fix a bug</, `${label} T027 chip 2`);
  assert.match(starters, /id=["']ask-starter-3["'][^>]*>Do the thing</, `${label} T027 chip 3`);
  assert.match(starters, /id=["']ask-starter-4["'][^>]*>Explain this</, `${label} T027 chip 4`);
  assert.doesNotMatch(html, /id=["']ask-starter-5["']/, `${label} T027 no 5th chip id`);
  assert.doesNotMatch(html, /id=["']ask-starter-6["']/, `${label} T027 no 6th chip id`);
  assert.doesNotMatch(starters, /class=["']tf-choice["']/, `${label} T027 starters are not scream choices`);
  assert.match(starters, /class=["']tf-quiet["'] id=["']ask-starter["']/, `${label} T027 chips are tf-quiet`);
  assert.doesNotMatch(html, /Welcome note/, `${label} T027 no Welcome note leftover`);
  assert.doesNotMatch(html, /Summarize this/, `${label} T027 no Summarize leftover`);
  assert.doesNotMatch(html, /Review a PR/, `${label} T027 no Review a PR leftover`);
  assert.doesNotMatch(html, /say something strange/, `${label} T027 no strange leftover`);
  assert.match(
    html,
    /body\.has-chat #ask-starters,body\.has-chat #ask-free-fine,body\.has-chat #ask-range,body\.has-chat #buyer-live-line,body\.has-chat #ask-nav\{display:none!important\}/,
    `${label} T027 starters leave once a thread exists`,
  );

  const paint = extractFn(html, 'paintAskThread');
  assert.match(paint, /const thread=\$\(['"]ask-thread['"]\),starters=\$\(['"]ask-starters['"]\)/, `${label} T027 paintAskThread owns starters`);
  assert.match(paint, /if\(starters\)\{\s*starters\.hidden=open/, `${label} T027 paint hides starters when the thread is open`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T027 no plugin`);
}

function assertHoverOnlyTurnActs(html, label) {
  assert.match(
    html,
    /\.ask-acts\{[^}]*opacity:0;pointer-events:none;position:absolute/,
    `${label} T028 actions overlay hidden until hover`,
  );
  assert.match(
    html,
    /\.ask-turn:hover \.ask-acts,\.ask-turn:focus-within \.ask-acts,\.ask-acts:focus-within\{opacity:1;pointer-events:auto\}/,
    `${label} T028 hover/focus reveal`,
  );
  assert.match(html, /\.ask-act\{[^}]*border:0;background:transparent/, `${label} T028 acts are quiet text, not scream buttons`);
  assert.match(html, /\.ask-act\{[^}]*font:600 12px/, `${label} T028 acts are 12px whisper`);
  assert.doesNotMatch(html, /\.ask-acts\{[^}]*min-height/, `${label} T028 no reserved always-visible rail`);
  assert.doesNotMatch(html, /\.ask-acts\{[^}]*opacity:1/, `${label} T028 rest opacity is not 1`);
  assert.doesNotMatch(html, /\.ask-act\{[^}]*(min-height:60px|font-size:20px|text-transform:uppercase)/, `${label} T028 no scream act CSS`);

  const paint = extractFn(html, 'paintAskTurn');
  assert.match(paint, /acts\.className=['"]ask-acts['"]/, `${label} T028 paintAskTurn builds .ask-acts`);
  assert.match(paint, /askAct\(['"]Copy['"],['"]copy['"]\)/, `${label} T028 Copy`);
  assert.match(paint, /askAct\(['"]Regenerate['"],['"]regen['"]\)/, `${label} T028 Regen`);
  assert.match(paint, /askAct\(['"]Edit['"],['"]edit['"]\)/, `${label} T028 Edit`);
  assert.match(html, /function copyAskText\(/, `${label} T028 copyAskText`);
  assert.match(html, /function regenerateLastAsk\(/, `${label} T028 regenerateLastAsk`);
  assert.match(html, /function editLastUserAsk\(/, `${label} T028 editLastUserAsk`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T028 no plugin`);
}

function assertThinkingStopChrome(html, label) {
  assert.match(
    html,
    /\.ask-turn\[data-state=thinking\] \.ask-who::after,\.ask-turn\[data-state=streaming\] \.ask-who::after\{content:' Thinking…'/,
    `${label} T029 one-word Thinking… on thinking + streaming`,
  );
  assert.match(html, /function beginAskLive\(/, `${label} T029 beginAskLive`);
  assert.match(html, /askLive=\{user:String\(userContent\|\|''\),assistant:'',state:'thinking'\}/, `${label} T029 send starts thinking`);
  assert.match(html, /function stopAskRun\(/, `${label} T029 stopAskRun`);
  assert.match(html, /if\(askBusy\)\{\s*stopAskRun\(\);return\}/, `${label} T029 primary click is Stop`);
  assert.match(html, /if\(askBusy\)\$\(['"]run-demo['"]\)\.textContent=['"]Stop['"]/, `${label} T029 Stop label`);
  assert.doesNotMatch(html, /content:' · streaming'/, `${label} T029 no streaming essay`);
  assert.doesNotMatch(html, /content:' · thinking'/, `${label} T029 no · thinking rail`);
  assert.doesNotMatch(
    html,
    /\.ask-turn\[data-state=(?:thinking|streaming)\][^{]*\{[^}]*tok\/s/,
    `${label} T029 no tok/s in stream chrome`,
  );
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T029 no plugin`);
}

function assertModelWhisperPill(html, label) {
  const canvas = sliceId(html, 'ask-scroll', 'ask-composer');
  const composer = sliceId(html, 'ask-composer', 'step-market');
  const links = (composer.match(/<div class=["']ask-links["']>[\s\S]*?<\/div>/) || [''])[0];

  assert.doesNotMatch(canvas, /id=["']ask-model["']/, `${label} T030 model pill is not on the empty canvas`);
  assert.match(links, /id=["']ask-model["']/, `${label} T030 #ask-model lives in composer ask-links`);
  assert.match(
    links,
    /<select id=["']ask-model["'] class=["']ask-model-pill["'] aria-label=["']Model["'] hidden>/,
    `${label} T030 whisper pill starts hidden`,
  );
  assert.match(html, /#change-engine,#ask-model\{[^}]*font-size:12px/, `${label} T030 12px whisper`);
  assert.match(html, /#change-engine,#ask-model\{[^}]*border:0/, `${label} T030 no badge border`);
  assert.match(html, /#change-engine,#ask-model\{[^}]*background:transparent/, `${label} T030 transparent chip`);
  assert.match(html, /#ask-model\[hidden\]\{display:none!important\}/, `${label} T030 hidden stays gone`);
  assert.doesNotMatch(html, /#ask-model\{[^}]*(min-height:60px|font-size:20px|text-transform:uppercase)/, `${label} T030 no scream pill CSS`);

  const paint = extractFn(html, 'paintAskModel');
  assert.match(paint, /const pill=\$\(['"]ask-model['"]\)/, `${label} T030 paintAskModel targets the pill`);
  assert.match(paint, /if\(!mac\)\{pill\.hidden=true/, `${label} T030 Hosted keeps the whisper hidden`);
  assert.match(paint, /const pool=askModelPool\(\)/, `${label} T030 Community fills live pool`);
  assert.doesNotMatch(paint, /step-model|Which model/, `${label} T030 paint does not open Which model?`);
  assert.match(html, /id=["']step-model["'][^>]*\bhidden\b/, `${label} T030 leftover Which model? stays hidden`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T030 no plugin`);
}

assertAskQuietShellGate(disk, 'disk');
assertAskQuietShellGate(COMPUTE_PAGE_HTML, 'embed');
assertEmptyStateFourStarters(disk, 'disk');
assertEmptyStateFourStarters(COMPUTE_PAGE_HTML, 'embed');
assertHoverOnlyTurnActs(disk, 'disk');
assertHoverOnlyTurnActs(COMPUTE_PAGE_HTML, 'embed');
assertThinkingStopChrome(disk, 'disk');
assertThinkingStopChrome(COMPUTE_PAGE_HTML, 'embed');
assertModelWhisperPill(disk, 'disk');
assertModelWhisperPill(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
const servedHtml = await served.text();
assertAskQuietShellGate(servedHtml, 'worker.fetch');
assertEmptyStateFourStarters(servedHtml, 'worker.fetch');
assertHoverOnlyTurnActs(servedHtml, 'worker.fetch');
assertThinkingStopChrome(servedHtml, 'worker.fetch');
assertModelWhisperPill(servedHtml, 'worker.fetch');

const liveCanary = process.env.LIVE_ASK_CANARY === '1';
if (liveCanary) {
  const live = await fetch('https://lobby.getdasha.com/compute', {
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'dasha-compute-ask-quiet-chrome-canary.test', Accept: 'text/html' },
  });
  assert.equal(live.status, 200, 'LIVE_ASK_CANARY live /compute 200');
  const liveHtml = await live.text();
  if (!hasAskQuietShell(liveHtml)) {
    assert.fail(
      'LIVE_ASK_CANARY: live /compute is still Typeform (no #ask-composer / #ask-model / #ask-starters). Instinct wrangler of Uuriko/dasha-lobby tip still outstanding — source canaries on COMPUTE_PAGE_HTML already hold.',
    );
  }
  assertAskQuietShellGate(liveHtml, 'live');
  assertEmptyStateFourStarters(liveHtml, 'live');
  assertHoverOnlyTurnActs(liveHtml, 'live');
  assertThinkingStopChrome(liveHtml, 'live');
  assertModelWhisperPill(liveHtml, 'live');
  console.log('dasha-compute-ask-quiet-chrome-canary: PASS (T027–T030; live Ask shell too)');
} else {
  console.log('dasha-compute-ask-quiet-chrome-canary: PASS (T027 ≤4 starters + T028 hover acts + T029 Thinking/Stop + T030 #ask-model whisper; source only — live Typeform until tip)');
}
