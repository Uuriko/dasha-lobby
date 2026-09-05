#!/usr/bin/env node
/**
 * Leftover after howto dropped-selector .risk/.when/.fine + leftover id=buy2.
 * Live /how-to-buy 200 still serializes leftover `nav a.btn` CSS after nav Buy
 * was already DOM-stripped (nav is $dasha only). Humans see it in view-source.
 * Distinct leftover vs leftover .risk/.when/.fine CSS. .btn + .btn.ghost stay.
 * Buy on Jupiter + #ca + id=copy stay. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishHowtoHtml,
  stripHowtoLeftoverNavBtnCss,
} from "./dasha-lobby-worker.mjs";
import { HOWTO_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover /how-to-buy dropped-selector CSS after nav Buy was already DOM-stripped"));
assert.match(workerSrc, /export function stripHowtoLeftoverNavBtnCss/);
assert.match(workerSrc, /page = stripHowtoLeftoverNavBtnCss\(page\);/);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /#grwm \.grwm-phone/,
  "mobile-scroll still unlocks GRWM phone",
);
assert.match(
  (workerSrc.match(/const style = '<style id="dasha-home-chrome-hide">[\s\S]*?<\/style>';/) || [""])[0],
  /\.price,#price,\.ticker.*#spark\{display:none!important\}/,
  "Watch belt selector list stays",
);

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

function navHtml(html) {
  return (afterStyleScript(html).match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i) || [""])[0];
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>How to buy $dasha</title>
<style>
.skip-link{position:absolute;left:-9999px}
nav{display:flex}
nav a{color:var(--paper)}
nav a.btn{color:var(--ink);font-size:13px;padding:0 18px}
.btn{min-height:48px}
.btn.ghost{background:transparent}
.actions{display:flex}
.facts{border-top:1px solid var(--line)}
</style>
</head><body>
<a class="skip-link" href="#ca">Skip to mint</a>
<main class="wrap">
  <nav aria-label="Dasha"><a href="/">$dasha</a></nav>
  <h1>How to buy $dasha</h1>
  <p class="lede">SOL → mint → Buy.</p>
  <code class="ca" id="ca">${MINT}</code>
  <button type="button" class="btn" id="copy">Copy CA</button>
  <article class="step" data-n="03">
    <h2>Swap SOL → $dasha</h2>
    <p>Opens Jupiter with SOL selling into the exact mint above.</p>
    <div class="actions">
      <a class="btn" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy on Jupiter ↗</a>
      <a class="btn ghost" href="https://solscan.io/token/${MINT}">Solscan ↗</a>
    </div>
  </article>
  <section class="facts"><h2>On-chain</h2></section>
</main>
</body></html>`;

assert.match(LIVE, /nav a\.btn\{/, "fixture leftover nav a.btn CSS paints");
assert.doesNotMatch(navHtml(LIVE), /\bbtn\b/, "fixture nav has no .btn");
assert.match(afterStyleScript(LIVE), /class=["']btn["']/, "fixture action .btn stays");

const gone = stripHowtoLeftoverNavBtnCss(LIVE);
assert.doesNotMatch(gone, /nav a\.btn\s*\{/, "drops leftover nav a.btn CSS");
assert.match(gone, /nav a\{/, "nav a CSS stays");
assert.match(gone, /\.btn\{/, ".btn CSS stays");
assert.match(gone, /\.btn\.ghost\{/, ".btn.ghost CSS stays");
assert.match(gone, />Buy on Jupiter/, "Buy on Jupiter stays");
assert.match(gone, /id=["']ca["']/, "#ca stays");
assert.match(gone, /id=["']copy["']/, "id=copy stays");
assert.match(gone, /class=["']skip-link["']/, "skip-link stays");
assert.match(gone, /\.facts\{/, ".facts CSS stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-rule, not eat-the-page");

{
  const keep = LIVE.replace('<nav aria-label="Dasha"><a href="/">$dasha</a></nav>', '<nav aria-label="Dasha"><a class="btn" href="/how-to-buy">Buy</a></nav>');
  const out = stripHowtoLeftoverNavBtnCss(keep);
  assert.match(out, /nav a\.btn\{/, "keeps nav a.btn CSS when nav still has .btn");
}

assert.match(HOWTO_HTML, /nav a\.btn\{/, "disk source still has leftover nav a.btn CSS (polish drops it; did not run static-gen)");

function assertNoNavBtnCss(html, label) {
  assert.doesNotMatch(html, /nav a\.btn\s*\{/, `${label} no leftover nav a.btn CSS`);
  assert.match(html, /\.btn\{/, `${label} .btn CSS`);
  assert.match(html, />Buy on Jupiter/, `${label} Buy on Jupiter`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, /id=["']ca["']/, `${label} #ca`);
  assert.match(html, /id=["']copy["']/, `${label} id=copy`);
  assert.match(html, /class=["']skip-link["']/, `${label} skip-link`);
  assert.match(html, /<h1>How to buy \$dasha<\/h1>/, `${label} H1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoNavBtnCss(polishHowtoHtml(LIVE), "polished leftover fixture");
assertNoNavBtnCss(polishHowtoHtml(HOWTO_HTML), "polished disk");
assert.match(polishHowtoHtml(HOWTO_HTML), /\.btn\.ghost\{/, "polished disk .btn.ghost stays");
assert.match(polishHowtoHtml(HOWTO_HTML), /nav a\{/, "polished disk nav a stays");

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  assert.equal(howto.headers.get("x-dasha-edge"), "howto");
  const html = await howto.text();
  assertNoNavBtnCss(html, "served howto");
  assert.doesNotMatch(navHtml(html), /\bbtn\b/, "served nav has no .btn");
  assert.match(html, /\.btn\.ghost\{/, "served .btn.ghost CSS");
  assert.match(html, /nav a\{/, "served nav a CSS");
  assert.match(html, /id=["']copy["']/, "served id=copy");
  assert.doesNotMatch(html, /x-connect\.js/, "howto leftover x-connect.js is a separate strip");
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "home mobile-scroll stays");
  assert.match(html, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
  assert.match(html, /id=["']dasha-digest-remount["']/, "home remount stays");
  assert.match(html, /\/digest\.json/, "home remount still fetches /digest.json");
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
  assert.match(html, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
  assert.match(html, /#spark\{display:none!important\}/, "Watch #spark hide stays");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /@view-transition/, "product @view-transition stays");
  assert.match(html, /johns-awesome/, "johns-awesome CSS stays");
  assert.match(html, /data:image\/svg\+xml/, "cherries SVG stays");
  assert.match(html, /faucet\.js/, "faucet.js stays");
  assert.match(html, /x-connect\.js/, "x-connect.js stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.match(html, /id=["']forum-play-go["']/, "forum-play-go stays");
  assert.match(html, /id=["']dasha-forum["']/, "dasha-forum stays");
  assert.match(html, /class=["']dasha-lobby["']|\.dasha-lobby\{/, ".dasha-lobby stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const privacy = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, "privacy product skip-link stays");
}

{
  const forum = await edgeWorker.fetch(new Request("https://www.getdasha.com/forum"), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get("location"), "https://www.getdasha.com/lobby");
}

{
  const studio = await edgeWorker.fetch(new Request("https://www.getdasha.com/studio"), {});
  assert.equal(studio.status, 308);
  assert.equal(studio.headers.get("location"), "https://www.getdasha.com/");
}

console.log("dasha-howto-nav-btn-css-leftover: PASS (leftover nav a.btn CSS droppable; .btn + Buy on Jupiter + #ca stay)");
