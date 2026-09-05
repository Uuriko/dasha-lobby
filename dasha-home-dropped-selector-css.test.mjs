#!/usr/bin/env node
/**
 * Leftover after home skip-link/footer/.compute/.poster DOM-strip + chrome-hide DRY.
 * Live / 200 still serializes dropped-selector CSS in the product <style>:
 *   .skip-link / footer / .compute / .poster / wrap-nav .navlinks
 * after those nodes were already dropped from the document.
 * Humans see it in view-source. Repair #dasha-home h1/h2/label stay.
 * Watch price/ticker remount belt stays. Product skip-links stay.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  hideHomeExtraChrome,
  stripDeadNav,
  stripHomeDroppedSelectorCss,
  stripHomeWebflowBoot,
  unlockHomeMobileScroll,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const REPAIR = `#dasha-home h1,
#dasha-home h2 { color: var(--ink, #F2EDE7); }
#dasha-home #tool label { color: var(--ink, #F2EDE7); }`;
const CHERRIES = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20fill%3D%22%23dfff00%22%2F%3E%3C%2Fsvg%3E">';
const VIEW_CSS = '<style>@view-transition{navigation:auto}</style>';
const DROPPED = `.skip-link{position:absolute;left:-9999px;top:0;z-index:100;padding:12px 16px;background:var(--acid);color:var(--ink)!important;font-weight:900;text-decoration:none}.skip-link:focus{left:12px;top:12px;outline:3px solid var(--paper);outline-offset:2px}
.poster{position:relative;aspect-ratio:4/5}.poster-grid{height:100%}.poster-tile{padding:26px}.poster-tile:hover{filter:brightness(1.18)}.poster-tile:nth-child(1){background:#351b62}.poster-tile strong{max-width:92%}.sticker{pointer-events:none}
.compute{display:none}
footer{padding:34px 0 44px}footer .wrap{display:flex}footer p{margin:0}.dasha footer a{color:var(--paper)!important}.dasha footer a:hover{text-decoration:underline}
.navlinks{display:flex;align-items:center;gap:22px}.navlinks a{min-height:44px;display:inline-flex;align-items:center;text-decoration:none}.navlinks a:hover{text-decoration:underline;text-underline-offset:5px}
@media(max-width:800px){.navlinks>a:not(.pill):not(.login-link){display:none}.dasha-hero{grid-template-columns:1fr}.poster{width:90%;margin:20px auto 0}.contract,.door{grid-template-columns:1fr}}
@media(max-width:480px){.navlinks{gap:12px}.pill{padding:0 17px}.dasha-hero{min-height:auto}.contract,.door{padding:24px}}
.price{margin:22px 0 0}.ticker{position:relative}
/* The collage lands one tile at a time, in reading order. Each tile is its own subject so the
   stagger comes from the scroll range rather than a delay, which keeps it correct at any
   scroll speed and when someone jumps mid-page. */
.poster-tile{animation:dasha-rise linear both;animation-timeline:view();}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.ticker-loop{animation:none;display:none}.pill,.poster-tile{transition:none}.poster-tile:hover{filter:none}}`;

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripHomeDroppedSelectorCss/);
assert.match(workerSrc, /out = stripHomeDroppedSelectorCss\(out\);/);
assert.doesNotMatch(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [''])[0],
  /\.poster-tile/,
  'Worker mobile-scroll does not re-lecture dropped .poster-tile',
);

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
${DROPPED}
</style>
<link rel="canonical" href="https://www.getdasha.com/">
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section><svg id="cherries"></svg></main>
<script src="https://lobby.getdasha.com/client/x-connect.js"></script>
<script src="https://lobby.getdasha.com/client/faucet.js"></script>
</body></html>`;

assert.match(LIVE, /\.skip-link\{/, 'fixture leftover skip-link CSS paints in live <style>');
assert.match(LIVE, /footer\{/, 'fixture leftover footer CSS paints in live <style>');
assert.match(LIVE, /\.compute\{/, 'fixture leftover .compute CSS paints in live <style>');
assert.match(LIVE, /\.poster\{/, 'fixture leftover .poster CSS paints in live <style>');
assert.match(LIVE, /\.navlinks\{/, 'fixture leftover .navlinks CSS paints in live <style>');
assert.match(LIVE, /The collage lands one tile at a time/, 'fixture leftover collage lecture');
assert.doesNotMatch(LIVE, /class=["']skip-link["']/, 'fixture skip-link already DOM-stripped');
assert.doesNotMatch(LIVE, /<footer\b/i, 'fixture footer already DOM-stripped');
assert.doesNotMatch(LIVE, /class=["']poster["']/, 'fixture poster already DOM-stripped');
assert.match(LIVE, /#dasha-home h1/, 'fixture keeps repair h1 rule');
assert.match(LIVE, /#dasha-home #tool label/, 'fixture keeps repair label rule');
assert.match(LIVE, /\.price\{/, 'fixture keeps Watch price CSS');
assert.match(LIVE, /\.ticker\{/, 'fixture keeps Watch ticker CSS');

const gone = stripHomeDroppedSelectorCss(LIVE);
assert.doesNotMatch(gone, /\.skip-link\s*\{/, 'drops leftover skip-link CSS');
assert.doesNotMatch(gone, /footer\s*\{/, 'drops leftover footer CSS');
assert.doesNotMatch(gone, /footer \.wrap\s*\{/, 'drops leftover footer wrap CSS');
assert.doesNotMatch(gone, /\.dasha footer a/, 'drops leftover dasha footer CSS');
assert.doesNotMatch(gone, /\.compute[^{]*\{/, 'drops leftover .compute CSS');
assert.doesNotMatch(gone, /\.poster\s*\{/, 'drops leftover .poster CSS');
assert.doesNotMatch(gone, /\.poster-grid\s*\{/, 'drops leftover .poster-grid CSS');
assert.doesNotMatch(gone, /\.poster-tile/, 'drops leftover .poster-tile CSS');
assert.doesNotMatch(gone, /\.sticker\s*\{/, 'drops leftover .sticker CSS');
assert.doesNotMatch(gone, /\.navlinks/, 'drops leftover .navlinks CSS');
assert.match(gone, /class=["']pill primary["']/, 'simp-door pill class stays');
assert.match(gone, /\.pill\{padding:0 17px\}/, 'mixed 480px media keeps .pill');
assert.match(gone, /\.dasha-hero\{grid-template-columns:1fr\}/, 'mixed 800px media keeps .dasha-hero');
assert.doesNotMatch(gone, /The collage lands one tile at a time/, 'drops leftover collage lecture');
assert.match(gone, /#dasha-home h1/, 'repair h1 rule stays');
assert.match(gone, /#dasha-home h2/, 'repair h2 rule stays');
assert.match(gone, /#dasha-home #tool label/, 'repair label rule stays');
assert.match(gone, /var\(--ink, #F2EDE7\)/, 'repair color stays');
assert.match(gone, /\.price\{/, 'Watch price CSS stays');
assert.match(gone, /\.ticker\{/, 'Watch ticker CSS stays');
assert.match(gone, /\.pill\{transition:none\}/, 'pill reduced-motion stays without poster-tile');
assert.match(gone, /data:image\/svg\+xml/, 'cherries SVG stays');
assert.match(gone, /@view-transition/, '@view-transition stays');
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
assert.ok(gone.length > LIVE.length * 0.4, 'dropped-selector CSS drop is per-rule, not eat-the-page');
assert.ok(gone.length > 400 && gone.includes('<body>'), 'dropped-selector CSS drop cannot blank the fixture');

const other = stripHomeDroppedSelectorCss('<html><head><style>.skip-link{left:-9999px}footer{padding:1rem}.poster{width:90%}.compute{display:none}</style></head><body><a class="skip-link" href="#dasha-page">Skip to content</a><p>privacy skip</p></body></html>');
assert.match(other, /\.skip-link\{left:-9999px\}/, 'non-home pages keep skip-link CSS');
assert.match(other, /footer\{padding:1rem\}/, 'non-home pages keep footer CSS');
assert.match(other, /\.poster\{width:90%\}/, 'non-home pages keep poster CSS');
assert.match(other, /class=["']skip-link["']/, 'non-home product skip-link stays');

const booted = stripHomeWebflowBoot(LIVE);
assert.doesNotMatch(booted, /\.skip-link\s*\{/, 'stripHomeWebflowBoot drops leftover skip-link CSS');
assert.doesNotMatch(booted, /footer\s*\{/, 'boot drops leftover footer CSS');
assert.doesNotMatch(booted, /\.poster\s*\{/, 'boot drops leftover poster CSS');
assert.doesNotMatch(booted, /\.compute[^{]*\{/, 'boot drops leftover compute CSS');
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
assert.doesNotMatch(rewritten, /\.skip-link\s*\{/, 'stripDeadNav drops leftover skip-link CSS');
assert.doesNotMatch(rewritten, /footer\s*\{/, 'rewrite drops leftover footer CSS');
assert.doesNotMatch(rewritten, /\.poster\s*\{/, 'rewrite drops leftover poster CSS');
assert.doesNotMatch(rewritten, /\.poster-tile/, 'rewrite drops leftover poster-tile CSS');
assert.doesNotMatch(rewritten, /\.compute[^{]*\{/, 'rewrite drops leftover compute CSS');
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
  assert.doesNotMatch(hide, /\.skip-link/, 'chrome-hide does not re-lecture dropped skip-link');
  assert.doesNotMatch(hide, /footer/, 'chrome-hide does not re-lecture dropped footer');
  assert.doesNotMatch(hide, /\.compute/, 'chrome-hide does not re-lecture dropped .compute');
  assert.doesNotMatch(hide, /\.poster/, 'chrome-hide does not re-lecture dropped poster');
}
{
  const mobile = (rewritten.match(/<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  assert.match(mobile, /id=["']dasha-mobile-scroll["']/, 'mobile scroll unlock stays');
  assert.doesNotMatch(mobile, /\.poster-tile/, 'mobile-scroll does not re-lecture dropped .poster-tile');
  assert.doesNotMatch(mobile, /\.lobby-log/, 'mobile-scroll does not re-lecture leftover .lobby-log');
  assert.doesNotMatch(mobile, /#dasha-chess/, 'mobile-scroll does not re-lecture leftover #dasha-chess');
  assert.match(mobile, /\.dasha section/, 'mobile-scroll still unlocks section animation');
}

{
  const hide = hideHomeExtraChrome('<html><head></head><body id="dasha-home"></body></html>');
  const belt = (hide.match(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  assert.match(belt, /\.ticker/);
  assert.match(belt, /\.price/);
  assert.doesNotMatch(belt, /\.poster/);
  assert.doesNotMatch(belt, /\.skip-link/);
}

{
  const unlocked = unlockHomeMobileScroll('<html><head></head><body id="dasha-home"></body></html>');
  const mobile = (unlocked.match(/<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  assert.doesNotMatch(mobile, /\.poster-tile/);
  assert.doesNotMatch(mobile, /\.lobby-log/);
  assert.doesNotMatch(mobile, /#dasha-chess/);
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-dasha-edge'), 'html-security');
  const html = await home.text();
  assert.doesNotMatch(html, /\.skip-link\s*\{/, 'served home no leftover skip-link CSS');
  assert.doesNotMatch(html, /footer\s*\{/, 'served home no leftover footer CSS');
  assert.doesNotMatch(html, /\.compute[^{]*\{/, 'served home no leftover .compute CSS');
  assert.doesNotMatch(html, /\.poster\s*\{/, 'served home no leftover .poster CSS');
  assert.doesNotMatch(html, /\.poster-tile/, 'served home no leftover .poster-tile CSS');
  assert.doesNotMatch(html, /\.navlinks/, 'served home no leftover .navlinks CSS');
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
  assert.match(html, /\.skip-link\{/, 'privacy skip-link CSS stays');
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

console.log('dasha-home-dropped-selector-css: PASS (leftover skip-link/footer/.compute/.poster/.navlinks CSS dropped; repair h1/label + Watch price/ticker belt stay)');
