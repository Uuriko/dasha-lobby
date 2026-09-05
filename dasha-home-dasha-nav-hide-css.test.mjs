#!/usr/bin/env node
/**
 * Leftover after home dasha-nav DOM-strip + chrome-hide DRY.
 * Live / 200 still serializes `.dasha-nav{display:none!important}` in the repair <style>
 * after leftover `<nav class="dasha-nav">` was already dropped from the document.
 * Humans see it in view-source. Repair #dasha-home h1/h2/label stay.
 * Watch price/ticker remount belt stays. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  hideHomeExtraChrome,
  stripDeadNav,
  stripHomeDashaNavHideCss,
  stripHomeWebflowBoot,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const HIDE = '.dasha-nav{display:none!important}';
const REPAIR = `#dasha-home h1,
#dasha-home h2 { color: var(--ink, #F2EDE7); }
#dasha-home #tool label { color: var(--ink, #F2EDE7); }`;
const CHERRIES = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20fill%3D%22%23dfff00%22%2F%3E%3C%2Fsvg%3E">';
const VIEW_CSS = '<style>@view-transition{navigation:auto}</style>';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripHomeDashaNavHideCss/);
assert.match(workerSrc, /out = stripHomeDashaNavHideCss\(out\);/);

const LIVE = `<!doctype html><html lang="en" id="dasha-home"><head>
<title>$dasha</title>
<meta name="description" content="$dasha on getdasha.com. dash_eats. Mint ${MINT}.">
${CHERRIES}
<link rel="stylesheet" href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/css/johns-awesome-project-39b1b5.webflow.shared.4e493bbf3.min.css">
${VIEW_CSS}
<style>
${REPAIR}


${HIDE}
</style>
<link rel="canonical" href="https://www.getdasha.com/">
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section><svg id="cherries"></svg></main>
<script src="https://lobby.getdasha.com/client/x-connect.js"></script>
<script src="https://lobby.getdasha.com/client/faucet.js"></script>
</body></html>`;

assert.match(LIVE, /\.dasha-nav\{display:none!important\}/, 'fixture leftover dasha-nav hide CSS paints in live <style>');
assert.doesNotMatch(LIVE, /<nav class="dasha-nav">/, 'fixture nav already DOM-stripped');
assert.match(LIVE, /#dasha-home h1/, 'fixture keeps repair h1 rule');
assert.match(LIVE, /#dasha-home #tool label/, 'fixture keeps repair label rule');

const gone = stripHomeDashaNavHideCss(LIVE);
assert.doesNotMatch(gone, /\.dasha-nav\s*\{/, 'drops leftover dasha-nav hide CSS');
assert.doesNotMatch(gone, /display:none!important/, 'drops leftover hide declaration');
assert.match(gone, /#dasha-home h1/, 'repair h1 rule stays');
assert.match(gone, /#dasha-home h2/, 'repair h2 rule stays');
assert.match(gone, /#dasha-home #tool label/, 'repair label rule stays');
assert.match(gone, /var\(--ink, #F2EDE7\)/, 'repair color stays');
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
assert.ok(gone.length > LIVE.length * 0.4, 'hide-css drop is per-rule, not eat-the-page');
assert.ok(gone.length > 400 && gone.includes('<body>'), 'hide-css drop cannot blank the fixture');

const other = stripHomeDashaNavHideCss('<html><head><style>.dasha-nav{display:none!important}</style></head><body><p>privacy skip</p></body></html>');
assert.match(other, /\.dasha-nav\{display:none!important\}/, 'non-home pages keep their CSS');

const booted = stripHomeWebflowBoot(LIVE);
assert.doesNotMatch(booted, /\.dasha-nav\s*\{/, 'stripHomeWebflowBoot drops leftover dasha-nav hide CSS');
assert.match(booted, /#dasha-home h1/, 'boot keeps repair h1');
assert.doesNotMatch(booted, /#dasha-home\s+#tool\s+label/, 'boot drops leftover #tool label');
assert.match(booted, /#dasha-home h2/, 'boot keeps repair h2');
assert.match(booted, /@view-transition/, 'boot keeps @view-transition');
assert.match(booted, /id=["']chat-door["']/, 'boot keeps chat-door');
assert.match(booted, /id=["']simp-door["']/, 'boot keeps simp-door');
assert.match(booted, /id=["']grok-door["']/, 'boot keeps grok-door');
assert.match(booted, /x-connect\.js/, 'boot keeps x-connect.js');
assert.match(booted, /faucet\.js/, 'boot keeps faucet.js');
assert.match(booted, /johns-awesome/, 'boot keeps johns-awesome');
assert.doesNotMatch(booted, /plugin\.jup\.ag/, 'boot no plugin.jup.ag');

const rewritten = stripDeadNav(LIVE);
assert.doesNotMatch(rewritten, /\.dasha-nav\s*\{/, 'stripDeadNav drops leftover dasha-nav hide CSS');
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
  assert.doesNotMatch(hide, /\.dasha-nav/, 'chrome-hide does not re-lecture dropped .dasha-nav');
}

{
  const hide = hideHomeExtraChrome('<html><head></head><body id="dasha-home"></body></html>');
  const belt = (hide.match(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
  assert.match(belt, /\.ticker/);
  assert.match(belt, /\.price/);
  assert.doesNotMatch(belt, /\.dasha-nav/);
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-dasha-edge'), 'html-security');
  const html = await home.text();
  assert.doesNotMatch(html, /\.dasha-nav\s*\{/, 'served home no leftover dasha-nav hide CSS');
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
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

console.log('dasha-home-dasha-nav-hide-css: PASS (leftover .dasha-nav hide CSS dropped; repair h1/label + Watch price/ticker belt stay)');
