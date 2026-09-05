#!/usr/bin/env node
/**
 * Leftover after chess CSS/JS strip + Top table leaders.
 * Live /chess 200 still serializes leftover id="leaders-panel" after JS never reads
 * getElementById('leaders-panel') and CSS never targets #leaders-panel (Top table is
 * class="leaders" + id="leaders"). Humans see it in view-source.
 * Distinct leftover vs leftover id="buy-sheet-fallback" / leftover id="buy-share-tg" /
 * leftover id="gate-actions".
 * Keep class="leaders" + #leaders. Disk only. No Designer.
 * Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverLeadersPanelId,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";
const TG = "https://t.me/+xB7S8mIQaKFiZjRh";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover /chess id="leaders-panel" after CSS/JS strip'));
assert.match(workerSrc, /export function stripChessLeftoverLeadersPanelId/);
assert.match(workerSrc, /out = stripChessLeftoverLeadersPanelId\(out\);/);
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
.leaders{list-style:none}.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim .buy-dasha{margin-left:auto}
.empty{color:var(--muted);margin:0}.identity{font-weight:900;color:var(--acid)}
#buy-sheet{position:fixed}#buy-share-x{color:inherit}#buy-mint{font:inherit}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div class="app"><section class="gate" id="gate">
<div class="gate-actions"><button class="btn" id="gate-action" type="button">Play</button></div>
</section><div id="chess-stage"></div></div>
<p class="empty">No rated games yet</p>
<p class="identity">@dash_eats</p>
<section id="leaders-panel" hidden><h2>Top table</h2><ol class="leaders" id="leaders"><li><small>—</small><span>No rated games yet</span><b></b></li></ol></section>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><div class="buy-chips" id="buy-chips"></div><div><code id="buy-mint">${MINT}</code><p id="buy-flash" hidden>bought. <a id="buy-share-x" href="https://x.com/intent/post">X</a> <a href="${TG}" target="_blank" rel="noopener noreferrer">TG</a></p></div></div>
</body></html>`;

assert.match(afterStyleScript(LIVE), /id=["']leaders-panel["']/, "fixture leftover id=leaders-panel paints after style/script strip");
assert.doesNotMatch(afterStyleScript(LIVE), /getElementById\(['"]leaders-panel['"]\)/, "fixture JS never reads leaders-panel");
assert.doesNotMatch(LIVE, /#leaders-panel\b/, "fixture CSS never targets #leaders-panel");
assert.match(LIVE, /class=["']leaders["']/, "fixture class=leaders stays in DOM");
assert.match(LIVE, /id=["']leaders["']/, "fixture #leaders stays");

const gone = stripChessLeftoverLeadersPanelId(LIVE);
assert.doesNotMatch(gone, /\bid=["']leaders-panel["']/, "drops leftover id=leaders-panel");
assert.match(gone, /id=["']leaders["']/, "#leaders stays");
assert.match(gone, /class=["']leaders["']/, "class=leaders stays");
assert.match(gone, /id=["']buy-mint["']/, "#buy-mint stays");
assert.match(gone, /id=["']buy-sheet["']/, "buy sheet stays");
assert.match(gone, /id=["']buy-share-x["']/, "#buy-share-x stays");
assert.match(gone, new RegExp(TG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "TG href stays");
assert.match(gone, />TG<\/a>/, "TG text stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, /src="\/client\/chess-local\.js"/, "chess-local stays");
assert.match(gone, /class=["']gate-actions["']/, "class=gate-actions stays");
assert.match(gone, /id=["']gate-action["']/, "#gate-action stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "id drop is per-attr, not eat-the-page");

{
  const other = stripChessLeftoverLeadersPanelId(`<!doctype html><html><head></head><body><section id="leaders-panel"><ol class="leaders" id="leaders"></ol></section></body></html>`);
  assert.match(other, /id="leaders-panel"/, "non-chess pages keep leftover leaders-panel id");
}

const polished = polishServedSlim(LIVE);
assert.doesNotMatch(polished, /\bid=["']leaders-panel["']/, "polish drops leftover id=leaders-panel");
assert.match(polished, /id=["']leaders["']/, "polish #leaders stays");
assert.match(polished, /class=["']leaders["']/, "polish class=leaders stays");
assert.match(polished, /id=["']buy-mint["']/, "polish #buy-mint stays");
assert.match(polished, /id=["']buy-share-x["']/, "polish #buy-share-x stays");
assert.match(polished, />TG<\/a>/, "polish TG stays");
assert.match(polished, /id=["']buy-sheet["']/, "polish buy sheet stays");

assert.match(chessDisk, /id=["']leaders-panel["']/, "disk source still has leftover id=leaders-panel (polish drops it; did not run static-gen)");
assert.match(CHESS_PAGE_HTML, /id=["']leaders-panel["']/, "bundled still has leftover id=leaders-panel");

function assertNoLeadersPanelId(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']leaders-panel["']/, `${label} no leftover id=leaders-panel after style/script strip`);
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

assertNoLeadersPanelId(polishServedSlim(LIVE), "polished leftover fixture");
assertNoLeadersPanelId(polishServedSlim(chessDisk), "polished disk");
assertNoLeadersPanelId(polishServedSlim(CHESS_PAGE_HTML), "polished bundled");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  assertNoLeadersPanelId(html, "served chess");
  assert.doesNotMatch(html, /\bid=["']buy-sheet-fallback["']/, "prior leftover id=buy-sheet-fallback stays dropped");
  assert.doesNotMatch(html, /\bid=["']buy-share-tg["']/, "prior leftover id=buy-share-tg stays dropped");
  assert.doesNotMatch(html, /\bid=["']gate-actions["']/, "prior leftover id=gate-actions stays dropped");
  assert.match(html, /class=["']gate-actions["']/, "class=gate-actions stays");
  assert.match(html, /id=["']gate-action["']/, "#gate-action stays");
  assert.doesNotMatch(html, /\.panel\{/, "prior leftover .panel CSS stays dropped");
  assert.doesNotMatch(html, /\.dasha-quiet/, "prior leftover .dasha-quiet CSS stays dropped");
  assert.doesNotMatch(html, /\.privacy/, "prior leftover .privacy CSS stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "prior leftover chess mobile-scroll stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-jup["']/, "prior leftover empty jup mount stays dropped");
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
  assert.match(html, /id=["']dasha-chess["']/, "in-room chess stays");
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
  assert.doesNotMatch(html, /#dasha-home\s+#tool\s+label/, "leftover #tool label gone");
  assert.match(html, /#dasha-home h2/, "repair h2 stays");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /johns-awesome/, "johns-awesome CSS stays");
  assert.match(html, /@view-transition/, "@view-transition stays");
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

console.log("dasha-chess-leaders-panel-id-leftover: PASS (chess leftover id=leaders-panel gone; class=leaders + #leaders stay)");
