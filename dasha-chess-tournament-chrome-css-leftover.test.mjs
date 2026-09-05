#!/usr/bin/env node
/**
 * Leftover after chess unused JS casualRematch/nextPlay/playReady/showPlayPair strip.
 * Live /chess 200 still serializes leftover unused tournament CSS
 * `.tournament-meta` / `.bracket` / `.champion` / `.entrants` / `.tournament-actions`.
 * Those classes never paint: static DOM has #tournament + .tournament-form only;
 * wantTournamentChrome() is false. Humans see leftover tournament essay CSS in view-source.
 * Distinct leftover vs leftover unused JS casualRematch / leftover unused JS loadLeaders.
 * Keep #tournament + .tournament-form. Keep showCasualBar() + hidePlayPair().
 * Keep #gate-find + #gate-action. Keep hideLecture() + watchingGame() + g.watch===true.
 * Disk still emits leftover (polish drops it). No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverTournamentChromeCss,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover /chess dropped-selector CSS after .tournament-meta / .bracket / .champion / .entrants / .tournament-actions"),
);
assert.match(workerSrc, /export function stripChessLeftoverTournamentChromeCss/);
assert.match(workerSrc, /out = stripChessLeftoverTournamentChromeCss\(out\);/);
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

function noPaintedClass(html, name, label) {
  assert.doesNotMatch(
    afterStyleScript(html),
    new RegExp(`class=["'][^"']*\\b${name}\\b`),
    `${label} ${name} never in DOM`,
  );
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>Dasha Chess</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Game","name":"Chess — $dasha","description":"Play. Invite. Find. ${MINT}"}</script>
<style>
.app{display:grid;gap:12px}.gate{display:flex}
.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim .buy-dasha{margin-left:auto}
.tournament-form{display:flex;flex-wrap:wrap;gap:8px}.tournament-form input{min-width:0;flex:1}.tournament-form .btn{padding:0 14px}.tournament-meta{color:var(--muted);margin:0 0 12px}.tournament-actions{display:flex;flex-wrap:wrap;gap:8px}.tournament-actions .btn{min-height:48px;padding:0 14px}.entrants,.bracket{list-style:none;padding:0;margin:12px 0 0;font:13px/1.5 monospace}.entrants li,.bracket li{border-top:1px solid var(--line);padding:7px 0}.champion{color:var(--acid);font-weight:950}
.empty{color:var(--muted);margin:0}.identity{font-weight:900;color:var(--acid)}
footer.dasha-foot{padding:1.25rem 0;background:#070608}
#buy-sheet{position:fixed}
.leaders{display:grid}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div class="app"><section class="gate" id="gate"><div class="kicker" id="gate-kicker" hidden></div><h2 id="gate-title" hidden></h2><p id="gate-copy" hidden></p><div class="gate-actions"><button class="btn" id="gate-action" type="button">Play</button><button class="btn" id="gate-invite" type="button">Invite</button><button class="btn" id="gate-find" type="button">Find</button></div></section>
<aside class="leaders"><ol class="leaders" id="leaders"></ol></aside>
<section id="tournament" hidden><h2>Play</h2><div id="tournament-body"><form class="tournament-form" id="tournament-form"><input id="tournament-name" maxlength="48" placeholder="Cup name" aria-label="Tournament name"><button class="btn" type="button">Link X</button></form></div></section>
<div id="chess-stage"></div></div>
<p class="empty">No rated games yet</p>
<p class="identity">@dash_eats</p>
<script>function watchingGame(g){return Boolean(g&&(g.watch===true||g.side==null)&&!g.local)}function hideLecture(){$('gate-kicker').hidden=true;$('gate-title').hidden=true;$('gate-copy').hidden=true}function hidePlayPair(){var cancel=$('gate-cancel');if(cancel)cancel.hidden=true}function showCasualBar(){var play=$('gate-action'),find=$('gate-find'),invite=$('gate-invite');if(play){play.hidden=false;play.disabled=false;play.textContent='Play'}if(find){find.hidden=false;find.disabled=false;find.textContent='Find'}if(invite){invite.hidden=false;invite.textContent='Invite'}}function wantTournamentChrome(){return false}function renderTournament(){var body=$('tournament-body');body.append(element('p','Open','tournament-meta'));var actions=element('div',null,'tournament-actions');var entrants=element('ul',null,'entrants');var bracket=element('ul',null,'bracket');body.append(element('p','wins','champion'))}</script>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><p id="buy-flash" hidden></p><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div>
<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a></p></footer>
</body></html>`;

assert.match(LIVE, /\.tournament-meta\{/, "fixture leftover .tournament-meta CSS paints");
assert.match(LIVE, /\.tournament-actions\{/, "fixture leftover .tournament-actions CSS paints");
assert.match(LIVE, /\.entrants,\.bracket\{/, "fixture leftover .entrants,.bracket CSS paints");
assert.match(LIVE, /\.champion\{/, "fixture leftover .champion CSS paints");
noPaintedClass(LIVE, "tournament-meta", "fixture");
noPaintedClass(LIVE, "tournament-actions", "fixture");
noPaintedClass(LIVE, "entrants", "fixture");
noPaintedClass(LIVE, "bracket", "fixture");
noPaintedClass(LIVE, "champion", "fixture");
assert.match(afterStyleScript(LIVE), /id=["']tournament["']/, "fixture #tournament stays");
assert.match(afterStyleScript(LIVE), /class=["']tournament-form["']/, "fixture .tournament-form stays in DOM");

const gone = stripChessLeftoverTournamentChromeCss(LIVE);
assert.doesNotMatch(gone, /\.tournament-meta\{/, "drops leftover .tournament-meta CSS");
assert.doesNotMatch(gone, /\.tournament-actions\{/, "drops leftover .tournament-actions CSS");
assert.doesNotMatch(gone, /\.tournament-actions \.btn\{/, "drops leftover .tournament-actions .btn CSS");
assert.doesNotMatch(gone, /\.entrants,\.bracket\{/, "drops leftover .entrants,.bracket CSS");
assert.doesNotMatch(gone, /\.entrants li,\.bracket li\{/, "drops leftover .entrants li,.bracket li CSS");
assert.doesNotMatch(gone, /\.champion\{/, "drops leftover .champion CSS");
assert.match(gone, /\.tournament-form\{/, ".tournament-form CSS stays");
assert.match(gone, /\.tournament-form input\{/, ".tournament-form input CSS stays");
assert.match(gone, /id=["']tournament["']/, "#tournament stays");
assert.match(gone, /class=["']tournament-form["']/, ".tournament-form stays");
assert.match(gone, /function wantTournamentChrome\(\)\{return false\}/, "wantTournamentChrome stays false");
assert.match(gone, /function showCasualBar\(\)/, "showCasualBar stays");
assert.match(gone, /function hidePlayPair\(\)/, "hidePlayPair stays");
assert.match(gone, /function hideLecture\(\)/, "hideLecture stays");
assert.match(gone, /id=["']gate-find["']/, "#gate-find stays");
assert.match(gone, /id=["']gate-action["']/, "#gate-action stays");
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
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-rule, not eat-the-page");

{
  const paints = `<!doctype html><html lang="en"><head>
<title>Dasha Chess</title>
<style>.tournament-meta{color:red}.champion{color:yellow}</style>
</head><body>
<div id="chess-stage"></div>
<section id="tournament"><p class="tournament-meta">Open</p><p class="champion">wins</p></section>
<div id="buy-sheet" hidden></div>
</body></html>`;
  const out = stripChessLeftoverTournamentChromeCss(paints);
  assert.match(out, /\.tournament-meta\{/, "do not strip if .tournament-meta still paints");
  assert.match(out, /\.champion\{/, "do not strip if .champion still paints");
}

{
  const lobby = `<!doctype html><html><head><style>.dasha-lobby{display:flex}.tournament-meta{color:red}.champion{font-weight:950}</style></head><body>
<div id="dasha-lobby" class="dasha-lobby"></div>
<button id="forum-play-go">Play</button>
<div id="dasha-forum"></div>
</body></html>`;
  const out = stripChessLeftoverTournamentChromeCss(lobby);
  assert.match(out, /\.tournament-meta\{/, "lobby does not eat leftover chess tournament-meta CSS");
  assert.match(out, /\.champion\{/, "lobby does not eat leftover chess champion CSS");
}

const polished = polishServedSlim(LIVE);
assert.doesNotMatch(polished, /\.tournament-meta\{/, "polish drops leftover .tournament-meta CSS");
assert.doesNotMatch(polished, /\.tournament-actions\{/, "polish drops leftover .tournament-actions CSS");
assert.doesNotMatch(polished, /\.entrants,\.bracket\{/, "polish drops leftover .entrants,.bracket CSS");
assert.doesNotMatch(polished, /\.champion\{/, "polish drops leftover .champion CSS");
assert.match(polished, /\.tournament-form\{/, "polish keeps .tournament-form");
assert.match(polished, /id=["']tournament["']/, "polish keeps #tournament");
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

assert.match(chessDisk, /\.tournament-meta\{/, "chess disk still emits leftover .tournament-meta CSS (polish drops it)");
assert.match(chessDisk, /\.tournament-actions\{/, "chess disk still emits leftover .tournament-actions CSS (polish drops it)");
assert.match(chessDisk, /\.entrants,\.bracket\{/, "chess disk still emits leftover .entrants,.bracket CSS (polish drops it)");
assert.match(chessDisk, /\.champion\{/, "chess disk still emits leftover .champion CSS (polish drops it)");
assert.match(CHESS_PAGE_HTML, /\.tournament-meta\{/, "bundled chess still emits leftover .tournament-meta CSS (polish drops it)");
assert.match(CHESS_PAGE_HTML, /\.tournament-actions\{/, "bundled chess still emits leftover .tournament-actions CSS (polish drops it)");
assert.match(CHESS_PAGE_HTML, /\.entrants,\.bracket\{/, "bundled chess still emits leftover .entrants,.bracket CSS (polish drops it)");
assert.match(CHESS_PAGE_HTML, /\.champion\{/, "bundled chess still emits leftover .champion CSS (polish drops it)");
noPaintedClass(chessDisk, "tournament-meta", "chess disk");
noPaintedClass(chessDisk, "tournament-actions", "chess disk");
noPaintedClass(chessDisk, "entrants", "chess disk");
noPaintedClass(chessDisk, "bracket", "chess disk");
noPaintedClass(chessDisk, "champion", "chess disk");
assert.match(afterStyleScript(chessDisk), /id=["']tournament["']/, "chess disk #tournament stays");
assert.match(afterStyleScript(chessDisk), /class=["']tournament-form["']/, "chess disk .tournament-form stays");
assert.match(chessDisk, /function wantTournamentChrome\(\)\{return false\}/, "chess disk wantTournamentChrome stays false");
assert.match(chessDisk, /\.tournament-form\{/, "chess disk .tournament-form CSS stays");
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
<style>.tournament-meta{color:red}.champion{color:yellow}</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="grwm"><div class="grwm-phone"></div></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
</body></html>`;

assert.equal(stripChessLeftoverTournamentChromeCss(HOME), HOME, "home is not a chess leftover tournament-chrome CSS page");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  assert.doesNotMatch(html, /\.tournament-meta\{/, "served chess drops leftover .tournament-meta CSS");
  assert.doesNotMatch(html, /\.tournament-actions\{/, "served chess drops leftover .tournament-actions CSS");
  assert.doesNotMatch(html, /\.entrants,\.bracket\{/, "served chess drops leftover .entrants,.bracket CSS");
  assert.doesNotMatch(html, /\.champion\{/, "served chess drops leftover .champion CSS");
  noPaintedClass(html, "tournament-meta", "served chess");
  noPaintedClass(html, "tournament-actions", "served chess");
  noPaintedClass(html, "entrants", "served chess");
  noPaintedClass(html, "bracket", "served chess");
  noPaintedClass(html, "champion", "served chess");
  assert.match(html, /\.tournament-form\{/, "served .tournament-form CSS stays");
  assert.match(html, /id=["']tournament["']/, "served #tournament stays");
  assert.match(html, /class=["']tournament-form["']/, "served .tournament-form stays");
  assert.match(html, /function wantTournamentChrome\(\)\{return false\}/, "served wantTournamentChrome stays false");
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
  assert.doesNotMatch(html, /\bcasualRematch\b/, "prior leftover casualRematch stays dropped");
  assert.doesNotMatch(html, /\bnextPlay\b/, "prior leftover nextPlay stays dropped");
  assert.doesNotMatch(html, /\bplayReady\b/, "prior leftover playReady stays dropped");
  assert.doesNotMatch(html, /\bshowPlayPair\b/, "prior leftover showPlayPair stays dropped");
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

console.log("dasha-chess-tournament-chrome-css-leftover.test.mjs: ok");
