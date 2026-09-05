#!/usr/bin/env node
/**
 * Leftover after howto leftover nav a.btn CSS + leftover id=buy2.
 * Live /how-to-buy 200 still serializes leftover x-connect.js after CSS/JS
 * strip. Howto has no [data-dasha-login], [data-dasha-login-link], oauth/x,
 * or #bb-x. Humans see leftover x-connect.js in view-source. Distinct leftover
 * vs leftover nav a.btn CSS. Home/lobby/chess/login/faucet/bounties x-connect.js
 * stay. Mint COPY + Buy on Jupiter + #ca stay. Disk only. No Designer.
 * Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishHowtoHtml,
  stripHowtoLeftoverXConnectJs,
} from "./dasha-lobby-worker.mjs";
import { HOWTO_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";
const XTAG = '<script src="https://lobby.getdasha.com/client/x-connect.js" integrity="sha384-DD4R1qMUUftlIFJU3g7ZEourjvxcSYVEgduLdXUFYfTr8DlnmAVh+Hm0EVLU/hQY" crossorigin="anonymous" defer></script>';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover /how-to-buy x-connect.js after CSS/JS strip"));
assert.match(workerSrc, /export function stripHowtoLeftoverXConnectJs/);
assert.match(workerSrc, /page = stripHowtoLeftoverXConnectJs\(page\);/);
assert.doesNotMatch(
  workerSrc,
  /injectXConnectPrompt\(polishHowtoHtml\(HOWTO_HTML\)\)/,
  "www /how-to-buy does not re-inject leftover x-connect.js",
);
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

const LIVE = `<!doctype html><html lang="en"><head>
<title>How to buy $dasha</title>
<style>
.skip-link{position:absolute;left:-9999px}
nav{display:flex}
nav a{color:var(--paper)}
.btn{min-height:48px}
.btn.ghost{background:transparent}
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
    <div class="actions">
      <a class="btn" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111112&buy=${MINT}">Buy on Jupiter ↗</a>
    </div>
  </article>
</main>
<script>(()=>{const CA='${MINT}';const b=document.getElementById('copy');b&&b.addEventListener('click',()=>{});window.DashaHowToBuy={CA}})()</script>
${XTAG}
</body></html>`;

assert.match(LIVE, /x-connect\.js/, "fixture leftover x-connect.js paints");
assert.doesNotMatch(afterStyleScript(LIVE), /data-dasha-login/, "fixture has no login mount");
assert.doesNotMatch(afterStyleScript(LIVE), /oauth\/x|#bb-x|id=["']bb-x["']/, "fixture has no oauth/x or #bb-x");

const gone = stripHowtoLeftoverXConnectJs(LIVE);
assert.doesNotMatch(gone, /x-connect\.js/, "drops leftover howto x-connect.js");
assert.match(gone, /window\.DashaHowToBuy/, "mint COPY JS stays");
assert.match(gone, /id=["']copy["']/, "id=copy stays");
assert.match(gone, />Buy on Jupiter/, "Buy on Jupiter stays");
assert.match(gone, /id=["']ca["']/, "#ca stays");
assert.match(gone, /class=["']skip-link["']/, "skip-link stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "JS drop is per-script, not eat-the-page");

{
  const home = `<!doctype html><html><head></head><body>
<main id="dasha-home"><section id="chat-door"></section><section id="grok-door"></section>
<section id="dasha-home-faucet"></section><section id="grwm"></section></main>
${XTAG}
</body></html>`;
  const out = stripHowtoLeftoverXConnectJs(home);
  assert.match(out, /x-connect\.js/, "home x-connect.js stays");
  assert.match(out, /id=["']chat-door["']/, "home chat-door stays");
  assert.match(out, /id=["']grok-door["']/, "home grok-door stays");
}

{
  const lobby = `<!doctype html><html><head></head><body>
<div id="dasha-lobby" class="dasha-lobby"><button id="forum-play-go">Play</button><div id="dasha-forum"></div></div>
${XTAG}
</body></html>`;
  const out = stripHowtoLeftoverXConnectJs(lobby);
  assert.match(out, /x-connect\.js/, "lobby x-connect.js stays");
  assert.match(out, /id=["']forum-play-go["']/, "Play stays");
  assert.match(out, /id=["']dasha-forum["']/, "threads mount stays");
}

assert.doesNotMatch(HOWTO_HTML, /x-connect\.js/, "disk HOWTO_HTML has no x-connect.js (inject was leftover)");
assert.doesNotMatch(polishHowtoHtml(HOWTO_HTML), /x-connect\.js/, "polished disk has no leftover x-connect.js");
assert.doesNotMatch(polishHowtoHtml(LIVE), /x-connect\.js/, "polished leftover fixture drops x-connect.js");
assert.match(polishHowtoHtml(LIVE), /window\.DashaHowToBuy/, "polished leftover fixture keeps mint COPY JS");
assert.match(polishHowtoHtml(HOWTO_HTML), />Buy on Jupiter/, "polished disk Buy on Jupiter");
assert.match(polishHowtoHtml(HOWTO_HTML), /id=["']ca["']/, "polished disk #ca");
assert.match(polishHowtoHtml(HOWTO_HTML), /id=["']copy["']/, "polished disk id=copy");

function assertNoHowtoXConnect(html, label) {
  assert.doesNotMatch(html, /x-connect\.js/, `${label} no leftover x-connect.js`);
  assert.match(html, />Buy on Jupiter/, `${label} Buy on Jupiter`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, /id=["']ca["']/, `${label} #ca`);
  assert.match(html, /id=["']copy["']/, `${label} id=copy`);
  assert.match(html, /class=["']skip-link["']/, `${label} skip-link`);
  assert.match(html, /<h1>How to buy \$dasha<\/h1>/, `${label} H1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoHowtoXConnect(polishHowtoHtml(LIVE), "polished leftover fixture");
assertNoHowtoXConnect(polishHowtoHtml(HOWTO_HTML), "polished disk");

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  assert.equal(howto.headers.get("x-dasha-edge"), "howto");
  const html = await howto.text();
  assertNoHowtoXConnect(html, "served howto");
  assert.doesNotMatch(afterStyleScript(html), /data-dasha-login/, "served howto has no login mount");
  assert.doesNotMatch(html, /nav a\.btn\s*\{/, "prior leftover nav a.btn CSS stays dropped");
  assert.doesNotMatch(html, /\bid=["']buy2["']/, "prior leftover id=buy2 stays dropped");
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /x-connect\.js/, "home x-connect.js stays");
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
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /x-connect\.js/, "lobby x-connect.js stays");
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.match(html, /id=["']forum-play-go["']/, "forum-play-go stays");
  assert.match(html, /id=["']dasha-forum["']/, "dasha-forum stays");
  assert.match(html, /class=["']dasha-lobby["']|\.dasha-lobby\{/, ".dasha-lobby stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /x-connect\.js/, "chess x-connect.js stays");
  assert.match(html, /class=["']buy-dasha["']/, "chess .buy-dasha stays");
  assert.match(html, /id=["']buy-dasha["']/, "chess #buy-dasha stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const login = await edgeWorker.fetch(new Request("https://www.getdasha.com/login"), {});
  assert.equal(login.status, 200);
  const html = await login.text();
  assert.match(html, /x-connect\.js/, "login x-connect.js stays");
  assert.match(html, /data-dasha-login/, "login mount stays");
}

{
  const faucet = await edgeWorker.fetch(new Request("https://www.getdasha.com/faucet"), {});
  assert.equal(faucet.status, 200);
  const html = await faucet.text();
  assert.match(html, /x-connect\.js/, "faucet x-connect.js stays");
  assert.match(html, /faucet\.js/, "faucet.js stays");
}

{
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /x-connect\.js/, "bounties x-connect.js stays");
  assert.match(html, /id=["']bb-x["']/, "#bb-x stays");
  assert.match(html, /id=["']bb-app["']/, "#bb-app empty inventory stays");
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
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

console.log("dasha-howto-x-connect-js-leftover: PASS (leftover howto x-connect.js droppable; home/lobby/chess/login/faucet/bounties x-connect stay)");
