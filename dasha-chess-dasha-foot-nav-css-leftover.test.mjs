#!/usr/bin/env node
/**
 * Leftover after chess CSS/JS strip + product footer.dasha-foot <p> links.
 * Live /chess 200 still serializes leftover `footer.dasha-foot nav` CSS after
 * footer <nav> was already DOM-stripped (footer is $dasha · Buy · Chess · Bag ·
 * Telegram in a <p>). Humans see it in view-source. Distinct leftover vs leftover
 * id=leaders-panel / leftover .panel / leftover lobby footer.dasha-foot nav.
 * footer.dasha-foot + a + .buy-dasha stay. Disk only. No Designer.
 * Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverDashaFootNavCss,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover /chess dropped-selector CSS after footer.dasha-foot <nav> was already DOM-stripped"));
assert.match(workerSrc, /export function stripChessLeftoverDashaFootNavCss/);
assert.match(workerSrc, /out = stripChessLeftoverDashaFootNavCss\(out\);/);
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
<title>Dasha Chess</title>
<style>
.app{display:grid;gap:12px}.gate{display:flex}
.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim .buy-dasha{margin-left:auto}
.empty{color:var(--muted);margin:0}.identity{font-weight:900;color:var(--acid)}
footer.dasha-foot{padding:1.25rem 0;background:#070608}
footer.dasha-foot a{color:#f4eddb}
footer.dasha-foot a:hover{color:#dfff00}
footer.dasha-foot .buy-dasha,footer.dasha-foot .buy-dasha:hover{background:#dfff00;color:#070608}
footer.dasha-foot nav{display:flex;flex-wrap:wrap;gap:.15rem .25rem}
#buy-sheet{position:fixed}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div class="app"><section class="gate" id="gate"></section><div id="chess-stage"></div></div>
<p class="empty">No rated games yet</p>
<p class="identity">@dash_eats</p>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><div class="buy-chips" id="buy-chips"></div><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div>
<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a></p></footer>
</body></html>`;

assert.match(LIVE, /footer\.dasha-foot nav\{/, "fixture leftover footer.dasha-foot nav CSS paints");
assert.doesNotMatch(afterStyleScript(LIVE), /<nav\b/i, "fixture footer has no <nav>");
assert.match(afterStyleScript(LIVE), /<footer class="dasha-foot wrap">/, "fixture footer.dasha-foot stays");

const gone = stripChessLeftoverDashaFootNavCss(LIVE);
assert.doesNotMatch(gone, /footer\.dasha-foot nav\s*\{/, "drops leftover footer.dasha-foot nav CSS");
assert.match(gone, /footer\.dasha-foot\{/, "footer.dasha-foot CSS stays");
assert.match(gone, /footer\.dasha-foot a\{/, "footer.dasha-foot a CSS stays");
assert.match(gone, /footer\.dasha-foot \.buy-dasha/, "footer.dasha-foot .buy-dasha CSS stays");
assert.match(gone, /\.app\{/, ".app CSS stays");
assert.match(gone, /\.gate\{/, ".gate CSS stays");
assert.match(gone, /class=["']buy-dasha["']/, ".buy-dasha stays");
assert.match(gone, /id=["']chess-stage["']/, "chess-stage stays");
assert.match(gone, /id=["']buy-sheet["']/, "buy sheet stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.match(gone, /src="\/client\/chess-local\.js"/, "chess-local stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-rule, not eat-the-page");

{
  const keep = LIVE.replace(
    '<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=' +
      MINT +
      '">Buy</a></p></footer>',
    '<footer class="dasha-foot wrap"><nav><a href="/">$dasha</a></nav></footer>',
  );
  const out = stripChessLeftoverDashaFootNavCss(keep);
  assert.match(out, /footer\.dasha-foot nav\{/, "keeps footer.dasha-foot nav CSS when footer still has <nav>");
}

{
  const lobby = `<!doctype html><html><head><style>footer.dasha-foot nav{display:flex}.dasha-lobby{display:flex}</style></head><body>
<div id="dasha-lobby" class="dasha-lobby"></div>
<button id="forum-play-go">Play</button>
<div id="dasha-forum"></div>
<footer class="dasha-foot"><p><a class="buy-dasha" href="https://jup.ag/swap">Buy</a></p></footer>
</body></html>`;
  const out = stripChessLeftoverDashaFootNavCss(lobby);
  assert.match(out, /footer\.dasha-foot nav\{/, "lobby keeps leftover footer.dasha-foot nav CSS (separate leftover)");
}

const polished = polishServedSlim(LIVE);
assert.doesNotMatch(polished, /footer\.dasha-foot nav\s*\{/, "polish drops leftover footer.dasha-foot nav CSS");
assert.match(polished, /footer\.dasha-foot\{/, "polish keeps footer.dasha-foot");
assert.match(polished, /footer\.dasha-foot a\{/, "polish keeps footer.dasha-foot a");
assert.match(polished, /footer\.dasha-foot \.buy-dasha/, "polish keeps .buy-dasha");
assert.match(polished, /id=["']buy-sheet["']/, "buy sheet stays after polish");
assert.match(polished, /src="\/client\/chess-local\.js"/, "chess-local stays after polish");

assert.doesNotMatch(chessDisk, /footer\.dasha-foot nav\{/, "chess disk leftover footer.dasha-foot nav CSS stays dropped (prior leftover)");
assert.doesNotMatch(CHESS_PAGE_HTML, /footer\.dasha-foot nav\{/, "bundled leftover footer.dasha-foot nav CSS stays dropped (prior leftover)");
assert.doesNotMatch(afterStyleScript(chessDisk), /<nav\b/i, "chess disk footer has no <nav>");

const HOME = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
<style>footer.dasha-foot nav{display:flex}</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
<script>(()=>{const CA='${MINT}';window.DashaHomeMint={CA}})()</script>
</body></html>`;

assert.equal(stripChessLeftoverDashaFootNavCss(HOME), HOME, "home is not a chess leftover footer.dasha-foot nav page");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  assert.doesNotMatch(html, /footer\.dasha-foot nav\s*\{/, "served chess drops leftover footer.dasha-foot nav CSS");
  assert.doesNotMatch(afterStyleScript(html), /<nav\b/i, "served chess footer has no <nav>");
  assert.match(html, /footer\.dasha-foot\{/, "served footer.dasha-foot CSS stays");
  assert.match(html, /footer\.dasha-foot a\{/, "served footer.dasha-foot a CSS stays");
  assert.match(html, /footer\.dasha-foot \.buy-dasha/, "served footer.dasha-foot .buy-dasha CSS stays");
  assert.match(html, /class=["']buy-dasha["']/, "served .buy-dasha stays");
  assert.match(html, /id=["']buy-dasha["']/, "served #buy-dasha stays");
  assert.match(html, /\.app\{/, "served .app CSS stays");
  assert.match(html, /\.gate\{/, "served .gate CSS stays");
  assert.doesNotMatch(html, /\.panel\{/, "prior leftover .panel CSS stays dropped");
  assert.doesNotMatch(html, /\.dasha-quiet/, "prior leftover .dasha-quiet CSS stays dropped");
  assert.doesNotMatch(html, /\.privacy/, "prior leftover .privacy CSS stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "prior leftover chess mobile-scroll stays dropped");
  assert.doesNotMatch(html, /id=["']leaders-panel["']/, "prior leftover id=leaders-panel stays dropped");
  assert.match(html, /id=["']chess-stage["']/, "chess-stage stays");
  assert.match(html, /id=["']buy-sheet["']/, "buy sheet stays");
  assert.match(html, /jup\.ag/, "jup.ag stays");
  assert.match(html, new RegExp(MINT), "mint stays");
  assert.match(html, /chess-local\.js/, "chess-local stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "chess no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.doesNotMatch(html, /footer\.dasha-foot nav\s*\{/, "prior leftover lobby footer.dasha-foot nav CSS stays dropped");
  assert.match(html, /footer\.dasha-foot\{/, "lobby footer.dasha-foot CSS stays");
  assert.match(html, /footer\.dasha-foot a\{/, "lobby footer.dasha-foot a CSS stays");
  assert.match(html, /class=["']buy-dasha["']/, "lobby .buy-dasha stays");
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.match(html, /id=["']forum-play-go["']/, "#forum-play-go stays");
  assert.match(html, /id=["']dasha-forum["']/, "#dasha-forum stays");
  assert.match(html, /\.dasha-lobby\{/, ".dasha-lobby stays");
  assert.doesNotMatch(html, /\.forum-form/, "lobby leftover .forum-form CSS stays dropped");
  assert.match(html, /\.lobby-form\{/, "lobby .lobby-form CSS stays");
  assert.doesNotMatch(html, /\.forum-body/, "lobby leftover mixed .forum-body CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-status/, "lobby leftover mixed .forum-status CSS stays dropped");
  assert.match(html, /\.lobby-body/, "lobby .lobby-body CSS stays");
  assert.match(html, /\.lobby-status/, "lobby .lobby-status CSS stays");
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
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  const html = await howto.text();
  assert.doesNotMatch(html, /nav a\.btn\s*\{/, "prior leftover howto nav a.btn CSS stays dropped");
  assert.match(html, />Buy on Jupiter/, "Buy on Jupiter stays");
  assert.match(html, /id=["']ca["']/, "#ca stays");
  assert.match(html, /id=["']copy["']/, "id=copy stays");
}

{
  const privacy = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, "privacy product skip-link stays");
}

{
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /id=["']bb-x["']/, "bounties quiet Connect X stays");
  assert.match(html, /id=["']bb-app["']/, "#bb-app empty inventory stays");
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
}

{
  const studio = await edgeWorker.fetch(new Request("https://www.getdasha.com/studio"), {});
  assert.equal(studio.status, 308);
  assert.equal(studio.headers.get("location"), "https://www.getdasha.com/");
}

{
  const forum = await edgeWorker.fetch(new Request("https://www.getdasha.com/forum"), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get("location"), "https://www.getdasha.com/lobby");
}

console.log("dasha-chess-dasha-foot-nav-css-leftover: PASS (chess leftover footer.dasha-foot nav CSS gone; footer.dasha-foot + buy sheet stay)");
