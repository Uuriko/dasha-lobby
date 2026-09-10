#!/usr/bin/env node
/**
 * Quiet Provide Setup earn receipt: jobs completed + $ pending
 * from /compute/api/provider/earnings only. Honest empty
 * "No jobs yet · $0 pending". Keep live rate card. No invented
 * Macs. Test-only. No wrangler. No Designer. No plugin.jup.ag.
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

const CARD = '$0.05/job + $0.01/1k completion · min $1 · pending operator settle · $dasha payout +10%';
const EMPTY = 'No jobs yet · $0 pending';
const VIBE = 'Leave it on. Earn.';

function provideDone(html) {
  const start = html.indexOf('id="step-provide-done"');
  const end = html.indexOf('id="step-build"', start);
  assert.ok(start >= 0 && end > start, 'provide-done section');
  return html.slice(start, end);
}

function gateBlock(html) {
  const m = html.match(/<section[^>]*id=["']step-gate["'][^>]*>[\s\S]*?<\/section>/);
  assert.ok(m, 'gate section');
  return m[0];
}

function askBounds(html) {
  const start = html.indexOf('id="step-ask"');
  const end = html.indexOf('id="step-market"', start);
  assert.ok(start >= 0 && end > start, 'Ask bounds');
  return html.slice(start, end);
}

function assertReceiptFace(html, label) {
  const done = provideDone(html);
  const gate = gateBlock(html);
  const ask = askBounds(html);

  assert.match(html, /<!-- provide-earn-receipt:2026-09-10 -->/, `${label} marker`);
  assert.match(done, /id=["']provide-earn-vibe["'][^>]*>Leave it on\. Earn\.</, `${label} vibe on Setup`);
  assert.match(done, /id=["']provide-earn-receipt["'][^>]*hidden/, `${label} receipt hidden until paint`);
  assert.match(done, /id=["']provide-earn-receipt["'][^>]*aria-live=["']polite["']/, `${label} receipt aria-live`);
  assert.match(done, /id=["']provide-earn-fine["'][^>]*>\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle · \$dasha payout \+10%</, `${label} rate card stays`);
  assert.match(html, /function provideEarnReceiptLine\(/, `${label} provideEarnReceiptLine`);
  assert.match(html, /function paintProvideEarnReceipt\(/, `${label} paintProvideEarnReceipt`);
  assert.match(html, /No jobs yet · \$0 pending/, `${label} honest empty copy`);
  assert.match(html, /jobs'\)\+' completed · '\+formatUsdCents\(face\)\+' pending'/, `${label} jobs + \$ pending from Worker fields`);
  assert.match(html, /api\('\/compute\/api\/provider\/earnings'\)/, `${label} same earnings API`);
  assert.match(html, /if\(step==='provide-done'\)[\s\S]*?paintProvideEarnReceipt\(\)/, `${label} Setup paints receipt`);
  assert.match(html, /if\(step==='provide-done'\)[\s\S]*?if\(loggedIn\)loadEarn\(\)/, `${label} Setup loads earn`);
  assert.match(html, /paintProvideEarnReceipt\(\);\s*return;/, `${label} guest\/unloaded hide receipt`);

  assert.doesNotMatch(gate, /Leave it on/, `${label} vibe off Start`);
  assert.doesNotMatch(gate, /No jobs yet/, `${label} empty off Start`);
  assert.doesNotMatch(ask, /Leave it on/, `${label} vibe off Ask`);
  assert.doesNotMatch(ask, /No jobs yet/, `${label} empty off Ask`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(done, /disclaimer|not financial advice|dyor|\bnfa\b|guaranteed|always paid/i, `${label} no lecture`);
  assert.doesNotMatch(done, /active_providers|code_attested|darkbloom/i, `${label} no Darkbloom`);
  assert.doesNotMatch(done, /providers_online=\d/, `${label} no invented Mac count`);
}

assertReceiptFace(disk, 'disk');
assertReceiptFace(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertReceiptFace(await res.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });

    const first = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      return {
        step: document.body.dataset.step,
        vibeOnGate: vis(document.getElementById('provide-earn-vibe')),
        receiptOnGate: vis(document.getElementById('provide-earn-receipt')),
      };
    });
    assert.equal(first.step, 'gate', 'cold boot Start');
    assert.equal(first.vibeOnGate, false, 'vibe off Start');
    assert.equal(first.receiptOnGate, false, 'receipt off Start');

    await page.evaluate(() => {
      showTf('provide-done');
    });
    const guest = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      return {
        step: document.body.dataset.step,
        vibe: (document.getElementById('provide-earn-vibe')?.textContent || '').trim(),
        vibeVis: vis(document.getElementById('provide-earn-vibe')),
        receipt: (document.getElementById('provide-earn-receipt')?.textContent || '').trim(),
        receiptVis: vis(document.getElementById('provide-earn-receipt')),
        card: (document.getElementById('provide-earn-fine')?.textContent || '').trim(),
        loggedIn,
      };
    });
    assert.equal(guest.step, 'provide-done', 'Setup');
    assert.equal(guest.loggedIn, false, 'guest');
    assert.equal(guest.vibe, VIBE, 'vibe copy');
    assert.equal(guest.vibeVis, true, 'vibe visible');
    assert.equal(guest.receiptVis, false, 'guest never invents $0');
    assert.equal(guest.receipt, '', 'guest receipt empty');
    assert.equal(guest.card, CARD, 'rate card stays');

    const empty = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      loggedIn = true;
      earnLoaded = true;
      earnTotalUsdc = 0;
      earnTotalJobs = 0;
      earnRates = { job_cents: 5, token_cents_per_1k: 1, min_payout_cents: 100 };
      paintEarn();
      return {
        receipt: (document.getElementById('provide-earn-receipt')?.textContent || '').trim(),
        receiptVis: vis(document.getElementById('provide-earn-receipt')),
        card: (document.getElementById('provide-earn-fine')?.textContent || '').trim(),
        line: provideEarnReceiptLine(),
      };
    });
    assert.equal(empty.receipt, EMPTY, 'honest empty');
    assert.equal(empty.receiptVis, true, 'empty visible when loaded');
    assert.equal(empty.line, EMPTY, 'line helper empty');
    assert.equal(empty.card, CARD, 'empty keeps rates');

    const paid = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      earnTotalUsdc = 15;
      earnTotalJobs = 3;
      paintProvideEarnReceipt();
      return {
        receipt: (document.getElementById('provide-earn-receipt')?.textContent || '').trim(),
        receiptVis: vis(document.getElementById('provide-earn-receipt')),
        line: provideEarnReceiptLine(),
      };
    });
    assert.equal(paid.receipt, '3 jobs completed · $0.15 pending', 'jobs + $ from Worker fields');
    assert.equal(paid.receiptVis, true, 'paid receipt visible');
    assert.equal(paid.line, '3 jobs completed · $0.15 pending', 'line helper paid');

    const one = await page.evaluate(() => {
      earnTotalUsdc = 5;
      earnTotalJobs = 1;
      return provideEarnReceiptLine();
    });
    assert.equal(one, '1 job completed · $0.05 pending', 'singular job');

    const hide = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      loggedIn = false;
      paintEarn();
      return {
        receiptVis: vis(document.getElementById('provide-earn-receipt')),
        receipt: (document.getElementById('provide-earn-receipt')?.textContent || '').trim(),
        line: provideEarnReceiptLine(),
      };
    });
    assert.equal(hide.receiptVis, false, 'logout hides receipt');
    assert.equal(hide.receipt, '', 'logout clears receipt');
    assert.equal(hide.line, '', 'logout line empty');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-provide-earn-receipt: PASS');
