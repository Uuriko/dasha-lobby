#!/usr/bin/env node
/**
 * After Provide / Enroll, surface the known live provider earn card
 * (not buyer price) and one ink-on-acid next Mac. Start. first paint
 * stays Start. Test-only. No wrangler. No Designer. No plugin.jup.ag.
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

function gateBlock(html) {
  const m = html.match(/<section[^>]*id=["']step-gate["'][^>]*>[\s\S]*?<\/section>/);
  assert.ok(m, 'gate section');
  return m[0];
}

function provideName(html) {
  const m = html.match(/<section[^>]*id=["']step-provide-name["'][^>]*>[\s\S]*?<\/section>/);
  assert.ok(m, 'provide-name section');
  return m[0];
}

function provideDone(html) {
  const start = html.indexOf('id="step-provide-done"');
  const end = html.indexOf('id="step-build"', start);
  assert.ok(start >= 0 && end > start, 'provide-done section');
  return html.slice(start, end);
}

function hostBlock(html) {
  const m = html.match(/<section[^>]*id=["']step-host["'][^>]*>[\s\S]*?<\/section>/);
  assert.ok(m, 'host section');
  return m[0];
}

function assertEarnCard(html, label) {
  const gate = gateBlock(html);
  const name = provideName(html);
  const done = provideDone(html);
  const host = hostBlock(html);

  assert.match(html, /<h1 class=["']tf-q["']>Start\.<\/h1>/, `${label} first paint Start.`);
  assert.match(gate, /class=["']tf-choice primary["'][^>]*id=["']pick-ask["'][^>]*>Ask</, `${label} Ask stays the one Start primary`);
  assert.match(gate, /id=["']pick-provide["'][^>]*>Provide</, `${label} Provide stays`);
  assert.doesNotMatch(gate, /\$0\.05\/job/, `${label} no earn rate on Start`);
  assert.doesNotMatch(gate, /\$dasha payout/, `${label} no payout lecture on Start`);

  assert.match(name, /id=["']provide-name-earn["'][^>]*>\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle · \$dasha payout \+10%</, `${label} Provide name card`);
  assert.match(done, /id=["']provide-earn-fine["'][^>]*>\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle · \$dasha payout \+10%</, `${label} Setup card`);
  assert.match(html, /id=["']earn-rates["'][^>]*>\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle · \$dasha payout \+10%</, `${label} Earn card`);

  assert.match(html, /pending operator settle · \$dasha payout \+10%/, `${label} formatEarnRatesLine dasha +10%`);
  assert.match(html, /const pn=\$\(['"]provide-name-earn['"]\);/, `${label} paintEarnRates name`);
  assert.match(html, /if\(step==='provide-name'\)[\s\S]*?paintEarnRates\(earnRates\)/, `${label} name paints rates`);
  assert.match(html, /if\(step==='provide-done'\)[\s\S]*?paintEarnRates\(earnRates\)/, `${label} Setup paints rates`);

  assert.match(
    done,
    /class=["']tf-choice primary["'][^>]*id=["']provide-add-mac["'][^>]*>Add another Mac</,
    `${label} Add another Mac is the one Setup primary`,
  );
  assert.match(done, /id=["']provide-done-gate["'][^>]*class=["']tf-choice secondary["']|class=["']tf-choice secondary["'][^>]*id=["']provide-done-gate["']/, `${label} Done stays secondary`);
  assert.equal((done.match(/tf-choice primary/g) || []).length, 1, `${label} one ink-on-acid primary on Setup`);
  assert.match(done, /id=["']provide-add-mac["'][^>]*title=["']Community Register · not Host \/ OCM enroll["']/, `${label} add-mac stays Community`);

  assert.doesNotMatch(host, /\$0\.05\/job/, `${label} no community earn on Host Enroll`);
  assert.doesNotMatch(name, /disclaimer|not financial advice|dyor|\bnfa\b|guaranteed|always paid/i, `${label} no lecture on Provide`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertEarnCard(disk, 'disk');
assertEarnCard(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertEarnCard(await res.text(), 'worker.fetch');

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
        start: document.querySelector('#step-gate .tf-q')?.textContent || '',
        askPrimary: document.getElementById('pick-ask')?.classList.contains('primary') || false,
        provide: vis(document.getElementById('pick-provide')),
        earnOnGate: vis(document.getElementById('provide-name-earn')) || vis(document.getElementById('provide-earn-fine')),
        name: vis(document.getElementById('step-provide-name')),
      };
    });
    assert.equal(first.step, 'gate', 'cold boot Start');
    assert.equal(first.start, 'Start.');
    assert.equal(first.askPrimary, true, 'Ask stays primary');
    assert.equal(first.provide, true, 'Provide still on Start');
    assert.equal(first.earnOnGate, false, 'earn card off Start');
    assert.equal(first.name, false, 'Name hidden first paint');

    await page.click('#pick-provide');
    const named = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      return {
        step: document.body.dataset.step,
        title: document.querySelector('#step-provide-name .tf-q')?.textContent || '',
        card: (document.getElementById('provide-name-earn')?.textContent || '').trim(),
        cardVis: vis(document.getElementById('provide-name-earn')),
        nextPrimary: document.getElementById('provide-next')?.classList.contains('primary') || false,
      };
    });
    assert.equal(named.step, 'provide-name', 'Provide opens Name');
    assert.equal(named.title, 'Name this Mac.');
    assert.equal(named.card, CARD, 'Name shows live earn card');
    assert.equal(named.cardVis, true, 'Name earn card visible');
    assert.equal(named.nextPrimary, true, 'Next stays the Name primary');

    await page.evaluate(() => {
      showTf('provide-done');
    });
    const setup = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const primaries = [...document.querySelectorAll('#step-provide-done .tf-choice.primary')].filter((el) => vis(el));
      return {
        step: document.body.dataset.step,
        title: document.querySelector('#step-provide-done .tf-q')?.textContent || '',
        card: (document.getElementById('provide-earn-fine')?.textContent || '').trim(),
        cardVis: vis(document.getElementById('provide-earn-fine')),
        addPrimary: document.getElementById('provide-add-mac')?.classList.contains('primary') || false,
        addText: (document.getElementById('provide-add-mac')?.textContent || '').trim(),
        addVis: vis(document.getElementById('provide-add-mac')),
        doneSecondary: document.getElementById('provide-done-gate')?.classList.contains('secondary') || false,
        primaryCount: primaries.length,
        primaryText: primaries.map((el) => (el.textContent || '').trim()),
      };
    });
    assert.equal(setup.step, 'provide-done', 'Setup after Enroll');
    assert.equal(setup.title, 'Setup.');
    assert.equal(setup.card, CARD, 'Setup shows live earn card');
    assert.equal(setup.cardVis, true, 'Setup earn card visible');
    assert.equal(setup.addPrimary, true, 'Add another Mac is primary');
    assert.equal(setup.addText, 'Add another Mac');
    assert.equal(setup.addVis, true, 'Add another Mac visible');
    assert.equal(setup.doneSecondary, true, 'Done stays secondary');
    assert.equal(setup.primaryCount, 1, 'one Setup primary');
    assert.deepEqual(setup.primaryText, ['Add another Mac']);

    await page.click('#provide-add-mac');
    const again = await page.evaluate(() => ({
      step: document.body.dataset.step,
      title: document.querySelector('#step-provide-name .tf-q')?.textContent || '',
      card: (document.getElementById('provide-name-earn')?.textContent || '').trim(),
    }));
    assert.equal(again.step, 'provide-name', 'Add another Mac names the next one');
    assert.equal(again.title, 'Name this Mac.');
    assert.equal(again.card, CARD, 'next Name still shows the card');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-provide-earn-card: PASS');
