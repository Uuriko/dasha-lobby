#!/usr/bin/env node
/**
 * Instinct #1: Provider FAQ + buyer quickstart on live /compute.
 * Buyer Q/A + OpenAI snippet sit in #buyer-one-path (near Ask / API).
 * Provider FAQ sits on Setup. $0.05/job is Provider Earn, not a buyer price.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag. No home first paint.
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

const BUYER_LINES = [
  'How do I ask? Sign in. Change the base URL. https://lobby.getdasha.com/compute/api/v1',
  'What is live? The Mac that is advertising. Read /compute/api/network.',
  'What if no Mac is online? Hosted is still there.',
  'Community spends credits. Your Mac is free.',
  'Key cap $5 / month · 402 after.',
];

const PROVIDER_LINES = [
  '$0.05/job is Provider Earn. Not the buyer price.',
  'Mac · Apple Silicon · Ollama ≥0.33.1 · python3 · 15–30 min.',
  'Sign in. Name it. Register. Run Setup.',
  'USDC · $dasha +10% · wallet to get paid.',
  'No inbound. Token 0600. You revoke it.',
  "Jobs cross your Mac. Don't put secrets. No attestation in alpha.",
  'Offline: drop from advertise. No penalty. Earn only for served jobs.',
  'dasha-compute status · doctor · benchmark · logs · restart · uninstall',
];

function buyerBlock(html) {
  const m = html.match(/<section id=["']buyer-one-path["']>[\s\S]*?<\/section>/);
  assert.ok(m, 'buyer-one-path section');
  return m[0];
}

function buyerFaq(html) {
  const m = html.match(/<div id=["']buyer-faq["']>[\s\S]*?<\/div>/);
  assert.ok(m, 'buyer-faq');
  return m[0];
}

function providerFaq(html) {
  const m = html.match(/<section id=["']provider-faq["']>[\s\S]*?<\/section>/);
  assert.ok(m, 'provider-faq');
  return m[0];
}

function askBlock(html) {
  const start = html.indexOf('id="step-ask"');
  const end = html.indexOf('id="step-market"', start);
  assert.ok(start >= 0 && end > start, 'Ask section bounds');
  return html.slice(start, end);
}

function gateBlock(html) {
  const m = html.match(/<section[^>]*id=["']step-gate["'][^>]*>[\s\S]*?<\/section>/);
  assert.ok(m, 'gate section');
  return m[0];
}

function assertFaqQuickstart(html, label) {
  const block = buyerBlock(html);
  const faq = buyerFaq(html);
  const provide = providerFaq(html);
  const ask = askBlock(html);
  const gate = gateBlock(html);

  assert.ok(block.includes(faq), `${label} buyer FAQ sits in buyer-one-path`);
  assert.match(html, /id=["']step-provide-done["'][\s\S]*?id=["']provider-faq["']/, `${label} Provider FAQ on Setup`);
  assert.doesNotMatch(ask, /id=["']buyer-faq["']/, `${label} FAQ not a new Ask wall`);
  assert.doesNotMatch(gate, /buyer-faq|provider-faq/, `${label} FAQ off gate first paint`);

  assert.match(faq, /id=["']buyer-faq-ask["'][^>]*>How do I ask\? Sign in\. Change the base URL\. https:\/\/lobby\.getdasha\.com\/compute\/api\/v1</, `${label} buyer how`);
  assert.match(faq, /id=["']buyer-faq-live["'][^>]*>What is live\? The Mac that is advertising\. Read \/compute\/api\/network\.</, `${label} buyer live`);
  assert.match(faq, /id=["']buyer-faq-hosted["'][^>]*>What if no Mac is online\? Hosted is still there\.</, `${label} buyer hosted`);
  assert.match(faq, /id=["']buyer-faq-credits["'][^>]*>Community spends credits\. Your Mac is free\.</, `${label} buyer credits`);
  assert.match(faq, /id=["']buyer-faq-cap["'][^>]*>Key cap \$5 \/ month · 402 after\.</, `${label} buyer cap`);
  assert.equal((faq.match(/<p\b/g) || []).length, BUYER_LINES.length, `${label} buyer FAQ line count`);

  assert.match(block, /id=["']compat-openai-label["'][^>]*>OpenAI</, `${label} OpenAI label`);
  assert.ok(block.includes(`from openai import OpenAI\nOpenAI(base_url="${BASE}", api_key=os.environ["DASHA_API_KEY"])`), `${label} OpenAI snippet`);
  assert.match(block, /data-copy=["']code-openai["'][^>]*>Copy OpenAI</, `${label} Copy OpenAI`);
  assert.match(
    html,
    /const openai=\$\(['"]code-openai['"]\);if\(openai\)openai\.textContent='from openai import OpenAI\\nOpenAI\(base_url="'\+base\+'", api_key=os\.environ\["DASHA_API_KEY"\]\)'/,
    `${label} paintCode OpenAI`,
  );

  assert.doesNotMatch(block, /\$0\.05\/job/, `${label} no Provider Earn on buyer block`);
  assert.doesNotMatch(block, /\$0\.01\/1k/, `${label} no provider token rate on buyer block`);
  assert.doesNotMatch(ask, /\$0\.05\/job/, `${label} no \$0.05/job on Ask`);
  assert.doesNotMatch(faq, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(faq, /\d+\s*Mac|Macs · \d|providers_online=\d/i, `${label} no invented Mac count`);
  assert.doesNotMatch(faq, /always on|always-on|always free|free-qwen/i, `${label} no always-on model`);
  assert.doesNotMatch(block, /id=["']code-python["']|id=["']code-javascript["']/, `${label} no leftover snippet ids`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);

  assert.match(provide, /id=["']provide-faq-earn["'][^>]*>\$0\.05\/job is Provider Earn\. Not the buyer price\.</, `${label} Earn distinction`);
  assert.match(provide, /id=["']provide-faq-need["'][^>]*>Mac · Apple Silicon · Ollama ≥0\.33\.1 · python3 · 15–30 min\.</, `${label} need`);
  assert.match(provide, /id=["']provide-faq-enroll["'][^>]*>Sign in\. Name it\. Register\. Run Setup\.</, `${label} enroll`);
  assert.match(provide, /id=["']provide-faq-wallet["'][^>]*>USDC · \$dasha \+10% · wallet to get paid\.</, `${label} wallet`);
  assert.match(provide, /id=["']provide-faq-safe["'][^>]*>No inbound\. Token 0600\. You revoke it\.</, `${label} safe`);
  assert.match(provide, /id=["']provide-faq-jobs["'][^>]*>Jobs cross your Mac\. Don't put secrets\. No attestation in alpha\.</, `${label} jobs`);
  assert.match(provide, /id=["']provide-faq-offline["'][^>]*>Offline: drop from advertise\. No penalty\. Earn only for served jobs\.</, `${label} offline`);
  assert.match(provide, /id=["']provide-faq-cmds["'][^>]*>dasha-compute status · doctor · benchmark · logs · restart · uninstall</, `${label} cmds`);
  assert.equal((provide.match(/<p\b/g) || []).length, PROVIDER_LINES.length, `${label} provider FAQ line count`);
  assert.doesNotMatch(provide, /disclaimer|not financial advice/i, `${label} provide no lecture`);
  assert.doesNotMatch(provide, /\d+\s*Mac|providers_online=\d/i, `${label} provide no invented Mac count`);

  assert.match(html, /id=["']earn-rates["'][^>]*>\$0\.05\/job/, `${label} Earn rates stay`);
  assert.match(html, /id=["']provide-earn-fine["'][^>]*>\$0\.05\/job/, `${label} Provide earn fine stays`);
  assert.equal((html.match(/id=["']buyer-faq["']/g) || []).length, 1, `${label} buyer FAQ once`);
  assert.equal((html.match(/id=["']provider-faq["']/g) || []).length, 1, `${label} provider FAQ once`);
}

assertFaqQuickstart(disk, 'disk');
assertFaqQuickstart(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertFaqQuickstart(await res.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    const first = await page.evaluate(() => {
      const vis = (el) => !!(el && el.offsetParent !== null && getComputedStyle(el).display !== 'none');
      const text = (id) => (document.getElementById(id)?.textContent || '').trim();
      return {
        gate: document.body?.dataset?.step || '',
        buyerFaqVis: vis(document.getElementById('buyer-faq')),
        providerFaqVis: vis(document.getElementById('provider-faq')),
        askHasEarn: (document.getElementById('step-ask')?.innerText || '').includes('$0.05/job'),
        buyer: [...document.querySelectorAll('#buyer-faq p')].map((p) => p.textContent),
        provide: [...document.querySelectorAll('#provider-faq p')].map((p) => p.textContent),
        openai: text('code-openai'),
        earn: text('provide-faq-earn'),
      };
    });
    assert.equal(first.gate, 'gate');
    assert.equal(first.buyerFaqVis, false, 'buyer FAQ hidden on gate first paint');
    assert.equal(first.providerFaqVis, false, 'provider FAQ hidden on gate first paint');
    assert.equal(first.askHasEarn, false, 'Ask has no $0.05/job');
    assert.deepEqual(first.buyer, BUYER_LINES);
    assert.deepEqual(first.provide, PROVIDER_LINES);
    assert.equal(first.openai, `from openai import OpenAI\nOpenAI(base_url="${BASE}", api_key=os.environ["DASHA_API_KEY"])`);
    assert.equal(first.earn, '$0.05/job is Provider Earn. Not the buyer price.');
    assert.doesNotMatch(first.buyer.join('\n'), /\$0\.05\/job/);
    assert.doesNotMatch(first.buyer.join('\n'), /\d+\s*Mac/);

    const painted = await page.evaluate(() => {
      const g = document.getElementById('gateway');
      g.value = 'https://example.test/v1/';
      paintCode();
      return document.getElementById('code-openai')?.textContent || '';
    });
    assert.equal(painted, 'from openai import OpenAI\nOpenAI(base_url="https://example.test/v1", api_key=os.environ["DASHA_API_KEY"])');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-faq-quickstart: PASS');
