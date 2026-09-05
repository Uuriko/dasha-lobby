#!/usr/bin/env node
/**
 * Next leftover after live Link header: home desc names dash_eats, /which FAQPage,
 * home links /which below the fold, sitemap drops 308 rooms. No plugin.jup.ag. No invented t.me.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mintHomeTitle,
  mintHomeDescription,
  mintHomeSameAs,
  linkHomeWhich,
  stripHomeOtherCoinWarning,
  potterHome308Dest,
  potterHome308Response,
} from './dasha-lobby-worker.mjs';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const OTHER = 'FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8';

assert.doesNotMatch(worker, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(worker, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/, 'worker must not invent Telegram');

function extractConst(name) {
  const m = worker.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(m, `${name} embedded`);
  return m[1];
}

const which = extractConst('WHICH_HTML');
assert.match(which, /"@type":"FAQPage"/);
assert.match(which, /Which dasha coin\?/);
assert.match(which, /What is dash_eats\?/);
assert.match(which, new RegExp(MINT));
assert.match(which, new RegExp(OTHER));
assert.doesNotMatch(which, /plugin\.jup\.ag/);
assert.doesNotMatch(which, /t\.me/);
assert.doesNotMatch(which, /disclaimer|not financial advice|NFA|dyor/i);
assert.match(which, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
assert.match(which, /<link rel="describedby" href="\/llms-full\.txt" type="text\/plain">/);
assert.match(which, /<title>Which \$dasha\? dash_eats<\/title>/);
assert.match(which, /og:title" content="Which \$dasha\? dash_eats"/);
assert.match(which, /og:description" content="dash_eats\. Buy \$dasha\."/);
assert.match(which, /twitter:title" content="Which \$dasha\? dash_eats"/);
assert.match(which, /twitter:description" content="dash_eats\. Buy \$dasha\."/);
assert.doesNotMatch(which, /Match the full Solana mint/);
assert.doesNotMatch(which, /before using a token link/);

const sitemap = extractConst('SITEMAP_XML');
assert.match(sitemap, /<loc>https:\/\/www\.getdasha\.com\/forum<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemap, /<loc>https:\/\/www\.getdasha\.com\/llms\.txt<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemap, /<loc>https:\/\/www\.getdasha\.com\/how-to-buy<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemap, /<loc>https:\/\/www\.getdasha\.com\/privacy<\/loc>/);
assert.doesNotMatch(sitemap, /<loc>https:\/\/www\.getdasha\.com\/dasha<\/loc>/);
assert.doesNotMatch(sitemap, /<loc>https:\/\/www\.getdasha\.com\/studio<\/loc>/);
assert.doesNotMatch(sitemap, /<loc>https:\/\/www\.getdasha\.com\/verse<\/loc>/);
assert.doesNotMatch(sitemap, /<loc>https:\/\/www\.getdasha\.com\/learn<\/loc>/);

const robots = extractConst('ROBOTS_TXT');
assert.match(robots, /Allow: \/llms\.txt/);
assert.match(robots, /Allow: \/llms-full\.txt/);
assert.ok(!/^Allow:\s*\/verse\s*$/m.test(robots));
assert.ok(!/^Allow:\s*\/learn\s*$/m.test(robots));

const studio = `<!doctype html><html><head>
<title>$dasha — make the timeline stranger</title>
<meta content="$dasha. Make something. Pass it on." name="description"/>
<meta content="Make something. Pass it on." property="og:description"/>
<meta content="Make something. Pass it on." name="twitter:description"/>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "$dasha",
  "url": "https://www.getdasha.com/",
  "description": "$dasha. Make something. Pass it on."
}
</script>
</head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<h1>It’s time $dasha.</h1>
<section id="token"><div class="linkrow"><a href="/how-to-buy">How to buy</a></div></section>
<footer><div class="wrap"><p> · <a href="/simp">Simp</a> · <a href="/privacy">Privacy</a></p></div></footer>
</body></html>`;

const titled = mintHomeTitle(studio);
assert.match(titled, /<title>\$dasha<\/title>/);
assert.doesNotMatch(titled, /make the timeline stranger/);

const described = mintHomeDescription(studio);
assert.match(described, /dash_eats/);
assert.match(described, new RegExp(MINT));
assert.doesNotMatch(described, /Make something\. Pass it on/);
assert.doesNotMatch(described, /disclaimer|not financial advice/i);

const already = mintHomeDescription('<head><meta name="description" content="dash_eats on Solana."></head>');
assert.match(already, /content="dash_eats on Solana\."/);
assert.doesNotMatch(already, /Mint 53ux/);

const ld = (described.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/) || [''])[0];
assert.match(ld, /dash_eats/);
assert.match(ld, new RegExp(MINT));
assert.match(ld, /\$dasha on getdasha\.com/);
assert.doesNotMatch(ld, /Make something\. Pass it on/);

const identified = mintHomeSameAs(described);
const identifiedLd = (identified.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/) || [''])[0];
const identifiedData = JSON.parse(identifiedLd.replace(/^<script[^>]*>|<\/script>$/g, ''));
assert.equal(identifiedData['@type'], 'WebSite');
assert.deepEqual(identifiedData.sameAs, [
  'https://x.com/dash_eats',
  'https://www.getdasha.com/',
  `https://jup.ag/tokens/${MINT}`,
]);
assert.doesNotMatch(identifiedLd, /plugin\.jup/);
assert.doesNotMatch(identifiedLd, /studio|lobby|desk/i);
assert.doesNotMatch(identifiedLd, /t\.me/);

const injected = mintHomeSameAs('<head><title>$dasha</title></head>');
assert.match(injected, /"@type":"WebSite"/);
assert.match(injected, /https:\/\/x\.com\/dash_eats/);
assert.match(injected, new RegExp(`jup\\.ag/tokens/${MINT}`));
assert.doesNotMatch(injected, /plugin\.jup/);

const whichKept = mintHomeSameAs(which);
assert.match(whichKept, /"@type":"FAQPage"/);
assert.match(whichKept, /dash_eats/);

const namedLd = mintHomeDescription('<head><meta name="description" content="dash_eats on Solana."><script type="application/ld+json">{"@type":"WebSite","description":"dash_eats on Solana."}</script></head>');
const namedLdBlock = (namedLd.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/) || [''])[0];
assert.match(namedLdBlock, /"description":"dash_eats on Solana\."/);
assert.doesNotMatch(namedLdBlock, /Mint 53ux/);

const linked = linkHomeWhich(studio.replace('<div class="linkrow"><a href="/how-to-buy">How to buy</a></div>', '<div class="linkrow"><a href="/which">Which</a><a href="/how-to-buy">How to buy</a></div>'));
assert.doesNotMatch(linked, /href="\/which"/, 'home drops /which');
assert.match(linked, /<div class="linkrow"><a href="\/how-to-buy">How to buy<\/a>/, 'token row keeps How to buy');
const header = (linked.match(/<header[\s\S]*?<\/header>/) || [''])[0];
assert.doesNotMatch(header, /href="\/which"/, 'slim header stays word+Buy');
const again = linkHomeWhich(linked);
assert.equal((again.match(/href="\/which"/g) || []).length, 0);

for (const path of ['/studio', '/verse', '/learn', '/graph', '/index.html']) {
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.ok(res, `${path} still 308`);
  assert.equal(res.status, 308, `${path} status`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/');
}
for (const path of ['/dasha', '/desk']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/how-to-buy');
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, `${path} status`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/how-to-buy');
}
assert.equal(potterHome308Dest('/privacy'), null);


const full = extractConst('LLMS_FULL_TXT');
assert.doesNotMatch(full, /^Desk:/m);
assert.doesNotMatch(full, /Make something\. Pass it on/);
assert.match(full, /dash_eats/);
assert.doesNotMatch(full, /t\.me/);
assert.doesNotMatch(full, /plugin\.jup\.ag/);

const hero = `<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<header class="dasha-hero wrap" id="content">
  <div><h1>It’s time<br><span class="stroke">$dasha.</span></h1><p class="mint-lede">Associated mint <code>${MINT}</code>. Not CoinGecko’s Dasha (VVAIFU). <a href="/which">Which $dasha?</a></p><div class="actions"><a class="pill primary" href="/lobby">Enter lobby →</a></div></div>
</header>
<section id="token"><div class="linkrow"><a href="/how-to-buy">How to buy</a></div></section>
<p class="banner">Not CoinGecko’s Dasha (VVAIFU). <a href="/which">Which $dasha?</a></p>
<footer><div class="wrap"><p> · <a href="/simp">Simp</a></p></div></footer>`;

const cut = stripHomeOtherCoinWarning(hero);
assert.doesNotMatch(cut, /VVAIFU/, 'home rewrite drops VVAIFU');
assert.doesNotMatch(cut, /Not CoinGecko/, 'home rewrite drops Not CoinGecko');
assert.doesNotMatch(cut, /Which \$dasha\?/, 'home rewrite drops Which $dasha?');
assert.doesNotMatch(cut, /mint-lede/, 'drops empty mint-lede');
assert.match(cut, /It’s time/, 'keeps headline');
assert.match(cut, />Buy</, 'keeps Buy');
assert.match(cut, /<header class="bar">/, 'keeps slim header');
const cutHeader = (cut.match(/<header class="dasha-hero"[\s\S]*?<\/header>/) || [''])[0];
assert.doesNotMatch(cutHeader, /href="\/which"/, 'hero does not feature /which');

const quiet = linkHomeWhich(cut);
assert.doesNotMatch(quiet, /href="\/which"/, 'token row drops Which');
assert.match(quiet, /<div class="linkrow"><a href="\/how-to-buy">How to buy<\/a>/, 'token row keeps How to buy');
assert.doesNotMatch(quiet, /Which \$dasha\?/, 'lecture Which stays gone');

const { HOME_HTML } = await import('./dasha-lobby-static-gen.mjs');
assert.doesNotMatch(HOME_HTML, /VVAIFU/, 'HOME_HTML source has no VVAIFU');
assert.doesNotMatch(HOME_HTML, /Not CoinGecko/, 'HOME_HTML source has no Not CoinGecko');
assert.doesNotMatch(HOME_HTML, /Which \$dasha\?/, 'HOME_HTML source has no Which $dasha?');

for (const path of ['/studio', '/verse', '/learn', '/graph']) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 308, `${path} worker fetch is 308 not 200/404`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/');
}
for (const path of ['/dasha', '/desk']) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 308, `${path} worker fetch is 308`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/how-to-buy');
}
{
  const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(privacy.status, 200, '/privacy is 200 not 308');
  const body = await privacy.text();
  assert.match(body, /<h1>Privacy<\/h1>/);
}

{
  const oauth = await edgeWorker.fetch(new Request('https://www.getdasha.com/oauth/x/start'), {});
  assert.equal(oauth.status, 308, 'www /oauth/x/start 308');
  assert.match(oauth.headers.get('location') || '', /lobby\.getdasha\.com\/oauth\/x\/start/);
}
{
  const oauth = await edgeWorker.fetch(new Request('https://www.getdasha.com/oauth/github/start'), {});
  assert.equal(oauth.status, 308, 'www /oauth/github/start 308');
  assert.match(oauth.headers.get('location') || '', /lobby\.getdasha\.com\/oauth\/github\/start/);
}

function assertDescribedBy(res, path) {
  assert.equal(res.status, 200, `${path} 200`);
  const link = res.headers.get('link') || '';
  assert.match(link, /<\/llms\.txt>; rel="describedby"/, `${path} HTTP Link llms.txt`);
  assert.match(link, /<\/llms-full\.txt>; rel="describedby"/, `${path} HTTP Link llms-full.txt`);
}

const crawlerHtml = ['/lobby', '/compute', '/crew', '/digest', '/how-to-buy', '/privacy', '/faucet', '/bag', '/login', '/contribute', '/chess'];
for (const path of crawlerHtml) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assertDescribedBy(res, path);
  const body = await res.text();
  assert.match(body, /<link rel="describedby" href="\/llms\.txt"/, `${path} HTML describedby llms.txt`);
  assert.match(body, /<link rel="describedby" href="\/llms-full\.txt"/, `${path} HTML describedby llms-full.txt`);
}
for (const path of ['/lobby', '/faucet', '/how-to-buy', '/login', '/chess']) {
  const res = await edgeWorker.fetch(new Request(`https://lobby.getdasha.com${path}`), {});
  assertDescribedBy(res, `lobby host ${path}`);
}


{
  const chess = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess'), {});
  assertDescribedBy(chess, '/chess');
  assert.equal(chess.headers.get('x-dasha-edge'), 'chess');
  const csp = chess.headers.get('content-security-policy') || '';
  assert.match(csp, /frame-ancestors 'self' https:\/\/www\.getdasha\.com/, 'chess CSP still allows embed iframe');
  const chessHtml = await chess.text();
  assert.match(chessHtml, /<link rel="describedby" href="\/llms\.txt"/);
  assert.match(chessHtml, /<link rel="describedby" href="\/llms-full\.txt"/);
  assert.doesNotMatch(chessHtml, /plugin\.jup\.ag/);
  assert.doesNotMatch(chessHtml, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);
  const embed = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess?embed=1'), {});
  assertDescribedBy(embed, '/chess?embed=1');
  assert.equal(embed.headers.get('x-frame-options'), 'SAMEORIGIN');
}

console.log('dasha-aeo-leftover: PASS (home desc + JSON-LD sameAs dash_eats/jup mint, /which FAQPage, Which dropped from home, other-coin warning cut, sitemap 308s dropped, crawler HTML 200s plus /login /contribute /chess send HTTP Link describedby, quiet /simp stays without; /verify 308 /which, no plugin.jup, no invented t.me)');
