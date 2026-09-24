#!/usr/bin/env node
/**
 * T073 — Capacity dashboard never in the Ask thread / empty canvas.
 * Tip-source canary: Ask thread + empty canvas never embed the
 * capacity dashboard, providers table, or tok/s essay panel.
 * Those surfaces stay on How/Compare (#market), the page-level
 * #honesty-panel aside, and /compute/leaderboard (#models).
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

const DASH_IDS = [
  ['honesty-panel', 'capacity / honesty aside'],
  ['honesty-hosted', 'honesty Hosted chip'],
  ['honesty-macs', 'honesty Macs chip'],
  ['honesty-settled', 'honesty settled tape'],
  ['presence-strip', 'presence strip'],
  ['act-tape', 'act tape'],
  ['compute-live-badge', 'live Macs badge'],
  ['market', 'Compare models market'],
  ['market-toggle', 'Compare models toggle'],
  ['market-filter', 'market filter'],
  ['market-rows', 'providers / tok/s rows'],
  ['s-prov', 'leaderboard providers-online'],
  ['s-queue', 'leaderboard jobs queued'],
];

function assertNoCapacityDashSurface(html, label) {
  assert.doesNotMatch(html, /id=["']honesty-panel["']/, `${label} no #honesty-panel`);
  assert.doesNotMatch(html, /class=["'][^"']*honesty-panel/, `${label} no honesty-panel class`);
  assert.doesNotMatch(html, /id=["']market["']/, `${label} no #market`);
  assert.doesNotMatch(html, /class=["']market-table["']/, `${label} no market-table`);
  assert.doesNotMatch(html, /id=["']market-rows["']/, `${label} no #market-rows`);
  assert.doesNotMatch(html, /id=["']market-toggle["']/, `${label} no Compare models`);
  assert.doesNotMatch(html, /<table\b[^>]*id=["']models["']/, `${label} no leaderboard #models table`);
  assert.doesNotMatch(html, /id=["']s-prov["']/, `${label} no providers-online stat`);
  assert.doesNotMatch(html, /providers online/i, `${label} no providers-online essay`);
  assert.doesNotMatch(html, /Measured tok\/s/, `${label} no Measured tok/s table header`);
  assert.doesNotMatch(html, /<th>[^<]*tok\/s/i, `${label} no tok/s table header`);
  assert.doesNotMatch(html, /<table\b/, `${label} no providers / capacity table`);
  assert.doesNotMatch(html, /The network, in public/, `${label} no leaderboard essay`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  for (const [id, note] of DASH_IDS) {
    assert.doesNotMatch(html, new RegExp(`id=["']${id}["']`), `${label} no #${id} (${note})`);
  }
}

function assertAskThreadNeverEmbedsCapacityDash(html, label) {
  const ask = sliceId(html, 'step-ask', 'step-market');
  const canvas = sliceId(html, 'ask-scroll', 'ask-composer');
  const thread = sliceId(html, 'ask-thread', 'ask-mac-line');

  assertNoCapacityDashSurface(ask, `${label} T073 #step-ask`);
  assertNoCapacityDashSurface(canvas, `${label} T073 empty canvas`);
  assertNoCapacityDashSurface(thread, `${label} T073 #ask-thread`);

  assert.match(canvas, /id=["']ask-greet["'][^>]*>What\.</, `${label} T073 empty line is What.`);
  assert.match(canvas, /id=["']ask-starters["']/, `${label} T073 starters stay on empty canvas`);
  assert.match(canvas, /id=["']ask-thread["'][^>]*\bhidden\b/, `${label} T073 empty thread starts hidden`);
  assert.match(thread, /id=["']ask-thread["'][^>]*\bhidden\b><\/div>/, `${label} T073 empty thread has no dash children`);

  // Receipt slot may sit on the canvas as a hidden empty <p> — not a dashboard.
  assert.match(
    canvas,
    /<p class=["']fine["'] id=["']ask-receipt["'] hidden aria-live=["']polite["']><\/p>/,
    `${label} T073 ask-receipt is an empty hidden slot, not a tok/s essay panel`,
  );
  assert.match(
    html,
    /#step-ask #ask-receipt,#step-ask #ask-mac-line,#step-ask #ask-range\{display:none!important\}/,
    `${label} T073 Ask CSS keeps receipt / mac-line / range off the empty thread`,
  );
}

function assertPaintAskNeverInjectsCapacityDash(html, label) {
  const paint = extractFn(html, 'paintAskThread');
  const turn = extractFn(html, 'paintAskTurn');
  const live = extractFn(html, 'paintAskLiveTurn');
  const show = extractFn(html, 'showTf');
  const honesty = extractFn(html, 'paintHonestyPanel');

  assert.match(paint, /const thread=\$\(['"]ask-thread['"]\)/, `${label} T073 paintAskThread owns #ask-thread`);
  assert.match(paint, /thread\.replaceChildren\(\.\.\.turns\.map/, `${label} T073 open thread is ask-turns only`);
  assert.match(paint, /thread\.replaceChildren\(\)/, `${label} T073 empty thread clears children`);
  assert.doesNotMatch(paint, /honesty-panel|market-table|market-rows|market-toggle|s-prov/, `${label} T073 paintAskThread does not mount dash`);
  assert.doesNotMatch(paint, /tok\/s|tokens_per_second|providers online/i, `${label} T073 paintAskThread does not essay tok/s`);
  assert.doesNotMatch(paint, /innerHTML|createElement\(['"]table['"]\)/, `${label} T073 paintAskThread does not build a table`);

  assert.match(turn, /turn\.className='ask-turn '/, `${label} T073 paintAskTurn builds .ask-turn`);
  assert.match(turn, /turn\.append\(who,said,acts\)/, `${label} T073 turn is who/said/acts only`);
  assert.doesNotMatch(turn, /honesty-panel|market-table|market-rows|s-prov/, `${label} T073 paintAskTurn does not mount dash`);
  assert.doesNotMatch(turn, /tok\/s|tokens_per_second|providers online/i, `${label} T073 paintAskTurn does not essay tok/s`);
  assert.doesNotMatch(turn, /createElement\(['"]table['"]\)/, `${label} T073 paintAskTurn does not build a table`);

  assert.match(live, /const thread=\$\(['"]ask-thread['"]\)/, `${label} T073 live paint stays on #ask-thread`);
  assert.match(live, /fillAskSaid\(turn\.querySelector\('\.ask-said'\)/, `${label} T073 live paint fills .ask-said`);
  assert.doesNotMatch(live, /honesty-panel|market-table|market-rows|s-prov/, `${label} T073 live paint does not mount dash`);
  assert.doesNotMatch(live, /tok\/s|tokens_per_second|providers online/i, `${label} T073 live paint does not essay tok/s`);

  assert.match(show, /if\(step==='ask'\)\{\s*paintAskThread\(\)/, `${label} T073 showTf(ask) paints the quiet thread`);
  assert.match(show, /paintHonestyPanel\(\)/, `${label} T073 showTf still refreshes the page-level honesty aside`);
  assert.doesNotMatch(
    show,
    /step==='ask'[\s\S]{0,800}(honesty-panel|market-rows|appendChild\(panel|ask-thread['"]\)\.append)/,
    `${label} T073 showTf(ask) does not append the dash into the thread`,
  );

  assert.match(honesty, /const panel=\$\(['"]honesty-panel['"]\)/, `${label} T073 paintHonestyPanel targets the aside`);
  assert.doesNotMatch(honesty, /ask-thread|ask-scroll|ask-composer/, `${label} T073 honesty paint never writes the Ask thread`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T073 no plugin`);
}

function assertCapacityDashLivesElsewhere(html, label) {
  const how = sliceId(html, 'step-model', 'step-ask');
  const market = (how.match(/<div class=["']market["'] id=["']market["'][\s\S]*?<\/div>/) || [''])[0];
  const aside = (html.match(/<aside id=["']honesty-panel["'][\s\S]*?<\/aside>/) || [''])[0];

  assert.match(how, /id=["']market-toggle["'][^>]*>Compare models</, `${label} T073 Compare models lives on How/Which model`);
  assert.match(how, /<div class=["']market["'] id=["']market["'] hidden>/, `${label} T073 #market starts closed on How`);
  assert.match(market, /<table class=["']market-table["']>/, `${label} T073 providers table is the How market`);
  assert.match(market, /<th>tok\/s<\/th>/, `${label} T073 tok/s column lives on How market`);
  assert.match(market, /<th>Macs<\/th>/, `${label} T073 Macs column lives on How market`);
  assert.match(market, /id=["']market-rows["']/, `${label} T073 #market-rows lives on How`);

  assert.match(aside, /id=["']honesty-panel["']/, `${label} T073 honesty aside exists`);
  assert.match(aside, /id=["']honesty-hosted["']/, `${label} T073 honesty Hosted chip is the aside`);
  assert.match(aside, /id=["']honesty-macs["']/, `${label} T073 honesty Macs chip is the aside`);
  assert.match(aside, /id=["']honesty-settled["']/, `${label} T073 settled tape is the aside`);
  assert.match(html, /<aside id=["']honesty-panel["']/, `${label} T073 honesty-panel is a page aside, not Ask markup`);

  const askAt = html.search(/id=["']step-ask["']/);
  const marketAt = html.search(/id=["']step-market["']/);
  const honestyAt = html.search(/id=["']honesty-panel["']/);
  assert.ok(askAt >= 0 && marketAt > askAt, `${label} T073 #step-ask before #step-market`);
  assert.ok(honestyAt > marketAt, `${label} T073 #honesty-panel is after Ask, not inside it`);
}

function assertAskCapacityDash(html, label) {
  assertAskQuietShellGate(html, label);
  assertAskThreadNeverEmbedsCapacityDash(html, label);
  assertPaintAskNeverInjectsCapacityDash(html, label);
  assertCapacityDashLivesElsewhere(html, label);
}

assertAskCapacityDash(disk, 'disk');
assertAskCapacityDash(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
const servedHtml = await served.text();
assertAskCapacityDash(servedHtml, 'worker.fetch');

{
  const board = await worker.fetch(new Request('https://www.getdasha.com/compute/leaderboard'), {});
  assert.equal(board.status, 200, 'T073 leaderboard 200');
  assert.equal(board.headers.get('x-dasha-edge'), 'leaderboard');
  const boardHtml = await board.text();
  assert.match(boardHtml, /<table id="models">/, 'T073 capacity table lives on /compute/leaderboard');
  assert.match(boardHtml, /<th>Measured tok\/s<\/th>/, 'T073 Measured tok/s header lives on the board');
  assert.match(boardHtml, /id="s-prov"/, 'T073 providers-online stat lives on the board');
  assert.match(boardHtml, /providers online/, 'T073 providers-online copy lives on the board');
  assert.doesNotMatch(boardHtml, /id=["']ask-thread["']/, 'T073 leaderboard is not the Ask thread');
  assert.doesNotMatch(boardHtml, /plugin\.jup\.ag/, 'T073 leaderboard no plugin');
}

const liveCanary = process.env.LIVE_ASK_CANARY === '1';
if (liveCanary) {
  const live = await fetch('https://lobby.getdasha.com/compute', {
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'dasha-compute-ask-capacity-dash-canary.test', Accept: 'text/html' },
  });
  assert.equal(live.status, 200, 'LIVE_ASK_CANARY live /compute 200');
  const liveHtml = await live.text();
  if (!hasAskQuietShell(liveHtml)) {
    assert.fail(
      'LIVE_ASK_CANARY: live /compute is still Typeform (no #ask-composer / #ask-scroll / #ask-starters). Instinct wrangler of Uuriko/dasha-lobby tip still outstanding — source canaries on COMPUTE_PAGE_HTML already hold.',
    );
  }
  assertAskCapacityDash(liveHtml, 'live');
  console.log('dasha-compute-ask-capacity-dash-canary: PASS (T073 Ask thread never embeds capacity dash; live Ask shell too)');
} else {
  console.log(
    'dasha-compute-ask-capacity-dash-canary: PASS (T073 Ask thread / empty canvas never embed capacity dash / providers table / tok/s essay; source only — live Typeform until tip)',
  );
}
