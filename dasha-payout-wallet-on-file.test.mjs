#!/usr/bin/env node
/**
 * Wallet on file before jobs clear / bounty settle.
 * Provide Name ships #provide-wallet; Earn CTA + Request payout stay
 * honest; /bounties ships #bb-wallet. Same payout-pref store. No SIWS.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { bountiesHtml } from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function provideName(html) {
  const m = html.match(/<section[^>]*id=["']step-provide-name["'][^>]*>[\s\S]*?<\/section>/);
  assert.ok(m, 'provide-name section');
  return m[0];
}

function earnBlock(html) {
  const m = html.match(/<section[^>]*id=["']step-earn["'][^>]*>[\s\S]*?<\/section>/);
  assert.ok(m, 'earn section');
  return m[0];
}

function afterStyleScript(src) {
  return String(src)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

function assertComputeWallet(html, label) {
  const name = provideName(html);
  const earn = earnBlock(html);
  assert.match(html, /<!-- provide-wallet-on-file:2026-09-10 -->/, `${label} marker`);
  assert.match(name, /id=["']provide-wallet["']/, `${label} #provide-wallet on Name`);
  assert.match(name, /On file · jobs clear here\./, `${label} Provide fine`);
  assert.match(name, /id=["']provide-wallet-save["'][^>]*>Save</, `${label} Provide Save`);
  assert.match(earn, /id=["']earn-wallet["']/, `${label} Earn #earn-wallet stays`);
  assert.match(earn, /id=["']earn-wallet-cta["']/, `${label} Earn CTA`);
  assert.match(earn, />Add wallet so you can get paid</, `${label} CTA copy`);
  assert.match(html, /function solanaWalletOk\(/, `${label} base58 length check`);
  assert.match(html, /api\('\/compute\/api\/provider\/payout-pref'/, `${label} reuses Earn pref API`);
  assert.match(html, /btn\.disabled=!canPay\|\|!haveWallet/, `${label} Request payout disabled without wallet`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(name, /seed|private key|not financial advice|we don.t custody/i, `${label} no lecture on Name`);
}

assertComputeWallet(disk, 'disk');
assertComputeWallet(COMPUTE_PAGE_HTML, 'embed');

const computeRes = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(computeRes.status, 200);
assert.equal(computeRes.headers.get('x-dasha-edge'), 'compute');
assertComputeWallet(await computeRes.text(), 'worker.fetch /compute');

{
  const empty = bountiesHtml({ listings: [] });
  const visible = afterStyleScript(empty);
  assert.match(visible, /id=["']bb-x["']/, 'bounties #bb-x stays');
  assert.match(visible, /id=["']bb-wallet["']/, 'bounties #bb-wallet');
  assert.match(visible, /id=["']bb-wallet-input["']/, 'bounties wallet input');
  assert.match(visible, /id=["']bb-wallet-save["']/, 'bounties Save');
  assert.match(visible, /On file · USDC lands here\./, 'bounties fine');
  assert.match(visible, /USDC on Solana\. We don.t hold it\./, 'custody one-liner stays');
  assert.match(empty, /\/compute\/api\/provider\/payout-pref/, 'bounties posts Earn pref API');
  assert.match(empty, /\/auth\/status/, 'bounties uses site session');
  assert.doesNotMatch(visible, /seed|private key|SIWS|not financial advice|we don.t custody/i, 'no extra lecture');
  assert.doesNotMatch(empty, /plugin\.jup\.ag/);
}

assert.match(workerSrc, /id="bb-x" href="\/oauth\/x\/start\?continue=1"/, 'site-hunt X-connect stays');

{
  const res = await worker.fetch(new Request('https://www.getdasha.com/bounties'), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'bounties');
  const html = await res.text();
  const visible = afterStyleScript(html);
  assert.match(visible, /id=["']bb-wallet["']/, 'served #bb-wallet');
  assert.match(visible, /id=["']bb-x["']/, 'served #bb-x');
  assert.match(visible, /id=["']bb-app["']/, 'served #bb-app');
  assert.match(visible, /No funded bounties right now\./, 'browsing empty inventory stays');
  assert.match(html, /USDC on Solana\. We don.t hold it\./);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

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
        walletOnStart: vis(document.getElementById('provide-wallet')),
        earnWallet: vis(document.getElementById('earn-wallet-wrap')),
        cta: vis(document.getElementById('earn-wallet-cta')),
      };
    });
    assert.equal(first.step, 'gate', 'cold boot Start');
    assert.equal(first.walletOnStart, false, 'wallet off Start');
    assert.equal(first.earnWallet, false, 'Earn wallet off Start');
    assert.equal(first.cta, false, 'CTA off Start');

    await page.click('#pick-provide');
    const named = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      return {
        step: document.body.dataset.step,
        title: document.querySelector('#step-provide-name .tf-q')?.textContent || '',
        wallet: vis(document.getElementById('provide-wallet')),
        fine: (document.getElementById('provide-wallet-fine')?.textContent || '').trim(),
        save: vis(document.getElementById('provide-wallet-save')),
        next: vis(document.getElementById('provide-next')),
      };
    });
    assert.equal(named.step, 'provide-name');
    assert.equal(named.title, 'Name this Mac.');
    assert.equal(named.wallet, true, 'Payout wallet on Name');
    assert.equal(named.fine, 'On file · jobs clear here.');
    assert.equal(named.save, true, 'Save visible');
    assert.equal(named.next, true, 'Next still there');

    await page.click('#provide-next');
    assert.equal(await page.evaluate(() => document.body.dataset.step), 'provide-reg', 'Next still enrolls');

    await page.evaluate(() => showTf('earn'));
    const earnEmpty = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      loggedIn = true;
      earnLoaded = true;
      earnTotalUsdc = 250;
      earnTotalJobs = 4;
      earnPending = [{ status: 'pending', payout_cents: 250, method: 'usdc' }];
      earnPref = null;
      earnRates = { job_cents: 5, token_cents_per_1k: 1, min_payout_cents: 100 };
      const w = document.getElementById('earn-wallet');
      if (w) w.value = '';
      paintEarn();
      const btn = document.getElementById('earn-payout');
      return {
        wrap: vis(document.getElementById('earn-wallet-wrap')),
        cta: vis(document.getElementById('earn-wallet-cta')),
        ctaText: (document.getElementById('earn-wallet-cta')?.textContent || '').trim(),
        btnVis: vis(btn),
        btnDisabled: !!btn?.disabled,
        receipt: provideEarnReceiptLine(),
      };
    });
    assert.equal(earnEmpty.wrap, true, 'wallet field shown when pending');
    assert.equal(earnEmpty.cta, true, 'CTA when pending and no wallet');
    assert.equal(earnEmpty.ctaText, 'Add wallet so you can get paid');
    assert.equal(earnEmpty.btnVis, true, 'Request payout not hidden');
    assert.equal(earnEmpty.btnDisabled, true, 'Request payout disabled without wallet');
    assert.equal(earnEmpty.receipt, 'Wallet needed · pending won’t clear');

    await page.click('#earn-wallet-cta');
    const focused = await page.evaluate(() => document.activeElement?.id || '');
    assert.equal(focused, 'earn-wallet', 'CTA jumps to wallet field');

    const withWallet = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      document.getElementById('earn-wallet').value = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
      earnPref = { method: 'usdc', wallet: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN' };
      paintEarn();
      const btn = document.getElementById('earn-payout');
      return {
        cta: vis(document.getElementById('earn-wallet-cta')),
        btnDisabled: !!btn?.disabled,
        receipt: provideEarnReceiptLine(),
      };
    });
    assert.equal(withWallet.cta, false, 'CTA gone once wallet on file');
    assert.equal(withWallet.btnDisabled, false, 'Request payout enabled with wallet + min');
    assert.equal(withWallet.receipt, '4 jobs completed · $2.50 pending');
  } finally {
    await browser.close();
  }
}

console.log('dasha-payout-wallet-on-file: PASS');
