#!/usr/bin/env node
/**
 * Leftover after lobby CSS/JS strip + Play button.
 * Live /lobby 200 still serializes leftover id="forum-play" after JS never reads
 * getElementById('forum-play') and CSS never targets #forum-play (Play is
 * class="forum-play" + id="forum-play-go"). Humans see it in view-source.
 * Distinct leftover vs leftover .forum-back / leftover .forum-play-full.
 * Keep class="forum-play" + #forum-play-go + .forum-send. Disk only. No Designer.
 * Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
  stripLobbyLeftoverForumPlayId,
} from "./dasha-lobby-worker.mjs";
import { LOBBY_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const lobbyDisk = readFileSync(join(root, "dasha-lobby-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover /lobby id="forum-play" after CSS/JS strip'));
assert.match(workerSrc, /export function stripLobbyLeftoverForumPlayId/);
assert.match(workerSrc, /out = stripLobbyLeftoverForumPlayId\(out\);/);
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
<title>$dasha Lobby</title>
<style>
.forum-play{margin:4.5rem 0 0}
.forum-play-row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center}
.forum-threads{margin:4.5rem 0 0}
.forum-send,.lobby-send{min-height:48px}
.dasha-lobby{display:flex;flex-direction:column;gap:1rem}
.lobby-log{flex:1 1 auto;min-height:8rem}
#dasha-chess{margin-top:1.2rem}
</style>
</head><body>
<h1>Lobby</h1>
<div id="dasha-lobby"></div>
<section id="forum-play" class="forum-play" aria-label="Play">
<h2>Play</h2>
<button type="button" class="forum-send" id="forum-play-go">Play</button>
<div id="dasha-chess" hidden></div>
</section>
<section class="forum-threads"><h2>Threads</h2><div id="dasha-forum"><p class="forum-empty">None yet.</p></div></section>
<div class="lobby-log"></div>
</body></html>`;

assert.match(afterStyleScript(LIVE), /id=["']forum-play["']/, "fixture leftover id=forum-play paints after style/script strip");
assert.doesNotMatch(afterStyleScript(LIVE), /getElementById\(['"]forum-play['"]\)/, "fixture JS never reads forum-play");
assert.doesNotMatch(LIVE, /#forum-play\b/, "fixture CSS never targets #forum-play");
assert.match(LIVE, /class=["']forum-play["']/, "fixture class=forum-play stays in DOM");
assert.match(LIVE, /id=["']forum-play-go["']/, "fixture #forum-play-go stays");

const gone = stripLobbyLeftoverForumPlayId(LIVE);
assert.doesNotMatch(gone, /\bid=["']forum-play["']/, "drops leftover id=forum-play");
assert.match(gone, /id=["']forum-play-go["']/, "#forum-play-go stays");
assert.match(gone, /class=["']forum-play["']/, "class=forum-play stays");
assert.match(gone, /class=["']forum-send["']/, ".forum-send stays");
assert.match(gone, /id=["']dasha-forum["']/, "threads mount stays");
assert.match(gone, /id=["']dasha-chess["']/, "in-room chess stays");
assert.match(gone, /id=["']dasha-lobby["']/, "#dasha-lobby stays");
assert.match(gone, /class=["']lobby-log["']/, "lobby .lobby-log stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "id drop is per-attr, not eat-the-page");

{
  const other = stripLobbyLeftoverForumPlayId(`<!doctype html><html><head></head><body><section id="forum-play" class="forum-play"><button id="x">x</button></section></body></html>`);
  assert.match(other, /id="forum-play"/, "non-lobby pages keep leftover forum-play id");
}

const rewritten = rewriteLobbyForumChrome(LIVE);
assert.doesNotMatch(rewritten, /\bid=["']forum-play["']/, "rewrite drops leftover id=forum-play");
assert.match(rewritten, /id=["']forum-play-go["']/, "rewrite Play stays");
assert.match(rewritten, /class=["']forum-play["']/, "rewrite class=forum-play stays");

assert.match(lobbyDisk, /id=["']forum-play["']/, "disk source still has leftover id=forum-play (polish drops it; did not run static-gen)");
assert.match(LOBBY_PAGE_HTML, /id=["']forum-play["']/, "bundled still has leftover id=forum-play");

function assertNoPlayId(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']forum-play["']/, `${label} no leftover id=forum-play after style/script strip`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} Play`);
  assert.match(html, /class=["']forum-play["']/, `${label} class=forum-play stays`);
  assert.match(html, /class=["']forum-send["']/, `${label} .forum-send stays`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} threads mount`);
  assert.match(html, /id=["']dasha-chess["']/, `${label} in-room chess`);
  assert.match(html, /\.dasha-lobby/, `${label} .dasha-lobby stays`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoPlayId(asStandaloneLobbyPage(LIVE), "standalone leftover fixture");
assertNoPlayId(asStandaloneLobbyPage(lobbyDisk), "standalone disk");
assertNoPlayId(asStandaloneLobbyPage(LOBBY_PAGE_HTML), "standalone bundled");
assert.match(asStandaloneLobbyPage(lobbyDisk), new RegExp(MINT), "standalone disk mint");

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get("x-dasha-edge"), "lobby-page");
  const html = await lobby.text();
  assertNoPlayId(html, "served lobby");
  assert.match(html, new RegExp(MINT), "served lobby mint");
  assert.doesNotMatch(html, /\.forum-back/, "prior leftover .forum-back CSS stays dropped");
  assert.doesNotMatch(html, /\.dasha-quiet/, "prior leftover .dasha-quiet CSS stays dropped");
  assert.match(html, /id=["']dasha-lobby["']/, "served #dasha-lobby stays");
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
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /johns-awesome/, "johns-awesome CSS stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /class=["']app["']/, "chess .app stays");
  assert.match(html, /class=["']gate["']/, "chess .gate stays");
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

console.log("dasha-lobby-forum-play-id-leftover: PASS (lobby leftover id=forum-play gone; class=forum-play + #forum-play-go stay)");
