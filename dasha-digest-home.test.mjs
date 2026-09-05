#!/usr/bin/env node
/**
 * Home tape lands after GRWM + SIWG. First paint stays $dasha + Chat + Buy.
 * Empty items stay honest. Full list stays on /digest.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  applyDigestTape,
  orderHomeLongPage,
  stripDeadNav,
  stripHomeOtherCoinWarning,
} from './dasha-lobby-worker.mjs';
import {
  DEFAULT,
  HOME_TAPE_LIMIT,
  digestRemountScript,
  homeTapeItems,
  injectDigestRemount,
  injectDigestSection,
} from './dasha-digest.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

const HOME = `<!doctype html><html lang="en"><head>
<title>old home</title>
<meta name="description" content="Not CoinGecko's Dasha (VVAIFU).">
</head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<nav class="dasha-nav"><a href="/chess">chess</a><a href="/dasha">desk</a><a href="/studio">studio</a></nav>
<section id="chess-door" aria-labelledby="chess-title"><h2 id="chess-title">Play chess.</h2><a href="/chess">Open chess →</a></section>
<p class="mint-lede">Not CoinGecko's Dasha (VVAIFU). <a href="/which">Which $dasha?</a></p>
<section id="simp-door"><h2>Simp Quiz.</h2></section>
<section id="dasha-home-faucet"><div id="dasha-faucet"></div></section>
<section id="grwm" aria-label="Get ready with me"><p>GRWM</p></section>
<footer><a href="/chess">Chess</a> · <a href="/dasha">Desk</a> · <a href="/studio">Studio</a></footer>
</body></html>`;

function firstPaint(html) {
  const at = String(html).indexOf('id="grwm"');
  return at >= 0 ? html.slice(0, at) : html;
}

function countRows(html) {
  return (String(html).match(/<li>/g) || []).length;
}

assert.equal(HOME_TAPE_LIMIT, 5);
assert.equal(homeTapeItems(DEFAULT.items).length, 5);
assert.match(homeTapeItems(DEFAULT.items)[0].title, /\$dasha \$/);
assert.equal(homeTapeItems([]).length, 0);

// empty items still no-op
assert.equal(injectDigestSection(HOME, []), HOME);
assert.equal(applyDigestTape(HOME, []), HOME);
assert.equal(injectDigestSection(HOME, [{ source: 'X', title: 'nope', href: 'https://plugin.jup.ag/x' }]), HOME);

// preferred: after #grok-door
{
  const src = '<main><section id="grwm">GRWM</section><section id="grok-door">SIWG</section></main>';
  const out = injectDigestSection(src, DEFAULT.items);
  const grwm = out.indexOf('id="grwm"');
  const grok = out.indexOf('id="grok-door"');
  const digest = out.indexOf('id="dasha-digest"');
  assert.ok(digest > grok && grok > grwm, 'after grok-door, after grwm');
  assert.doesNotMatch(out.slice(0, grwm), /id=["']dasha-digest["']/);
}

// fallback: after #grwm
{
  const src = '<main><section id="grwm">GRWM</section></main>';
  const out = injectDigestSection(src, DEFAULT.items);
  assert.ok(out.indexOf('id="dasha-digest"') > out.indexOf('id="grwm"'));
}

// keep footer.dasha-foot
{
  const src = '<div class="forum-split"></div>\n<footer class="dasha-foot">foot</footer>';
  const out = injectDigestSection(src, DEFAULT.items);
  const digest = out.indexOf('id="dasha-digest"');
  const foot = out.indexOf('<footer class="dasha-foot">');
  assert.ok(digest > 0 && foot > digest, 'digest before dasha-foot');
}

// before </main>
{
  const src = '<main><p>only</p></main>';
  const out = injectDigestSection(src, DEFAULT.items);
  assert.match(out, /id="dasha-digest"><\/main>|id="dasha-digest">[\s\S]*<\/section><\/main>/);
  assert.ok(out.indexOf('id="dasha-digest"') < out.indexOf('</main>'));
}

// before any <footer
{
  const src = '<div><p>only</p><footer>foot</footer></div>';
  const out = injectDigestSection(src, DEFAULT.items);
  assert.ok(out.indexOf('id="dasha-digest"') < out.indexOf('<footer'));
}

// append
{
  const src = '<div><p>only</p></div>';
  const out = injectDigestSection(src, DEFAULT.items);
  assert.match(out, /id="dasha-digest"/);
  assert.ok(out.indexOf('id="dasha-digest"') > out.indexOf('<p>only</p>'));
}

assert.equal(injectDigestSection(injectDigestSection(HOME, DEFAULT.items), DEFAULT.items).match(/id="dasha-digest"/g).length, 1, 'idempotent');

const transformed = stripHomeOtherCoinWarning(stripDeadNav(HOME));
const taped = applyDigestTape(transformed, homeTapeItems(DEFAULT.items));
assert.match(taped, /id=["']dasha-digest["']/, 'transformed home has tape');
assert.match(taped, /id=["']chat-door["']/);
assert.match(taped, /id=["']grwm["']/);
assert.match(taped, /id=["']grok-door["']/);
assert.doesNotMatch(taped, /id=["']chess-door["']/);
assert.ok(taped.indexOf('id="dasha-digest"') > taped.indexOf('id="grok-door"'), 'tape after grok-door');
assert.ok(taped.indexOf('id="dasha-digest"') > taped.indexOf('id="grwm"'), 'tape after grwm');
assert.ok(taped.indexOf('id="grok-door"') > taped.indexOf('id="grwm"'), 'grok after grwm');
const paint = firstPaint(taped);
assert.doesNotMatch(paint, /id=["']dasha-digest["']/, 'first paint has no tape');
assert.match(paint, /id=["']chat-door["']/, 'first paint still chat');
assert.doesNotMatch(paint, /VVAIFU|Not CoinGecko/i, 'first paint no other-coin');
assert.doesNotMatch(paint, /id=["']chess-door["']/, 'first paint no chess');
assert.match(taped, /\$dasha \$/);
assert.match(taped, /Dexscreener/);
assert.match(taped, /<h2>Tape\.<a href="\/digest">\/digest<\/a><\/h2>/, 'home tape keeps /digest permalink');
assert.equal(countRows(taped), 5, 'home tape caps at 5');
assert.doesNotMatch(taped, /plugin\.jup\.ag/);
assert.doesNotMatch(taped, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);
assert.doesNotMatch(taped, /<nav class="dasha-nav">/, 'drops leftover dasha-nav');

const ordered = applyDigestTape(
  orderHomeLongPage('<main><header id="content">hero</header><section id="grwm">GRWM</section></main>'),
  homeTapeItems(DEFAULT.items),
);
assert.ok(ordered.indexOf('id="dasha-digest"') > ordered.indexOf('id="grok-door"'));
assert.doesNotMatch(firstPaint(ordered), /id=["']dasha-digest["']/);

assert.match(workerSrc, /homeTapeItems\(\(await publicDigest\(env\)\)\.items\)/);
assert.match(workerSrc, /if \(isHome\) \{\s*try \{ html = applyDigestTape/);

{
  const page = await edgeWorker.fetch(new Request('https://www.getdasha.com/digest'), {});
  assert.equal(page.status, 200, '/digest 200');
  assert.equal(page.headers.get('x-dasha-edge'), 'digest');
  const html = await page.text();
  assert.match(html, /id="dasha-digest"/);
  assert.match(html, /class="bar"/);
  assert.match(html, />Buy</);
  assert.match(html, /\$dasha \$/);
  assert.ok(countRows(html) >= 10, '/digest keeps full list');
  assert.match(html, /<h2>Tape\.<\/h2>/, '/digest page drops leftover /digest self-link');
  assert.doesNotMatch(html, /<h2>Tape\.<a href="\/digest">/, '/digest page no Tape. /digest');
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const json = await edgeWorker.fetch(new Request('https://www.getdasha.com/digest.json'), {});
  assert.equal(json.status, 200, '/digest.json 200');
  const pack = await json.json();
  assert.equal(pack.items[0].kind, 'tape');
  assert.match(pack.items[0].title, /\$dasha \$/);
  assert.ok('tick' in pack, '/digest.json has tick field');
  if (pack.tick) {
    assert.equal(pack.tick.kind, 'tape');
    assert.equal(pack.items[0].href, pack.tick.href, 'tick is row 1');
  }
  assert.ok(pack.items.length > 5, 'json keeps full list');
}

const remount = digestRemountScript();
assert.match(remount, /\/digest\.json/, 'remount fetches /digest.json');
assert.match(remount, /setAttribute\('href','\/digest'\)/, 'remount keeps /digest permalink');
assert.match(remount, /pack\.tick/, 'remount uses live tick as row 1');
assert.match(remount, /#grok-door/, 'remount anchors on #grok-door');
assert.match(remount, /dasha-crew-line|crew-line/, 'remount paints quiet crew line');
assert.match(remount, /\/crew/, 'crew line links /crew');
assert.doesNotMatch(remount, /api\.dexscreener\.com/, 'browser never hits Dexscreener');
assert.doesNotMatch(remount, /plugin\.jup\.ag/);
assert.doesNotMatch(remount, /window\.Webflow/, 'leftover Webflow.push stays dropped');
assert.doesNotMatch(remount, /querySelector\(['"]footer['"]\)/, 'leftover remount footer querySelector dropped');
assert.match(remount, /querySelector\('main'\)/, 'remount still falls back to main');

const headEnd = taped.toLowerCase().indexOf('</head>');
assert.ok(headEnd > 0, 'transformed home has head');
const head = taped.slice(0, headEnd);
assert.match(head, /id=["']dasha-digest-remount["']/, 'remount lives in head');
assert.match(head, /\/digest\.json/);
assert.match(head, /#grok-door/);
assert.equal((taped.match(/id=["']dasha-digest-remount["']/g) || []).length, 1, 'one remount');
assert.equal((injectDigestRemount(taped).match(/id=["']dasha-digest-remount["']/g) || []).length, 1, 'remount idempotent');

assert.doesNotMatch(paint, /id=["']dasha-digest["']/, 'first paint slice has no tape section');
assert.match(paint, /id=["']dasha-digest-remount["']/, 'first paint keeps remount script');
assert.doesNotMatch(paint, /<p[^>]*id=["']dasha-crew-line["']/, 'first paint has no crew chrome');
assert.doesNotMatch(paint, /id=["']chess-door["']/);

assert.match(workerSrc, /injectDigestRemount\(html\)/);
assert.match(workerSrc, /injectDigestRemount\(out\)/);

console.log('dasha-digest-home: PASS (tape after grok/grwm, remount in head, first paint clean, /digest full)');
