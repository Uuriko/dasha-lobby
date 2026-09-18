#!/usr/bin/env node
/**
 * Live grid strip on /compute Start. — honest Macs / tokens / requests.
 * Darkbloom motion (homepage live counters) without Eigen brand or invented zeros.
 * Disk == embed == worker.fetch. No wrangler. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

export const COMPUTE_GRID_SNIPPET = `<div class="compute-grid" id="compute-grid" data-grid="live" aria-live="polite">
  <p class="compute-grid-kicker">Macs on the network.</p>
  <div class="compute-grid-stats">
    <div class="compute-grid-cell" id="grid-macs-cell">
      <span class="compute-grid-val" id="grid-macs">—</span>
      <span class="compute-grid-lbl">online</span>
    </div>
    <div class="compute-grid-cell" id="grid-tokens-cell" hidden>
      <span class="compute-grid-val" id="grid-tokens">—</span>
      <span class="compute-grid-lbl">tokens · 24h</span>
    </div>
    <div class="compute-grid-cell" id="grid-requests-cell" hidden>
      <span class="compute-grid-val" id="grid-requests">—</span>
      <span class="compute-grid-lbl">requests · 24h</span>
    </div>
  </div>
</div>`;

function gateSlice(html) {
  const start = html.indexOf('id="step-gate"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, 'gate slice');
  return html.slice(start, end);
}

function assertGrid(html, label) {
  const gate = gateSlice(html);
  assert.match(html, /compute-grid:2026-09-18/, `${label} marker`);
  assert.match(html, /id=["']compute-grid["']/, `${label} #compute-grid`);
  assert.match(html, /data-grid=["']live["']/, `${label} data-grid=live`);
  assert.match(html, /id=["']grid-macs["'][^>]*>—</, `${label} first-paint dash, not a fake 0`);
  assert.match(html, /id=["']grid-tokens-cell["'][^>]*\bhidden\b/, `${label} tokens omitted until volume`);
  assert.match(html, /id=["']grid-requests-cell["'][^>]*\bhidden\b/, `${label} requests omitted until volume`);
  assert.match(gate, /Macs on the network\./, `${label} Dasha kicker on Start.`);
  assert.match(html, /function paintComputeGrid\(/, `${label} paintComputeGrid`);
  assert.match(html, /paintComputeGrid\(\)/, `${label} paintComputeGrid called`);
  assert.match(html, /Waiting on \/compute\/api\/network/, `${label} unknown network → dash`);
  assert.match(html, /No Mac advertising/, `${label} known-zero Macs is a dash, not 0 theater`);
  assert.match(html, /tokCell\.hidden=!show/, `${label} hide zero tokens`);
  assert.match(html, /reqCell\.hidden=!show/, `${label} hide zero requests`);
  assert.doesNotMatch(html, /1231|287B|72M|active_providers/, `${label} no Darkbloom marketing counters`);
  assert.doesNotMatch(html, /Eigen|Private Cloud Compute|darkbloom/i, `${label} no Eigen/Darkbloom brand`);
  assert.doesNotMatch(gate, /disclaimer|not financial advice|\bdyor\b|\bnfa\b/i, `${label} no lecture on gate`);
  assert.doesNotMatch(gate, /\/room|Project Room/i, `${label} Compute stays off Room`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.ok(gate.indexOf('Start.') < gate.indexOf('id="compute-grid"'), `${label} Start. before grid`);
  assert.ok(gate.indexOf('id="compute-grid"') < gate.indexOf('id="pick-ask"'), `${label} grid before Do`);
}

assertGrid(disk, 'disk');
assertGrid(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
assertGrid(await served.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    const first = await page.evaluate(() => {
      const grid = document.getElementById('compute-grid');
      const macs = document.getElementById('grid-macs');
      const tok = document.getElementById('grid-tokens-cell');
      const req = document.getElementById('grid-requests-cell');
      return {
        step: document.body.dataset.step,
        kicker: grid?.querySelector('.compute-grid-kicker')?.textContent || '',
        macs: (macs?.textContent || '').trim(),
        tokHidden: tok?.hidden === true,
        reqHidden: req?.hidden === true,
        vis: !!(grid && !grid.hidden && !grid.closest('[hidden]')),
      };
    });
    assert.equal(first.step, 'gate');
    assert.equal(first.kicker, 'Macs on the network.');
    assert.equal(first.macs, '—', 'first paint is a dash');
    assert.equal(first.tokHidden, true, 'tokens omitted at zero');
    assert.equal(first.reqHidden, true, 'requests omitted at zero');
    assert.equal(first.vis, true, 'grid on Start.');

    const live = await page.evaluate(() => {
      providersOnline = 2;
      settled24h = { tokens: 15_000, jobs: 3, cents: 15 };
      paintComputeGrid();
      return {
        macs: document.getElementById('grid-macs').textContent,
        tokHidden: document.getElementById('grid-tokens-cell').hidden,
        tok: document.getElementById('grid-tokens').textContent,
        reqHidden: document.getElementById('grid-requests-cell').hidden,
        req: document.getElementById('grid-requests').textContent,
      };
    });
    assert.equal(live.macs, '2');
    assert.equal(live.tokHidden, false);
    assert.equal(live.tok, '15k');
    assert.equal(live.reqHidden, false);
    assert.equal(live.req, '3');

    const zero = await page.evaluate(() => {
      providersOnline = 0;
      settled24h = { tokens: 0, jobs: 0, cents: 0 };
      paintComputeGrid();
      return {
        macs: document.getElementById('grid-macs').textContent,
        title: document.getElementById('grid-macs').title,
        tokHidden: document.getElementById('grid-tokens-cell').hidden,
        reqHidden: document.getElementById('grid-requests-cell').hidden,
      };
    });
    assert.equal(zero.macs, '—', 'known-zero Macs stay a dash');
    assert.equal(zero.title, 'No Mac advertising');
    assert.equal(zero.tokHidden, true, 'never paint 0 tok as a stat');
    assert.equal(zero.reqHidden, true, 'never paint 0 requests as a stat');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-grid-strip: PASS (honest Macs/tokens/requests; no fake zeros; snippet locked)');
