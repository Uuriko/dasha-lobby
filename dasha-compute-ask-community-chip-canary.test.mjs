#!/usr/bin/env node
/**
 * T050 — Community chip quiet vs scream on the Ask empty canvas.
 * Soft T036 (New is a quiet top control) + T037 (message column ~42rem)
 * when those ids/classes already exist in COMPUTE_PAGE_HTML.
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
    /id=["']ask-scroll["']/.test(html) &&
    /id=["']change-engine["']/.test(html)
  );
}

function assertAskQuietShellGate(html, label) {
  assert.ok(hasAskQuietShell(html), `${label} Ask quiet-shell present in source (tip #246/#249/#255)`);
  assert.match(html, /id=["']step-ask["']/, `${label} #step-ask`);
  assert.match(html, /id=["']ask-input["']/, `${label} #ask-input`);
  assert.match(html, /id=["']ask-send["']/, `${label} #ask-send`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

function assertCommunityChipQuiet(html, label) {
  const canvas = sliceId(html, 'ask-scroll', 'ask-composer');
  const composer = sliceId(html, 'ask-composer', 'step-market');
  const more = sliceId(html, 'ask-more');
  const links = (composer.match(/<div class=["']ask-links["']>[\s\S]*?<\/div>/) || [''])[0];

  assert.doesNotMatch(canvas, /Community/, `${label} T050 no Community ink on empty canvas`);
  assert.doesNotMatch(canvas, /id=["']ask-community["']/, `${label} T050 #ask-community off empty canvas`);
  assert.doesNotMatch(canvas, /id=["']change-engine["']/, `${label} T050 engine chip is not a canvas dump`);
  assert.doesNotMatch(canvas, /Community Macs/, `${label} T050 no Community Macs heading on canvas`);
  assert.doesNotMatch(canvas, /class=["']tf-choice["'][^>]*>Community</, `${label} T050 no giant Community choice on canvas`);
  assert.doesNotMatch(canvas, /class=["']tf-q["'][^>]*>Community/, `${label} T050 no giant Community tf-q`);

  assert.match(links, /id=["']change-engine["']/, `${label} T050 quiet engine chip in ask-links`);
  assert.match(links, /id=["']ask-model["']/, `${label} T050 model pill beside engine chip`);
  assert.match(
    links,
    /id=["']change-engine["'][^>]*class=["']tf-quiet["']/,
    `${label} T050 engine chip is tf-quiet`,
  );
  assert.match(links, /id=["']change-engine["'][^>]*>Hosted</, `${label} T050 default chip is Hosted`);
  assert.doesNotMatch(links, /class=["']tf-choice["']/, `${label} T050 ask-links is not a scream row`);
  assert.doesNotMatch(links, /Community/, `${label} T050 Community is not first-paint chip text`);

  assert.match(
    html,
    /#change-engine,#ask-model\{[^}]*font-size:12px/,
    `${label} T050 engine + model are 12px chips`,
  );
  assert.match(html, /#change-engine,#ask-model\{[^}]*border:0/, `${label} T050 chips have no badge border`);
  assert.match(
    html,
    /#change-engine,#ask-model\{[^}]*background:transparent/,
    `${label} T050 chips are transparent`,
  );
  assert.doesNotMatch(
    html,
    /#ask-community\{[^}]*(min-height:60px|font-size:20px|clamp\(36px)/,
    `${label} T050 #ask-community has no scream CSS`,
  );
  assert.doesNotMatch(
    html,
    /#change-engine\{[^}]*(min-height:60px|font-size:20px|text-transform:uppercase)/,
    `${label} T050 #change-engine has no scream CSS`,
  );

  assert.match(
    more,
    /class=["']tf-quiet["'] id=["']ask-community["'][^>]*\bhidden\b[^>]*>Community</,
    `${label} T050 #ask-community is a hidden quiet door`,
  );
  assert.match(html, /<details class=["']ask-more["'] id=["']ask-more["']>/, `${label} T050 More starts closed`);
  assert.doesNotMatch(html, /<details class=["']ask-more["'][^>]*\bopen\b/, `${label} T050 More not open`);
  assert.match(
    html,
    /id=["']ask-community["'][^>]*\bhidden\b/,
    `${label} T050 Community door starts hidden`,
  );

  const paintChip = extractFn(html, 'paintAskCommunity');
  assert.match(paintChip, /const chip=\$\(['"]ask-community['"]\)/, `${label} T050 paintAskCommunity targets the door`);
  assert.doesNotMatch(
    paintChip,
    /ask-greet|ask-scroll|ask-thread|ask-starters/,
    `${label} T050 paintAskCommunity does not dump onto the canvas`,
  );
  assert.match(
    paintChip,
    /chip\.textContent=`Community · \$\{providersOnline\}`/,
    `${label} T050 door text stays a short chip`,
  );

  const paintEngine = extractFn(html, 'paintAskEngine');
  assert.match(paintEngine, /const btn=\$\(['"]change-engine['"]\)/, `${label} T050 paintAskEngine paints the quiet chip`);
  assert.match(
    paintEngine,
    /else if\(eng==='community'\)btn\.textContent=['"]Community['"]/,
    `${label} T050 Community is one quiet chip word`,
  );
  assert.match(paintEngine, /paintAskModel\(\)/, `${label} T050 Community chip stays next to the model pill`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T050 no plugin`);
}

function assertNewChatQuietTop(html, label) {
  assert.match(html, /<div class=["']ask-top["']>/, `${label} T036 .ask-top`);
  assert.match(html, /#step-ask \.ask-top\{/, `${label} T036 #step-ask .ask-top`);
  assert.match(html, /id=["']clear-chat["'][^>]*>New</, `${label} T036 New control`);
  assert.match(html, /#step-ask \.ask-top #clear-chat\{/, `${label} T036 New lives in ask-top`);
  assert.match(
    html,
    /#step-ask \.ask-top #clear-chat\{[^}]*font-size:12px/,
    `${label} T036 New is 12px quiet`,
  );
  assert.match(html, /#step-ask \.ask-top #clear-chat\{[^}]*border:0/, `${label} T036 New has no badge border`);
  const top = sliceId(html, 'clear-chat', 'ask-scroll');
  assert.match(top, /\bhidden\b/, `${label} T036 New starts hidden`);
  assert.doesNotMatch(html, /id=["']ask-composer["'][\s\S]*id=["']clear-chat["']/, `${label} T036 New left the composer`);
}

function assertMessageColumn42rem(html, label) {
  assert.match(
    html,
    /body\[data-step=ask\] \.shell\{[^}]*width:min\(42rem,calc\(100% - 28px\)\)/,
    `${label} T037 Ask shell width min(42rem)`,
  );
  assert.match(
    html,
    /body\[data-step=ask\] \.shell\{[^}]*max-width:42rem/,
    `${label} T037 Ask shell max-width 42rem`,
  );
}

assertAskQuietShellGate(disk, 'disk');
assertAskQuietShellGate(COMPUTE_PAGE_HTML, 'embed');
assertCommunityChipQuiet(disk, 'disk');
assertCommunityChipQuiet(COMPUTE_PAGE_HTML, 'embed');
assertNewChatQuietTop(disk, 'disk');
assertNewChatQuietTop(COMPUTE_PAGE_HTML, 'embed');
assertMessageColumn42rem(disk, 'disk');
assertMessageColumn42rem(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
const servedHtml = await served.text();
assertAskQuietShellGate(servedHtml, 'worker.fetch');
assertCommunityChipQuiet(servedHtml, 'worker.fetch');
assertNewChatQuietTop(servedHtml, 'worker.fetch');
assertMessageColumn42rem(servedHtml, 'worker.fetch');

const liveCanary = process.env.LIVE_ASK_CANARY === '1';
if (liveCanary) {
  const live = await fetch('https://lobby.getdasha.com/compute', {
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'dasha-compute-ask-community-chip-canary.test', Accept: 'text/html' },
  });
  assert.equal(live.status, 200, 'LIVE_ASK_CANARY live /compute 200');
  const liveHtml = await live.text();
  if (!hasAskQuietShell(liveHtml)) {
    assert.fail(
      'LIVE_ASK_CANARY: live /compute is still Typeform (no #ask-composer / #change-engine). Instinct wrangler of Uuriko/dasha-lobby tip still outstanding — source canaries on COMPUTE_PAGE_HTML already hold.',
    );
  }
  assertAskQuietShellGate(liveHtml, 'live');
  assertCommunityChipQuiet(liveHtml, 'live');
  assertNewChatQuietTop(liveHtml, 'live');
  assertMessageColumn42rem(liveHtml, 'live');
  console.log('dasha-compute-ask-community-chip-canary: PASS (T050 quiet Community chip + T036/T037; live Ask shell too)');
} else {
  console.log('dasha-compute-ask-community-chip-canary: PASS (T050 Community chip quiet vs scream + T036 New top + T037 42rem; source only — live Typeform until tip)');
}
