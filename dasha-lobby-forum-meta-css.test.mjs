#!/usr/bin/env node
/**
 * Leftover after Full table CSS DRY (df-* threads mount).
 * Live /lobby 200 still serializes leftover `.forum-meta` CSS prefix after
 * that class was never in the lobby DOM (threads are #dasha-forum + df-*). Keep `.lobby-meta`.
 * Humans see it in view-source. Distinct leftover vs .forum-post/.forum-reply / .forum-replies/.forum-when /
 * .forum-row / .forum-title / .forum-list/.forum-thread. #forum-play-go + #dasha-forum + #dasha-chess +
 * .lobby-log stay. Do not eat .forum-threads. Keep .lobby-meta. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
  stripLobbyLeftoverForumMetaCss,
} from "./dasha-lobby-worker.mjs";
import { LOBBY_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const lobbyDisk = readFileSync(join(root, "dasha-lobby-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover /lobby dropped-selector CSS after .forum-meta was never in the lobby DOM"));
assert.match(workerSrc, /export function stripLobbyLeftoverForumMetaCss/);
assert.match(workerSrc, /out = stripLobbyLeftoverForumMetaCss\(out\);/);
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
.forum-meta,.lobby-meta{color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.lobby-line{display:grid;gap:2px;width:100%;padding:.35rem 0;border:0;background:none;color:var(--paper);font:inherit;text-align:left}
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

assert.match(LIVE, /\.forum-meta,\.lobby-meta\{/, "fixture leftover .forum-meta CSS paints");
assert.doesNotMatch(LIVE, /class=["'][^"']*\bforum-meta\b/, "fixture .forum-meta never in DOM");
assert.match(LIVE, /class=["']forum-threads["']/, "fixture .forum-threads stays in DOM");

const gone = stripLobbyLeftoverForumMetaCss(LIVE);
assert.doesNotMatch(gone, /\.forum-meta/, "drops leftover .forum-meta CSS");
assert.match(gone, /\.lobby-meta\{/, ".lobby-meta CSS stays");
assert.match(gone, /\.lobby-line\{/, ".lobby-line CSS stays");
assert.match(gone, /\.forum-threads\{/, ".forum-threads CSS stays");
assert.match(gone, /\.lobby-log\{/, ".lobby-log CSS stays");
assert.match(gone, /id=["']forum-play-go["']/, "Play stays");
assert.match(gone, /id=["']dasha-forum["']/, "threads mount stays");
assert.match(gone, /id=["']dasha-chess["']/, "in-room chess stays");
assert.match(gone, /class=["']lobby-log["']/, "lobby .lobby-log stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-rule, not eat-the-page");

const rewritten = rewriteLobbyForumChrome(LIVE);
assert.doesNotMatch(rewritten, /\.forum-meta/, "rewrite drops leftover .forum-meta CSS");
assert.match(rewritten, /\.lobby-meta\{/, "rewrite keeps .lobby-meta");
assert.match(rewritten, /\.lobby-line\{/, "rewrite keeps .lobby-line");
assert.match(rewritten, /\.forum-threads\{/, "rewrite keeps .forum-threads");
assert.match(rewritten, /id=["']forum-play-go["']/, "rewrite Play stays");

assert.match(lobbyDisk, /\.forum-meta,\.lobby-meta\{/, "disk source still has leftover .forum-meta CSS (polish drops it; did not run static-gen)");
assert.match(LOBBY_PAGE_HTML, /\.forum-meta,\.lobby-meta\{/, "bundled still has leftover .forum-meta CSS");

function assertNoDroppedCss(html, label) {
  assert.doesNotMatch(html, /\.forum-meta/, `${label} no leftover .forum-meta CSS`);
  assert.doesNotMatch(html, /class=["'][^"']*\bforum-meta\b/, `${label} no forum-meta class`);
  assert.match(html, /\.lobby-meta/, `${label} .lobby-meta CSS stays`);
  assert.match(html, /\.lobby-line/, `${label} .lobby-line CSS stays`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} Play`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} threads mount`);
  assert.match(html, /id=["']dasha-chess["']/, `${label} in-room chess`);
  assert.match(html, /\.lobby-log/, `${label} .lobby-log CSS stays`);
  assert.match(html, /\.forum-threads/, `${label} .forum-threads stays`);
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
  assert.doesNotMatch(html, /\.forum-post/, "prior leftover .forum-post CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-reply/, "prior leftover .forum-reply CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-row/, "prior leftover .forum-row CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-list/, "prior leftover .forum-list CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-title/, "prior leftover .forum-title CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-replies/, "prior leftover .forum-replies CSS stays dropped");
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
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "prior leftover chess mobile-scroll stays dropped");
  assert.match(html, /id=["']chess-stage["']/, "chess-stage stays");
  assert.match(html, /id=["']buy-sheet["']/, "buy sheet stays");
  assert.match(html, /jup\.ag/, "jup.ag stays");
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

console.log("dasha-lobby-forum-meta-css: PASS (lobby .forum-meta CSS gone; .lobby-meta + threads + Play + lobby-log stay)");
