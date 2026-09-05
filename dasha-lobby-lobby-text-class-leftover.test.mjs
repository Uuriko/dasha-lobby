#!/usr/bin/env node
/**
 * Leftover after lobby CSS/JS strip + composer.
 * Live /lobby 200 still serializes leftover class="lobby-text" after CSS never
 * targets .lobby-text (composer paints via .lobby-form textarea) and inline JS
 * never reads querySelector('.lobby-text'). Humans see it in view-source.
 * Distinct leftover vs leftover id="forum-play" / leftover .forum-back.
 * Keep .lobby-form + .lobby-send + textarea name=text. Keep #dasha-lobby.
 * Keep class="forum-play" + #forum-play-go. Disk only. No Designer.
 * Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
  stripLobbyLeftoverLobbyTextClass,
} from "./dasha-lobby-worker.mjs";
import { LOBBY_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const lobbyDisk = readFileSync(join(root, "dasha-lobby-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover /lobby class="lobby-text" after CSS/JS strip'));
assert.match(workerSrc, /export function stripLobbyLeftoverLobbyTextClass/);
assert.match(workerSrc, /out = stripLobbyLeftoverLobbyTextClass\(out\);/);
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
.lobby-form{display:grid}
.lobby-form textarea{min-height:48px}
.lobby-log{flex:1 1 auto;min-height:8rem}
#dasha-chess{margin-top:1.2rem}
</style>
</head><body>
<h1>Lobby</h1>
<div id="dasha-lobby">
<form class="lobby-form" autocomplete="off">
<textarea class="lobby-text" name="text" aria-label="Message" placeholder="Message" rows="1" autofocus></textarea>
<button class="lobby-send" type="submit">Send</button>
</form>
</div>
<section class="forum-play" aria-label="Play">
<h2>Play</h2>
<button type="button" class="forum-send" id="forum-play-go">Play</button>
<div id="dasha-chess" hidden></div>
</section>
<section class="forum-threads"><h2>Threads</h2><div id="dasha-forum"><p class="forum-empty">None yet.</p></div></section>
<div class="lobby-log"></div>
</body></html>`;

assert.match(afterStyleScript(LIVE), /class=["']lobby-text["']/, "fixture leftover class=lobby-text paints after style/script strip");
assert.doesNotMatch(afterStyleScript(LIVE), /querySelector\(['"]\.lobby-text['"]\)/, "fixture JS never reads .lobby-text");
assert.doesNotMatch(LIVE, /\.lobby-text\b/, "fixture CSS never targets .lobby-text");
assert.match(LIVE, /class=["']lobby-form["']/, "fixture class=lobby-form stays in DOM");
assert.match(LIVE, /class=["']lobby-send["']/, "fixture class=lobby-send stays");
assert.match(LIVE, /name=["']text["']/, "fixture textarea name=text stays");

const gone = stripLobbyLeftoverLobbyTextClass(LIVE);
assert.doesNotMatch(gone, /class=["'][^"']*\blobby-text\b/, "drops leftover class=lobby-text");
assert.match(gone, /class=["']lobby-form["']/, ".lobby-form stays");
assert.match(gone, /class=["']lobby-send["']/, ".lobby-send stays");
assert.match(gone, /<textarea\b/, "textarea stays");
assert.match(gone, /name=["']text["']/, "name=text stays");
assert.match(gone, /id=["']forum-play-go["']/, "#forum-play-go stays");
assert.match(gone, /class=["']forum-play["']/, "class=forum-play stays");
assert.match(gone, /id=["']dasha-forum["']/, "threads mount stays");
assert.match(gone, /id=["']dasha-chess["']/, "in-room chess stays");
assert.match(gone, /id=["']dasha-lobby["']/, "#dasha-lobby stays");
assert.match(gone, /class=["']lobby-log["']/, "lobby .lobby-log stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "class drop is per-attr, not eat-the-page");

{
  const other = stripLobbyLeftoverLobbyTextClass(`<!doctype html><html><head></head><body><textarea class="lobby-text" name="text"></textarea></body></html>`);
  assert.match(other, /class="lobby-text"/, "non-lobby pages keep leftover lobby-text class");
}

const rewritten = rewriteLobbyForumChrome(LIVE);
assert.doesNotMatch(rewritten, /class=["'][^"']*\blobby-text\b/, "rewrite drops leftover class=lobby-text");
assert.match(rewritten, /class=["']lobby-form["']/, "rewrite .lobby-form stays");
assert.match(rewritten, /class=["']lobby-send["']/, "rewrite .lobby-send stays");

assert.match(lobbyDisk, /class=["']lobby-text["']/, "disk source still has leftover class=lobby-text (polish drops it; did not run static-gen)");
assert.match(LOBBY_PAGE_HTML, /class=["']lobby-text["']/, "bundled still has leftover class=lobby-text");

function assertNoLobbyText(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /class=["'][^"']*\blobby-text\b/, `${label} no leftover class=lobby-text after style/script strip`);
  assert.match(html, /class=["']lobby-form["']/, `${label} .lobby-form stays`);
  assert.match(html, /class=["']lobby-send["']/, `${label} .lobby-send stays`);
  assert.match(html, /<textarea\b/, `${label} textarea stays`);
  assert.match(html, /name=["']text["']/, `${label} name=text stays`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} Play`);
  assert.match(html, /class=["']forum-play["']/, `${label} class=forum-play stays`);
  assert.doesNotMatch(html, /\bid=["']forum-play["']/, `${label} leftover id=forum-play stays dropped`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} threads mount`);
  assert.match(html, /id=["']dasha-chess["']/, `${label} in-room chess`);
  assert.match(html, /\.dasha-lobby/, `${label} .dasha-lobby stays`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoLobbyText(asStandaloneLobbyPage(LIVE), "standalone leftover fixture");
assertNoLobbyText(asStandaloneLobbyPage(lobbyDisk), "standalone disk");
assertNoLobbyText(asStandaloneLobbyPage(LOBBY_PAGE_HTML), "standalone bundled");
assert.match(asStandaloneLobbyPage(lobbyDisk), new RegExp(MINT), "standalone disk mint");

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get("x-dasha-edge"), "lobby-page");
  const html = await lobby.text();
  assertNoLobbyText(html, "served lobby");
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
  assert.doesNotMatch(html, /\bid=["']leaders-panel["']/, "prior leftover id=leaders-panel stays dropped");
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

console.log("dasha-lobby-lobby-text-class-leftover: PASS (lobby leftover class=lobby-text gone; .lobby-form + .lobby-send stay)");
