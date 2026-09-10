#!/usr/bin/env node
/**
 * Provide Setup + Earn empty: quiet “Invite a second Mac” with
 * Join a Mac hash door. Rates + jobs+$ receipt + wallet-on-file stay.
 * Recruit capacity while one Mac is already on. Not Add another Mac
 * (your next kit). Compute is not stripHomeCompute / stripRetiredProductDoors.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag. No people-data.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { stripHomeCompute, stripRetiredProductDoors } from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');

const CARD = '$0.05/job + $0.01/1k completion · min $1 · pending operator settle · $dasha payout +10%';
const INVITE = 'Invite a second Mac. Join a Mac.';
const JOIN = 'https://www.getdasha.com/compute#provide';

function provideDone(html) {
  const start = html.indexOf('id="step-provide-done"');
  const end = html.indexOf('id="step-build"', start);
  assert.ok(start >= 0 && end > start, 'provide-done section');
  return html.slice(start, end);
}

function earnBlock(html) {
  const m = html.match(/<section[^>]*id=["']step-earn["'][^>]*>[\s\S]*?<\/section>/);
  assert.ok(m, 'earn section');
  return m[0];
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

function assertInviteFace(html, label) {
  const done = provideDone(html);
  const earn = earnBlock(html);
  const gate = gateBlock(html);
  const ask = askBounds(html);

  assert.match(html, /<!-- provide-invite-second:2026-09-10 -->/, `${label} marker`);
  assert.match(
    done,
    /id=["']provide-invite-second["'][^>]*>Invite a second Mac\. <a href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac<\/a>\.</,
    `${label} Setup invite + Join`,
  );
  assert.match(
    earn,
    /id=["']earn-invite-second["'][^>]*>Invite a second Mac\. <a href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac<\/a>\.</,
    `${label} Earn invite + Join`,
  );
  assert.match(done, /id=["']provide-earn-fine["'][^>]*>\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle · \$dasha payout \+10%</, `${label} Setup rates stay`);
  assert.match(earn, /id=["']earn-rates["'][^>]*>\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle · \$dasha payout \+10%</, `${label} Earn rates stay`);
  assert.match(done, /id=["']provide-earn-receipt["']/, `${label} jobs+\$ receipt stays`);
  assert.match(html, /function walletOnFile\(/, `${label} wallet on file stays`);
  assert.match(html, /function earnInviteEmpty\(/, `${label} earnInviteEmpty`);
  assert.match(html, /function paintEarnInvite\(/, `${label} paintEarnInvite`);
  assert.match(html, /paintEarnInvite\(\);\s*paintProvideEarnReceipt\(\);\s*return;/, `${label} guest\/unloaded paint invite`);
  assert.match(
    done,
    /class=["']tf-choice primary["'][^>]*id=["']provide-add-mac["'][^>]*>Add another Mac</,
    `${label} Add another Mac stays the one Setup primary`,
  );
  assert.equal((done.match(/tf-choice primary/g) || []).length, 1, `${label} one Setup primary`);
  assert.doesNotMatch(done, /id=["']provide-invite-second["'][^>]*hidden/, `${label} Setup invite always on`);
  assert.doesNotMatch(done, /href="(?:https:\/\/(?:www\.)?getdasha\.com)?\/compute"/, `${label} Setup no exact \/compute`);
  assert.doesNotMatch(earn, /href="(?:https:\/\/(?:www\.)?getdasha\.com)?\/compute"/, `${label} Earn no exact \/compute`);
  assert.doesNotMatch(done, /id=["']compute-door["']/, `${label} no compute-door on Setup`);
  assert.doesNotMatch(earn, /id=["']compute-door["']/, `${label} no compute-door on Earn`);
  assert.doesNotMatch(done, /class=["'][^"']*\bcompute\b/, `${label} no class=compute on Setup`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(done, /disclaimer|not financial advice|dyor|\bnfa\b|guaranteed|always paid/i, `${label} no lecture`);
  assert.doesNotMatch(done, /\b\d+\s+Macs?\b/i, `${label} no invented Mac count`);
  assert.doesNotMatch(gate, /Invite a second Mac/, `${label} invite off Start`);
  assert.doesNotMatch(ask, /Invite a second Mac/, `${label} invite off Do`);

  {
    const line = done.match(/id=["']provide-invite-second["'][\s\S]*?<\/p>/);
    assert.ok(line, `${label} Setup invite line`);
    assert.doesNotMatch(line[0], /Add another Mac/, `${label} invite is not Add another Mac`);
  }
}

assertInviteFace(disk, 'disk');
assertInviteFace(COMPUTE_PAGE_HTML, 'embed');

assert.doesNotMatch(
  workerSrc.match(/function computePageResponse\([\s\S]*?\n\}/)?.[0] || '',
  /stripHomeCompute|stripRetiredProductDoors/,
  'compute response does not run Instinct compute strips',
);

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
const served = await res.text();
assertInviteFace(served, 'worker.fetch');

{
  const eaten = stripRetiredProductDoors(served);
  assert.doesNotMatch(eaten, /href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac/, 'howto strip would eat Join');
  assert.match(served, /href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac/, 'compute keeps Join because that strip is not applied');
}

{
  const homeKill = stripHomeCompute('<a class="compute" href="/compute">Compute</a><a href="/compute#provide">Join a Mac</a>');
  assert.doesNotMatch(homeKill, /href="\/compute"/, 'stripHomeCompute eats exact /compute');
  assert.match(homeKill, /href="\/compute#provide"/, 'hash Join survives stripHomeCompute');
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
        inviteOnGate: vis(document.getElementById('provide-invite-second')) || vis(document.getElementById('earn-invite-second')),
      };
    });
    assert.equal(first.step, 'gate', 'cold boot Start');
    assert.equal(first.inviteOnGate, false, 'invite off Start');

    await page.evaluate(() => {
      showTf('provide-done');
    });
    const setup = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const a = document.querySelector('#provide-invite-second a');
      return {
        step: document.body.dataset.step,
        invite: (document.getElementById('provide-invite-second')?.textContent || '').replace(/\s+/g, ' ').trim(),
        inviteVis: vis(document.getElementById('provide-invite-second')),
        href: a?.getAttribute('href') || '',
        text: (a?.textContent || '').trim(),
        card: (document.getElementById('provide-earn-fine')?.textContent || '').trim(),
        addPrimary: document.getElementById('provide-add-mac')?.classList.contains('primary') || false,
      };
    });
    assert.equal(setup.step, 'provide-done', 'Setup');
    assert.equal(setup.invite, INVITE, 'Setup invite copy');
    assert.equal(setup.inviteVis, true, 'Setup invite visible');
    assert.equal(setup.href, JOIN, 'Setup Join href');
    assert.equal(setup.text, 'Join a Mac', 'Setup Join label');
    assert.equal(setup.card, CARD, 'Setup rates stay');
    assert.equal(setup.addPrimary, true, 'Add another Mac stays primary');

    await page.evaluate(() => {
      showTf('earn');
    });
    const guestEarn = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const a = document.querySelector('#earn-invite-second a');
      return {
        step: document.body.dataset.step,
        invite: (document.getElementById('earn-invite-second')?.textContent || '').replace(/\s+/g, ' ').trim(),
        inviteVis: vis(document.getElementById('earn-invite-second')),
        href: a?.getAttribute('href') || '',
        card: (document.getElementById('earn-rates')?.textContent || '').trim(),
        loggedIn,
        empty: earnInviteEmpty(),
      };
    });
    assert.equal(guestEarn.step, 'earn', 'Earn');
    assert.equal(guestEarn.loggedIn, false, 'guest');
    assert.equal(guestEarn.invite, INVITE, 'Earn invite copy');
    assert.equal(guestEarn.inviteVis, true, 'guest empty shows invite');
    assert.equal(guestEarn.href, JOIN, 'Earn Join href');
    assert.equal(guestEarn.card, CARD, 'Earn rates stay');
    assert.equal(guestEarn.empty, true, 'guest is empty');

    const empty = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      loggedIn = true;
      earnLoaded = true;
      earnTotalUsdc = 0;
      earnTotalJobs = 0;
      earnRates = { job_cents: 5, token_cents_per_1k: 1, min_payout_cents: 100 };
      paintEarn();
      return {
        inviteVis: vis(document.getElementById('earn-invite-second')),
        empty: earnInviteEmpty(),
        card: (document.getElementById('earn-rates')?.textContent || '').trim(),
        receipt: provideEarnReceiptLine(),
      };
    });
    assert.equal(empty.empty, true, 'loaded $0 / 0 jobs is empty');
    assert.equal(empty.inviteVis, true, 'empty Earn shows invite');
    assert.equal(empty.card, CARD, 'empty keeps rates');
    assert.equal(empty.receipt, 'No jobs yet · $0 pending', 'empty receipt stays');

    const paid = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      earnTotalUsdc = 15;
      earnTotalJobs = 3;
      earnPref = { method: 'usdc', wallet: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN' };
      paintEarn();
      return {
        inviteVis: vis(document.getElementById('earn-invite-second')),
        empty: earnInviteEmpty(),
        receipt: provideEarnReceiptLine(),
        wallet: walletOnFile(),
      };
    });
    assert.equal(paid.empty, false, 'jobs hide empty');
    assert.equal(paid.inviteVis, false, 'jobs hide invite');
    assert.equal(paid.receipt, '3 jobs completed · $0.15 pending', 'jobs+$ stay');
    assert.equal(paid.wallet, true, 'wallet on file stays');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-invite-second-mac: PASS (Setup + Earn empty Invite a second Mac · Join a Mac; rates + wallet stay)');
