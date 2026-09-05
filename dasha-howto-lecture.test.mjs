#!/usr/bin/env node
/** /how-to-buy leftover lecture: no VVAIFU, no never-opens-a-wallet, no unverified disclaimer. */
import assert from 'node:assert/strict';
import edgeWorker, { polishHowtoHtml } from './dasha-lobby-worker.mjs';
import { HOWTO_HTML } from './dasha-lobby-static-gen.mjs';

const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

function bodyOf(html) {
  const noScript = String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  return noScript;
}

const out = polishHowtoHtml(HOWTO_HTML);
const body = bodyOf(out);
assert.match(out, /<h1>How to buy \$dasha<\/h1>/);
assert.match(out, new RegExp(MINT));
assert.match(out, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112&buy=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
assert.doesNotMatch(out, /plugin\.jup\.ag/);
assert.doesNotMatch(body, /VVAIFU/);
assert.doesNotMatch(body, /CoinGecko/);
assert.doesNotMatch(body, /never opens a wallet/);
assert.doesNotMatch(body, /nobody here can promise/);
assert.doesNotMatch(body, /flag this token as unverified/);
assert.doesNotMatch(body, /taking this page/);
assert.doesNotMatch(body, /not financial advice|NFA|dyor/i);
assert.match(body, /SOL → mint → Buy\./);
assert.match(body, /Fund any Solana wallet you control\./);
assert.match(body, /Copy the whole mint\./);
assert.match(body, />On-chain</);
assert.doesNotMatch(body, /Review the route there before confirming/);
assert.doesNotMatch(body, /finalized commitment/);
assert.doesNotMatch(body, /Read from the Solana mint account/);
assert.doesNotMatch(body, /before confirming/);
assert.match(body, /Opens Jupiter with SOL selling into the exact mint above\./);
assert.match(body, />Buy on Jupiter/);

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/how-to-buy'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'howto');
const served = bodyOf(await res.text());
assert.doesNotMatch(served, /VVAIFU/);
assert.doesNotMatch(served, /never opens a wallet/);
assert.doesNotMatch(served, /nobody here can promise/);
assert.match(served, /SOL → mint → Buy\./);
assert.match(served, new RegExp(MINT));
assert.match(served, /jup\.ag\/swap/);
assert.doesNotMatch(served, /Review the route there before confirming/);
assert.doesNotMatch(served, /finalized commitment/);
assert.match(served, /Opens Jupiter with SOL selling into the exact mint above\./);

const llms = await edgeWorker.fetch(new Request('https://www.getdasha.com/llms-full.txt'), {});
assert.equal(llms.status, 200);
const full = await llms.text();
assert.match(full, /How to buy: SOL → mint → Buy\./);
assert.doesNotMatch(full, /fund SOL, match the full mint/);
assert.doesNotMatch(full, /does not execute or custody the swap/);
assert.doesNotMatch(full, /plugin\.jup\.ag/);

console.log('dasha-howto-lecture: PASS');
