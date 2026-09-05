#!/usr/bin/env node
/**
 * Leftover after hidden home chrome strip.
 * First class (dasha-nav / Simp-in-menu on lobby, faucet, login, how-to-buy) is dry.
 * Leftover class: footer featuring Studio/Desk/Verse/Learn/Forum as products.
 * Live chess footer still listed Forum. How-to-buy strip left · holes for Chess/Desk.
 * Potter lock: Simp out of Menu/footer. Quiz #simp-door stays. Disk only. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  polishHowtoHtml,
  stripDeadNav,
  stripLeftoverProductFooter,
} from './dasha-lobby-worker.mjs';
import { CHESS_PAGE_HTML, HOWTO_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripLeftoverProductFooter/);
assert.match(workerSrc, /out = stripLeftoverProductFooter\(out\);/);
assert.match(workerSrc, /stripLeftoverProductFooter\(stripRetiredProductDoors/);
assert.match(
  workerSrc,
  /Dasha never collects seed phrases, private keys, DMs, email, phone numbers, or payment cards\./,
);
assert.match(workerSrc, /path === '\/digest\.json'/);
assert.match(workerSrc, /applyDigestTape/);

function footerChunks(html) {
  return [...String(html).matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi)].map((m) => m[0]);
}

function productHrefs(chunk) {
  return [...String(chunk).matchAll(/href=(["'])(.*?)\1/gi)]
    .map((m) => m[2])
    .filter((h) => /(?:^|getdasha\.com)\/(?:forum|studio|desk|verse|learn|dasha)(?:[/?#]|$)/i.test(h));
}

function hasEmptyDots(chunk) {
  return /·\s*·/.test(chunk) || /<(?:p|div)[^>]*>\s*·/.test(chunk);
}

const LIVE_CHESS_FOOT = '<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump" target="_blank" rel="noopener noreferrer">Buy</a> · <a href="https://www.getdasha.com/chess">Chess</a> · <a href="https://www.getdasha.com/forum">Forum</a> · <a href="https://www.getdasha.com/bag">Bag</a> · <a href="https://t.me/+xB7S8mIQaKFiZjRh" target="_blank" rel="noopener noreferrer">Telegram</a></p></footer>';
const LIVE_HOWTO_HOLES = '<footer><p><a href="/">Home</a> · <a href="/lobby">Lobby</a> · <a href="/faucet">Faucet</a> ·  ·  · <a href="/privacy">Privacy</a> · <a href="https://x.com/dash_eats" target="_blank" rel="noopener noreferrer">@dash_eats ↗</a></p></footer>';
const LIVE_PRODUCTS = '<footer><p><a href="/studio">Studio</a> · <a href="/desk">Desk</a> · <a href="/verse">Verse</a> · <a href="/learn">Learn</a> · <a href="/forum">Forum</a> · <a href="/privacy">Privacy</a></p></footer>';

assert.ok(footerChunks(LIVE_CHESS_FOOT).some((f) => productHrefs(f).length), 'fixture chess footer lists Forum');
assert.ok(hasEmptyDots(LIVE_HOWTO_HOLES), 'fixture howto footer has leftover · holes');

const chessGone = stripLeftoverProductFooter(LIVE_CHESS_FOOT);
assert.deepEqual(footerChunks(chessGone).flatMap(productHrefs), [], 'drops Forum from chess footer');
assert.match(chessGone, /href="https:\/\/www\.getdasha\.com\/bag">Bag</, 'keeps Bag');
assert.match(chessGone, />Buy</, 'keeps Buy');
assert.doesNotMatch(chessGone, /Forum/, 'no Forum word in chess footer');
assert.ok(!hasEmptyDots(chessGone), 'no leftover · after Forum drop');

const howtoGone = stripLeftoverProductFooter(LIVE_HOWTO_HOLES);
assert.ok(!hasEmptyDots(howtoGone), 'collapses leftover · holes');
assert.match(howtoGone, /href="\/privacy">Privacy</, 'keeps Privacy');
assert.match(howtoGone, /@dash_eats/, 'keeps @dash_eats');

const productsGone = stripLeftoverProductFooter(LIVE_PRODUCTS);
assert.deepEqual(footerChunks(productsGone).flatMap(productHrefs), [], 'drops Studio/Desk/Verse/Learn/Forum');
assert.match(productsGone, /href="\/privacy">Privacy</, 'keeps Privacy');
assert.doesNotMatch(productsGone, /Studio|Desk|Verse|Learn|Forum/);

assert.deepEqual(footerChunks(CHESS_PAGE_HTML).flatMap(productHrefs), [], 'disk chess footer has no leftover products');
assert.doesNotMatch(footerChunks(CHESS_PAGE_HTML).join(''), /Forum/, 'disk chess footer has no Forum word');
assert.doesNotMatch(CHESS_PAGE_HTML, /ask-forum/);
assert.doesNotMatch(CHESS_PAGE_HTML, /getdasha\.com\/forum/);
assert.doesNotMatch(CHESS_PAGE_HTML, />Forum</);
assert.ok(!footerChunks(HOWTO_HTML).some(hasEmptyDots), 'disk howto footer has no · holes');
assert.deepEqual(footerChunks(HOWTO_HTML).flatMap(productHrefs), [], 'disk howto footer has no leftover products');
assert.doesNotMatch(polishHowtoHtml(HOWTO_HTML + LIVE_PRODUCTS), /href="\/(?:forum|studio|desk|verse|learn|dasha)"/);

{
  const chess = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess'), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get('x-dasha-edge'), 'chess');
  const html = await chess.text();
  assert.deepEqual(footerChunks(html).flatMap(productHrefs), [], 'served chess footer has no leftover products');
  assert.doesNotMatch(footerChunks(html).join(''), /Forum/, 'served chess footer has no Forum word');
  assert.doesNotMatch(html, /ask-forum/, 'served chess drops leftover Forum door');
  assert.doesNotMatch(html, /getdasha\.com\/forum/, 'served chess has no /forum href');
  assert.doesNotMatch(html, />Forum</, 'served chess has no Forum word');
  assert.match(html, /jup\.ag\/swap/, 'chess jup.ag');
  assert.match(html, new RegExp(MINT), 'chess mint');
  assert.doesNotMatch(html, /plugin\.jup\.ag/, 'no plugin.jup.ag');
}

{
  const howto = await edgeWorker.fetch(new Request('https://www.getdasha.com/how-to-buy'), {});
  assert.equal(howto.status, 200);
  assert.equal(howto.headers.get('x-dasha-edge'), 'howto');
  const html = await howto.text();
  assert.deepEqual(footerChunks(html).flatMap(productHrefs), [], 'served howto footer has no leftover products');
  assert.ok(!footerChunks(html).some(hasEmptyDots), 'served howto footer has no · holes');
  assert.match(html, /jup\.ag\/swap/, 'howto jup.ag');
  assert.match(html, new RegExp(MINT), 'howto mint');
  assert.doesNotMatch(html, /plugin\.jup\.ag/, 'no plugin.jup.ag');
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
}

{
  const fixture = `<!doctype html><html><head><title>$dasha</title></head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<nav class="dasha-nav"><a href="/simp">simp</a></nav>
<section id="simp-door" aria-labelledby="simp-title"><h2 id="simp-title">Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section>
<section id="grwm" aria-label="Get ready with me"></section>
<footer><p><a href="/simp">Simp</a> · <a href="/studio">Studio</a> · <a href="/dasha">Desk</a> · <a href="/forum">Forum</a> · <a href="/privacy">Privacy</a></p></footer>
</body></html>`;
  const html = stripDeadNav(fixture);
  assert.doesNotMatch(html, /<nav class="dasha-nav">/, 'home still no leftover dasha-nav');
  assert.doesNotMatch(html, /id=["']compute-door["']/, 'home still no compute-door');
  assert.match(html, /id=["']simp-door["']/, 'quiz door stays');
  assert.match(html, /<header class="bar">/, 'keeps header.bar');
  assert.match(html, /\$<b>dasha<\/b>/, 'first paint $dasha');
  assert.match(html, /href="\/lobby">Chat</, 'first paint Chat');
  assert.match(html, />Buy</, 'first paint Buy');
  assert.doesNotMatch(html, /plugin\.jup\.ag/, 'no plugin.jup.ag');
  assert.deepEqual(footerChunks(html).flatMap(productHrefs), [], 'home footer has no leftover products');
  assert.ok(!footerChunks(html).some((f) => /href=(["'])(?:https?:\/\/(?:www\.)?getdasha\.com)?\/simp/.test(f)), 'home footer has no Simp');
}

{
  const crew = await edgeWorker.fetch(new Request('https://www.getdasha.com/crew'), {});
  assert.equal(crew.status, 200);
  assert.equal(crew.headers.get('x-dasha-edge'), 'crew');
  const crewHtml = await crew.text();
  assert.ok(!footerChunks(crewHtml).some((f) => /href=(["'])(?:https?:\/\/(?:www\.)?getdasha\.com)?\/simp/.test(f)), 'crew footer has no Simp');
  assert.match(crewHtml, /Lobby \/ @dash_eats\./, 'Vibe is Lobby / @dash_eats');
  assert.doesNotMatch(crewHtml, /\/ simp \//, 'crew has no / simp / product list');
  assert.doesNotMatch(crewHtml, /plugin\.jup\.ag/);
}

{
  const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(privacy.status, 200);
  const privacyHtml = await privacy.text();
  assert.match(
    privacyHtml,
    /Dasha never collects seed phrases, private keys, DMs, email, phone numbers, or payment cards\./,
  );
  assert.match(privacyHtml, /Lobby threads can retain a score-neutral mark/);
  assert.doesNotMatch(privacyHtml, /Forum/, 'privacy has no leftover Forum word');
  assert.doesNotMatch(privacyHtml, /getdasha\.com\/forum/, 'privacy has no /forum href');
}

{
  const digest = await edgeWorker.fetch(new Request('https://www.getdasha.com/digest.json'), {});
  assert.equal(digest.status, 200);
  const pack = JSON.parse(await digest.text());
  assert.ok(pack.at);
  assert.ok(Array.isArray(pack.items));
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), { redirect: 'manual' });
  assert.equal(forum.status, 308, 'do not redo dest 308s');
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-product-footer-leftover: PASS (Forum/Studio/Desk/Verse/Learn out of footers; howto · holes collapsed; quiz stays; crew footer no /simp; vibe no / simp /; describedby; privacy; digest.json; forum 308)');
