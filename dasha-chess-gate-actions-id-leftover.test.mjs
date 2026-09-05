#!/usr/bin/env node
/**
 * Leftover after chess CSS/JS strip + Play gate.
 * Live /chess 200 still serializes leftover id="gate-actions" after JS never reads
 * getElementById('gate-actions') and CSS never targets #gate-actions (Play chrome is
 * class="gate-actions" + id="gate-action"). Humans see it in view-source.
 * Distinct leftover vs leftover .panel / leftover .dasha-quiet / leftover .privacy.
 * Keep class="gate-actions" + #gate-action + .app + .gate. Disk only. No Designer.
 * Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverGateActionsId,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover /chess id="gate-actions" after CSS/JS strip'));
assert.match(workerSrc, /export function stripChessLeftoverGateActionsId/);
assert.match(workerSrc, /out = stripChessLeftoverGateActionsId\(out\);/);
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
.app{display:grid;gap:12px}.app>*{min-width:0}.gate{display:flex}
.gate-actions{display:flex;flex-wrap:wrap;gap:10px}
.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim .buy-dasha{margin-left:auto}
.empty{color:var(--muted);margin:0}.identity{font-weight:900;color:var(--acid)}
#buy-sheet{position:fixed}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div class="app"><section class="gate" id="gate">
<div class="gate-actions" id="gate-actions"><button class="btn" id="gate-action" type="button">Play</button></div>
</section><div id="chess-stage"></div></div>
<p class="empty">No rated games yet</p>
<p class="identity">@dash_eats</p>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><div class="buy-chips" id="buy-chips"></div><div id="buy-sheet-fallback"><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div></div>
</body></html>`;

assert.match(afterStyleScript(LIVE), /id=["']gate-actions["']/, "fixture leftover id=gate-actions paints after style/script strip");
assert.doesNotMatch(afterStyleScript(LIVE), /getElementById\(['"]gate-actions['"]\)/, "fixture JS never reads gate-actions");
assert.doesNotMatch(LIVE, /#gate-actions\b/, "fixture CSS never targets #gate-actions");
assert.match(LIVE, /class=["']gate-actions["']/, "fixture class=gate-actions stays in DOM");
assert.match(LIVE, /id=["']gate-action["']/, "fixture #gate-action stays");

const gone = stripChessLeftoverGateActionsId(LIVE);
assert.doesNotMatch(gone, /\bid=["']gate-actions["']/, "drops leftover id=gate-actions");
assert.match(gone, /id=["']gate-action["']/, "#gate-action stays");
assert.match(gone, /class=["']gate-actions["']/, "class=gate-actions stays");
assert.match(gone, /class=["']app["']/, ".app stays");
assert.match(gone, /class=["']gate["']/, ".gate stays");
assert.match(gone, /id=["']chess-stage["']/, "chess-stage stays");
assert.match(gone, /id=["']buy-sheet["']/, "buy sheet stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, /src="\/client\/chess-local\.js"/, "chess-local stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "id drop is per-attr, not eat-the-page");

{
  const other = stripChessLeftoverGateActionsId(`<!doctype html><html><head></head><body><div class="gate-actions" id="gate-actions"><button id="gate-action">x</button></div></body></html>`);
  assert.match(other, /id="gate-actions"/, "non-chess pages keep leftover gate-actions id");
}

const polished = polishServedSlim(LIVE);
assert.doesNotMatch(polished, /\bid=["']gate-actions["']/, "polish drops leftover id=gate-actions");
assert.match(polished, /id=["']gate-action["']/, "polish #gate-action stays");
assert.match(polished, /class=["']gate-actions["']/, "polish class=gate-actions stays");
assert.match(polished, /class=["']app["']/, "polish .app stays");
assert.match(polished, /class=["']gate["']/, "polish .gate stays");

assert.match(chessDisk, /id=["']gate-actions["']/, "disk source still has leftover id=gate-actions (polish drops it; did not run static-gen)");
assert.match(CHESS_PAGE_HTML, /id=["']gate-actions["']/, "bundled still has leftover id=gate-actions");

function assertNoGateActionsId(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']gate-actions["']/, `${label} no leftover id=gate-actions after style/script strip`);
  assert.match(html, /id=["']gate-action["']/, `${label} #gate-action`);
  assert.match(html, /class=["']gate-actions["']/, `${label} class=gate-actions`);
  assert.match(html, /class=["']app["']/, `${label} .app`);
  assert.match(html, /class=["']gate["']/, `${label} .gate`);
  assert.match(html, /id=["']buy-sheet["']/, `${label} buy sheet`);
  assert.match(html, /jup\.ag/, `${label} jup.ag`);
  assert.match(html, /chess-local\.js/, `${label} chess-local`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoGateActionsId(polishServedSlim(LIVE), "polished leftover fixture");
assertNoGateActionsId(polishServedSlim(chessDisk), "polished disk");
assertNoGateActionsId(polishServedSlim(CHESS_PAGE_HTML), "polished bundled");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  assertNoGateActionsId(html, "served chess");
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

console.log("dasha-chess-gate-actions-id-leftover: PASS (chess leftover id=gate-actions gone; class=gate-actions + #gate-action + .app + .gate stay)");
