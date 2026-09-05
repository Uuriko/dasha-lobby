#!/usr/bin/env node
/**
 * Leftover after chess unused tournament chrome CSS strip. Live /chess 200 still
 * serializes leftover unused JS className strings
 * 'tournament-meta' / 'tournament-actions' / 'entrants' / 'bracket' / 'champion'
 * inside renderTournament / renderChallenge after CSS drop.
 * Those classes never paint: static DOM has #tournament + .tournament-form only;
 * wantTournamentChrome() is false. Functions still run for the hidden form path
 * so they stay; leftover className cluster never paints. Humans see leftover
 * tournament className strings in view-source.
 * Distinct leftover vs leftover unused tournament chrome CSS / leftover unused JS casualRematch.
 * Keep #tournament + .tournament-form. Keep renderTournament() + renderChallenge().
 * Keep showCasualBar() + hidePlayPair(). Keep #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true.
 * Disk still emits leftover (polish drops it). No Designer. Never plugin.jup.ag.
 * Do not restore leftover CSS rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverTournamentChromeJs,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover /chess unused JS tournament-meta / tournament-actions / entrants / bracket / champion className strings after CSS drop"),
);
assert.match(workerSrc, /export function stripChessLeftoverTournamentChromeJs/);
assert.match(workerSrc, /out = stripChessLeftoverTournamentChromeJs\(out\);/);
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

function noLeftoverClassName(src, label) {
  assert.doesNotMatch(src, /,'tournament-meta'/, `${label} drops leftover 'tournament-meta' className`);
  assert.doesNotMatch(src, /'tournament-actions'/, `${label} drops leftover 'tournament-actions' className`);
  assert.doesNotMatch(src, /,null,'entrants'/, `${label} drops leftover 'entrants' className`);
  assert.doesNotMatch(src, /,null,'bracket'/, `${label} drops leftover 'bracket' className`);
  assert.doesNotMatch(src, /,'champion'/, `${label} drops leftover 'champion' className`);
}

function keepLiveChrome(src, label) {
  assert.match(src, /function renderTournament\(\)/, `${label} renderTournament stays`);
  assert.match(src, /function renderChallenge\(\)/, `${label} renderChallenge stays`);
  assert.match(src, /function wantTournamentChrome\(\)\{return false\}/, `${label} wantTournamentChrome stays false`);
  assert.match(src, /id=["']tournament["']/, `${label} #tournament stays`);
  assert.match(src, /class=["']tournament-form["']/, `${label} .tournament-form stays`);
  assert.match(src, /\.tournament-form\{/, `${label} .tournament-form CSS stays`);
  assert.match(src, /function showCasualBar\(\)/, `${label} showCasualBar stays`);
  assert.match(src, /function hidePlayPair\(\)/, `${label} hidePlayPair stays`);
  assert.match(src, /function hideLecture\(\)/, `${label} hideLecture stays`);
  assert.match(src, /id=["']gate-find["']/, `${label} #gate-find stays`);
  assert.match(src, /id=["']gate-action["']/, `${label} #gate-action stays`);
  assert.match(src, /function watchingGame\(g\)/, `${label} watchingGame stays`);
  assert.match(src, /g\.watch===true/, `${label} g.watch===true stays`);
  assert.match(src, /id=["']gate-invite["']/, `${label} #gate-invite stays`);
  assert.match(src, /textContent='Invite'/, `${label} Invite textContent stays`);
  assert.match(src, />Invite</, `${label} Invite button copy stays`);
  assert.match(src, /Play\. Invite\. Find\./, `${label} JSON-LD Play. Invite. Find. stays`);
  assert.match(src, /class=["']buy-dasha["']/, `${label} .buy-dasha stays`);
  assert.match(src, /id=["']chess-stage["']/, `${label} chess-stage stays`);
  assert.match(src, /id=["']buy-sheet["']/, `${label} buy sheet stays`);
  assert.match(src, /jup\.ag/, `${label} jup.ag stays`);
  assert.match(src, new RegExp(MINT), `${label} mint stays`);
  assert.match(src, /chess-local\.js/, `${label} chess-local stays`);
  assert.doesNotMatch(src, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>Dasha Chess</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Game","name":"Chess — $dasha","description":"Play. Invite. Find. ${MINT}"}</script>
<style>
.app{display:grid;gap:12px}.gate{display:flex}
.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim .buy-dasha{margin-left:auto}
.tournament-form{display:flex;flex-wrap:wrap;gap:8px}.tournament-form input{min-width:0;flex:1}.tournament-form .btn{padding:0 14px}
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
<script>function watchingGame(g){return Boolean(g&&(g.watch===true||g.side==null)&&!g.local)}function hideLecture(){$('gate-kicker').hidden=true;$('gate-title').hidden=true;$('gate-copy').hidden=true}function hidePlayPair(){var cancel=$('gate-cancel');if(cancel)cancel.hidden=true}function showCasualBar(){var play=$('gate-action'),find=$('gate-find'),invite=$('gate-invite');if(play){play.hidden=false;play.disabled=false;play.textContent='Play'}if(find){find.hidden=false;find.disabled=false;find.textContent='Find'}if(invite){invite.hidden=false;invite.textContent='Invite'}}function wantTournamentChrome(){return false}function renderTournament(){var body=$('tournament-body');body.textContent='';$('tournament').hidden=!wantTournamentChrome();if(challenge)return renderChallenge();if(!tournament){var form=element('form',null,'tournament-form');body.append(form);return}body.append(element('p','Open','tournament-meta'));var actions=element('div',null,'tournament-actions');var entrants=element('ul',null,'entrants');tournament.entrants.forEach(function(player){entrants.append(element('li',player.display))});var bracket=element('ul',null,'bracket');if(tournament.champion)body.append(element('p',tournament.champion+' wins','champion'))}function renderChallenge(){var body=$('tournament-body');body.append(element('p','Open','tournament-meta'));var actions=element('div',null,'tournament-actions')}</script>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><p id="buy-flash" hidden></p><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div>
<footer class="dasha-foot wrap"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a></p></footer>
</body></html>`;

assert.match(LIVE, /,'tournament-meta'/, "fixture leftover 'tournament-meta' className paints");
assert.match(LIVE, /'tournament-actions'/, "fixture leftover 'tournament-actions' className paints");
assert.match(LIVE, /,null,'entrants'/, "fixture leftover 'entrants' className paints");
assert.match(LIVE, /,null,'bracket'/, "fixture leftover 'bracket' className paints");
assert.match(LIVE, /,'champion'/, "fixture leftover 'champion' className paints");
noPaintedClass(LIVE, "tournament-meta", "fixture");
noPaintedClass(LIVE, "tournament-actions", "fixture");
noPaintedClass(LIVE, "entrants", "fixture");
noPaintedClass(LIVE, "bracket", "fixture");
noPaintedClass(LIVE, "champion", "fixture");
assert.match(afterStyleScript(LIVE), /id=["']tournament["']/, "fixture #tournament stays");
assert.match(afterStyleScript(LIVE), /class=["']tournament-form["']/, "fixture .tournament-form stays in DOM");

const gone = stripChessLeftoverTournamentChromeJs(LIVE);
noLeftoverClassName(gone, "strip");
assert.match(gone, /tournament\.entrants/, "tournament.entrants property stays");
assert.match(gone, /tournament\.champion/, "tournament.champion property stays");
assert.match(gone, /var form=element\('form',null,'tournament-form'\)/, "tournament-form className stays");
keepLiveChrome(gone, "strip");
assert.doesNotMatch(gone, /\.tournament-meta\{/, "does not restore leftover .tournament-meta CSS");
assert.ok(gone.length > LIVE.length * 0.7, "className drop is per-string, not eat-the-page");

{
  const paints = `<!doctype html><html lang="en"><head>
<title>Dasha Chess</title>
<style>.tournament-form{display:flex}</style>
</head><body>
<div id="chess-stage"></div>
<section id="tournament"><p class="tournament-meta">Open</p><p class="champion">wins</p></section>
<div id="buy-sheet" hidden></div>
<script>function renderTournament(){body.append(element('p','Open','tournament-meta'));var actions=element('div',null,'tournament-actions')}</script>
</body></html>`;
  const out = stripChessLeftoverTournamentChromeJs(paints);
  assert.match(out, /,'tournament-meta'/, "do not strip if .tournament-meta still paints");
  assert.match(out, /'tournament-actions'/, "do not strip if leftover class still paints");
}

{
  const lobby = `<!doctype html><html><head><style>.dasha-lobby{display:flex}</style></head><body>
<div id="dasha-lobby" class="dasha-lobby"></div>
<button id="forum-play-go">Play</button>
<div id="dasha-forum"></div>
<script>function renderTournament(){body.append(element('p','Open','tournament-meta'));var actions=element('div',null,'tournament-actions');var entrants=element('ul',null,'entrants')}</script>
</body></html>`;
  const out = stripChessLeftoverTournamentChromeJs(lobby);
  assert.match(out, /,'tournament-meta'/, "lobby does not eat leftover chess tournament-meta className");
  assert.match(out, /'tournament-actions'/, "lobby does not eat leftover chess tournament-actions className");
}

const polished = polishServedSlim(LIVE);
noLeftoverClassName(polished, "polish");
assert.match(polished, /tournament\.entrants/, "polish keeps tournament.entrants");
assert.match(polished, /tournament\.champion/, "polish keeps tournament.champion");
keepLiveChrome(polished, "polish");
assert.doesNotMatch(polished, /\.tournament-meta\{/, "polish does not restore leftover .tournament-meta CSS");
assert.doesNotMatch(polished, /\.tournament-actions\{/, "polish does not restore leftover .tournament-actions CSS");
assert.doesNotMatch(polished, /\.champion\{/, "polish does not restore leftover .champion CSS");

assert.match(chessDisk, /,'tournament-meta'/, "chess disk still emits leftover 'tournament-meta' className (polish drops it)");
assert.match(chessDisk, /'tournament-actions'/, "chess disk still emits leftover 'tournament-actions' className (polish drops it)");
assert.match(chessDisk, /,null,'entrants'/, "chess disk still emits leftover 'entrants' className (polish drops it)");
assert.match(chessDisk, /,null,'bracket'/, "chess disk still emits leftover 'bracket' className (polish drops it)");
assert.match(chessDisk, /,'champion'/, "chess disk still emits leftover 'champion' className (polish drops it)");
assert.match(CHESS_PAGE_HTML, /,'tournament-meta'/, "bundled chess still emits leftover 'tournament-meta' className (polish drops it)");
assert.match(CHESS_PAGE_HTML, /'tournament-actions'/, "bundled chess still emits leftover 'tournament-actions' className (polish drops it)");
assert.match(CHESS_PAGE_HTML, /,null,'entrants'/, "bundled chess still emits leftover 'entrants' className (polish drops it)");
assert.match(CHESS_PAGE_HTML, /,null,'bracket'/, "bundled chess still emits leftover 'bracket' className (polish drops it)");
assert.match(CHESS_PAGE_HTML, /,'champion'/, "bundled chess still emits leftover 'champion' className (polish drops it)");
noPaintedClass(chessDisk, "tournament-meta", "chess disk");
noPaintedClass(chessDisk, "tournament-actions", "chess disk");
noPaintedClass(chessDisk, "entrants", "chess disk");
noPaintedClass(chessDisk, "bracket", "chess disk");
noPaintedClass(chessDisk, "champion", "chess disk");
assert.match(afterStyleScript(chessDisk), /id=["']tournament["']/, "chess disk #tournament stays");
assert.match(afterStyleScript(chessDisk), /class=["']tournament-form["']/, "chess disk .tournament-form stays");
assert.match(chessDisk, /function wantTournamentChrome\(\)\{return false\}/, "chess disk wantTournamentChrome stays false");
assert.match(chessDisk, /function renderTournament\(\)/, "chess disk renderTournament stays");
assert.match(chessDisk, /function renderChallenge\(\)/, "chess disk renderChallenge stays");
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
<script>function renderTournament(){body.append(element('p','Open','tournament-meta'))}</script>
</body></html>`;

assert.equal(stripChessLeftoverTournamentChromeJs(HOME), HOME, "home is not a chess leftover tournament-chrome JS page");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  noLeftoverClassName(html, "served chess");
  noPaintedClass(html, "tournament-meta", "served chess");
  noPaintedClass(html, "tournament-actions", "served chess");
  noPaintedClass(html, "entrants", "served chess");
  noPaintedClass(html, "bracket", "served chess");
  noPaintedClass(html, "champion", "served chess");
  assert.match(html, /function tournamentClick\(/, "served tournamentClick stays");
  assert.doesNotMatch(html, /\.tournament-meta\{/, "served leftover .tournament-meta CSS stays dropped");
  assert.doesNotMatch(html, /\.tournament-actions\{/, "served leftover .tournament-actions CSS stays dropped");
  assert.doesNotMatch(html, /\.entrants,\.bracket\{/, "served leftover .entrants,.bracket CSS stays dropped");
  assert.doesNotMatch(html, /\.champion\{/, "served leftover .champion CSS stays dropped");
  keepLiveChrome(html, "served chess");
  assert.match(html, /id=["']gate-kicker["']/, "served #gate-kicker stays");
  assert.match(html, /id=["']gate-title["']/, "served #gate-title stays");
  assert.match(html, /id=["']gate-copy["']/, "served #gate-copy stays");
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

console.log("dasha-chess-tournament-chrome-js-leftover.test.mjs: ok");
