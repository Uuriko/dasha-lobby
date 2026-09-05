#!/usr/bin/env node
/**
 * Leftover after leftover unused JS loadLeaders was already stripped.
 * Live /chess 200 still serializes leftover id="recent-panel" after JS never reads
 * getElementById('recent-panel') and CSS never targets #recent-panel (recent games
 * list is class="recent" + id="recent"). Humans see it in view-source.
 * Distinct leftover vs leftover id="leaders-panel" / leftover unused JS loadLeaders.
 * Keep class="recent" + #recent. Keep class="leaders" + #leaders.
 * Keep function tournamentAction(action,name) + tournamentAction('create'.
 * Disk still emits leftover (polish drops it). No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverRecentPanelId,
  stripChessLeftoverUnusedJs,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";
const TG = "https://t.me/+xB7S8mIQaKFiZjRh";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes('Leftover /chess id="recent-panel" after leftover unused JS loadLeaders was already stripped'),
);
assert.match(workerSrc, /export function stripChessLeftoverRecentPanelId/);
assert.match(workerSrc, /out = stripChessLeftoverRecentPanelId\(out\);/);
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
.gate-actions{display:flex;flex-wrap:wrap;gap:10px}
.leaders{list-style:none}.recent{list-style:none}.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim .buy-dasha{margin-left:auto}
.empty{color:var(--muted);margin:0}.identity{font-weight:900;color:var(--acid)}
#buy-sheet{position:fixed}#buy-share-x{color:inherit}#buy-mint{font:inherit}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div class="app"><section class="gate" id="gate">
<div class="gate-actions"><button class="btn" id="gate-action" type="button">Play</button><button class="btn" id="gate-find" type="button">Find</button><button class="btn" id="gate-invite" type="button">Invite</button></div>
</section><div id="chess-stage"></div></div>
<p class="empty">No rated games yet</p>
<p class="identity">@dash_eats</p>
<section hidden><ol class="leaders" id="leaders"><li><small>—</small><span>No rated games yet</span><b></b></li></ol></section>
<section id="recent-panel" hidden><ol class="recent" id="recent"></ol></section>
<script src="/client/chess-local.js"></script>
<script>function hideLecture(){}$('gate-kicker').hidden=true;function showCasualBar(){}function hidePlayPair(){}function watchingGame(g){return g.watch===true}function tournamentAction(action,name){var request=post('/chess/tournaments',{name:name})}function tournamentSubmit(event){tournamentAction('create',$('tournament-name').value)}var recover=loadTournaments();</script>
<div id="buy-sheet" hidden><div class="buy-chips" id="buy-chips"></div><div><code id="buy-mint">${MINT}</code><p id="buy-flash" hidden>bought. <a id="buy-share-x" href="https://x.com/intent/post">X</a> <a href="${TG}" target="_blank" rel="noopener noreferrer">TG</a></p></div></div>
</body></html>`;

assert.match(afterStyleScript(LIVE), /id=["']recent-panel["']/, "fixture leftover id=recent-panel paints after style/script strip");
assert.doesNotMatch(LIVE, /getElementById\(['"]recent-panel['"]\)/, "fixture JS never reads recent-panel");
assert.doesNotMatch(LIVE, /\$\(['"]recent-panel['"]\)/, "fixture $() never reads recent-panel");
assert.doesNotMatch(LIVE, /#recent-panel\b/, "fixture CSS never targets #recent-panel");
assert.match(LIVE, /class=["']recent["']/, "fixture class=recent stays in DOM");
assert.match(LIVE, /id=["']recent["']/, "fixture #recent stays");
assert.doesNotMatch(LIVE, /function\s+loadLeaders\s*\(/, "fixture loadLeaders already dropped");

const gone = stripChessLeftoverRecentPanelId(LIVE);
assert.doesNotMatch(gone, /\bid=["']recent-panel["']/, "drops leftover id=recent-panel");
assert.match(gone, /id=["']recent["']/, "#recent stays");
assert.match(gone, /class=["']recent["']/, "class=recent stays");
assert.match(gone, /id=["']leaders["']/, "#leaders stays");
assert.match(gone, /class=["']leaders["']/, "class=leaders stays");
assert.match(gone, /id=["']buy-mint["']/, "#buy-mint stays");
assert.match(gone, /id=["']buy-sheet["']/, "buy sheet stays");
assert.match(gone, /id=["']buy-share-x["']/, "#buy-share-x stays");
assert.match(gone, /id=["']gate-find["']/, "#gate-find stays");
assert.match(gone, /id=["']gate-action["']/, "#gate-action stays");
assert.match(gone, /id=["']gate-invite["']/, "#gate-invite stays");
assert.match(gone, /function tournamentAction\(action,name\)/, "tournamentAction(action,name) stays");
assert.match(gone, /tournamentAction\('create'/, "tournamentAction create stays");
assert.match(gone, /var recover=loadTournaments\(\);/, "loadTournaments recover stays");
assert.match(gone, /function showCasualBar\(\)/, "showCasualBar stays");
assert.match(gone, /function hidePlayPair\(\)/, "hidePlayPair stays");
assert.match(gone, /function hideLecture\(\)/, "hideLecture stays");
assert.match(gone, /g\.watch===true/, "g.watch===true stays");
assert.match(gone, new RegExp(TG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "TG href stays");
assert.match(gone, />TG<\/a>/, "TG text stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, /src="\/client\/chess-local\.js"/, "chess-local stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "id drop is per-attr, not eat-the-page");

{
  const keep = LIVE.replace(
    "</script>",
    "function loadLeaders(){$('recent-panel').hidden=!games.length}</script>",
  );
  const out = stripChessLeftoverRecentPanelId(keep);
  assert.match(out, /id=["']recent-panel["']/, "keeps id=recent-panel when loadLeaders still reads it");
}

{
  const other = stripChessLeftoverRecentPanelId(
    `<!doctype html><html><head></head><body><section id="recent-panel"><ol class="recent" id="recent"></ol></section></body></html>`,
  );
  assert.match(other, /id="recent-panel"/, "non-chess pages keep leftover recent-panel id");
}

{
  const raw = stripChessLeftoverRecentPanelId(chessDisk);
  assert.match(raw, /id=["']recent-panel["']/, "strip alone keeps id while disk still has loadLeaders");
  assert.match(chessDisk, /function loadLeaders\s*\(/, "disk still emits leftover loadLeaders (unused-js strip drops it)");
}

const polished = polishServedSlim(LIVE);
assert.doesNotMatch(polished, /\bid=["']recent-panel["']/, "polish drops leftover id=recent-panel");
assert.match(polished, /id=["']recent["']/, "polish #recent stays");
assert.match(polished, /class=["']recent["']/, "polish class=recent stays");
assert.match(polished, /function tournamentAction\(action,name\)/, "polish tournamentAction(action,name) stays");
assert.match(polished, /tournamentAction\('create'/, "polish tournamentAction create stays");

assert.match(chessDisk, /id=["']recent-panel["']/, "disk source still has leftover id=recent-panel (polish drops it; did not run static-gen)");
assert.match(CHESS_PAGE_HTML, /id=["']recent-panel["']/, "bundled still has leftover id=recent-panel");

function assertNoRecentPanelId(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']recent-panel["']/, `${label} no leftover id=recent-panel after style/script strip`);
  assert.match(html, /id=["']recent["']/, `${label} #recent`);
  assert.match(html, /class=["']recent["']/, `${label} class=recent stays`);
  assert.match(html, /id=["']leaders["']/, `${label} #leaders`);
  assert.match(html, /class=["']leaders["']/, `${label} class=leaders stays`);
  assert.match(html, /id=["']buy-mint["']/, `${label} #buy-mint`);
  assert.match(html, /id=["']buy-share-x["']/, `${label} #buy-share-x`);
  assert.match(html, />TG<\/a>/, `${label} TG`);
  assert.match(html, /id=["']buy-sheet["']/, `${label} buy sheet`);
  assert.match(html, /jup\.ag/, `${label} jup.ag`);
  assert.match(html, /chess-local\.js/, `${label} chess-local`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoRecentPanelId(polishServedSlim(LIVE), "polished leftover fixture");
{
  const diskPolished = polishServedSlim(chessDisk);
  assertNoRecentPanelId(diskPolished, "polished disk");
  assert.doesNotMatch(diskPolished, /function\s+loadLeaders\s*\(/, "polished disk loadLeaders stays dropped");
  assert.match(diskPolished, /function tournamentAction\(action,name\)/, "polished disk tournamentAction(action,name)");
  assert.match(diskPolished, /tournamentAction\('create'/, "polished disk tournamentAction create");
  assert.match(diskPolished, /function showCasualBar\(\)/, "polished disk showCasualBar");
  assert.match(diskPolished, /function hidePlayPair\(\)/, "polished disk hidePlayPair");
  assert.match(diskPolished, /function hideLecture\(\)/, "polished disk hideLecture");
  assert.match(diskPolished, /id=["']gate-kicker["']/, "polished disk #gate-kicker");
  assert.match(diskPolished, /id=["']gate-title["']/, "polished disk #gate-title");
  assert.match(diskPolished, /id=["']gate-copy["']/, "polished disk #gate-copy");
  assert.match(diskPolished, /id=["']gate-invite["']/, "polished disk #gate-invite");
  assert.match(diskPolished, /id=["']share["']/, "polished disk #share");
  assert.match(diskPolished, /function shareChallenge/, "polished disk shareChallenge");
  assert.match(diskPolished, /function shareGame/, "polished disk shareGame");
  assert.match(diskPolished, /var recover=loadTournaments\(\);/, "polished disk loadTournaments recover");
  assert.match(diskPolished, /organizerIsMe/, "polished disk organizerIsMe");
  assert.match(diskPolished, /function watchingGame/, "polished disk watchingGame");
  assert.match(diskPolished, /g\.watch===true/, "polished disk g.watch===true");
  assert.doesNotMatch(diskPolished, /\bshareTournament\b/, "polished disk shareTournament stays dropped");
  assert.doesNotMatch(diskPolished, /function showLecture/, "polished disk showLecture stays dropped");
}
assertNoRecentPanelId(polishServedSlim(CHESS_PAGE_HTML), "polished bundled");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  assertNoRecentPanelId(html, "served chess");
  assert.match(html, /function tournamentAction\(action,name\)/, "served tournamentAction(action,name)");
  assert.match(html, /tournamentAction\('create'/, "served tournamentAction create");
  assert.match(html, /function showCasualBar\(\)/, "served showCasualBar");
  assert.match(html, /function hidePlayPair\(\)/, "served hidePlayPair");
  assert.match(html, /id=["']gate-find["']/, "served #gate-find");
  assert.match(html, /id=["']gate-action["']/, "served #gate-action");
  assert.match(html, /id=["']gate-invite["']/, "served #gate-invite");
  assert.match(html, /Play\. Invite\. Find/, "served Invite JSON-LD");
  assert.doesNotMatch(html, /\bid=["']leaders-panel["']/, "prior leftover id=leaders-panel stays dropped");
  assert.doesNotMatch(html, /\bid=["']buy-sheet-fallback["']/, "prior leftover id=buy-sheet-fallback stays dropped");
  assert.doesNotMatch(html, /\bid=["']buy-share-tg["']/, "prior leftover id=buy-share-tg stays dropped");
  assert.doesNotMatch(html, /\bid=["']gate-actions["']/, "prior leftover id=gate-actions stays dropped");
  assert.match(html, /class=["']gate-actions["']/, "class=gate-actions stays");
  assert.doesNotMatch(html, /function\s+loadLeaders\s*\(/, "prior leftover loadLeaders stays dropped");
  assert.doesNotMatch(html, /\bshareTournament\b/, "prior leftover shareTournament stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "prior leftover chess mobile-scroll stays dropped");
  assert.match(html, /id=["']chess-stage["']/, "chess-stage stays");
  assert.match(html, new RegExp(MINT), "mint stays");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /id=["']forum-play-go["']/, "Play stays");
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.doesNotMatch(html, /\bid=["']forum-play["']/, "leftover id=forum-play stays dropped");
  assert.match(html, /id=["']dasha-forum["']/, "threads mount stays");
  assert.match(html, /id=["']forum-copy["']/, "#forum-copy stays");
  assert.match(html, /class=["']forum-pin["']/, ".forum-pin stays");
  assert.match(html, /class=["']lobby-form["']/, ".lobby-form stays");
  assert.match(html, new RegExp(TG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "lobby footer Telegram stays");
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
  assert.match(html, /#dasha-home h1/, "repair h1 stays");
  assert.match(html, /#dasha-home h2/, "repair h2 stays");
  assert.match(html, /\.dasha h1,\.dasha h2/, "home .dasha h1,.dasha h2 stays");
  assert.match(html, /\.dasha a,\.dasha strong/, "home mixed .dasha a,.dasha strong stays (separate leftover)");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /johns-awesome/, "johns-awesome CSS stays");
  assert.match(html, /@view-transition/, "@view-transition stays");
  assert.match(html, /data:image\/svg\+xml/, "cherries SVG stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  const html = await howto.text();
  assert.doesNotMatch(html, /id=["']buy2["']/, "leftover id=buy2 stays dropped");
  assert.match(html, /id=["']ca["']/, "#ca stays");
  assert.match(html, /id=["']copy["']/, "id=copy stays");
  assert.match(html, /jup\.ag\/swap/, "jup.ag stays");
}

{
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /id=["']bb-x["']/, "bounties quiet Connect X stays");
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
}

{
  const privacy = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, "privacy product skip-link stays");
  assert.match(html, /href=["']#dasha-page["']/, "privacy skip target stays #dasha-page");
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

assert.equal(typeof stripChessLeftoverUnusedJs, "function");

console.log("dasha-chess-recent-panel-id-leftover: PASS (chess leftover id=recent-panel gone; class=recent + #recent stay)");
