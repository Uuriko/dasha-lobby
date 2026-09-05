#!/usr/bin/env node
/**
 * Leftover after Full table CSS DRY (df-* threads mount).
 * Live /lobby 200 still serializes leftover `.forum-back` CSS after that class
 * was never in the lobby DOM (threads are #dasha-forum + df-back). Keep `.forum-send`.
 * Humans see it in view-source. Distinct leftover vs leftover .dasha-quiet /
 * leftover .forum-meta / leftover .forum-post. #forum-play-go + #dasha-forum +
 * #dasha-chess + .lobby-log stay. Do not eat .forum-threads. Keep .dasha-lobby.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
  stripLobbyLeftoverForumBackCss,
} from "./dasha-lobby-worker.mjs";
import { LOBBY_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const lobbyDisk = readFileSync(join(root, "dasha-lobby-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover /lobby dropped-selector CSS after .forum-back was never in the lobby DOM"));
assert.match(workerSrc, /export function stripLobbyLeftoverForumBackCss/);
assert.match(workerSrc, /out = stripLobbyLeftoverForumBackCss\(out\);/);
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

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha Lobby</title>
<style>
.forum-play{margin:4.5rem 0 0}
.forum-play-row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center}
.forum-threads{margin:4.5rem 0 0}
.forum-back,.forum-send,.lobby-send,.lobby-x-btn,.lobby-x-unlink{min-height:48px}
.forum-back,.lobby-x-btn,.lobby-x-unlink{background:transparent;color:var(--paper);border:1px solid var(--paper)}
.dasha-lobby{display:flex;flex-direction:column;gap:1rem}
.lobby-log{flex:1 1 auto;min-height:8rem}
.forum-send{min-height:48px}
#dasha-chess{margin-top:1.2rem}
</style>
</head><body>
<h1>Lobby</h1>
<section class="forum-play"><button type="button" class="forum-send" id="forum-play-go">Play</button><div id="dasha-chess" hidden></div></section>
<section class="forum-threads"><h2>Threads</h2><div id="dasha-forum"><p class="forum-empty">None yet.</p></div></section>
<div class="lobby-log"></div>
</body></html>`;

assert.match(LIVE, /\.forum-back,\.forum-send,/, "fixture leftover .forum-back CSS paints");
assert.doesNotMatch(LIVE, /class=["'][^"']*\bforum-back\b/, "fixture .forum-back never in DOM");
assert.match(LIVE, /class=["']forum-send["']/, "fixture .forum-send stays in DOM");
assert.match(LIVE, /class=["']forum-threads["']/, "fixture .forum-threads stays in DOM");

const gone = stripLobbyLeftoverForumBackCss(LIVE);
assert.doesNotMatch(gone, /\.forum-back/, "drops leftover .forum-back CSS");
assert.match(gone, /\.forum-send,/, ".forum-send CSS stays");
assert.match(gone, /\.lobby-send/, ".lobby-send CSS stays");
assert.match(gone, /\.lobby-x-btn/, ".lobby-x-btn CSS stays");
assert.match(gone, /\.lobby-x-unlink/, ".lobby-x-unlink CSS stays");
assert.match(gone, /\.forum-threads\{/, ".forum-threads CSS stays");
assert.match(gone, /\.lobby-log\{/, ".lobby-log CSS stays");
assert.match(gone, /id=["']forum-play-go["']/, "Play stays");
assert.match(gone, /id=["']dasha-forum["']/, "threads mount stays");
assert.match(gone, /id=["']dasha-chess["']/, "in-room chess stays");
assert.match(gone, /class=["']lobby-log["']/, "lobby .lobby-log stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-rule, not eat-the-page");

const rewritten = rewriteLobbyForumChrome(LIVE);
assert.doesNotMatch(rewritten, /\.forum-back/, "rewrite drops leftover .forum-back CSS");
assert.match(rewritten, /\.forum-send/, "rewrite keeps .forum-send");
assert.match(rewritten, /\.lobby-x-btn/, "rewrite keeps .lobby-x-btn");
assert.match(rewritten, /\.forum-threads\{/, "rewrite keeps .forum-threads");
assert.match(rewritten, /id=["']forum-play-go["']/, "rewrite Play stays");

assert.match(lobbyDisk, /\.forum-back,\.forum-send,/, "disk source still has leftover .forum-back CSS (polish drops it; did not run static-gen)");
assert.match(LOBBY_PAGE_HTML, /\.forum-back,\.forum-send,/, "bundled still has leftover .forum-back CSS");

function assertNoDroppedCss(html, label) {
  assert.doesNotMatch(html, /\.forum-back/, `${label} no leftover .forum-back CSS`);
  assert.doesNotMatch(html, /class=["'][^"']*\bforum-back\b/, `${label} no forum-back class`);
  assert.match(html, /\.forum-send/, `${label} .forum-send CSS stays`);
  assert.match(html, /\.lobby-send/, `${label} .lobby-send CSS stays`);
  assert.match(html, /\.lobby-x-btn/, `${label} .lobby-x-btn CSS stays`);
  assert.match(html, /\.lobby-x-unlink/, `${label} .lobby-x-unlink CSS stays`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} Play`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} threads mount`);
  assert.match(html, /id=["']dasha-chess["']/, `${label} in-room chess`);
  assert.match(html, /\.lobby-log/, `${label} .lobby-log CSS stays`);
  assert.match(html, /\.forum-threads/, `${label} .forum-threads stays`);
  assert.match(html, /\.dasha-lobby/, `${label} .dasha-lobby stays`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoDroppedCss(asStandaloneLobbyPage(LIVE), "standalone leftover fixture");
assertNoDroppedCss(asStandaloneLobbyPage(lobbyDisk), "standalone disk");
assertNoDroppedCss(asStandaloneLobbyPage(LOBBY_PAGE_HTML), "standalone bundled");
assert.match(asStandaloneLobbyPage(lobbyDisk), new RegExp(MINT), "standalone disk mint");

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get("x-dasha-edge"), "lobby-page");
  const html = await lobby.text();
  assertNoDroppedCss(html, "served lobby");
  assert.match(html, new RegExp(MINT), "served lobby mint");
  assert.doesNotMatch(html, /\.forum-meta/, "prior leftover .forum-meta CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-post/, "prior leftover .forum-post CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-reply/, "prior leftover .forum-reply CSS stays dropped");
  assert.doesNotMatch(html, /\.dasha-quiet/, "prior leftover .dasha-quiet CSS stays dropped");
  assert.doesNotMatch(html, /\.dasha-forum\{/, "prior leftover .dasha-forum CSS stays dropped");
  assert.match(html, /\.lobby-meta/, "lobby .lobby-meta stays");
  assert.match(html, /\.lobby-line/, "lobby .lobby-line stays");
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "prior leftover lobby mobile-scroll stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-digest-remount["']/, "prior leftover lobby remount stays dropped");
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
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
  assert.match(html, /class=["']pill primary["']/, "simp-door pill stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /@view-transition/, "@view-transition stays");
  assert.match(html, />Buy</, "Buy stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.doesNotMatch(html, /\.panel\{/, "prior leftover chess .panel CSS stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "prior leftover chess mobile-scroll stays dropped");
  assert.match(html, /id=["']chess-stage["']/, "chess-stage stays");
  assert.match(html, /id=["']buy-sheet["']/, "buy sheet stays");
  assert.match(html, /jup\.ag/, "jup.ag stays");
  assert.match(html, /class=["']app["']/, "chess .app stays");
  assert.match(html, /class=["']gate["']/, "chess .gate stays");
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

console.log("dasha-lobby-forum-back-css: PASS (lobby .forum-back CSS gone; .forum-send + threads + Play + lobby-log stay)");
