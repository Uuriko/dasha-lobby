#!/usr/bin/env node
/** /how-to-buy share card: Buy. No mint-match lecture. No never-opens-a-wallet. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { polishHowtoHtml } from './dasha-lobby-worker.mjs';
import { HOWTO_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const TITLE = 'How to buy $dasha';
const DESC = 'Buy $dasha.';

assert.doesNotMatch(worker, /plugin\.jup\.ag/);
assert.doesNotMatch(worker, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);

function assertShare(html, label) {
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  assert.match(head, /<title>How to buy \$dasha<\/title>/, `${label} title`);
  assert.match(head, /property="og:title" content="How to buy \$dasha"/, `${label} og:title`);
  assert.match(head, /property="og:description" content="Buy \$dasha\."/, `${label} og:desc`);
  assert.match(head, /property="og:url" content="https:\/\/www\.getdasha\.com\/how-to-buy"/, `${label} og:url`);
  assert.match(head, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/, `${label} og:image`);
  assert.match(head, /name="twitter:card" content="summary_large_image"/, `${label} twitter:card`);
  assert.match(head, /name="twitter:title" content="How to buy \$dasha"/, `${label} twitter:title`);
  assert.match(head, /name="twitter:description" content="Buy \$dasha\."/, `${label} twitter:desc`);
  assert.match(head, /name="twitter:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/, `${label} twitter:image`);
  assert.equal((head.match(/property="og:title"/g) || []).length, 1, `${label} one og:title`);
  assert.equal((head.match(/property="og:description"/g) || []).length, 1, `${label} one og:desc`);
  assert.equal((head.match(/name="twitter:title"/g) || []).length, 1, `${label} one twitter:title`);
  assert.doesNotMatch(head, /How to buy \$dasha on Solana/, `${label} no lecture`);
  assert.doesNotMatch(head, /match the full mint/, `${label} no mint lecture`);
  assert.doesNotMatch(head, /never opens a wallet/, `${label} no never-opens`);
  assert.doesNotMatch(head, /plugin\.jup\.ag/, `${label} no plugin.jup`);
  const ogDesc = head.match(/property="og:description" content="([^"]*)"/);
  const twDesc = head.match(/name="twitter:description" content="([^"]*)"/);
  assert.equal(ogDesc?.[1], DESC, `${label} og desc copy`);
  assert.equal(twDesc?.[1], DESC, `${label} twitter desc copy`);
  assert.equal(TITLE, 'How to buy $dasha');
}

assertShare(HOWTO_HTML, 'disk HOWTO_HTML');
assertShare(polishHowtoHtml(HOWTO_HTML), 'polished HOWTO_HTML');
assert.match(HOWTO_HTML, /<h1>How to buy \$dasha<\/h1>/, 'H1 stays');
assert.match(HOWTO_HTML, new RegExp(MINT), 'hers mint');
assert.match(HOWTO_HTML, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112&buy=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/, 'jup swap + mint');
assert.doesNotMatch(HOWTO_HTML, /plugin\.jup\.ag/, 'no plugin.jup');
assert.doesNotMatch(HOWTO_HTML, /<form\b/, 'no form');
assert.doesNotMatch(HOWTO_HTML, /disclaimer|not financial advice|NFA|dyor/i, 'no disclaimer');

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/how-to-buy'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'howto');
const body = await res.text();
assertShare(body, 'served /how-to-buy');
assert.match(body, /<h1>How to buy \$dasha<\/h1>/);
assert.match(body, new RegExp(MINT));
assert.match(body, /jup\.ag\/swap/);
assert.doesNotMatch(body, /plugin\.jup\.ag/);

console.log('dasha-howto-og: PASS (card How to buy $dasha / Buy $dasha., no lecture, jup.ag + mint)');
