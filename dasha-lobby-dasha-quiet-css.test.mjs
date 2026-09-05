#!/usr/bin/env node
/**
 * Leftover after CSS/JS strip on /lobby.
 * Live /lobby 200 still serializes leftover `.dasha-quiet` CSS after that class
 * was never in the lobby DOM (slim header is .dasha-word + .buy-dasha; JS never
 * mounts it). Humans see it in view-source. Distinct leftover vs leftover
 * .dasha-forum / leftover chess .dasha-quiet.
 * Keep .dasha-slim + .dasha-word + .buy-dasha. Keep .dasha-lobby (lobby.js
 * classList.add). Keep #dasha-forum. #forum-play-go + #dasha-chess + .lobby-log
 * stay. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
  stripLobbyLeftoverDashaQuietCss,
} from "./dasha-lobby-worker.mjs";
import { LOBBY_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const lobbyDisk = readFileSync(join(root, "dasha-lobby-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover /lobby dropped-selector CSS after .dasha-quiet was never in the lobby DOM"));
assert.match(workerSrc, /export function stripLobbyLeftoverDashaQuietCss/);
assert.match(workerSrc, /out = stripLobbyLeftoverDashaQuietCss\(out\);/);
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
.dasha-slim{display:flex}.dasha-word{font-weight:900}.dasha-slim a.dasha-quiet{display:inline-flex;align-items:center;min-height:48px;padding:0 .15rem;color:inherit;font:900 1rem/1 Arial,Helvetica,sans-serif;text-decoration:none}.dasha-slim .buy-dasha{margin-left:auto}
.forum-play{margin:4.5rem 0 0}
.forum-play-row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center}
.forum-threads{margin:4.5rem 0 0}
.dasha-lobby{display:flex;flex-direction:column;gap:1rem}
.lobby-log{flex:1 1 auto;min-height:8rem}
.forum-send{min-height:48px}
#dasha-chess{margin-top:1.2rem}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<h1>Lobby</h1>
<section class="forum-play"><button type="button" class="forum-send" id="forum-play-go">Play</button><div id="dasha-chess" hidden></div></section>
<section class="forum-threads"><h2>Threads</h2><div id="dasha-forum"><p class="forum-empty">None yet.</p></div></section>
<div id="dasha-lobby" class="lobby-log"></div>
</body></html>`;

assert.match(LIVE, /\.dasha-slim a\.dasha-quiet\{/, "fixture leftover .dasha-quiet CSS paints");
assert.doesNotMatch(LIVE, /class=["'][^"']*\bdasha-quiet\b/, "fixture .dasha-quiet never in DOM");
assert.match(LIVE, /class=["']dasha-slim["']/, "fixture .dasha-slim stays in DOM");
assert.match(LIVE, /class=["']dasha-word["']/, "fixture .dasha-word stays in DOM");
assert.match(LIVE, /class=["']buy-dasha["']/, "fixture .buy-dasha stays in DOM");
assert.match(LIVE, /id=["']dasha-forum["']/, "fixture #dasha-forum stays in DOM");

const gone = stripLobbyLeftoverDashaQuietCss(LIVE);
assert.doesNotMatch(gone, /\.dasha-quiet/, "drops leftover .dasha-quiet CSS");
assert.match(gone, /\.dasha-slim\{/, ".dasha-slim CSS stays");
assert.match(gone, /\.dasha-word\{/, ".dasha-word CSS stays");
assert.match(gone, /\.dasha-slim \.buy-dasha\{/, ".buy-dasha CSS stays");
assert.match(gone, /\.dasha-lobby\{/, ".dasha-lobby CSS stays");
assert.match(gone, /\.forum-threads\{/, ".forum-threads CSS stays");
assert.match(gone, /\.lobby-log\{/, ".lobby-log CSS stays");
assert.match(gone, /id=["']forum-play-go["']/, "Play stays");
assert.match(gone, /id=["']dasha-forum["']/, "threads mount stays");
assert.match(gone, /id=["']dasha-chess["']/, "in-room chess stays");
assert.match(gone, /class=["']lobby-log["']/, "lobby .lobby-log stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-rule, not eat-the-page");

const rewritten = rewriteLobbyForumChrome(LIVE);
assert.doesNotMatch(rewritten, /\.dasha-quiet/, "rewrite drops leftover .dasha-quiet CSS");
assert.match(rewritten, /\.dasha-lobby\{/, "rewrite keeps .dasha-lobby");
assert.match(rewritten, /\.dasha-slim\{/, "rewrite keeps .dasha-slim");
assert.match(rewritten, /\.dasha-word\{/, "rewrite keeps .dasha-word");
assert.match(rewritten, /id=["']forum-play-go["']/, "rewrite Play stays");
assert.match(rewritten, /id=["']dasha-forum["']/, "rewrite threads mount stays");

assert.match(lobbyDisk, /\.dasha-slim a\.dasha-quiet\{/, "disk source still has leftover .dasha-quiet CSS (polish drops it; did not run static-gen)");
assert.match(LOBBY_PAGE_HTML, /\.dasha-slim a\.dasha-quiet\{/, "bundled still has leftover .dasha-quiet CSS");

function assertNoDroppedCss(html, label) {
  assert.doesNotMatch(html, /\.dasha-quiet/, `${label} no leftover .dasha-quiet CSS`);
  assert.doesNotMatch(html, /class=["'][^"']*\bdasha-quiet\b/, `${label} no dasha-quiet class`);
  assert.match(html, /\.dasha-slim\{/, `${label} .dasha-slim CSS stays`);
  assert.match(html, /\.dasha-word\{/, `${label} .dasha-word CSS stays`);
  assert.match(html, /\.buy-dasha/, `${label} .buy-dasha stays`);
  assert.match(html, /\.dasha-lobby\{/, `${label} .dasha-lobby CSS stays`);
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

const HOME = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
<style>.dasha-slim a.dasha-quiet{display:inline-flex}</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
<script>(()=>{const CA='${MINT}';window.DashaHomeMint={CA}})()</script>
</body></html>`;

assert.equal(stripLobbyLeftoverDashaQuietCss(HOME), HOME, "home is not a lobby leftover .dasha-quiet page");

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get("x-dasha-edge"), "lobby-page");
  const html = await lobby.text();
  assertNoDroppedCss(html, "served lobby");
  assert.match(html, new RegExp(MINT), "served lobby mint");
  assert.doesNotMatch(html, /\.dasha-forum\{/, "prior leftover .dasha-forum CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-meta/, "prior leftover .forum-meta CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-list/, "prior leftover .forum-list CSS stays dropped");
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
  assert.doesNotMatch(html, /\.dasha-quiet/, "prior leftover chess .dasha-quiet CSS stays dropped");
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

console.log("dasha-lobby-dasha-quiet-css: PASS (lobby .dasha-quiet CSS gone; slim header + .dasha-lobby + threads + Play stay)");
