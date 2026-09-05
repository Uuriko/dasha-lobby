#!/usr/bin/env node
/**
 * Leftover after lobby leftover mixed .forum-form CSS.
 * Live /lobby 200 still serializes leftover mixed `.forum-body` / `.forum-status` CSS
 * after those classes were never in the lobby DOM (lobby.js mounts lobby-body /
 * lobby-status; threads mount is #dasha-forum + df-body / df-status). Humans see
 * leftover .forum-body / .forum-status prefixes in view-source.
 * Distinct leftover vs leftover .forum-form / leftover footer.dasha-foot nav.
 * Keep .lobby-body + .lobby-body a. Keep .lobby-status + .lobby-status[data-kind=bad].
 * Keep .forum-send + class="forum-play" + #forum-play-go + #dasha-forum + .dasha-lobby.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
  stripLobbyLeftoverForumBodyCss,
} from "./dasha-lobby-worker.mjs";
import { LOBBY_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const lobbyDisk = readFileSync(join(root, "dasha-lobby-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover /lobby dropped-selector CSS after .forum-body/.forum-status were never in the lobby DOM"),
);
assert.match(workerSrc, /export function stripLobbyLeftoverForumBodyCss/);
assert.match(workerSrc, /out = stripLobbyLeftoverForumBodyCss\(out\);/);
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
.lobby-form{display:grid}
.lobby-form input,.lobby-form textarea{min-height:48px}
.lobby-nick[hidden],.lobby-xbar[hidden]{display:none!important}
.forum-body,.lobby-body{overflow-wrap:anywhere}
.forum-body a,.lobby-body a{color:var(--acid);font-weight:800}
.forum-status,.lobby-status{margin:0;min-height:1.2em;color:var(--muted);font-size:14px;font-weight:700}
.forum-status[data-kind=bad],.lobby-status[data-kind=bad]{color:var(--hot)}
.dasha-lobby{display:flex;flex-direction:column;gap:1rem}
.dasha-lobby .lobby-form{margin-top:auto}
.lobby-log{flex:1 1 auto;min-height:8rem}
.forum-send,.lobby-send{min-height:48px}
#dasha-chess{margin-top:1.2rem}
</style>
</head><body>
<h1>Lobby</h1>
<div id="dasha-lobby" class="dasha-lobby">
<form class="lobby-form" autocomplete="off">
<textarea name="text" aria-label="Message" placeholder="Message" rows="1"></textarea>
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

assert.match(LIVE, /\.forum-body,\.lobby-body\{/, "fixture leftover mixed .forum-body CSS paints");
assert.match(LIVE, /\.forum-status,\.lobby-status\{/, "fixture leftover mixed .forum-status CSS paints");
assert.doesNotMatch(afterStyleScript(LIVE), /class=["'][^"']*\bforum-body\b/, "fixture .forum-body never in DOM");
assert.doesNotMatch(afterStyleScript(LIVE), /class=["'][^"']*\bforum-status\b/, "fixture .forum-status never in DOM");
assert.match(LIVE, /class=["']lobby-form["']/, "fixture .lobby-form stays in DOM");

const gone = stripLobbyLeftoverForumBodyCss(LIVE);
assert.doesNotMatch(gone, /\.forum-body/, "drops leftover .forum-body CSS");
assert.doesNotMatch(gone, /\.forum-status/, "drops leftover .forum-status CSS");
assert.match(gone, /\.lobby-body\{/, ".lobby-body CSS stays");
assert.match(gone, /\.lobby-body a\{/, ".lobby-body a CSS stays");
assert.match(gone, /\.lobby-status\{/, ".lobby-status CSS stays");
assert.match(gone, /\.lobby-status\[data-kind=bad\]\{/, ".lobby-status[data-kind=bad] stays");
assert.match(gone, /\.lobby-form\{/, ".lobby-form CSS stays");
assert.match(gone, /class=["']lobby-form["']/, ".lobby-form class stays");
assert.match(gone, /class=["']forum-play["']/, "class=forum-play stays");
assert.match(gone, /id=["']forum-play-go["']/, "#forum-play-go stays");
assert.match(gone, /id=["']dasha-forum["']/, "#dasha-forum stays");
assert.match(gone, /\.dasha-lobby\{/, ".dasha-lobby stays");
assert.match(gone, /class=["']forum-send["']/, ".forum-send stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-prefix, not eat-the-page");

{
  const keep = LIVE.replace('class="lobby-form"', 'class="lobby-form forum-body forum-status"');
  const out = stripLobbyLeftoverForumBodyCss(keep);
  assert.match(out, /\.forum-body,\.lobby-body\{/, "keeps mixed .forum-body CSS when DOM still has forum-body");
  assert.match(out, /\.forum-status,\.lobby-status\{/, "keeps mixed .forum-status CSS when DOM still has forum-status");
}

{
  const home = `<!doctype html><html><head><style>.forum-body,.lobby-body{overflow-wrap:anywhere}.forum-status,.lobby-status{min-height:1.2em}</style></head>
<body><div id="dasha-home"></div><div id="chat-door"></div><div id="grwm"></div></body></html>`;
  const out = stripLobbyLeftoverForumBodyCss(home);
  assert.match(out, /\.forum-body,\.lobby-body/, "home does not eat leftover lobby .forum-body CSS");
  assert.match(out, /\.forum-status,\.lobby-status/, "home does not eat leftover lobby .forum-status CSS");
}

assert.match(lobbyDisk, /\.forum-body,\.lobby-body\{/, "disk source still has leftover .forum-body CSS (polish drops it; did not run static-gen)");
assert.match(lobbyDisk, /\.forum-status,\.lobby-status\{/, "disk source still has leftover .forum-status CSS");
assert.match(LOBBY_PAGE_HTML, /\.forum-body,\.lobby-body\{/, "bundled still has leftover .forum-body CSS");
assert.match(LOBBY_PAGE_HTML, /\.forum-status,\.lobby-status\{/, "bundled still has leftover .forum-status CSS");

function assertNoForumBodyCss(html, label) {
  assert.doesNotMatch(html, /\.forum-body/, `${label} no leftover .forum-body CSS`);
  assert.doesNotMatch(html, /\.forum-status/, `${label} no leftover .forum-status CSS`);
  assert.match(html, /\.lobby-body\{/, `${label} .lobby-body CSS`);
  assert.match(html, /\.lobby-status\{/, `${label} .lobby-status CSS`);
  assert.match(html, /class=["']lobby-form["']/, `${label} class=lobby-form`);
  assert.match(html, /class=["']forum-play["']/, `${label} class=forum-play`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} #forum-play-go`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} #dasha-forum`);
  assert.match(html, /\.dasha-lobby/, `${label} .dasha-lobby`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoForumBodyCss(stripLobbyLeftoverForumBodyCss(LIVE), "strip leftover fixture");
assertNoForumBodyCss(rewriteLobbyForumChrome(LIVE), "rewrite leftover fixture");
assertNoForumBodyCss(asStandaloneLobbyPage(LIVE), "standalone leftover fixture");
assertNoForumBodyCss(asStandaloneLobbyPage(lobbyDisk), "standalone disk");
assertNoForumBodyCss(asStandaloneLobbyPage(LOBBY_PAGE_HTML), "standalone bundled");
assert.match(asStandaloneLobbyPage(lobbyDisk), new RegExp(MINT), "standalone disk mint");
assert.match(asStandaloneLobbyPage(lobbyDisk), /\.lobby-body a\{/, "standalone disk .lobby-body a");
assert.match(asStandaloneLobbyPage(lobbyDisk), /\.lobby-status\[data-kind=bad\]/, "standalone disk .lobby-status[data-kind=bad]");

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get("x-dasha-edge"), "lobby-page");
  const html = await lobby.text();
  assertNoForumBodyCss(html, "served lobby");
  assert.match(html, new RegExp(MINT), "served lobby mint");
  assert.match(html, /\.lobby-body a\{/, "served .lobby-body a");
  assert.match(html, /\.lobby-status\[data-kind=bad\]/, "served .lobby-status[data-kind=bad]");
  assert.match(html, /\.lobby-form\{/, "served .lobby-form CSS stays");
  assert.doesNotMatch(html, /\.forum-form/, "prior leftover .forum-form CSS stays dropped");
  assert.doesNotMatch(html, /footer\.dasha-foot nav\s*\{/, "prior leftover footer.dasha-foot nav CSS stays dropped");
  assert.match(html, /footer\.dasha-foot\{/, "footer.dasha-foot CSS stays");
  assert.doesNotMatch(html, /class=["'][^"']*\blobby-text\b/, "prior leftover class=lobby-text stays dropped");
  assert.doesNotMatch(html, /\bid=["']forum-play["']/, "prior leftover id=forum-play stays dropped");
  assert.match(html, /x-connect\.js/, "lobby x-connect.js stays");
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
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /@view-transition/, "product @view-transition stays");
  assert.match(html, /johns-awesome/, "johns-awesome CSS stays");
  assert.match(html, /data:image\/svg\+xml/, "cherries SVG stays");
  assert.match(html, /faucet\.js/, "faucet.js stays");
  assert.match(html, /x-connect\.js/, "x-connect.js stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /class=["']buy-dasha["']/, "chess .buy-dasha stays");
  assert.match(html, /id=["']buy-dasha["']/, "chess #buy-dasha stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  const html = await howto.text();
  assert.match(html, />Buy on Jupiter/, "Buy on Jupiter stays");
  assert.match(html, /id=["']ca["']/, "#ca stays");
  assert.match(html, /id=["']copy["']/, "id=copy stays");
  assert.doesNotMatch(html, /x-connect\.js/, "prior leftover howto x-connect.js stays dropped");
}

{
  const privacy = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.doesNotMatch(html, /a,code\{/, "prior leftover privacy a,code CSS stays dropped");
  assert.match(html, /a\{color:#dfff00\}/, "privacy a color stays");
  assert.match(html, /class=["']skip-link["']/, "privacy skip-link stays");
}

{
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /id=["']bb-x["']/, "bounties #bb-x stays");
  assert.match(html, /id=["']bb-app["']/, "#bb-app empty inventory stays");
  assert.match(html, /x-connect\.js/, "bounties x-connect.js stays");
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
}

{
  const contribute = await edgeWorker.fetch(new Request("https://www.getdasha.com/contribute"), {});
  assert.equal(contribute.status, 200);
  const html = await contribute.text();
  assert.doesNotMatch(html, /a,code\{/, "contribute leftover a,code CSS stays dropped");
  assert.match(html, /a\{color:#dfff00\}/, "contribute a color stays");
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

{
  const siwg = await edgeWorker.fetch(new Request("https://www.getdasha.com/siwg"), {});
  assert.equal(siwg.status, 308);
  assert.equal(siwg.headers.get("location"), "https://www.getdasha.com/login#grok");
}

{
  const use = await edgeWorker.fetch(new Request("https://www.getdasha.com/compute/use"), {});
  assert.equal(use.status, 308);
  assert.equal(use.headers.get("location"), "https://www.getdasha.com/compute");
}

console.log("dasha-lobby-forum-body-css-leftover: PASS (lobby leftover .forum-body/.forum-status CSS gone; .lobby-body + .lobby-status stay)");
