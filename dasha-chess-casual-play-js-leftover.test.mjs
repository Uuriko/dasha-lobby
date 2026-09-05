#!/usr/bin/env node
/**
 * Leftover after chess unused JS loadLeaders/playNow/flashBought strip. Live /chess 200 still
 * serializes leftover unused JS casualRematch / nextPlay / playReady / showPlayPair.
 * Defined, never called (no onclick / string refs). Humans see leftover functions in view-source.
 * Distinct leftover vs leftover unused JS loadLeaders / leftover showLecture.
 * Keep showCasualBar() + hidePlayPair(). Keep #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true.
 * Disk still emits leftover (polish drops it). No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverCasualPlayJs,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover /chess unused JS casualRematch / nextPlay / playReady / showPlayPair after never called"),
);
assert.match(workerSrc, /export function stripChessLeftoverCasualPlayJs/);
assert.match(workerSrc, /out = stripChessLeftoverCasualPlayJs\(out\);/);
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

function onlyDecl(src, name, label) {
  const hits = [...String(src).matchAll(new RegExp("\\b" + name + "\\b", "g"))];
  assert.equal(hits.length, 1, `${label} ${name} appears once`);
  const around = String(src).slice(Math.max(0, hits[0].index - 12), hits[0].index + name.length + 16);
  assert.match(around, new RegExp("function\\s+" + name), `${label} ${name} is a function decl, not a call`);
  assert.doesNotMatch(src, /onclick\s*=/, `${label} has no onclick`);
}

onlyDecl(chessDisk, "casualRematch", "chess disk");
onlyDecl(chessDisk, "nextPlay", "chess disk");
onlyDecl(chessDisk, "playReady", "chess disk");
onlyDecl(chessDisk, "showPlayPair", "chess disk");
onlyDecl(CHESS_PAGE_HTML, "casualRematch", "bundled chess");
onlyDecl(CHESS_PAGE_HTML, "nextPlay", "bundled chess");
onlyDecl(CHESS_PAGE_HTML, "playReady", "bundled chess");
onlyDecl(CHESS_PAGE_HTML, "showPlayPair", "bundled chess");

const LIVE = `<!doctype html><html lang="en"><head>
<title>Dasha Chess</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Game","name":"Chess — $dasha","description":"Play. Invite. Find. ${MINT}"}</script>
<style>
.app{display:grid;gap:12px}.gate{display:flex}
.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim .buy-dasha{margin-left:auto}
.empty{color:var(--muted);margin:0}.identity{font-weight:900;color:var(--acid)}
footer.dasha-foot{padding:1.25rem 0;background:#070608}
#buy-sheet{position:fixed}
.leaders{display:grid}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div class="app"><section class="gate" id="gate"><div class="kicker" id="gate-kicker" hidden></div><h2 id="gate-title" hidden></h2><p id="gate-copy" hidden></p><div class="gate-actions"><button class="btn" id="gate-action" type="button">Play</button><button class="btn" id="gate-invite" type="button">Invite</button><button class="btn" id="gate-find" type="button">Find</button></div></section>
<aside class="leaders"><ol class="leaders" id="leaders"></ol></aside>
<div id="chess-stage"></div></div>
<p class="empty">No rated games yet</p>
<p class="identity">@dash_eats</p>
<script>function watchingGame(g){return Boolean(g&&(g.watch===true||g.side==null)&&!g.local)}function hideLecture(){$('gate-kicker').hidden=true;$('gate-title').hidden=true;$('gate-copy').hidden=true}function casualRematch(g){if(!g)return false;if(g.casual||g.local)return true;function seat(p){return p&&(String(p.xId||p.id||'').indexOf('g_')===0||p.handle==='guest')}return seat(g.white)||seat(g.black)}function playReady(){return Boolean(me&&me.linked&&me.enrolled&&me.holder)}function showPlayPair(enabled){showCasualBar();var find=$('gate-find'),invite=$('gate-invite');find.disabled=!enabled;invite.disabled=!enabled}function hidePlayPair(){var cancel=$('gate-cancel');if(cancel)cancel.hidden=true}function showCasualBar(){var play=$('gate-action'),find=$('gate-find'),invite=$('gate-invite');if(play){play.hidden=false;play.disabled=false;play.textContent='Play'}if(find){find.hidden=false;find.disabled=false;find.textContent='Find'}if(invite){invite.hidden=false;invite.textContent='Invite'}}function nextPlay(){if(!me||!me.linked)return{text:'Link X',action:'link'};if(!me.enrolled)return{text:'Play',action:'join'};if(!me.holder)return{text:'Prove',action:'holder'};return{text:'Play',action:'queue'}}function findNow(button){if(busy)return;busy=true;joinQueue('join')}</script>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><p id="buy-flash" hidden></p><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div>
<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a></p></footer>
</body></html>`;

assert.match(LIVE, /function casualRematch\(g\)/, "fixture leftover casualRematch paints");
assert.match(LIVE, /function nextPlay\(\)/, "fixture leftover nextPlay paints");
assert.match(LIVE, /function playReady\(\)/, "fixture leftover playReady paints");
assert.match(LIVE, /function showPlayPair\(enabled\)/, "fixture leftover showPlayPair paints");
assert.match(afterStyleScript(LIVE), /id=["']gate-find["']/, "fixture #gate-find stays");
assert.match(afterStyleScript(LIVE), /id=["']gate-action["']/, "fixture #gate-action stays");

const gone = stripChessLeftoverCasualPlayJs(LIVE);
assert.doesNotMatch(gone, /function casualRematch/, "drops leftover casualRematch");
assert.doesNotMatch(gone, /function nextPlay/, "drops leftover nextPlay");
assert.doesNotMatch(gone, /function playReady/, "drops leftover playReady");
assert.doesNotMatch(gone, /function showPlayPair/, "drops leftover showPlayPair");
assert.doesNotMatch(gone, /\bcasualRematch\b/, "no leftover casualRematch token");
assert.doesNotMatch(gone, /\bnextPlay\b/, "no leftover nextPlay token");
assert.doesNotMatch(gone, /\bplayReady\b/, "no leftover playReady token");
assert.doesNotMatch(gone, /\bshowPlayPair\b/, "no leftover showPlayPair token");
assert.match(gone, /function showCasualBar\(\)/, "showCasualBar stays");
assert.match(gone, /function hidePlayPair\(\)/, "hidePlayPair stays");
assert.match(gone, /function hideLecture\(\)/, "hideLecture stays");
assert.match(gone, /function findNow\(button\)/, "findNow stays");
assert.match(gone, /id=["']gate-find["']/, "#gate-find stays");
assert.match(gone, /id=["']gate-action["']/, "#gate-action stays");
assert.match(gone, /id=["']gate-kicker["']/, "#gate-kicker stays");
assert.match(gone, /id=["']gate-title["']/, "#gate-title stays");
assert.match(gone, /id=["']gate-copy["']/, "#gate-copy stays");
assert.match(gone, /function watchingGame\(g\)/, "watchingGame stays");
assert.match(gone, /g\.watch===true/, "watchingGame still inlines g.watch===true");
assert.match(gone, /id=["']gate-invite["']/, "#gate-invite stays");
assert.match(gone, /textContent='Invite'/, "Invite textContent stays");
assert.match(gone, />Invite</, "Invite button copy stays");
assert.match(gone, /Play\. Invite\. Find\./, "JSON-LD Play. Invite. Find. stays");
assert.match(gone, /class=["']buy-dasha["']/, ".buy-dasha stays");
assert.match(gone, /id=["']chess-stage["']/, "chess-stage stays");
assert.match(gone, /id=["']buy-sheet["']/, "buy sheet stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.match(gone, /src="\/client\/chess-local\.js"/, "chess-local stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "unused JS drop is per-function, not eat-the-page");

{
  const lobby = `<!doctype html><html><head><style>.dasha-lobby{display:flex}</style></head><body>
<div id="dasha-lobby" class="dasha-lobby"></div>
<button id="forum-play-go">Play</button>
<div id="dasha-forum"></div>
<script>function casualRematch(){return 1}function nextPlay(){return 2}function playReady(){return 3}function showPlayPair(){return 4}</script>
</body></html>`;
  const out = stripChessLeftoverCasualPlayJs(lobby);
  assert.match(out, /function casualRematch/, "lobby does not eat leftover chess casualRematch");
  assert.match(out, /function nextPlay/, "lobby does not eat leftover chess nextPlay");
  assert.match(out, /function playReady/, "lobby does not eat leftover chess playReady");
  assert.match(out, /function showPlayPair/, "lobby does not eat leftover chess showPlayPair");
}

const polished = polishServedSlim(LIVE);
assert.doesNotMatch(polished, /\bcasualRematch\b/, "polish drops leftover casualRematch");
assert.doesNotMatch(polished, /\bnextPlay\b/, "polish drops leftover nextPlay");
assert.doesNotMatch(polished, /\bplayReady\b/, "polish drops leftover playReady");
assert.doesNotMatch(polished, /\bshowPlayPair\b/, "polish drops leftover showPlayPair");
assert.match(polished, /function showCasualBar\(\)/, "polish keeps showCasualBar");
assert.match(polished, /function hidePlayPair\(\)/, "polish keeps hidePlayPair");
assert.match(polished, /function hideLecture\(\)/, "polish keeps hideLecture");
assert.match(polished, /id=["']gate-find["']/, "polish keeps #gate-find");
assert.match(polished, /id=["']gate-action["']/, "polish keeps #gate-action");
assert.match(polished, /function watchingGame\(g\)/, "polish keeps watchingGame");
assert.match(polished, /g\.watch===true/, "polish keeps g.watch===true");
assert.match(polished, /id=["']gate-invite["']/, "polish keeps #gate-invite");
assert.match(polished, /textContent='Invite'/, "polish keeps Invite textContent");
assert.match(polished, />Invite</, "polish keeps Invite button copy");
assert.match(polished, /Play\. Invite\. Find\./, "polish keeps JSON-LD Invite copy");
assert.match(polished, /id=["']buy-sheet["']/, "buy sheet stays after polish");
assert.match(polished, /src="\/client\/chess-local\.js"/, "chess-local stays after polish");

assert.match(chessDisk, /function casualRematch\(g\)/, "chess disk still emits leftover casualRematch (polish drops it)");
assert.match(chessDisk, /function nextPlay\(\)/, "chess disk still emits leftover nextPlay (polish drops it)");
assert.match(chessDisk, /function playReady\(\)/, "chess disk still emits leftover playReady (polish drops it)");
assert.match(chessDisk, /function showPlayPair\(enabled\)/, "chess disk still emits leftover showPlayPair (polish drops it)");
assert.match(CHESS_PAGE_HTML, /function casualRematch\(g\)/, "bundled chess still emits leftover casualRematch (polish drops it)");
assert.match(CHESS_PAGE_HTML, /function nextPlay\(\)/, "bundled chess still emits leftover nextPlay (polish drops it)");
assert.match(CHESS_PAGE_HTML, /function playReady\(\)/, "bundled chess still emits leftover playReady (polish drops it)");
assert.match(CHESS_PAGE_HTML, /function showPlayPair\(enabled\)/, "bundled chess still emits leftover showPlayPair (polish drops it)");
assert.match(chessDisk, /function showCasualBar\(\)/, "chess disk showCasualBar stays");
assert.match(chessDisk, /function hidePlayPair\(\)/, "chess disk hidePlayPair stays");
assert.match(chessDisk, /function hideLecture\(\)/, "chess disk hideLecture stays");
assert.match(chessDisk, /id=["']gate-find["']/, "chess disk #gate-find stays");
assert.match(chessDisk, /id=["']gate-action["']/, "chess disk #gate-action stays");
assert.match(chessDisk, /function watchingGame\(g\)/, "chess disk watchingGame stays");
assert.match(chessDisk, /g\.watch===true/, "chess disk g.watch===true stays");
assert.match(chessDisk, /id=["']gate-invite["']/, "chess disk #gate-invite stays");
assert.match(chessDisk, /textContent='Invite'/, "chess disk Invite textContent stays");
assert.match(chessDisk, /Play\. Invite\. Find\./, "chess disk JSON-LD Invite copy stays");

const HOME = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="grwm"><div class="grwm-phone"></div></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
<script>function casualRematch(){return 1}function nextPlay(){return 2}function playReady(){return 3}function showPlayPair(){return 4}</script>
</body></html>`;

assert.equal(stripChessLeftoverCasualPlayJs(HOME), HOME, "home is not a chess leftover casual-play JS page");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  assert.doesNotMatch(html, /\bcasualRematch\b/, "served chess drops leftover casualRematch");
  assert.doesNotMatch(html, /\bnextPlay\b/, "served chess drops leftover nextPlay");
  assert.doesNotMatch(html, /\bplayReady\b/, "served chess drops leftover playReady");
  assert.doesNotMatch(html, /\bshowPlayPair\b/, "served chess drops leftover showPlayPair");
  assert.match(html, /function showCasualBar\(\)/, "served showCasualBar stays");
  assert.match(html, /function hidePlayPair\(\)/, "served hidePlayPair stays");
  assert.match(html, /function hideLecture\(\)/, "served hideLecture stays");
  assert.match(html, /id=["']gate-find["']/, "served #gate-find stays");
  assert.match(html, /id=["']gate-action["']/, "served #gate-action stays");
  assert.match(html, /id=["']gate-kicker["']/, "served #gate-kicker stays");
  assert.match(html, /id=["']gate-title["']/, "served #gate-title stays");
  assert.match(html, /id=["']gate-copy["']/, "served #gate-copy stays");
  assert.match(html, /function watchingGame\(g\)/, "served watchingGame stays");
  assert.match(html, /g\.watch===true/, "served watchingGame still inlines g.watch===true");
  assert.match(html, /id=["']gate-invite["']/, "served #gate-invite stays");
  assert.match(html, /textContent='Invite'/, "served Invite textContent stays");
  assert.match(html, />Invite</, "served Invite button copy stays");
  assert.match(html, /Play\. Invite\. Find\./, "served JSON-LD Invite copy stays");
  assert.match(html, /class=["']buy-dasha["']/, "served .buy-dasha stays");
  assert.match(html, /\.app\{/, "served .app CSS stays");
  assert.match(html, /\.gate\{/, "served .gate CSS stays");
  assert.doesNotMatch(html, /function showLecture/, "prior leftover showLecture stays dropped");
  assert.doesNotMatch(html, /\bloadLeaders\b/, "prior leftover loadLeaders stays dropped");
  assert.doesNotMatch(html, /\bplayNow\b/, "prior leftover playNow stays dropped");
  assert.doesNotMatch(html, /\bflashBought\b/, "prior leftover flashBought stays dropped");
  assert.doesNotMatch(html, /\/\* Invite \/ 1v1 \*\//, "prior leftover Invite / 1v1 comment stays dropped");
  assert.doesNotMatch(html, /\/\* watch:true \*\//, "prior leftover watch:true comment stays dropped");
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
  assert.doesNotMatch(html, /\bcasualRematch\b/, "lobby has no leftover casualRematch");
  assert.doesNotMatch(html, /\bnextPlay\b/, "lobby has no leftover nextPlay");
  assert.doesNotMatch(html, /\bplayReady\b/, "lobby has no leftover playReady");
  assert.doesNotMatch(html, /\bshowPlayPair\b/, "lobby has no leftover showPlayPair");
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.match(html, /id=["']forum-play-go["']/, "#forum-play-go stays");
  assert.match(html, /id=["']dasha-forum["']/, "#dasha-forum stays");
  assert.match(html, /\.dasha-lobby\{/, ".dasha-lobby stays");
  assert.match(html, /class=["']lobby-form["']/, ".lobby-form stays");
  assert.match(html, /\.lobby-body/, "lobby .lobby-body CSS stays");
  assert.match(html, /\.lobby-status/, "lobby .lobby-status CSS stays");
  assert.match(html, /x-connect\.js/, "lobby x-connect.js stays");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /\.dasha a,\.dasha strong/, "home leftover mixed .dasha a,.dasha strong still paints (a under .dasha)");
  assert.match(html, /\.dasha h1,\.dasha h2\{/, "served .dasha h1,.dasha h2 stays");
  assert.doesNotMatch(html, /\.dasha h3/, "prior leftover .dasha h3 CSS stays dropped");
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
  assert.match(html, />Buy on Jupiter/, "Buy on Jupiter stays");
  assert.match(html, /id=["']ca["']/, "#ca stays");
  assert.match(html, /id=["']copy["']/, "id=copy stays");
}

{
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /id=["']bb-x["']/, "#bb-x stays");
  assert.match(html, /id=["']bb-app["']/, "#bb-app stays");
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

console.log("dasha-chess-casual-play-js-leftover.test.mjs: ok");
