#!/usr/bin/env node
/**
 * Leftover after simp CSS/JS strip + quiz board.
 * Live /simp 200 still serializes leftover class="dasha-quiz" after CSS never
 * targets .dasha-quiz (quiz paints via #dasha-quiz) and JS never reads
 * querySelector('.dasha-quiz') (simp-board.js mounts #dasha-simp-board).
 * Humans see it in view-source.
 * Distinct leftover vs leftover home #simp hash / leftover class="lobby-text".
 * Keep #dasha-quiz + skip-link href=#dasha-quiz. Keep #dasha-simp-board + .simp-quiz-go.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripSimpLeftoverDashaQuizClass,
} from "./dasha-lobby-worker.mjs";
import { simpPageHtml } from "./dasha-simp-share-html.mjs";
import { SIMP_BOARD_SRI } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const shareSrc = readFileSync(join(root, "dasha-simp-share-html.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover /simp class="dasha-quiz" after CSS/JS strip'));
assert.match(workerSrc, /export function stripSimpLeftoverDashaQuizClass/);
assert.match(workerSrc, /stripSimpLeftoverDashaQuizClass\(simpPageHtml/);
assert.match(workerSrc, /function servedSimpPageHtml/);
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
<title>$dasha / Beat this</title>
<style>
#dasha-quiz{margin-top:2rem}
.simp-lede{font-weight:900}
.simp-quiz-go{min-height:56px}
.dasha-slim{display:flex}.dasha-word{font-weight:900}.buy-dasha{margin-left:auto}
</style>
</head><body>
<a class="skip-link" href="#dasha-quiz">Skip to quiz</a>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha</a></header>
<main>
<h1>Simp</h1>
<div id="dasha-quiz" class="dasha-quiz"><div id="dasha-simp-board"><p class="simp-lede">How big of a Dasha simp are you?</p>
<button type="button" class="simp-quiz-go" data-dasha-take-quiz>Take Quiz</button>
</div></div>
</main>
</body></html>`;

assert.match(afterStyleScript(LIVE), /class=["']dasha-quiz["']/, "fixture leftover class=dasha-quiz paints after style/script strip");
assert.doesNotMatch(afterStyleScript(LIVE), /querySelector\(['"]\.dasha-quiz['"]\)/, "fixture JS never reads .dasha-quiz");
assert.doesNotMatch(LIVE, /\.dasha-quiz\b/, "fixture CSS never targets .dasha-quiz");
assert.match(LIVE, /id=["']dasha-quiz["']/, "fixture #dasha-quiz stays in DOM");
assert.match(LIVE, /href=["']#dasha-quiz["']/, "fixture skip-link stays");

const gone = stripSimpLeftoverDashaQuizClass(LIVE);
assert.doesNotMatch(gone, /class=["'][^"']*\bdasha-quiz\b/, "drops leftover class=dasha-quiz");
assert.match(gone, /id=["']dasha-quiz["']/, "#dasha-quiz stays");
assert.match(gone, /href=["']#dasha-quiz["']/, "skip-link stays");
assert.match(gone, /id=["']dasha-simp-board["']/, "#dasha-simp-board stays");
assert.match(gone, /class=["']simp-quiz-go["']/, ".simp-quiz-go stays");
assert.match(gone, /data-dasha-take-quiz/, "Take Quiz stays");
assert.match(gone, /class=["']simp-lede["']/, ".simp-lede stays");
assert.match(gone, /class=["']buy-dasha["']/, "header Buy stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "class drop is per-attr, not eat-the-page");

{
  const other = stripSimpLeftoverDashaQuizClass(`<!doctype html><html><head></head><body><div class="dasha-quiz"></div></body></html>`);
  assert.match(other, /class="dasha-quiz"/, "non-simp pages keep leftover dasha-quiz class");
}

assert.match(shareSrc, /id="dasha-quiz" class="dasha-quiz"/, "share source still has leftover class=dasha-quiz (polish drops it; did not run static-gen)");
assert.match(simpPageHtml(), /class=["']dasha-quiz["']/, "bundled generator still has leftover class=dasha-quiz");
assert.match(simpPageHtml(), new RegExp(SIMP_BOARD_SRI.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "simp-board SRI stays in generator HTML");

function assertNoDashaQuizClass(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /class=["'][^"']*\bdasha-quiz\b/, `${label} no leftover class=dasha-quiz after style/script strip`);
  assert.match(html, /id=["']dasha-quiz["']/, `${label} #dasha-quiz stays`);
  assert.match(html, /href=["']#dasha-quiz["']/, `${label} skip-link stays`);
  assert.match(html, /id=["']dasha-simp-board["']/, `${label} board mount stays`);
  assert.match(html, /class=["']simp-quiz-go["']/, `${label} .simp-quiz-go stays`);
  assert.match(html, /data-dasha-take-quiz/, `${label} Take Quiz`);
  assert.match(html, /<h1>Simp<\/h1>/, `${label} Simp H1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoDashaQuizClass(stripSimpLeftoverDashaQuizClass(LIVE), "strip leftover fixture");
assertNoDashaQuizClass(stripSimpLeftoverDashaQuizClass(simpPageHtml()), "strip generator");

{
  const simp = await edgeWorker.fetch(new Request("https://www.getdasha.com/simp"), {});
  assert.equal(simp.status, 200);
  assert.equal(simp.headers.get("x-dasha-edge"), "simp");
  const html = await simp.text();
  assertNoDashaQuizClass(html, "served simp");
  assert.match(html, new RegExp(MINT), "served simp mint");
  assert.match(html, /simp-board\.js/, "simp-board.js stays");
  assert.match(html, /jup\.ag/, "jup.ag stays");
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
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /johns-awesome/, "johns-awesome CSS stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /class=["']lobby-form["']/, "lobby .lobby-form stays");
  assert.match(html, /class=["']lobby-send["']/, "lobby .lobby-send stays");
  assert.doesNotMatch(html, /class=["'][^"']*\blobby-text\b/, "prior leftover class=lobby-text stays dropped");
  assert.match(html, /id=["']dasha-forum["']/, "#dasha-forum stays");
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.match(html, /id=["']forum-play-go["']/, "#forum-play-go stays");
  assert.doesNotMatch(html, /\bid=["']forum-play["']/, "prior leftover id=forum-play stays dropped");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /class=["']app["']/, "chess .app stays");
  assert.match(html, /class=["']gate["']/, "chess .gate stays");
  assert.doesNotMatch(html, /\bid=["']leaders-panel["']/, "prior leftover id=leaders-panel stays dropped");
  assert.match(html, /jup\.ag/, "jup.ag stays");
}

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  const html = await howto.text();
  assert.doesNotMatch(html, /id=["']buy2["']/, "prior leftover howto id=buy2 stays dropped");
  assert.match(html, />Buy on Jupiter/, "Buy on Jupiter stays");
  assert.match(html, /id=["']ca["']/, "#ca stays");
  assert.match(html, /id=["']copy["']/, "id=copy stays");
}

{
  const privacy = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, "privacy product skip-link stays");
  assert.match(html, /href=["']#dasha-page["']/, "privacy skip target stays #dasha-page");
}

{
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /id=["']bb-x["']/, "bounties quiet Connect X stays");
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

console.log("dasha-simp-dasha-quiz-class-leftover: PASS (simp leftover class=dasha-quiz gone; #dasha-quiz + #dasha-simp-board stay)");
