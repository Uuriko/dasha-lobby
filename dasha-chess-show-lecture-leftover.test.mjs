#!/usr/bin/env node
/**
 * Leftover after chess JS comment strip. Live /chess 200 still serializes leftover
 * JS lecture showLecture after hideLecture already hides #gate-kicker/#gate-title/#gate-copy.
 * Humans see leftover showLecture in view-source. showLecture is never called.
 * Distinct leftover vs leftover Invite / 1v1 comment / leftover watch:true.
 * Keep hideLecture(). Keep #gate-kicker + #gate-title + #gate-copy.
 * Keep #gate-invite + textContent='Invite' + JSON-LD Play. Invite. Find.
 * Keep watchingGame() + g.watch===true. Disk still emits leftover (polish drops it).
 * No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverShowLecture,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover /chess JS lecture showLecture after hideLecture already hides"),
);
assert.match(workerSrc, /export function stripChessLeftoverShowLecture/);
assert.match(workerSrc, /out = stripChessLeftoverShowLecture\(out\);/);
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
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Game","name":"Chess — $dasha","description":"Play. Invite. Find. ${MINT}"}</script>
<style>
.app{display:grid;gap:12px}.gate{display:flex}
.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim .buy-dasha{margin-left:auto}
.empty{color:var(--muted);margin:0}.identity{font-weight:900;color:var(--acid)}
footer.dasha-foot{padding:1.25rem 0;background:#070608}
#buy-sheet{position:fixed}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div class="app"><section class="gate" id="gate"><div class="kicker" id="gate-kicker" hidden></div><h2 id="gate-title" hidden></h2><p id="gate-copy" hidden></p><div class="gate-actions"><button class="btn" id="gate-action" type="button">Play</button><button class="btn" id="gate-invite" type="button">Invite</button><button class="btn" id="gate-find" type="button">Find</button></div></section><div id="chess-stage"></div></div>
<p class="empty">No rated games yet</p>
<p class="identity">@dash_eats</p>
<script>function watchingGame(g){return Boolean(g&&(g.watch===true||g.side==null)&&!g.local)}function hideLecture(){$('gate-kicker').hidden=true;$('gate-title').hidden=true;$('gate-copy').hidden=true}function showLecture(title,copy){$('gate-kicker').hidden=true;$('gate-title').hidden=!title;$('gate-title').textContent=title||'';$('gate-copy').hidden=!copy;$('gate-copy').textContent=copy||''}function showCasualBar(){var invite=$('gate-invite');if(invite){invite.hidden=false;invite.textContent='Invite'}}</script>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div>
<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a></p></footer>
</body></html>`;

assert.match(LIVE, /function showLecture\(title,copy\)/, "fixture leftover showLecture paints");
assert.match(LIVE, /function hideLecture\(\)/, "fixture hideLecture stays");
assert.match(afterStyleScript(LIVE), /id=["']gate-kicker["']/, "fixture #gate-kicker stays");
assert.match(afterStyleScript(LIVE), /id=["']gate-title["']/, "fixture #gate-title stays");
assert.match(afterStyleScript(LIVE), /id=["']gate-copy["']/, "fixture #gate-copy stays");
assert.match(afterStyleScript(LIVE), /id=["']gate-invite["']/, "fixture Invite button stays");

const gone = stripChessLeftoverShowLecture(LIVE);
assert.doesNotMatch(gone, /function showLecture/, "drops leftover showLecture");
assert.match(gone, /function hideLecture\(\)/, "hideLecture stays");
assert.match(gone, /id=["']gate-kicker["']/, "#gate-kicker stays");
assert.match(gone, /id=["']gate-title["']/, "#gate-title stays");
assert.match(gone, /id=["']gate-copy["']/, "#gate-copy stays");
assert.match(gone, /function watchingGame\(g\)/, "watchingGame stays");
assert.match(gone, /g\.watch===true/, "watchingGame still inlines g.watch===true");
assert.match(gone, /id=["']gate-invite["']/, "#gate-invite stays");
assert.match(gone, /textContent='Invite'/, "Invite textContent stays");
assert.match(gone, />Invite</, "Invite button copy stays");
assert.match(gone, /Play\. Invite\. Find\./, "JSON-LD Play. Invite. Find. stays");
assert.match(gone, /function showCasualBar\(\)/, "showCasualBar stays");
assert.match(gone, /class=["']buy-dasha["']/, ".buy-dasha stays");
assert.match(gone, /id=["']chess-stage["']/, "chess-stage stays");
assert.match(gone, /id=["']buy-sheet["']/, "buy sheet stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.match(gone, /src="\/client\/chess-local\.js"/, "chess-local stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "lecture drop is per-function, not eat-the-page");

{
  const lobby = `<!doctype html><html><head><style>.dasha-lobby{display:flex}</style></head><body>
<div id="dasha-lobby" class="dasha-lobby"></div>
<button id="forum-play-go">Play</button>
<div id="dasha-forum"></div>
<script>function showLecture(title,copy){return title+copy}</script>
</body></html>`;
  const out = stripChessLeftoverShowLecture(lobby);
  assert.match(out, /function showLecture/, "lobby does not eat leftover chess showLecture");
}

const polished = polishServedSlim(LIVE);
assert.doesNotMatch(polished, /function showLecture/, "polish drops leftover showLecture");
assert.match(polished, /function hideLecture\(\)/, "polish keeps hideLecture");
assert.match(polished, /function watchingGame\(g\)/, "polish keeps watchingGame");
assert.match(polished, /g\.watch===true/, "polish keeps g.watch===true");
assert.match(polished, /id=["']gate-invite["']/, "polish keeps #gate-invite");
assert.match(polished, /textContent='Invite'/, "polish keeps Invite textContent");
assert.match(polished, />Invite</, "polish keeps Invite button copy");
assert.match(polished, /Play\. Invite\. Find\./, "polish keeps JSON-LD Invite copy");
assert.match(polished, /id=["']buy-sheet["']/, "buy sheet stays after polish");
assert.match(polished, /src="\/client\/chess-local\.js"/, "chess-local stays after polish");

assert.match(chessDisk, /function showLecture\(title,copy\)/, "chess disk still emits leftover showLecture (polish drops it)");
assert.match(CHESS_PAGE_HTML, /function showLecture\(title,copy\)/, "bundled chess still emits leftover showLecture (polish drops it)");
assert.match(chessDisk, /function hideLecture\(\)/, "chess disk hideLecture stays");
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
<script>function showLecture(title,copy){return title}</script>
</body></html>`;

assert.equal(stripChessLeftoverShowLecture(HOME), HOME, "home is not a chess leftover showLecture page");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  assert.doesNotMatch(html, /function showLecture/, "served chess drops leftover showLecture");
  assert.match(html, /function hideLecture\(\)/, "served hideLecture stays");
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
  assert.doesNotMatch(html, /function showLecture/, "lobby has no leftover showLecture");
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

console.log("dasha-chess-show-lecture-leftover.test.mjs: ok");
