#!/usr/bin/env node
/**
 * T031 / T038 / T046 — Ask quiet-shell leftover canaries against tip source.
 * T038 mobile always-on `.ask-acts` exception (CSS media markers if present).
 * T046 mid-stream tok/s essay ban: paintAskLive / stream path never injects
 * tok/s into Thinking… chrome.
 * T031 residual Typeform Start./Do. must not show on the Ask path once the
 * quiet-shell is present (assert against COMPUTE_PAGE_HTML #step-ask).
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

function extractMediaBlocks(html) {
  const blocks = [];
  const re = /@media[^{]+\{/g;
  let m;
  while ((m = re.exec(html))) {
    let i = html.indexOf('{', m.index);
    let depth = 0;
    for (; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) {
          blocks.push(html.slice(m.index, i + 1));
          break;
        }
      }
    }
  }
  return blocks;
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

function assertMobileAlwaysOnActsIfPresent(html, label) {
  const mobileActs = extractMediaBlocks(html).filter(
    (block) =>
      /\.ask-acts/.test(block) &&
      /max-width|hover:\s*none|pointer:\s*coarse/.test(block),
  );

  if (mobileActs.length) {
    for (const block of mobileActs) {
      assert.match(
        block,
        /\.ask-acts\{[^}]*opacity:1/,
        `${label} T038 narrow/touch media keeps .ask-acts always-on`,
      );
      assert.match(
        block,
        /\.ask-acts\{[^}]*pointer-events:auto/,
        `${label} T038 narrow/touch media keeps .ask-acts hittable`,
      );
      assert.doesNotMatch(
        block,
        /\.ask-acts\{[^}]*opacity:0/,
        `${label} T038 mobile exception is not hover-hidden`,
      );
    }
    return 'present';
  }

  // T038 CSS not in tip — do not invent always-on. Lock the mobile surface
  // plus the existing hover/focus-within reveal (touch can focus the acts).
  assert.match(html, /@media\(max-width:560px\)/, `${label} T038 narrow 560px surface exists`);
  assert.match(
    html,
    /\.ask-acts\{[^}]*opacity:0;pointer-events:none;position:absolute/,
    `${label} T038 rest overlay still hover-hidden (no always-on in tip)`,
  );
  assert.match(
    html,
    /\.ask-turn:hover \.ask-acts,\.ask-turn:focus-within \.ask-acts,\.ask-acts:focus-within\{opacity:1;pointer-events:auto\}/,
    `${label} T038 focus-within is the tip touch reveal`,
  );
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T038 no plugin`);
  return 'absent';
}

function assertPaintAskLiveNoToksChrome(html, label) {
  const live = extractFn(html, 'paintAskLiveTurn');
  const note = extractFn(html, 'noteAskPartial');
  const begin = extractFn(html, 'beginAskLive');
  const delta = extractFn(html, 'paintAskStreamDelta');
  const settle = extractFn(html, 'settleAskStream');
  const first = extractFn(html, 'onFirstToken');
  const think = extractFn(html, 'setAskThink');

  assert.doesNotMatch(live, /tok\/s/i, `${label} T046 paintAskLiveTurn never writes tok/s`);
  assert.doesNotMatch(note, /tok\/s/i, `${label} T046 noteAskPartial never writes tok/s`);
  assert.doesNotMatch(begin, /tok\/s/i, `${label} T046 beginAskLive never writes tok/s`);
  assert.doesNotMatch(delta, /tok\/s/i, `${label} T046 paintAskStreamDelta never writes tok/s`);
  assert.doesNotMatch(settle, /tok\/s/i, `${label} T046 settleAskStream never writes tok/s`);
  assert.doesNotMatch(first, /tok\/s/i, `${label} T046 onFirstToken never writes tok/s`);
  assert.doesNotMatch(think, /tok\/s/i, `${label} T046 setAskThink never writes tok/s`);

  assert.match(
    begin,
    /askLive=\{user:String\(userContent\|\|''\),assistant:'',state:'thinking'\}/,
    `${label} T046 send starts thinking`,
  );
  assert.match(
    live,
    /turn\.dataset\.state=askLive\.state\|\|'streaming'/,
    `${label} T046 paintAskLiveTurn only stamps live state`,
  );
  assert.match(
    live,
    /fillAskSaid\(turn\.querySelector\('\.ask-said'\),askLive\.assistant/,
    `${label} T046 live paint fills .ask-said from assistant text`,
  );
  assert.doesNotMatch(live, /ask-who|textContent|tok\/s|tokens_per_second/, `${label} T046 live paint does not essay the who-rail`);
  assert.match(
    note,
    /paintAskLiveTurn\(\)/,
    `${label} T046 mid-stream partials go through paintAskLiveTurn`,
  );
  assert.match(
    first,
    /if\(askLive&&askLive\.state==='thinking'\)\{askLive\.state='streaming';paintAskLiveTurn\(\)\}/,
    `${label} T046 first token flips thinking → streaming via paintAskLiveTurn`,
  );
  assert.match(
    think,
    /const copy=kind==='queued'\?'Queued…':kind==='hosted'\?'Hosted…':\(kind==='mac'\|\|kind==='resume'\)\?'Mac…':''/,
    `${label} T046 think chip is Queued/Hosted/Mac only`,
  );

  assert.match(
    html,
    /\.ask-turn\[data-state=thinking\] \.ask-who::after,\.ask-turn\[data-state=streaming\] \.ask-who::after\{content:' Thinking…'/,
    `${label} T046 Thinking… chrome is one quiet word`,
  );
  assert.doesNotMatch(html, /content:' · streaming'/, `${label} T046 no streaming essay`);
  assert.doesNotMatch(html, /content:' · thinking'/, `${label} T046 no · thinking rail`);
  assert.doesNotMatch(
    html,
    /\.ask-turn\[data-state=(?:thinking|streaming)\][^{]*\{[^}]*tok\/s/,
    `${label} T046 no tok/s in stream chrome CSS`,
  );
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T046 no plugin`);
}

function assertAskPathHidesTypeformStartDo(html, label) {
  assert.ok(hasAskQuietShell(html), `${label} T031 quiet-shell is the Ask path`);

  const ask = sliceId(html, 'step-ask', 'step-market');
  const gate = sliceId(html, 'step-gate', 'step-how');
  const canvas = sliceId(html, 'ask-scroll', 'ask-composer');

  assert.match(gate, /<h1 class=["']tf-q["']>Start\.<\/h1>/, `${label} T031 Start. stays on the gate`);
  assert.doesNotMatch(ask, /<h1 class=["']tf-q["']>Start\.<\/h1>/, `${label} T031 Ask step has no Start. H1`);
  assert.match(
    html,
    /#step-ask \.tf-q\{[^}]*position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect\(0,0,0,0\)/,
    `${label} T031 leftover Ask tf-q is clipped (not shown)`,
  );
  assert.match(
    html,
    /body\.has-chat #step-ask \.tf-q\{[^}]*clip:rect\(0,0,0,0\)/,
    `${label} T031 thread keeps leftover Do. clipped`,
  );
  assert.match(canvas, /id=["']ask-greet["'][^>]*>What\.</, `${label} T031 visible empty line is What.`);
  assert.doesNotMatch(canvas, /id=["']ask-greet["'][^>]*>Start\.</, `${label} T031 greet is not Start.`);
  assert.doesNotMatch(canvas, /id=["']ask-greet["'][^>]*>Do\.</, `${label} T031 greet is not Do.`);
  assert.match(html, /#step-ask #guide\{display:none!important\}/, `${label} T031 Typeform progress guide stays off Ask`);

  const show = extractFn(html, 'showTf');
  assert.match(show, /if\(step==='ask'\)\{\s*paintAskThread\(\)/, `${label} T031 showTf(ask) paints the quiet thread`);
  assert.doesNotMatch(
    show,
    /step==='ask'[\s\S]{0,400}(textContent=['"]Start\.['"]|textContent=['"]Do\.['"])/,
    `${label} T031 showTf(ask) does not stamp Start./Do.`,
  );
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T031 no plugin`);
}

assertAskQuietShellGate(disk, 'disk');
assertAskQuietShellGate(COMPUTE_PAGE_HTML, 'embed');
const t038Disk = assertMobileAlwaysOnActsIfPresent(disk, 'disk');
const t038Embed = assertMobileAlwaysOnActsIfPresent(COMPUTE_PAGE_HTML, 'embed');
assert.equal(t038Disk, t038Embed, 'T038 disk/embed agree');
assertPaintAskLiveNoToksChrome(disk, 'disk');
assertPaintAskLiveNoToksChrome(COMPUTE_PAGE_HTML, 'embed');
assertAskPathHidesTypeformStartDo(disk, 'disk');
assertAskPathHidesTypeformStartDo(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
const servedHtml = await served.text();
assertAskQuietShellGate(servedHtml, 'worker.fetch');
assertMobileAlwaysOnActsIfPresent(servedHtml, 'worker.fetch');
assertPaintAskLiveNoToksChrome(servedHtml, 'worker.fetch');
assertAskPathHidesTypeformStartDo(servedHtml, 'worker.fetch');

const liveCanary = process.env.LIVE_ASK_CANARY === '1';
if (liveCanary) {
  const live = await fetch('https://lobby.getdasha.com/compute', {
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'dasha-compute-ask-quiet-leftover-canary.test', Accept: 'text/html' },
  });
  assert.equal(live.status, 200, 'LIVE_ASK_CANARY live /compute 200');
  const liveHtml = await live.text();
  if (!hasAskQuietShell(liveHtml)) {
    assert.fail(
      'LIVE_ASK_CANARY: live /compute is still Typeform (no #ask-composer / #ask-model / #ask-starters). Instinct wrangler of Uuriko/dasha-lobby tip still outstanding — source canaries on COMPUTE_PAGE_HTML already hold.',
    );
  }
  assertAskQuietShellGate(liveHtml, 'live');
  assertMobileAlwaysOnActsIfPresent(liveHtml, 'live');
  assertPaintAskLiveNoToksChrome(liveHtml, 'live');
  assertAskPathHidesTypeformStartDo(liveHtml, 'live');
  console.log('dasha-compute-ask-quiet-leftover-canary: PASS (T031/T038/T046; live Ask shell too)');
} else {
  const t038Note = t038Disk === 'present' ? 'T038 mobile always-on acts' : 'T038 not in tip (hover/focus-within)';
  console.log(
    `dasha-compute-ask-quiet-leftover-canary: PASS (T031 Ask hides Start./Do. + ${t038Note} + T046 paintAskLive no tok/s; source only — live Typeform until tip)`,
  );
}
