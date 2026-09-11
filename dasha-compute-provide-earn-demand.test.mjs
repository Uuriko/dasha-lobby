#!/usr/bin/env node
/**
 * Provide earn honesty: busy network → more jobs at the live rate.
 * FAQ + earn-card sibling + optional jobs_queued pulse.
 * No surge formula. No invented balances. Provide = measured Mac.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag. No Room.
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

const DEMAND = 'Busy network · more jobs. Stay warm. Same rate.';
const FAQ_A = 'Busy network · more jobs. Stay warm. Same $0.05/job.';
const CARD = '$0.05/job + $0.01/1k completion · min $1 · pending operator settle · $dasha payout +10%';

const FAQ_ITEM = `<div class="ux-faq-item" data-faq="provide" hidden>
        <p class="ux-faq-q">When do I earn?</p>
        <p class="ux-faq-a">${FAQ_A}</p>
      </div>`;

function faqBlock(html) {
  const start = html.indexOf('id="ux-faq-items"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, '#ux-faq-items bounds');
  return html.slice(start, end);
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

function assertDemand(html, label) {
  const faq = faqBlock(html);
  const done = provideDone(html);
  const host = hostBlock(html);

  assert.match(html, /<!-- provide-earn-demand:2026-09-11 -->/, `${label} marker`);
  assert.ok(faq.includes(FAQ_ITEM), `${label} Provide FAQ When do I earn?`);
  assert.equal((faq.match(/When do I earn\?/g) || []).length, 1, `${label} earn Q once`);
  assert.match(faq, /Stay warm/, `${label} warmth`);
  assert.match(faq, /Same \$0\.05\/job/, `${label} same rate`);

  assert.match(html, /id=["']provide-faq-demand["'][^>]*>Busy network · more jobs\. Stay warm\. Same rate\.</, `${label} Setup FAQ`);
  assert.match(html, /id=["']provide-name-demand["'][^>]*>Busy network · more jobs\. Stay warm\. Same rate\.</, `${label} Name card`);
  assert.match(html, /id=["']provide-earn-demand["'][^>]*>Busy network · more jobs\. Stay warm\. Same rate\.</, `${label} Setup card`);
  assert.match(html, /id=["']earn-demand["'][^>]*>Busy network · more jobs\. Stay warm\. Same rate\.</, `${label} Earn card`);

  assert.match(html, /id=["']earn-rates["'][^>]*>\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle · \$dasha payout \+10%</, `${label} rates stay`);
  assert.match(html, /id=["']provide-name-earn["'][^>]*>\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle · \$dasha payout \+10%</, `${label} name rates stay`);
  assert.match(done, /id=["']provide-earn-fine["'][^>]*>\$0\.05\/job \+ \$0\.01\/1k completion · min \$1 · pending operator settle · \$dasha payout \+10%</, `${label} setup rates stay`);

  assert.match(html, /function applyJobsQueued\(/, `${label} applyJobsQueued`);
  assert.match(html, /function paintProvideQueue\(/, `${label} paintProvideQueue`);
  assert.match(html, /id=["']provide-queue["']/, `${label} #provide-queue`);
  assert.match(html, /api\('\/compute\/api\/network'\)/, `${label} network API`);
  assert.match(html, /network\.jobs_queued/, `${label} jobs_queued field`);
  assert.match(html, /q===1\?'1 queued':q\+' queued'/, `${label} queued copy`);

  assert.match(html, /Provide stays measured Mac tok\/s/, `${label} Provide = measured Mac`);
  assert.doesNotMatch(host, /Busy network/, `${label} demand off Host`);
  assert.match(faq, /data-faq="provide" hidden/, `${label} Provide FAQ hidden until chip`);
  assert.doesNotMatch(faq, /surge|fee engine|auto-payout|always paid|guaranteed/i, `${label} FAQ no surge`);
  assert.doesNotMatch(done, /surge|fee engine|auto-payout|always paid|guaranteed/i, `${label} Setup no surge`);
  assert.doesNotMatch(faq, /pending balance \$|earn \$[0-9]+\/(hr|hour|day)/i, `${label} FAQ no invented balances`);
  assert.doesNotMatch(done, /pending balance \$|earn \$[0-9]+\/(hr|hour|day)/i, `${label} Setup no invented balances`);
  assert.doesNotMatch(faq, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} FAQ no lecture`);
  assert.doesNotMatch(done, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} Setup no lecture`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /project-room|guest-agent|people-data/i, `${label} no Room / people-data`);
}

assertDemand(disk, 'disk');
assertDemand(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertDemand(await res.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });

    await page.click('#faq-areas [data-faq-area="provide"]');
    const faq = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const items = [...document.querySelectorAll('#ux-faq-items [data-faq="provide"]')].filter((el) => vis(el));
      const earn = items.find((el) => /When do I earn\?/.test(el.textContent || ''));
      return {
        count: items.length,
        q: (earn?.querySelector('.ux-faq-q')?.textContent || '').trim(),
        a: (earn?.querySelector('.ux-faq-a')?.textContent || '').trim(),
      };
    });
    assert.ok(faq.count >= 4, 'Provide FAQ shows demand item');
    assert.equal(faq.q, 'When do I earn?');
    assert.equal(faq.a, FAQ_A);

    await page.click('#pick-provide');
    const named = await page.evaluate(() => ({
      card: (document.getElementById('provide-name-earn')?.textContent || '').trim(),
      demand: (document.getElementById('provide-name-demand')?.textContent || '').trim(),
    }));
    assert.equal(named.card, CARD, 'Name rate card unchanged');
    assert.equal(named.demand, DEMAND, 'Name demand line');

    await page.evaluate(() => { showTf('provide-done'); });
    const setup = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      return {
        faq: (document.getElementById('provide-faq-demand')?.textContent || '').trim(),
        card: (document.getElementById('provide-earn-fine')?.textContent || '').trim(),
        demand: (document.getElementById('provide-earn-demand')?.textContent || '').trim(),
        queueVis: vis(document.getElementById('provide-queue')),
      };
    });
    assert.equal(setup.faq, DEMAND, 'Setup FAQ demand');
    assert.equal(setup.card, CARD, 'Setup rate card unchanged');
    assert.equal(setup.demand, DEMAND, 'Setup demand line');
    assert.equal(setup.queueVis, false, 'queue hidden until live jobs_queued > 0');

    const pulse = await page.evaluate(() => {
      loggedIn = true;
      ownMacOnline = 1;
      provideExpectingNew = false;
      applyJobsQueued({ jobs_queued: 3 });
      paintProvideBeat();
      const busy = {
        beat: (document.getElementById('provide-beat')?.textContent || '').trim(),
        queue: (document.getElementById('provide-queue')?.textContent || '').trim(),
        hidden: document.getElementById('provide-queue')?.hidden === true,
      };
      applyJobsQueued({ jobs_queued: 0 });
      paintProvideBeat();
      const idle = {
        queue: (document.getElementById('provide-queue')?.textContent || '').trim(),
        hidden: document.getElementById('provide-queue')?.hidden === true,
      };
      return { busy, idle, storedIdle: jobsQueued };
    });
    assert.equal(pulse.busy.beat, 'Online');
    assert.equal(pulse.busy.queue, '3 queued');
    assert.equal(pulse.busy.hidden, false);
    assert.equal(pulse.idle.hidden, true, 'hide when jobs_queued is 0');
    assert.equal(pulse.idle.queue, '');
    assert.equal(pulse.storedIdle, 0);
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-provide-earn-demand: PASS');
