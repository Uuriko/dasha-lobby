#!/usr/bin/env node
/**
 * Buyer one-path on /compute API: OpenAI-compatible base URL snippets.
 * Quiet first-job checklist: Guest dgk_ below, or Sign in. / Copy the key once. / Change the base URL.
 * LiteLLM / LangChain / n8n share lobby v1. $0.05/job stays on Provide, not this block.
 * Quiet gateways line lives on buyer-one-path (not the first-job checklist, not Ask).
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

function firstJobBlock(html) {
  const m = html.match(/<div id=["']buyer-first-job["']>[\s\S]*?<\/div>/);
  assert.ok(m, 'buyer-first-job checklist');
  return m[0];
}

function assertFirstJob(html, label) {
  const job = firstJobBlock(html);
  const block = buyerBlock(html);
  assert.ok(block.includes(job), `${label} checklist sits in buyer-one-path`);
  assert.equal((job.match(/<p\b/g) || []).length, 3, `${label} three lines only`);
  assert.match(job, /Guest dgk_ below, or <a href=["']\/login["']>Sign in<\/a>\./, `${label} Guest dgk_ or Sign in → /login`);
  assert.match(job, /<p class=["']fine["']>Copy the key once\.<\/p>/, `${label} Copy the key once.`);
  assert.match(job, /<p class=["']fine["']>Change the base URL\.<\/p>/, `${label} Change the base URL.`);
  assert.doesNotMatch(job, /For gateways|potter@trydemigod/, `${label} no extra gateway line on checklist`);
  assert.doesNotMatch(job, /\$0\.05\/job/, `${label} no \$0.05/job on checklist`);
  assert.doesNotMatch(job, /\d+\s*Mac|Macs · \d|providers_online=\d/i, `${label} no invented Mac count`);
  assert.doesNotMatch(job, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.equal((html.match(/id=["']buyer-first-job["']/g) || []).length, 1, `${label} checklist once`);
}

function assertBuyerOnePath(html, label) {
  assert.match(html, /id=["']ask-free-fine["'][^>]*>3 free \/ 10 min · then credits\./, `${label} Ask keeps 3-free`);
  assert.match(html, /id=["']code["']>curl https:\/\/lobby\.getdasha\.com\/compute\/api\/v1\/chat\/completions/, `${label} existing curl`);
  assert.match(html, /Authorization: Bearer \$DASHA_API_KEY/, `${label} curl bearer`);

  assertFirstJob(html, label);

  const block = buyerBlock(html);
  assert.match(block, /OpenAI-compatible\. Change the base URL\./, `${label} lead`);
  assert.match(block, /id=["']build-free-fine["'][^>]*>3 free \/ 10 min · then credits\./, `${label} 3-free near snippets`);
  assert.match(block, /id=["']compat-openai-label["'][^>]*>OpenAI</, `${label} OpenAI label`);
  assert.ok(block.includes(`OpenAI(base_url="${BASE}", api_key=os.environ["DASHA_API_KEY"])`), `${label} OpenAI base_url`);
  assert.match(block, /data-copy=["']code-openai["'][^>]*>Copy OpenAI</, `${label} Copy OpenAI`);
  assert.match(block, /id=["']compat-litellm-label["'][^>]*>LiteLLM</, `${label} LiteLLM label`);
  assert.ok(block.includes(`api_base = "${BASE}"`), `${label} LiteLLM api_base`);
  assert.match(block, /data-copy=["']code-litellm["'][^>]*>Copy LiteLLM</, `${label} Copy LiteLLM`);
  assert.match(block, /id=["']compat-langchain-label["'][^>]*>LangChain</, `${label} LangChain label`);
  assert.ok(block.includes(`ChatOpenAI(openai_api_base="${BASE}")`), `${label} LangChain openai_api_base`);
  assert.match(block, /data-copy=["']code-langchain["'][^>]*>Copy LangChain</, `${label} Copy LangChain`);
  assert.match(block, /id=["']compat-n8n-label["'][^>]*>n8n</, `${label} n8n label`);
  assert.ok(block.includes(`OpenAI node · base URL\n${BASE}`), `${label} n8n base URL`);
  assert.match(block, /data-copy=["']code-n8n["'][^>]*>Copy n8n</, `${label} Copy n8n`);
  assert.match(
    block,
    /id=["']buyer-gateways["'][^>]*>For gateways\. <a href=["']https:\/\/t\.me\/\+xB7S8mIQaKFiZjRh["'] target=["']_blank["'] rel=["']noopener noreferrer["']>Telegram<\/a><\/p>/,
    `${label} For gateways. Telegram`,
  );
  assert.doesNotMatch(block, /potter@trydemigod|mailto:potter/, `${label} no demigod mailto`);
  const emails = [...block.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((m) => m[0]);
  assert.deepEqual(emails, [], `${label} no email on buyer block`);
  assert.doesNotMatch(block, /<form\b/i, `${label} no form`);

  const askStart = html.indexOf('id="step-ask"');
  const askEnd = html.indexOf('id="step-market"', askStart);
  assert.ok(askStart >= 0 && askEnd > askStart, `${label} Ask bounds`);
  const ask = html.slice(askStart, askEnd);
  assert.doesNotMatch(ask, /\$0\.05\/job/, `${label} no \$0.05/job on Ask`);
  assert.doesNotMatch(ask, /For gateways|potter@trydemigod/, `${label} gateways line stays off Ask`);

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
    /const openai=\$\(['"]code-openai['"]\);if\(openai\)openai\.textContent='from openai import OpenAI\\nOpenAI\(base_url="'\+base\+'", api_key=os\.environ\["DASHA_API_KEY"\]\)'/,
    `${label} paintCode OpenAI`,
  );
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
      openai: document.getElementById('code-openai')?.textContent || '',
      litellm: document.getElementById('code-litellm')?.textContent || '',
      langchain: document.getElementById('code-langchain')?.textContent || '',
      n8n: document.getElementById('code-n8n')?.textContent || '',
      block: document.getElementById('buyer-one-path')?.innerText || '',
      job: document.getElementById('buyer-first-job')?.innerText || '',
      gateways: document.getElementById('buyer-gateways')?.textContent || '',
      href: document.querySelector('#buyer-gateways a')?.getAttribute('href') || '',
      target: document.querySelector('#buyer-gateways a')?.getAttribute('target') || '',
      rel: document.querySelector('#buyer-gateways a')?.getAttribute('rel') || '',
      signin: document.querySelector('#buyer-first-job a')?.getAttribute('href') || '',
      lines: [...document.querySelectorAll('#buyer-first-job p')].map((p) => p.textContent),
      askStep: document.getElementById('step-ask')?.innerText || '',
    }));
    assert.equal(first.lead, 'OpenAI-compatible. Change the base URL.');
    assert.deepEqual(first.lines, ['Guest dgk_ below, or Sign in.', 'Copy the key once.', 'Change the base URL.']);
    assert.equal(first.signin, '/login');
    assert.doesNotMatch(first.job, /\$0\.05\/job/);
    assert.doesNotMatch(first.job, /\d+\s*Mac/);
    assert.equal(first.free, '3 free / 10 min · then credits.');
    assert.equal(first.ask, '3 free / 10 min · then credits.');
    assert.equal(first.openai, `from openai import OpenAI\nOpenAI(base_url="${BASE}", api_key=os.environ["DASHA_API_KEY"])`);
    assert.equal(first.litellm, `api_base = "${BASE}"`);
    assert.equal(first.langchain, `ChatOpenAI(openai_api_base="${BASE}")`);
    assert.equal(first.n8n, `OpenAI node · base URL\n${BASE}`);
    assert.equal(first.gateways, 'For gateways. Telegram');
    assert.equal(first.href, 'https://t.me/+xB7S8mIQaKFiZjRh');
    assert.equal(first.target, '_blank');
    assert.equal(first.rel, 'noopener noreferrer');
    assert.doesNotMatch(first.job, /For gateways|potter@trydemigod/);
    assert.doesNotMatch(first.askStep, /\$0\.05\/job/);
    assert.doesNotMatch(first.askStep, /For gateways|potter@trydemigod/);
    assert.doesNotMatch(first.block, /\$0\.05\/job/);

    const painted = await page.evaluate(() => {
      const g = document.getElementById('gateway');
      g.value = 'https://example.test/v1/';
      paintCode();
      return {
        curl: document.getElementById('code')?.textContent || '',
        openai: document.getElementById('code-openai')?.textContent || '',
        litellm: document.getElementById('code-litellm')?.textContent || '',
        langchain: document.getElementById('code-langchain')?.textContent || '',
        n8n: document.getElementById('code-n8n')?.textContent || '',
      };
    });
    assert.match(painted.curl, /curl https:\/\/example\.test\/v1\/chat\/completions/);
    assert.equal(painted.openai, 'from openai import OpenAI\nOpenAI(base_url="https://example.test/v1", api_key=os.environ["DASHA_API_KEY"])');
    assert.equal(painted.litellm, 'api_base = "https://example.test/v1"');
    assert.equal(painted.langchain, 'ChatOpenAI(openai_api_base="https://example.test/v1")');
    assert.equal(painted.n8n, 'OpenAI node · base URL\nhttps://example.test/v1');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-buyer-one-path: PASS');
