#!/usr/bin/env node
/**
 * Start. keeps Ask as the one primary. Quiet API door shows the OpenAI
 * base URL in-page for gateway buyers — no lecture, no pick-build.
 * Click → API. Back → Start. #build cold-lands the same.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag.
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

const BASE = 'https://lobby.getdasha.com/compute/api/v1';

function gateBlock(html) {
  const m = html.match(/<section[^>]*id=["']step-gate["'][^>]*>[\s\S]*?<\/section>/);
  assert.ok(m, 'gate section');
  return m[0];
}

function assertGateApi(html, label) {
  const gate = gateBlock(html);
  assert.match(html, /<h1 class=["']tf-q["']>Start\.<\/h1>/, `${label} first paint Start.`);
  assert.match(gate, /class=["']tf-choice primary[^"']*["'][^>]*id=["']pick-ask["'][^>]*>Do</, `${label} Do stays the one primary`);
  assert.match(gate, /id=["']pick-pay["'][^>]*>Pay</, `${label} Pay stays`);
  assert.match(gate, /id=["']pick-credits["'][^>]*>Credits</, `${label} Credits stays`);
  assert.match(gate, /id=["']gate-ocm["'][^>]*href=["']\/compute\/ocm["']/, `${label} quiet Marketplace → OCM`);
  assert.doesNotMatch(gate, /id=["']gate-ocm["'][^>]*class=["'][^"']*tf-choice/, `${label} Marketplace is not a choice primary`);
  assert.match(gate, /id=["']pick-api["'][^>]*>API</, `${label} quiet API door`);
  assert.match(gate, /id=["']pick-api["'][^>]*class=["']tf-quiet["']|class=["']tf-quiet["'][^>]*id=["']pick-api["']/, `${label} API tf-quiet`);
  assert.match(gate, /title=["']OpenAI-compatible base URL["']/, `${label} API title`);
  assert.doesNotMatch(gate, /id=["']pick-api["'][^>]*class=["'][^"']*tf-choice/, `${label} API is not a choice primary`);
  assert.match(
    gate,
    /id=["']gate-api-base["'][^>]*>https:\/\/lobby\.getdasha\.com\/compute\/api\/v1</,
    `${label} base URL on Start`,
  );
  const startChrome = gate.split(/id=["']compute-faq["']/)[0];
  assert.equal((startChrome.match(/https:\/\/lobby\.getdasha\.com\/compute\/api\/v1/g) || []).length, 1, `${label} URL once on Start chrome`);
  assert.doesNotMatch(gate, /disclaimer|not financial advice|dyor|\bnfa\b|plugin\.jup\.ag/i, `${label} no lecture`);
  assert.doesNotMatch(gate, /buyer-faq|provider-faq|For gateways/, `${label} no FAQ / gateway lecture on Start`);
  assert.doesNotMatch(html, /id=["']pick-build["']/, `${label} no pick-build`);
  assert.match(html, /buildBack='answer'/, `${label} buildBack default answer`);
  assert.match(
    html,
    /pick-api['"]\)\?\.addEventListener\(['"]click['"],\(\)=>\{\s*buildBack='gate';/,
    `${label} pick-api sets buildBack gate`,
  );
  assert.match(html, /id==='build'\)\{buildBack='gate';showTf\(['"]build['"]\)/, `${label} #build cold-lands API`);
  assert.match(
    html,
    /setAttribute\(['"]data-back['"],buildBack==='you'\?'you':buildBack==='gate'\?'gate':'answer'\)/,
    `${label} Build back follows buildBack`,
  );
  assert.match(html, /id=["']code-openai["']/, `${label} OpenAI snippet still on API`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertGateApi(disk, 'disk');
assertGateApi(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertGateApi(await res.text(), 'worker.fetch');

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
        api: vis(document.getElementById('pick-api')),
        apiText: document.getElementById('pick-api')?.textContent || '',
        url: document.getElementById('gate-api-base')?.textContent || '',
        urlVis: vis(document.getElementById('gate-api-base')),
        pay: vis(document.getElementById('pick-pay')),
        credits: vis(document.getElementById('pick-credits')),
        build: vis(document.getElementById('step-build')),
        wallet: !!document.getElementById('earn-wallet-wrap') && vis(document.getElementById('earn-wallet-wrap')),
      };
    });
    assert.equal(first.step, 'gate', 'cold boot Start');
    assert.equal(first.start, 'Start.');
    assert.equal(first.askPrimary, true, 'Ask stays primary');
    assert.equal(first.api, true, 'API door visible logged-out');
    assert.equal(first.apiText, 'API');
    assert.equal(first.url, BASE, 'base URL visible on Start');
    assert.equal(first.urlVis, true, 'base URL painted');
    assert.equal(first.pay, true, 'Pay still on Start');
    assert.equal(first.credits, true, 'Credits still on Start');
    assert.equal(first.build, false, 'API step hidden first paint');
    assert.equal(first.wallet, false, 'wallet stays off Start');

    await page.click('#pick-api');
    const opened = await page.evaluate(() => ({
      step: document.body.dataset.step,
      title: document.querySelector('#step-build .tf-q')?.textContent || '',
      url: document.getElementById('gateway')?.value || '',
      openai: (document.getElementById('code-openai')?.textContent || '').includes('https://lobby.getdasha.com/compute/api/v1'),
      back: document.querySelector('#step-build .tf-back')?.getAttribute('data-back') || '',
      hash: location.hash,
      lead: document.getElementById('compat-lead')?.textContent || '',
    }));
    assert.equal(opened.step, 'build', 'API door opens API.');
    assert.equal(opened.title, 'API.');
    assert.equal(opened.url, BASE, 'gateway input is lobby v1');
    assert.equal(opened.openai, true, 'OpenAI snippet on API.');
    assert.equal(opened.back, 'gate', 'Back from Start API is Start');
    assert.equal(opened.hash, '#build', 'hash #build');
    assert.equal(opened.lead, 'OpenAI-compatible. Change the base URL.');

    await page.click('#step-build .tf-back');
    const back = await page.evaluate(() => ({
      step: document.body.dataset.step,
      start: document.querySelector('#step-gate .tf-q')?.textContent || '',
    }));
    assert.equal(back.step, 'gate', 'Back returns to Start');
    assert.equal(back.start, 'Start.');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-gate-api-base: PASS');
