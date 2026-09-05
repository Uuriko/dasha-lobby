#!/usr/bin/env node
/**
 * Leftover after home chrome DRY (style/script strip).
 * Live / 200 still serializes a 2020 portfolio CSS lecture inside live <style>:
 *   "Repairs for the 2020 portfolio template's stylesheet leaking"
 *   royal-blue / 1.1:1 / WCAG lecture
 * Humans see it in view-source without needing the old strip definition.
 * Repair rules (#dasha-home h1/h2/label) stay. Cherries SVG + @view-transition stay.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  stripDeadNav,
  stripHomePortfolioLecture,
  stripHomeWebflowBoot,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /export function stripHomePortfolioLecture/);
assert.match(workerSrc, /out = stripHomePortfolioLecture\(out\);/);
assert.match(workerSrc, /2020 portfolio template/);

const PORTFOLIO = `/* Repairs for the 2020 portfolio template's stylesheet leaking into this page. The Dasha
   markup sets no colour on these elements, so the inherited rules won. Everything here is
   scoped to #dasha-home with id specificity: it wins regardless of sheet order and cannot
   touch the hidden template sections or any other page.

   1. Headings rendered royal blue (rgb(79,112,223)) from \`h1 { color: var(--royal-blue) }\`;
      only the italic word was right, because \`h1 em\` is explicitly coloured.
   2. Form labels rendered rgb(38,25,43) on rgb(21,19,23) — a measured contrast ratio of
      1.1:1 against a WCAG AA minimum of 4.5:1, i.e. effectively invisible. These label the
      only conversion surface on the page, so they have to be readable. Ink on the panel
      measures ~15:1. */`;
const REPAIR = `#dasha-home h1,
#dasha-home h2 { color: var(--ink, #F2EDE7); }
#dasha-home #tool label { color: var(--ink, #F2EDE7); }`;
const CHERRIES = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20fill%3D%22%23dfff00%22%2F%3E%3C%2Fsvg%3E">';
const VIEW_CSS = '<style>@view-transition{navigation:auto}</style>';

const LIVE = `<!doctype html><html lang="en" id="dasha-home"><head>
<title>$dasha</title>
<meta name="description" content="$dasha on getdasha.com. dash_eats. Mint ${MINT}.">
${CHERRIES}
<link rel="stylesheet" href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/css/johns-awesome-project-39b1b5.webflow.shared.4e493bbf3.min.css">
${VIEW_CSS}
<style>
${PORTFOLIO}
${REPAIR}
</style>
<link rel="canonical" href="https://www.getdasha.com/">
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section><svg id="cherries"></svg></main>
<script src="https://lobby.getdasha.com/client/x-connect.js"></script>
<script src="https://lobby.getdasha.com/client/faucet.js"></script>
</body></html>`;

assert.match(LIVE, /2020 portfolio template/, 'fixture leftover 2020 portfolio lecture paints in live <style>');
assert.match(LIVE, /royal-blue/, 'fixture leftover royal-blue lecture');
assert.match(LIVE, /1\.1:1/, 'fixture leftover 1.1:1 lecture');
assert.match(LIVE, /WCAG AA/, 'fixture leftover WCAG lecture');
assert.match(LIVE, /#dasha-home h1/, 'fixture keeps repair h1 rule');
assert.match(LIVE, /#dasha-home #tool label/, 'fixture keeps repair label rule');

const lectureGone = stripHomePortfolioLecture(LIVE);
assert.doesNotMatch(lectureGone, /2020 portfolio template/, 'drops leftover 2020 portfolio lecture');
assert.doesNotMatch(lectureGone, /royal-blue/, 'drops leftover royal-blue lecture');
assert.doesNotMatch(lectureGone, /1\.1:1/, 'drops leftover 1.1:1 lecture');
assert.doesNotMatch(lectureGone, /WCAG AA/, 'drops leftover WCAG lecture');
assert.doesNotMatch(lectureGone, /stylesheet leaking/, 'drops leftover leaking lecture');
assert.match(lectureGone, /#dasha-home h1/, 'repair h1 rule stays');
assert.match(lectureGone, /#dasha-home h2/, 'repair h2 rule stays');
assert.match(lectureGone, /#dasha-home #tool label/, 'repair label rule stays');
assert.match(lectureGone, /var\(--ink, #F2EDE7\)/, 'repair color stays');
assert.match(lectureGone, /data:image\/svg\+xml/, 'cherries SVG stays');
assert.match(lectureGone, /@view-transition/, '@view-transition stays');
assert.match(lectureGone, /rel="canonical"/, 'canonical stays');
assert.match(lectureGone, /johns-awesome/, 'johns-awesome stays');
assert.match(lectureGone, /id=["']chat-door["']/, 'chat-door stays');
assert.match(lectureGone, /id=["']simp-door["']/, 'simp-door stays');
assert.match(lectureGone, /id=["']grok-door["']/, 'grok-door stays');
assert.match(lectureGone, /x-connect\.js/, 'x-connect.js stays');
assert.match(lectureGone, /faucet\.js/, 'faucet.js stays');
assert.match(lectureGone, /<header class="bar">/, 'header.bar stays');
assert.match(lectureGone, />Buy</, 'Buy stays');
assert.match(lectureGone, /jup\.ag\/swap/, 'jup.ag stays');
assert.match(lectureGone, new RegExp(MINT), 'mint stays');
assert.doesNotMatch(lectureGone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.ok(lectureGone.length > LIVE.length * 0.4, 'comment drop is per-comment, not eat-the-page');
assert.ok(lectureGone.length > 400 && lectureGone.includes('<body>'), 'comment drop cannot blank the fixture');

const booted = stripHomeWebflowBoot(LIVE);
assert.doesNotMatch(booted, /2020 portfolio template/, 'stripHomeWebflowBoot drops leftover 2020 lecture');
assert.doesNotMatch(booted, /royal-blue/, 'boot drop leftover royal-blue');
assert.match(booted, /#dasha-home h1/, 'boot keeps repair h1');
assert.match(booted, /@view-transition/, 'boot keeps @view-transition');
assert.match(booted, /id=["']chat-door["']/, 'boot keeps chat-door');
assert.match(booted, /id=["']simp-door["']/, 'boot keeps simp-door');
assert.match(booted, /id=["']grok-door["']/, 'boot keeps grok-door');
assert.match(booted, /x-connect\.js/, 'boot keeps x-connect.js');
assert.match(booted, /faucet\.js/, 'boot keeps faucet.js');
assert.match(booted, /johns-awesome/, 'boot keeps johns-awesome');
assert.doesNotMatch(booted, /plugin\.jup\.ag/, 'boot no plugin.jup.ag');

const rewritten = stripDeadNav(LIVE);
assert.doesNotMatch(rewritten, /2020 portfolio template/, 'stripDeadNav drops leftover 2020 lecture');
assert.match(rewritten, /#dasha-home h1/, 'rewrite keeps repair h1');
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
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('x-dasha-edge'), 'html-security');
  const html = await home.text();
  assert.doesNotMatch(html, /2020 portfolio template/, 'served home no leftover 2020 portfolio lecture');
  assert.doesNotMatch(html, /royal-blue/, 'served home no leftover royal-blue lecture');
  assert.doesNotMatch(html, /1\.1:1 against a WCAG/, 'served home no leftover WCAG lecture');
  assert.match(html, /#dasha-home h1/, 'served repair h1 stays');
  assert.doesNotMatch(html, /#dasha-home\s+#tool\s+label/, 'served leftover #tool label gone');
  assert.match(html, /#dasha-home h2/, 'served repair h2 stays');
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

console.log('dasha-home-portfolio-lecture: PASS (leftover 2020 portfolio CSS lecture dropped; repair rules + cherries SVG + @view-transition stay)');
