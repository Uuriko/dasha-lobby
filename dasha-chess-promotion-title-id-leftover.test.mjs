#!/usr/bin/env node
/**
 * Leftover after leftover unused chess id="recent-panel" was already stripped.
 * Live /chess 200 still serializes leftover id="promotion-title" after JS never reads
 * getElementById('promotion-title') and CSS never targets #promotion-title (dialog is
 * class="promotion" + id="promotion"; title paints via .promotion p).
 * aria-labelledby="promotion-title" only pointed at that unused id.
 * Humans see it in view-source.
 * Distinct leftover vs leftover id="recent-panel" / leftover id="leaders-panel".
 * Keep class="promotion" + #promotion. Keep id=tc-3 + id=tc-5 + id=tc-10
 * (JS binds via $('tc-'+n), not .tc only).
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
  stripChessLeftoverPromotionTitleId,
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
  workerSrc.includes('Leftover /chess id="promotion-title" after CSS/JS strip'),
);
assert.match(workerSrc, /export function stripChessLeftoverPromotionTitleId/);
assert.match(workerSrc, /out = stripChessLeftoverPromotionTitleId\(out\);/);
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
.btn.tc{min-width:36px}
.promotion{border:1px solid}.promotion p{font-weight:900}
.leaders{list-style:none}.recent{list-style:none}.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim .buy-dasha{margin-left:auto}
.empty{color:var(--muted);margin:0}.identity{font-weight:900;color:var(--acid)}
#buy-sheet{position:fixed}#buy-share-x{color:inherit}#buy-mint{font:inherit}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div class="app"><section class="gate" id="gate">
<div class="gate-actions"><button class="btn" id="gate-action" type="button">Play</button><button class="btn" id="gate-find" type="button">Find</button><button class="btn" id="gate-invite" type="button">Invite</button><button class="btn ghost tc" id="tc-3" type="button" aria-label="3 min">3</button><button class="btn ghost tc" id="tc-5" type="button" aria-label="5 min">5</button><button class="btn ghost tc on" id="tc-10" type="button" aria-label="10 min">10</button></div>
</section><div id="chess-stage"></div></div>
<p class="empty">No rated games yet</p>
<p class="identity">@dash_eats</p>
<section hidden><ol class="leaders" id="leaders"><li><small>—</small><span>No rated games yet</span><b></b></li></ol></section>
<section hidden><ol class="recent" id="recent"></ol></section>
<dialog class="promotion" id="promotion" aria-labelledby="promotion-title"><form method="dialog"><p id="promotion-title">Promote to</p><button value="q" aria-label="Queen">♕</button></form></dialog>
<script src="/client/chess-local.js"></script>
<script>function hideLecture(){}$('gate-kicker').hidden=true;function showCasualBar(){}function hidePlayPair(){}function watchingGame(g){return g.watch===true}function paintTc(){[3,5,10].forEach(function(n){var b=$('tc-'+n);if(!b)return;b.classList.toggle('on',clockMin===n)})}$('promotion').showModal();function tournamentAction(action,name){var request=post('/chess/tournaments',{name:name})}function tournamentSubmit(event){tournamentAction('create',$('tournament-name').value)}var recover=loadTournaments();</script>
<div id="buy-sheet" hidden><div class="buy-chips" id="buy-chips"></div><div><code id="buy-mint">${MINT}</code><p id="buy-flash" hidden>bought. <a id="buy-share-x" href="https://x.com/intent/post">X</a> <a href="${TG}" target="_blank" rel="noopener noreferrer">TG</a></p></div></div>
</body></html>`;

assert.match(afterStyleScript(LIVE), /id=["']promotion-title["']/, "fixture leftover id=promotion-title paints after style/script strip");
assert.match(afterStyleScript(LIVE), /aria-labelledby=["']promotion-title["']/, "fixture leftover aria-labelledby=promotion-title paints after style/script strip");
assert.doesNotMatch(LIVE, /getElementById\(['"]promotion-title['"]\)/, "fixture JS never reads promotion-title");
assert.doesNotMatch(LIVE, /\$\(['"]promotion-title['"]\)/, "fixture $() never reads promotion-title");
assert.doesNotMatch(LIVE, /#promotion-title\b/, "fixture CSS never targets #promotion-title");
assert.match(LIVE, /class=["']promotion["']/, "fixture class=promotion stays in DOM");
assert.match(LIVE, /id=["']promotion["']/, "fixture #promotion stays");
assert.match(LIVE, /Promote to/, "fixture Promote to copy stays");
assert.match(LIVE, /id=["']tc-3["']/, "fixture #tc-3 stays (JS binds $('tc-'+n))");
assert.match(LIVE, /id=["']tc-5["']/, "fixture #tc-5 stays");
assert.match(LIVE, /id=["']tc-10["']/, "fixture #tc-10 stays");
assert.match(LIVE, /\$\('tc-'\+n\)/, "fixture JS binds tc via $('tc-'+n)");
assert.doesNotMatch(LIVE, /function\s+loadLeaders\s*\(/, "fixture loadLeaders already dropped");
assert.doesNotMatch(LIVE, /\bid=["']recent-panel["']/, "fixture recent-panel already dropped");

const gone = stripChessLeftoverPromotionTitleId(LIVE);
assert.doesNotMatch(gone, /\bid=["']promotion-title["']/, "drops leftover id=promotion-title");
assert.doesNotMatch(gone, /aria-labelledby=["']promotion-title["']/, "drops dangling aria-labelledby=promotion-title");
assert.match(gone, /id=["']promotion["']/, "#promotion stays");
assert.match(gone, /class=["']promotion["']/, "class=promotion stays");
assert.match(gone, /Promote to/, "Promote to copy stays");
assert.match(gone, /\.promotion p\{/, ".promotion p CSS stays");
assert.match(gone, /id=["']tc-3["']/, "#tc-3 stays");
assert.match(gone, /id=["']tc-5["']/, "#tc-5 stays");
assert.match(gone, /id=["']tc-10["']/, "#tc-10 stays");
assert.match(gone, /\$\('tc-'\+n\)/, "$('tc-'+n) stays");
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
    "var recover=loadTournaments();</script>",
    "var recover=loadTournaments();$('promotion-title').hidden=false</script>",
  );
  const out = stripChessLeftoverPromotionTitleId(keep);
  assert.match(out, /id=["']promotion-title["']/, "keeps id=promotion-title when $() still reads it");
  assert.match(out, /aria-labelledby=["']promotion-title["']/, "keeps aria-labelledby when JS still reads the id");
}

{
  const cssKeep = LIVE.replace(".promotion p{font-weight:900}", "#promotion-title{font-weight:900}");
  const out = stripChessLeftoverPromotionTitleId(cssKeep);
  assert.match(out, /id=["']promotion-title["']/, "keeps id=promotion-title when CSS still targets #promotion-title");
}

{
  const other = stripChessLeftoverPromotionTitleId(
    `<!doctype html><html><head></head><body><dialog class="promotion" id="promotion" aria-labelledby="promotion-title"><p id="promotion-title">Promote to</p></dialog></body></html>`,
  );
  assert.match(other, /id="promotion-title"/, "non-chess pages keep leftover promotion-title id");
}

assert.match(chessDisk, /id=["']promotion-title["']/, "disk source still has leftover id=promotion-title (polish drops it; did not run static-gen)");
assert.match(CHESS_PAGE_HTML, /id=["']promotion-title["']/, "bundled still has leftover id=promotion-title");
assert.match(chessDisk, /id=["']tc-3["']/, "disk #tc-3 stays");
assert.match(chessDisk, /\$\('tc-'\+n\)/, "disk JS binds $('tc-'+n)");

const polished = polishServedSlim(LIVE);
assert.doesNotMatch(polished, /\bid=["']promotion-title["']/, "polish drops leftover id=promotion-title");
assert.doesNotMatch(polished, /aria-labelledby=["']promotion-title["']/, "polish drops dangling aria-labelledby");
assert.match(polished, /id=["']promotion["']/, "polish #promotion stays");
assert.match(polished, /class=["']promotion["']/, "polish class=promotion stays");
assert.match(polished, /function tournamentAction\(action,name\)/, "polish tournamentAction(action,name) stays");
assert.match(polished, /tournamentAction\('create'/, "polish tournamentAction create stays");

function assertNoPromotionTitleId(html, label) {
  const markup = afterStyleScript(html);
  assert.doesNotMatch(markup, /\bid=["']promotion-title["']/, `${label} no leftover id=promotion-title after style/script strip`);
  assert.doesNotMatch(markup, /aria-labelledby=["']promotion-title["']/, `${label} no leftover aria-labelledby=promotion-title after style/script strip`);
  assert.doesNotMatch(html, /#promotion-title\b/, `${label} CSS/JS never targets #promotion-title after strip`);
  assert.doesNotMatch(html, /getElementById\(['"]promotion-title['"]\)/, `${label} JS never reads getElementById promotion-title`);
  assert.doesNotMatch(html, /\$\(['"]promotion-title['"]\)/, `${label} $() never reads promotion-title`);
  assert.match(html, /id=["']promotion["']/, `${label} #promotion`);
  assert.match(html, /class=["']promotion["']/, `${label} class=promotion stays`);
  assert.match(html, /Promote to/, `${label} Promote to copy`);
  assert.match(html, /id=["']tc-3["']/, `${label} #tc-3`);
  assert.match(html, /id=["']tc-5["']/, `${label} #tc-5`);
  assert.match(html, /id=["']tc-10["']/, `${label} #tc-10`);
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

assertNoPromotionTitleId(polishServedSlim(LIVE), "polished leftover fixture");
{
  const diskPolished = polishServedSlim(chessDisk);
  assertNoPromotionTitleId(diskPolished, "polished disk");
  assert.match(diskPolished, /\$\('tc-'\+n\)/, "polished disk $('tc-'+n)");
  assert.doesNotMatch(diskPolished, /\bid=["']recent-panel["']/, "polished disk recent-panel stays dropped");
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
assertNoPromotionTitleId(polishServedSlim(CHESS_PAGE_HTML), "polished bundled");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  assertNoPromotionTitleId(html, "served chess");
  assert.match(html, /\$\('tc-'\+n\)/, "served $('tc-'+n)");
  assert.match(html, /function tournamentAction\(action,name\)/, "served tournamentAction(action,name)");
  assert.match(html, /tournamentAction\('create'/, "served tournamentAction create");
  assert.match(html, /function showCasualBar\(\)/, "served showCasualBar");
  assert.match(html, /function hidePlayPair\(\)/, "served hidePlayPair");
  assert.match(html, /id=["']gate-find["']/, "served #gate-find");
  assert.match(html, /id=["']gate-action["']/, "served #gate-action");
  assert.match(html, /id=["']gate-invite["']/, "served #gate-invite");
  assert.match(html, /Play\. Invite\. Find/, "served Invite JSON-LD");
  assert.doesNotMatch(html, /\bid=["']recent-panel["']/, "prior leftover id=recent-panel stays dropped");
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

console.log("dasha-chess-promotion-title-id-leftover: PASS (chess leftover id=promotion-title gone; class=promotion + #promotion + tc-3/5/10 stay)");
