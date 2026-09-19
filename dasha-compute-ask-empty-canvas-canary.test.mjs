#!/usr/bin/env node
/**
 * T047 — Ask empty canvas: starters only; Provide / Host / OCM console
 * stay off the empty thread. Soft T048 (Sign-in top dropdown) + T049
 * (guest soft-model honesty) when cheap in the same PR.
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

function assertEmptyCanvasDoorsOff(html, label) {
  const canvas = sliceId(html, 'ask-scroll', 'ask-composer');
  const thread = sliceId(html, 'ask-thread', 'ask-mac-line');
  const nav = sliceId(html, 'ask-nav', 'ask-more');

  assert.match(canvas, /id=["']ask-greet["'][^>]*>What\.</, `${label} T047 one empty line`);
  assert.match(canvas, /id=["']ask-starters["']/, `${label} T047 starters on empty canvas`);
  assert.match(canvas, /id=["']ask-starter["'][^>]*>Write code</, `${label} T047 chip 1`);
  assert.match(canvas, /id=["']ask-starter-2["'][^>]*>Fix a bug</, `${label} T047 chip 2`);
  assert.match(canvas, /id=["']ask-starter-3["'][^>]*>Do the thing</, `${label} T047 chip 3`);
  assert.match(canvas, /id=["']ask-starter-4["'][^>]*>Explain this</, `${label} T047 chip 4`);
  assert.doesNotMatch(canvas, /id=["']ask-starter-5["']/, `${label} T047 no 5th chip`);
  assert.match(canvas, /id=["']ask-thread["'][^>]*\bhidden\b/, `${label} T047 empty thread starts hidden`);

  assert.doesNotMatch(canvas, /id=["']ask-provide["']/, `${label} T047 Provide off empty canvas`);
  assert.doesNotMatch(canvas, /id=["']ask-host["']/, `${label} T047 Host off empty canvas`);
  assert.doesNotMatch(canvas, /id=["']ask-ocm["']/, `${label} T047 OCM console off empty canvas`);
  assert.doesNotMatch(canvas, />Provide</, `${label} T047 no Provide ink on canvas`);
  assert.doesNotMatch(canvas, />OCM console</, `${label} T047 no OCM console ink on canvas`);
  assert.doesNotMatch(canvas, />Host</, `${label} T047 no Host ink on canvas`);
  assert.doesNotMatch(canvas, /id=["']copy-skill-use["']/, `${label} T047 Copy AI skill not on empty canvas`);

  assert.doesNotMatch(thread, /id=["']ask-provide["']/, `${label} T047 Provide off empty thread`);
  assert.doesNotMatch(thread, /id=["']ask-host["']/, `${label} T047 Host off empty thread`);
  assert.doesNotMatch(thread, /id=["']ask-ocm["']/, `${label} T047 OCM console off empty thread`);
  assert.match(thread, /id=["']ask-thread["'][^>]*\bhidden\b><\/div>/, `${label} T047 empty thread has no door children`);

  assert.match(nav, /id=["']ask-provide["'][^>]*>Provide</, `${label} T047 Provide lives in composer nav`);
  assert.match(nav, /id=["']ask-ocm["'][^>]*>OCM console</, `${label} T047 OCM console lives in composer nav`);
  assert.match(nav, /id=["']ask-host["'][^>]*>Host</, `${label} T047 Host lives in composer nav`);
  assert.match(
    html,
    /body\.has-chat #ask-starters,body\.has-chat #ask-free-fine,body\.has-chat #ask-range,body\.has-chat #buyer-live-line,body\.has-chat #ask-nav\{display:none!important\}/,
    `${label} T047 doors stay off the thread once chat exists`,
  );
  assert.match(html, /<details class=["']ask-more["'] id=["']ask-more["']>/, `${label} T047 More starts closed`);
  assert.doesNotMatch(html, /<details class=["']ask-more["'][^>]*\bopen\b/, `${label} T047 More not open`);
}

function assertSignInTopDropdown(html, label) {
  assert.match(html, /<!-- siwg-nav-drop:2026-09-07 -->/, `${label} T048 marker`);
  assert.match(html, /<details class="nav-drop">/, `${label} T048 details.nav-drop`);
  assert.doesNotMatch(html, /<details class="nav-drop"[^>]*\bopen\b/, `${label} T048 dropdown closed`);
  const drop = (html.match(/<details class="nav-drop">[\s\S]*?<\/details>/) || [''])[0];
  assert.match(drop, /<summary>Menu<\/summary>/, `${label} T048 Menu`);
  assert.match(drop, /Sign in with Grok Bot/, `${label} T048 Sign in in top dropdown`);
  assert.match(drop, /href="\/login#grok"/, `${label} T048 SIWG href`);
  assert.doesNotMatch(html, /id=["']grok-door["']/, `${label} T048 no mid-page grok-door`);
  const grwmAt = html.indexOf('id="grwm"');
  const firstPaint = grwmAt >= 0 ? html.slice(0, grwmAt) : html;
  assert.match(firstPaint, /<details class="nav-drop">/, `${label} T048 first-paint dropdown`);
  assert.doesNotMatch(firstPaint, /id=["']grok-door["']/, `${label} T048 first paint no mid-page Sign in`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T048 no plugin`);
}

function assertGuestSoftModels(html, label) {
  const pool = extractFn(html, 'askModelPool');
  assert.match(pool, /else if\(networkModels\.size>0\)pool=pool\.filter\(m=>networkModels\.has\(m\[0\]\)\)/, `${label} T049 guest pool is live network models`);
  assert.doesNotMatch(pool, /loggedIn/, `${label} T049 model pool is not login-gated`);

  const paint = extractFn(html, 'paintAskModel');
  assert.match(paint, /if\(!mac\)\{pill\.hidden=true/, `${label} T049 Hosted hides the model pill`);
  assert.match(paint, /const pool=askModelPool\(\)/, `${label} T049 paint uses live pool`);

  assert.match(html, /hostedLive=status\?\.live===true/, `${label} T049 hostedLive from status.live`);
  assert.match(html, /Pre-auth optimistic Hosted stays/, `${label} T049 pre-auth optimistic Hosted`);
  assert.match(html, /Guest \+ noMac: one primary Run \(Hosted Ask miss\)/, `${label} T049 guest noMac Hosted miss`);
  assert.match(html, /[Nn]ever invent a model/, `${label} T049 never invent a model`);
  assert.match(
    html,
    /id=["']buyer-live-line["'][^>]*data-ssr-mac=["']pending["'][^>]*>…</,
    `${label} T049 buyer line pending until network`,
  );
  assert.match(html, /const live=n>=1&&ids\.length>0/, `${label} T049 live models only when online`);
  assert.match(html, /'Live\. '\+ids\.join\(' '\)/, `${label} T049 Live. + response ids`);
  assert.match(html, /'No Mac online\.'/, `${label} T049 empty/fail copy`);
  assert.match(html, /Guest: Sign in only — never invent \$0/, `${label} T049 guest never invents $0`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T049 no plugin`);
}

assertAskQuietShellGate(disk, 'disk');
assertAskQuietShellGate(COMPUTE_PAGE_HTML, 'embed');
assertEmptyCanvasDoorsOff(disk, 'disk');
assertEmptyCanvasDoorsOff(COMPUTE_PAGE_HTML, 'embed');
assertGuestSoftModels(disk, 'disk');
assertGuestSoftModels(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
const servedHtml = await served.text();
assertAskQuietShellGate(servedHtml, 'worker.fetch');
assertEmptyCanvasDoorsOff(servedHtml, 'worker.fetch');
assertGuestSoftModels(servedHtml, 'worker.fetch');

{
  const home = await worker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200, 'T048 home 200');
  const homeHtml = await home.text();
  assertSignInTopDropdown(homeHtml, 'worker.fetch home');
}

const liveCanary = process.env.LIVE_ASK_CANARY === '1';
if (liveCanary) {
  const live = await fetch('https://lobby.getdasha.com/compute', {
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'dasha-compute-ask-empty-canvas-canary.test', Accept: 'text/html' },
  });
  assert.equal(live.status, 200, 'LIVE_ASK_CANARY live /compute 200');
  const liveHtml = await live.text();
  if (!hasAskQuietShell(liveHtml)) {
    assert.fail(
      'LIVE_ASK_CANARY: live /compute is still Typeform (no #ask-composer / #ask-scroll / #ask-starters). Instinct wrangler of Uuriko/dasha-lobby tip still outstanding — source canaries on COMPUTE_PAGE_HTML already hold.',
    );
  }
  assertAskQuietShellGate(liveHtml, 'live');
  assertEmptyCanvasDoorsOff(liveHtml, 'live');
  assertGuestSoftModels(liveHtml, 'live');
  console.log('dasha-compute-ask-empty-canvas-canary: PASS (T047 empty-canvas doors off + T048/T049; live Ask shell too)');
} else {
  console.log('dasha-compute-ask-empty-canvas-canary: PASS (T047 empty-canvas doors off + T048 Sign-in dropdown + T049 guest soft models; source only — live Typeform until tip)');
}
