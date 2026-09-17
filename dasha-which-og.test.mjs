#!/usr/bin/env node
/** /which share card: identity only. dash_eats. Buy. No mint-match lecture. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const OTHER = 'FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8';
const TITLE = 'Which $dasha? dash_eats';
const DESC = 'dash_eats. Buy $dasha.';

assert.doesNotMatch(worker, /plugin\.jup\.ag/);
assert.doesNotMatch(worker, /t\.me\/(?!\+ck9pUjL2ncNiZjRh)/);

function extractConst(name) {
  const m = worker.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(m, `${name} embedded`);
  return m[1];
}

function assertShare(html, label) {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  assert.match(head, /<title>Which \$dasha\? dash_eats<\/title>/, `${label} title`);
  assert.match(head, /property="og:title" content="Which \$dasha\? dash_eats"/, `${label} og:title`);
  assert.match(head, /property="og:description" content="dash_eats\. Buy \$dasha\."/, `${label} og:desc`);
  assert.match(head, /property="og:url" content="https:\/\/www\.getdasha\.com\/which"/, `${label} og:url`);
  assert.match(head, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/, `${label} og:image`);
  assert.match(head, /name="twitter:card" content="summary_large_image"/, `${label} twitter:card`);
  assert.match(head, /name="twitter:title" content="Which \$dasha\? dash_eats"/, `${label} twitter:title`);
  assert.match(head, /name="twitter:description" content="dash_eats\. Buy \$dasha\."/, `${label} twitter:desc`);
  assert.match(head, /name="twitter:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/, `${label} twitter:image`);
  assert.equal((head.match(/property="og:title"/g) || []).length, 1, `${label} one og:title`);
  assert.equal((head.match(/property="og:description"/g) || []).length, 1, `${label} one og:desc`);
  assert.equal((head.match(/name="twitter:title"/g) || []).length, 1, `${label} one twitter:title`);
  assert.doesNotMatch(head, /Match the full Solana mint/, `${label} no mint lecture`);
  assert.doesNotMatch(head, /before using a token link/, `${label} no token-link lecture`);
  assert.doesNotMatch(head, /plugin\.jup\.ag/, `${label} no plugin.jup`);
  const ogDesc = head.match(/property="og:description" content="([^"]*)"/);
  const twDesc = head.match(/name="twitter:description" content="([^"]*)"/);
  assert.equal(ogDesc?.[1], DESC, `${label} og desc copy`);
  assert.equal(twDesc?.[1], DESC, `${label} twitter desc copy`);
  assert.doesNotMatch(ogDesc?.[1] || '', /VVAIFU/, `${label} card desc is hers`);
  assert.doesNotMatch(twDesc?.[1] || '', /VVAIFU/, `${label} twitter desc is hers`);
  assert.equal(TITLE, 'Which $dasha? dash_eats');
}

const which = extractConst('WHICH_HTML');
assertShare(which, 'disk WHICH_HTML');
assert.match(which, /<h1>Which \$dasha\?<\/h1>/, 'H1 identity');
assert.match(which, /<h2>This mint<\/h2>/, 'H2 this mint');
assert.match(which, /VVAIFU/, 'page still names VVAIFU');
assert.match(which, new RegExp(MINT), 'hers mint');
assert.match(which, new RegExp(PAIR), 'Raydium pair');
assert.match(which, new RegExp(OTHER), 'other mint');
{
  const main = (which.match(/<main>[\s\S]*?<\/main>/) || [''])[0];
  const mintAt = main.indexOf(MINT);
  const pairAt = main.indexOf(PAIR);
  const otherAt = main.indexOf(OTHER);
  assert.ok(mintAt >= 0 && pairAt > mintAt && pairAt < otherAt, 'mint + Raydium pair before VVAIFU');
  assert.match(main, /Raydium pair/, 'pair named Raydium in plain text');
}
assert.match(which, /"@type":"FAQPage"/, 'FAQPage stays');
assert.match(which, /jup\.ag\/tokens\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/, 'jup tokens');
assert.match(which, /<p>Compute\. <a href="https:\/\/www\.getdasha\.com\/compute#ask">Use a Mac<\/a> — Hosted when no Mac\. <a href="https:\/\/www\.getdasha\.com\/compute#provide">Provide<\/a><\/p>/, 'quiet Compute Use a Mac Hosted-when-no-Mac door');
assert.doesNotMatch(which, /<form\b/, 'no form');
assert.doesNotMatch(which, /disclaimer|not financial advice|NFA|dyor|not official/i, 'no disclaimer');
assert.doesNotMatch(which, /\b(?:users?|volume)\b/i, 'no invented volume');
assert.doesNotMatch(which, /\b\d+\s+Macs?\b/i, 'no invented Mac count');

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/which'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'which');
const body = await res.text();
assertShare(body, 'served /which');
assert.match(body, /<h1>Which \$dasha\?<\/h1>/);
assert.match(body, /<h2>This mint<\/h2>/);
assert.match(body, /VVAIFU/);
assert.match(body, new RegExp(MINT));
assert.match(body, new RegExp(PAIR));
assert.match(body, new RegExp(OTHER));
{
  const main = (body.match(/<main>[\s\S]*?<\/main>/) || [''])[0];
  const mintAt = main.indexOf(MINT);
  const pairAt = main.indexOf(PAIR);
  const otherAt = main.indexOf(OTHER);
  assert.ok(mintAt >= 0 && pairAt > mintAt && pairAt < otherAt, 'served mint + Raydium pair before VVAIFU');
  assert.match(main, /Raydium pair/, 'served pair named Raydium');
}
assert.match(body, /<p>Compute\. <a href="https:\/\/www\.getdasha\.com\/compute#ask">Use a Mac<\/a> — Hosted when no Mac\. <a href="https:\/\/www\.getdasha\.com\/compute#provide">Provide<\/a><\/p>/, 'served Compute Hosted-when-no-Mac door');
assert.doesNotMatch(body, /plugin\.jup\.ag/);
assert.doesNotMatch(body, /disclaimer|not financial advice|NFA|dyor|not official/i, 'served no disclaimer');
assert.doesNotMatch(body, /\b(?:users?|volume)\b/i, 'served no invented volume');
assert.doesNotMatch(body, /\b\d+\s+Macs?\b/i, 'served no invented Mac count');

console.log('dasha-which-og: PASS (identity card dash_eats / Buy $dasha., mint + Raydium pair before VVAIFU, quiet Compute Ask Hosted-when-no-Mac door, no mint lecture)');
