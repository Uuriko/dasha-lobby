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
