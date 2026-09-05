#!/usr/bin/env node
/**
 * Leftover after home dropped-selector CSS DRY.
 * Live / 200 still serializes CSS lecture in product <style>:
 *   Make, Play and Buy (retired Studio)
 *   Asking for less motion / Motion, added as enhancement / sparkline
 * Humans see it in view-source. @view-transition rules stay.
 * Repair #dasha-home h1/h2/label stay. Watch price/ticker remount belt stays.
 * Product skip-links stay. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  hideHomeExtraChrome,
  stripDeadNav,
  stripHomeCssLecture,
  stripHomeWebflowBoot,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const REPAIR = `#dasha-home h1,
#dasha-home h2 { color: var(--ink, #F2EDE7); }
#dasha-home #tool label { color: var(--ink, #F2EDE7); }`;
const CHERRIES = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20fill%3D%22%23dfff00%22%2F%3E%3C%2Fsvg%3E">';
const VIEW_CSS = '<style>@view-transition{navigation:auto}</style>';
const LECTURE = `/* Asking for less motion turns navigation transitions off entirely rather than shortening them.
     Same contract the surfaces already honour in their own stylesheets. */
/* Keep the cross-fade brief: a slow transition reads as latency, and this fires on every click
     between Make, Play and Buy. */
@view-transition { navigation: auto; }
/* Motion, added as enhancement only.
     The finished state above is the default, so a browser that does not know animation-timeline
     ignores every line below and shows the page exactly as it is now. */
/* Transform only. Opacity here composites acid buttons over ink into #576305 (3.07:1)
         while the mint row is mid-range. The finished colors stay the default. */
/* Sections arrive as they come into view. both holds the start transform. */
/* The sparkline draws itself once on load. stroke-dashoffset is not compositor-friendly. */
.price{margin:22px 0 0}.ticker{position:relative}`;

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripHomeCssLecture/);
assert.match(workerSrc, /out = stripHomeCssLecture\(out\);/);

const LIVE = `<!doctype html><html lang="en" id="dasha-home"><head>
<title>$dasha</title>
<meta name="description" content="$dasha on getdasha.com. dash_eats. Mint ${MINT}.">
${CHERRIES}
<link rel="stylesheet" href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/css/johns-awesome-project-39b1b5.webflow.shared.4e493bbf3.min.css">
${VIEW_CSS}
<style>
${REPAIR}
</style>
<style>
${LECTURE}
</style>
<link rel="canonical" href="https://www.getdasha.com/">
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section><svg id="cherries"></svg></main>
<script src="https://lobby.getdasha.com/client/x-connect.js"></script>
<script src="https://lobby.getdasha.com/client/faucet.js"></script>
</body></html>`;

assert.match(LIVE, /Make, Play and Buy/, 'fixture leftover Make/Play/Buy lecture paints in live <style>');
assert.match(LIVE, /Asking for less motion/, 'fixture leftover less-motion lecture');
assert.match(LIVE, /Motion, added as enhancement only/, 'fixture leftover motion-enhancement lecture');
assert.match(LIVE, /The sparkline draws itself once on load/, 'fixture leftover sparkline lecture');
assert.match(LIVE, /#576305/, 'fixture leftover opacity/contrast lecture');
assert.match(LIVE, /Sections arrive as they come into view/, 'fixture leftover sections lecture');
assert.match(LIVE, /#dasha-home h1/, 'fixture keeps repair h1 rule');
assert.match(LIVE, /#dasha-home #tool label/, 'fixture keeps repair label rule');
assert.match(LIVE, /\.price\{/, 'fixture keeps Watch price CSS');
assert.match(LIVE, /\.ticker\{/, 'fixture keeps Watch ticker CSS');
assert.match(LIVE, /@view-transition/, 'fixture keeps @view-transition');

const gone = stripHomeCssLecture(LIVE);
assert.doesNotMatch(gone, /Make, Play and Buy/, 'drops leftover Make/Play/Buy lecture');
assert.doesNotMatch(gone, /Asking for less motion/, 'drops leftover less-motion lecture');
assert.doesNotMatch(gone, /Motion, added as enhancement only/, 'drops leftover motion-enhancement lecture');
assert.doesNotMatch(gone, /The sparkline draws itself once on load/, 'drops leftover sparkline lecture');
assert.doesNotMatch(gone, /#576305/, 'drops leftover opacity/contrast lecture');
assert.doesNotMatch(gone, /Sections arrive as they come into view/, 'drops leftover sections lecture');
assert.doesNotMatch(gone, /Keep the cross-fade brief/, 'drops leftover cross-fade lecture');
assert.match(gone, /#dasha-home h1/, 'repair h1 rule stays');
assert.match(gone, /#dasha-home h2/, 'repair h2 rule stays');
assert.match(gone, /#dasha-home #tool label/, 'repair label rule stays');
assert.match(gone, /var\(--ink, #F2EDE7\)/, 'repair color stays');
assert.match(gone, /\.price\{/, 'Watch price CSS stays');
assert.match(gone, /\.ticker\{/, 'Watch ticker CSS stays');
assert.match(gone, /@view-transition/, '@view-transition stays');
assert.match(gone, /data:image\/svg\+xml/, 'cherries SVG stays');
assert.match(gone, /rel="canonical"/, 'canonical stays');
assert.match(gone, /johns-awesome/, 'johns-awesome stays');
assert.match(gone, /id=["']chat-door["']/, 'chat-door stays');
assert.match(gone, /id=["']simp-door["']/, 'simp-door stays');
assert.match(gone, /id=["']grok-door["']/, 'grok-door stays');
assert.match(gone, /x-connect\.js/, 'x-connect.js stays');
assert.match(gone, /faucet\.js/, 'faucet.js stays');
assert.match(gone, /<header class="bar">/, 'header.bar stays');
assert.match(gone, />Buy</, 'Buy stays');
assert.match(gone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(gone, new RegExp(MINT), 'mint stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(gone.length > LIVE.length * 0.4, 'CSS lecture drop is per-comment, not eat-the-page');
assert.ok(gone.length > 400 && gone.includes('<body>'), 'CSS lecture drop cannot blank the fixture');

const other = stripHomeCssLecture('<html><head><style>/* Keep the cross-fade brief between Make, Play and Buy. */@view-transition{navigation:auto}</style></head><body><p>privacy skip</p></body></html>');
assert.match(other, /Make, Play and Buy/, 'non-home pages keep CSS lecture');
assert.match(other, /@view-transition/, 'non-home @view-transition stays');

const booted = stripHomeWebflowBoot(LIVE);
assert.doesNotMatch(booted, /Make, Play and Buy/, 'stripHomeWebflowBoot drops leftover Make/Play/Buy lecture');
assert.doesNotMatch(booted, /Asking for less motion/, 'boot drops leftover less-motion lecture');
assert.doesNotMatch(booted, /The sparkline draws itself once on load/, 'boot drops leftover sparkline lecture');
assert.match(booted, /#dasha-home h1/, 'boot keeps repair h1');
assert.doesNotMatch(booted, /#dasha-home\s+#tool\s+label/, 'boot drops leftover #tool label');
assert.match(booted, /#dasha-home h2/, 'boot keeps repair h2');
assert.match(booted, /\.price\{/, 'boot keeps Watch price CSS');
assert.match(booted, /\.ticker\{/, 'boot keeps Watch ticker CSS');
assert.match(booted, /@view-transition/, 'boot keeps @view-transition');
assert.match(booted, /id=["']chat-door["']/, 'boot keeps chat-door');
assert.match(booted, /id=["']simp-door["']/, 'boot keeps simp-door');
assert.match(booted, /id=["']grok-door["']/, 'boot keeps grok-door');
assert.match(booted, /x-connect\.js/, 'boot keeps x-connect.js');
assert.match(booted, /faucet\.js/, 'boot keeps faucet.js');
assert.match(booted, /johns-awesome/, 'boot keeps johns-awesome');
assert.doesNotMatch(booted, /plugin\.jup\.ag/, 'boot no plugin.jup.ag');

const rewritten = stripDeadNav(LIVE);
assert.doesNotMatch(rewritten, /Make, Play and Buy/, 'stripDeadNav drops leftover Make/Play/Buy lecture');
assert.match(rewritten, /#dasha-home h1/, 'rewrite keeps repair h1');
assert.doesNotMatch(rewritten, /#dasha-home\s+#tool\s+label/, 'rewrite drops leftover #tool label');
assert.match(rewritten, /#dasha-home h2/, 'rewrite keeps repair h2');
assert.match(rewritten, /@view-transition/, 'rewrite keeps @view-transition');
assert.match(rewritten, /id=["']chat-door["']/, 'rewrite keeps chat-door');
assert.match(rewritten, /id=["']simp-door["']/, 'rewrite keeps simp-door');
assert.match(rewritten, /id=["']grok-door["']/, 'rewrite keeps grok-door');
assert.match(rewritten, /<header class="bar">/, 'rewrite keeps header.bar');
assert.match(rewritten, />Buy</, 'rewrite keeps Buy');
assert.match(rewritten, /jup\.ag\/swap/, 'rewrite keeps jup.ag');
assert.doesNotMatch(rewritten, /id=["']compute-door["']/, 'rewrite no compute-door');
assert.doesNotMatch(rewritten, /plugin\.jup\.ag/, 'rewrite no plugin.jup.ag');
{
  const hide = (rewritten.match(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  assert.match(hide, /id=["']dasha-home-chrome-hide["']/, 'Watch chrome-hide stays');
  assert.match(hide, /\.ticker/, 'Watch belt still hides ticker');
  assert.match(hide, /\.price/, 'Watch belt still hides price');
}

{
  const hide = hideHomeExtraChrome('<html><head></head><body id="dasha-home"></body></html>');
  const belt = (hide.match(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  assert.match(belt, /\.ticker/);
  assert.match(belt, /\.price/);
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-dasha-edge'), 'html-security');
  const html = await home.text();
  assert.doesNotMatch(html, /Make, Play and Buy/, 'served home no leftover Make/Play/Buy lecture');
  assert.doesNotMatch(html, /Asking for less motion/, 'served home no leftover less-motion lecture');
  assert.doesNotMatch(html, /Motion, added as enhancement only/, 'served home no leftover motion-enhancement lecture');
  assert.doesNotMatch(html, /The sparkline draws itself once on load/, 'served home no leftover sparkline lecture');
  assert.match(html, /#dasha-home h1/, 'served repair h1 stays');
  assert.doesNotMatch(html, /#dasha-home\s+#tool\s+label/, 'served leftover #tool label gone');
  assert.match(html, /#dasha-home h2/, 'served repair h2 stays');
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, 'served Watch chrome-hide stays');
  assert.match(html, /\.ticker/, 'served Watch ticker hide stays');
  assert.match(html, /\.price/, 'served Watch price hide stays');
  assert.match(html, /data:image\/svg\+xml/, 'served cherries SVG');
  assert.match(html, /@view-transition/, 'served @view-transition');
  assert.match(html, /rel="canonical"/, 'served canonical');
  assert.match(html, /johns-awesome/, 'served johns-awesome');
  assert.match(html, /id=["']chat-door["']/, 'served chat-door');
  assert.match(html, /id=["']simp-door["']/, 'served simp-door');
  assert.match(html, /id=["']grok-door["']/, 'served grok-door');
  assert.match(html, /id=["']dasha-home-faucet["']/, 'served HOME_FAUCET_MOUNT');
  assert.match(html, /x-connect\.js/, 'served x-connect.js');
  assert.match(html, /faucet\.js/, 'served faucet.js');
  assert.match(html, /<header class="bar">/, 'served header.bar');
  assert.match(html, />Buy</, 'served Buy');
  assert.match(html, /Chat/, 'served Chat');
  assert.match(html, /\$dasha/, 'served $dasha');
  assert.match(html, /jup\.ag\/swap/, 'served jup.ag');
  assert.match(html, new RegExp(MINT), 'served mint');
  assert.doesNotMatch(html, /plugin\.jup\.ag/, 'served no plugin.jup.ag');
  assert.doesNotMatch(html, /id=["']compute-door["']/, 'served no compute-door');
}

{
  const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, 'privacy product skip-link stays');
}

{
  const bounties = await edgeWorker.fetch(new Request('https://www.getdasha.com/bounties'), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /class=["']skip-link["']/, 'bounties product skip-link stays');
}

{
  const contribute = await edgeWorker.fetch(new Request('https://www.getdasha.com/contribute'), {});
  assert.equal(contribute.status, 200);
  const html = await contribute.text();
  assert.match(html, /class=["']skip-link["']/, 'contribute product skip-link stays');
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-home-css-lecture: PASS (leftover Make/Play/Buy + motion/sparkline CSS lecture dropped; @view-transition + Watch price/ticker belt stay)');
