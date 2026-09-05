#!/usr/bin/env node
/** /digest share card: tape. Live tick in og:description when Worker has one. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import {
  DEFAULT,
  DIGEST_DESC,
  DIGEST_OG_IMAGE,
  DIGEST_TITLE,
  DIGEST_URL,
  JUP_BUY,
  MINT,
  PAIR,
  digestOgDescription,
  digestPageHtml,
} from './dasha-digest.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

assert.equal(DIGEST_TITLE, '$dasha Tape');
assert.equal(DIGEST_DESC, 'Tick. Room. Buy.');
assert.equal(DIGEST_URL, 'https://www.getdasha.com/digest');
assert.equal(DIGEST_OG_IMAGE, 'https://lobby.getdasha.com/og/dasha-social-card.png');
assert.equal(digestOgDescription(null), DIGEST_DESC);
assert.equal(digestOgDescription({}), DIGEST_DESC);
assert.equal(digestOgDescription({ kind: 'news', title: 'nope', href: 'https://example.com', source: 'X' }), DIGEST_DESC);

const liveTick = {
  source: 'Dexscreener',
  kind: 'tape',
  title: '$dasha $0.0012345 · 12.3% 24h · liq $99000.50',
  href: `https://dexscreener.com/solana/${PAIR.toLowerCase()}`,
  at: '2026-08-27T21:00:00.000Z',
};
assert.equal(digestOgDescription(liveTick), liveTick.title);

function assertShare(html, label, desc) {
  assert.match(html, /<title>\$dasha Tape<\/title>/, `${label} title`);
  assert.match(html, /property="og:title" content="\$dasha Tape"/, `${label} og:title`);
  assert.match(html, new RegExp(`property="og:description" content="${desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `${label} og:desc`);
  assert.match(html, /property="og:url" content="https:\/\/www\.getdasha\.com\/digest"/, `${label} og:url`);
  assert.match(html, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/, `${label} og:image`);
  assert.match(html, /name="twitter:card" content="summary_large_image"/, `${label} twitter:card`);
  assert.match(html, /name="twitter:title" content="\$dasha Tape"/, `${label} twitter:title`);
  assert.match(html, new RegExp(`name="twitter:description" content="${desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), `${label} twitter:desc`);
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [html])[0];
  assert.doesNotMatch(head, /Studio|\/studio/i, `${label} no Studio on card`);
  assert.doesNotMatch(head, /plugin\.jup\.ag/, `${label} no plugin.jup`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup body`);
  assert.doesNotMatch(html, /not an airdrop|not earn|not advice|disclaimer/i, `${label} no lecture`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112/, `${label} jup.ag`);
  assert.match(html, /id="dasha-digest"/, `${label} tape`);
  assert.match(html, />Buy</, `${label} Buy`);
}

assertShare(digestPageHtml(DEFAULT.items), 'static card', DIGEST_DESC);
assertShare(digestPageHtml(DEFAULT.items, { tick: null }), 'null tick', DIGEST_DESC);
assertShare(digestPageHtml(DEFAULT.items, { tick: liveTick }), 'live tick', liveTick.title);

function tapeH2(html) {
  const sec = (String(html).match(/<section id="dasha-digest">[\s\S]*?<\/section>/) || [''])[0];
  return (sec.match(/<h2>[\s\S]*?<\/h2>/) || [''])[0];
}
{
  const page = digestPageHtml(DEFAULT.items);
  assert.match(tapeH2(page), /<h2>Tape\.<\/h2>/, 'digest page H2 is Tape. no leftover /digest');
  assert.doesNotMatch(tapeH2(page), /href=["']\/digest["']/, 'digest page has no self-link');
}

assert.match(workerSrc, /digestPageHtml\(pack\.items, \{ tick: pack\.tick \}\)/);
assert.match(workerSrc, /tick: pack\.tick/);
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

{
  const page = await edgeWorker.fetch(new Request('https://www.getdasha.com/digest'), {});
  assert.equal(page.status, 200, '/digest 200');
  assert.equal(page.headers.get('x-dasha-edge'), 'digest');
  const html = await page.text();
  assert.match(html, /property="og:title" content="\$dasha Tape"/);
  assert.match(html, /property="og:url" content="https:\/\/www\.getdasha\.com\/digest"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:title" content="\$dasha Tape"/);
  const desc = (html.match(/property="og:description" content="([^"]+)"/) || [])[1] || '';
  assert.ok(desc === DIGEST_DESC || /^\$dasha \$/.test(desc), 'served desc is static card or live tick');
  assert.match(html, /name="twitter:description" content="/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.match(html, new RegExp(MINT));
  assert.match(html, new RegExp(JUP_BUY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(tapeH2(html), /<h2>Tape\.<\/h2>/, 'served /digest H2 is Tape.');
  assert.doesNotMatch(tapeH2(html), /href=["']\/digest["']/, 'served /digest no self-link');
}

{
  const json = await edgeWorker.fetch(new Request('https://www.getdasha.com/digest.json'), {});
  assert.equal(json.status, 200, '/digest.json 200');
  const pack = await json.json();
  assert.ok('tick' in pack, 'tick field stays even when Dex is down');
  if (pack.tick) {
    assert.equal(pack.tick.kind, 'tape');
    assert.match(pack.tick.title, /\$dasha \$/);
  }
}

const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
assert.equal(studio.status, 308);
assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');

console.log('dasha-digest-share: PASS (tape OG, live tick desc, static fallback, tick field stays, no leftover /digest self-link)');
