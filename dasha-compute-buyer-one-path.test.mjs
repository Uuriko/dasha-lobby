#!/usr/bin/env node
/**
 * Buyer one-path on /compute API: OpenAI-compatible base URL snippets.
 * LiteLLM / LangChain / n8n share lobby v1. $0.05/job stays on Provide, not this block.
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

function buyerBlock(html) {
  const m = html.match(/<section id=["']buyer-one-path["']>[\s\S]*?<\/section>/);
  assert.ok(m, 'buyer-one-path section');
  return m[0];
}

function assertBuyerOnePath(html, label) {
  assert.match(html, /id=["']ask-free-fine["'][^>]*>3 free \/ 10 min · then credits\./, `${label} Ask keeps 3-free`);
  assert.match(html, /id=["']code["']>curl https:\/\/lobby\.getdasha\.com\/compute\/api\/v1\/chat\/completions/, `${label} existing curl`);
  assert.match(html, /Authorization: Bearer \$DASHA_API_KEY/, `${label} curl bearer`);

  const block = buyerBlock(html);
  assert.match(block, /OpenAI-compatible\. Change the base URL\./, `${label} lead`);
  assert.match(block, /id=["']build-free-fine["'][^>]*>3 free \/ 10 min · then credits\./, `${label} 3-free near snippets`);
  assert.match(block, /id=["']compat-litellm-label["'][^>]*>LiteLLM</, `${label} LiteLLM label`);
  assert.match(block, /id=["']code-litellm["'][^>]*>api_base = "${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"/, `${label} LiteLLM api_base`);
  assert.match(block, /data-copy=["']code-litellm["'][^>]*>Copy LiteLLM</, `${label} Copy LiteLLM`);
  assert.match(block, /id=["']compat-langchain-label["'][^>]*>LangChain</, `${label} LangChain label`);
  assert.match(block, /id=["']code-langchain["'][^>]*>ChatOpenAI\(openai_api_base="${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\)/, `${label} LangChain openai_api_base`);
  assert.match(block, /data-copy=["']code-langchain["'][^>]*>Copy LangChain</, `${label} Copy LangChain`);
  assert.match(block, /id=["']compat-n8n-label["'][^>]*>n8n</, `${label} n8n label`);
  assert.match(block, /id=["']code-n8n["'][^>]*>OpenAI node · base URL\n${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/, `${label} n8n base URL`);
  assert.match(block, /data-copy=["']code-n8n["'][^>]*>Copy n8n</, `${label} Copy n8n`);

  assert.doesNotMatch(block, /\$0\.05\/job/, `${label} no provider payout on buyer block`);
  assert.doesNotMatch(block, /\$0\.01\/1k/, `${label} no provider token rate on buyer block`);
  assert.doesNotMatch(block, /not official/i, `${label} no not-official`);
  assert.doesNotMatch(block, /disclaimer/i, `${label} no disclaimer`);
  assert.doesNotMatch(block, /free-qwen/i, `${label} no fake free-qwen`);
  assert.doesNotMatch(block, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(block, /tok\/s/, `${label} no hardcoded tok\/s`);
  assert.doesNotMatch(block, /providers_online=\d/, `${label} no hardcoded Mac count`);

  assert.match(html, /id=["']earn-rates["'][^>]*>\$0\.05\/job/, `${label} Provide still shows earn rates`);
  assert.match(html, /id=["']step-ask["'][\s\S]*?id=["']ask-free-fine["']/, `${label} Ask 3-free stays in Ask`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} page no plugin`);

  assert.match(
    html,
    /const litellm=\$\(['"]code-litellm['"]\);if\(litellm\)litellm\.textContent='api_base = "'\+base\+'"'/,
    `${label} paintCode LiteLLM`,
  );
  assert.match(
    html,
    /const langchain=\$\(['"]code-langchain['"]\);if\(langchain\)langchain\.textContent='ChatOpenAI\(openai_api_base="'\+base\+'"\)'/,
    `${label} paintCode LangChain`,
  );
  assert.match(
    html,
    /const n8n=\$\(['"]code-n8n['"]\);if\(n8n\)n8n\.textContent='OpenAI node · base URL\\n'\+base/,
    `${label} paintCode n8n`,
  );
}

assertBuyerOnePath(disk, 'disk');
assertBuyerOnePath(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertBuyerOnePath(await res.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    const first = await page.evaluate(() => ({
      lead: document.getElementById('compat-lead')?.textContent || '',
      free: document.getElementById('build-free-fine')?.textContent || '',
      ask: document.getElementById('ask-free-fine')?.textContent || '',
      litellm: document.getElementById('code-litellm')?.textContent || '',
      langchain: document.getElementById('code-langchain')?.textContent || '',
      n8n: document.getElementById('code-n8n')?.textContent || '',
      block: document.getElementById('buyer-one-path')?.innerText || '',
    }));
    assert.equal(first.lead, 'OpenAI-compatible. Change the base URL.');
    assert.equal(first.free, '3 free / 10 min · then credits.');
    assert.equal(first.ask, '3 free / 10 min · then credits.');
    assert.equal(first.litellm, `api_base = "${BASE}"`);
    assert.equal(first.langchain, `ChatOpenAI(openai_api_base="${BASE}")`);
    assert.equal(first.n8n, `OpenAI node · base URL\n${BASE}`);
    assert.doesNotMatch(first.block, /\$0\.05\/job/);

    const painted = await page.evaluate(() => {
      const g = document.getElementById('gateway');
      g.value = 'https://example.test/v1/';
      paintCode();
      return {
        curl: document.getElementById('code')?.textContent || '',
        litellm: document.getElementById('code-litellm')?.textContent || '',
        langchain: document.getElementById('code-langchain')?.textContent || '',
        n8n: document.getElementById('code-n8n')?.textContent || '',
      };
    });
    assert.match(painted.curl, /curl https:\/\/example\.test\/v1\/chat\/completions/);
    assert.equal(painted.litellm, 'api_base = "https://example.test/v1"');
    assert.equal(painted.langchain, 'ChatOpenAI(openai_api_base="https://example.test/v1")');
    assert.equal(painted.n8n, 'OpenAI node · base URL\nhttps://example.test/v1');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-buyer-one-path: PASS');
