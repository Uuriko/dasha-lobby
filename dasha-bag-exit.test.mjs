#!/usr/bin/env node
/** /bag exit estimate. Jupiter quote ≠ mark. No plugin.jup.ag. No auto-sell. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import {
  DASHA_DECIMALS,
  EXIT_ROUTE,
  HERS_MINT,
  JUP_QUOTE,
  JUP_QUOTE_FALLBACK,
  SLIPPAGE_BPS,
  USDC,
  WSOL,
  amountToRaw,
  bagExitApi,
  exitReceiptJson,
  exitReceiptMarkdown,
  haircutRaw,
  isBagExitPath,
  jupiterQuoteUrl,
  parseJupQuote,
  quoteExit,
  rawToUi,
} from './dasha-bag-exit.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const exitSrc = readFileSync(join(root, 'dasha-bag-exit.mjs'), 'utf8');

assert.equal(HERS_MINT, '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump');
assert.equal(isBagExitPath('/bag/api/exit'), true);
assert.equal(isBagExitPath('/bag/api/exit/'), true);
assert.equal(isBagExitPath('/bag/api/record'), false);
assert.equal(isBagExitPath('/bag'), false);
assert.equal(DASHA_DECIMALS, 6);
assert.equal(SLIPPAGE_BPS, 50);
assert.equal(amountToRaw('1000'), '1000000000');
assert.equal(amountToRaw('1,000.5'), '1000500000');
assert.equal(amountToRaw('0'), '');
assert.equal(amountToRaw('nope'), '');
assert.equal(rawToUi('11940000', 9), '0.01194');
assert.equal(haircutRaw('12000000', 50, '11940000'), '11940000');
assert.equal(haircutRaw('10000', 50), '9950');

const href = jupiterQuoteUrl(JUP_QUOTE, {
  inputMint: HERS_MINT,
  outputMint: WSOL,
  amount: '1000000000',
});
assert.match(href, /lite-api\.jup\.ag\/swap\/v1\/quote/);
assert.match(href, new RegExp(`inputMint=${HERS_MINT}`));
assert.match(href, new RegExp(`outputMint=${WSOL}`));
assert.doesNotMatch(href, /plugin\.jup\.ag/);
assert.doesNotMatch(JUP_QUOTE_FALLBACK, /plugin\.jup\.ag/);
assert.match(EXIT_ROUTE, new RegExp(`sell=${HERS_MINT}`));
assert.match(EXIT_ROUTE, /jup\.ag\/swap/);
assert.doesNotMatch(EXIT_ROUTE, /plugin\.jup\.ag/);

const parsed = parseJupQuote({
  outAmount: '12000000',
  otherAmountThreshold: '11940000',
  slippageBps: 50,
  priceImpactPct: '0.15',
  platformFee: null,
}, { decimals: 9 });
assert.equal(parsed.haircutUi, '0.01194');
assert.equal(parsed.fee, 'Jupiter quote fee 0');

const receiptRow = {
  asOf: '2026-09-11T06:59:00.000Z',
  mint: HERS_MINT,
  amount: '1000',
  mark: '0.0018',
  exitSol: '0.01194',
  exitUsd: '1.8308',
  fee: 'Jupiter quote fee 0',
  slippageBps: 50,
  impact: '0.15',
  route: EXIT_ROUTE,
};
const md = exitReceiptMarkdown(receiptRow);
assert.match(md, /mark price ≠ exit/);
assert.match(md, /asOf: 2026-09-11T06:59:00.000Z/);
assert.match(md, new RegExp(HERS_MINT));
assert.match(md, /slippage: 50 bps/);
assert.match(md, /Jupiter quote fee 0/);
assert.doesNotMatch(md, /auto-sell|autosell|private key|sign to sell/i);
const js = exitReceiptJson(receiptRow);
assert.match(js, /"note": "mark price ≠ exit"/);
assert.match(js, /2026-09-11T06:59:00.000Z/);

function extractConst(name) {
  const m = workerSrc.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(m, `${name} embedded`);
  return m[1];
}

const bag = extractConst('BAG_HTML');
assert.match(bag, /<section id="exit"/);
assert.match(bag, /Spot \/ mark/);
assert.match(bag, /Mark price ≠ exit\./);
assert.match(bag, /<form id="exit-form" action="\/bag\/api\/exit" method="get">/);
assert.match(bag, /<input id="exit-amount" name="amount"/);
assert.match(bag, /<button type="submit">Estimate<\/button>/);
assert.match(bag, /data-receipt="md">Copy receipt</);
assert.match(bag, /data-receipt="json">JSON</);
assert.match(bag, new RegExp(HERS_MINT));
assert.match(bag, /fetch\('\/bag\/api\/exit\?amount='/);
assert.match(bag, /fetch\('\/price'/);
assert.match(bag, /getTokenAccountsByOwner/);
assert.match(bag, /if \(p\.isConnected === false\) return '';/);
assert.doesNotMatch(bag, /plugin\.jup\.ag/);
assert.doesNotMatch(bag, /auto-sell|autosell|signTransaction|private key|secret key/i);
assert.doesNotMatch(bag, /connect\(\)|request\(\{\s*method:\s*['"]connect/);
assert.doesNotMatch(bag, /disclaimer|not financial advice|NFA|dyor/i);
assert.doesNotMatch(exitSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(exitSrc, /auto-sell|autosell|signTransaction|private key/i);
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

const full = extractConst('LLMS_FULL_TXT');
assert.match(full, /Exit estimate on the page: Jupiter quote for a pasted amount\. Mark price ≠ exit\./);

function solBody() {
  return {
    inputMint: HERS_MINT,
    inAmount: '1000000000',
    outputMint: WSOL,
    outAmount: '12000000',
    otherAmountThreshold: '11940000',
    slippageBps: 50,
    priceImpactPct: '0.15',
    platformFee: null,
  };
}

function usdcBody() {
  return {
    inputMint: HERS_MINT,
    inAmount: '1000000000',
    outputMint: USDC,
    outAmount: '1840000',
    otherAmountThreshold: '1830800',
    slippageBps: 50,
    priceImpactPct: '0.15',
  };
}

function jupFetch(url) {
  const u = String(url);
  assert.doesNotMatch(u, /plugin\.jup\.ag/, 'quote fetch must not hit plugin.jup.ag');
  assert.match(u, /inputMint=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
  if (u.includes('lite-api.jup.ag') && u.includes(WSOL)) {
    return new Response(JSON.stringify(solBody()), { status: 200 });
  }
  if (u.includes('lite-api.jup.ag') && u.includes(USDC)) {
    return new Response(JSON.stringify(usdcBody()), { status: 200 });
  }
  throw new Error(`unexpected ${u}`);
}

const quoted = await quoteExit('1000', jupFetch);
assert.equal(quoted.status, 200);
assert.equal(quoted.body.ok, true);
assert.equal(quoted.body.mint, HERS_MINT);
assert.equal(quoted.body.sol.haircutUi, '0.01194');
assert.equal(quoted.body.usdc.haircutUi, '1.8308');
assert.equal(quoted.body.fee, 'Jupiter quote fee 0');
assert.equal(quoted.body.slippageBps, 50);
assert.match(quoted.body.asOf, /T/);
assert.match(quoted.body.receiptMd, /mark price ≠ exit/);
assert.match(quoted.body.receiptMd, /asOf: /);
assert.match(quoted.body.receiptJson, /"exitSol": "0.01194"/);
assert.doesNotMatch(quoted.body.receiptMd, /auto-sell/i);

const fallbackSeen = [];
const fallbackFetch = async (url) => {
  fallbackSeen.push(String(url));
  const u = String(url);
  assert.doesNotMatch(u, /plugin\.jup\.ag/);
  if (u.includes('lite-api.jup.ag')) return new Response('no', { status: 503 });
  if (u.includes('quote-api.jup.ag') && u.includes(WSOL)) {
    return new Response(JSON.stringify(solBody()), { status: 200 });
  }
  if (u.includes('quote-api.jup.ag') && u.includes(USDC)) {
    return new Response(JSON.stringify(usdcBody()), { status: 200 });
  }
  throw new Error(`unexpected ${u}`);
};
const fell = await quoteExit('1000', fallbackFetch);
assert.equal(fell.body.ok, true);
assert.ok(fallbackSeen.some((u) => u.includes('quote-api.jup.ag/v6/quote')));

const quiet = await quoteExit('1000', async () => new Response('no', { status: 503 }));
assert.equal(quiet.status, 200);
assert.equal(quiet.body.ok, false);
assert.equal(quiet.body.error, 'Quote quiet.');

const bad = await quoteExit('nope', jupFetch);
assert.equal(bad.status, 400);
assert.equal(bad.body.error, 'bad amount');

async function call(url, init = {}, fetchImpl) {
  return bagExitApi(new Request(url, init), {}, fetchImpl);
}

const get = await call('https://www.getdasha.com/bag/api/exit?amount=1000', {}, jupFetch);
assert.equal(get.status, 200);
assert.equal(get.headers.get('access-control-allow-origin'), '*');
assert.equal(get.headers.get('x-dasha-edge'), 'bag-exit');
assert.equal((await get.json()).mint, HERS_MINT);

const post = await call('https://www.getdasha.com/bag/api/exit', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ amount: '1000' }),
}, jupFetch);
assert.equal((await post.json()).ok, true);

const opt = await call('https://www.getdasha.com/bag/api/exit', { method: 'OPTIONS' }, jupFetch);
assert.equal(opt.status, 204);

const missing = await call('https://www.getdasha.com/bag/api/exit', {}, jupFetch);
assert.equal(missing.status, 400);

const put = await call('https://www.getdasha.com/bag/api/exit', { method: 'PUT' }, jupFetch);
assert.equal(put.status, 405);

const boomEnv = { fetch: jupFetch };
for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const page = await edgeWorker.fetch(new Request(`${origin}/bag`), boomEnv);
  assert.equal(page.status, 200, `${origin}/bag`);
  const html = await page.text();
  assert.match(html, /Mark price ≠ exit\./);
  assert.match(html, /<form id="exit-form"/);
  assert.match(html, /Copy receipt/);
  assert.match(html, new RegExp(HERS_MINT));
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(html, /auto-sell|signTransaction|private key/i);

  const api = await edgeWorker.fetch(new Request(`${origin}/bag/api/exit?amount=1000`), boomEnv);
  assert.equal(api.status, 200, `${origin}/bag/api/exit`);
  assert.equal(api.headers.get('x-dasha-edge'), 'bag-exit');
  const body = await api.json();
  assert.equal(body.ok, true);
  assert.equal(body.mint, HERS_MINT);
  assert.doesNotMatch(body.route, /plugin\.jup\.ag/);
}

console.log('dasha-bag-exit: PASS (exit ≠ mark, Jupiter quote, receipt, exact mint, no plugin.jup.ag, no auto-sell)');
