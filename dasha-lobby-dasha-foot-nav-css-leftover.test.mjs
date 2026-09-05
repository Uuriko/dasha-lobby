#!/usr/bin/env node
/**
 * Leftover after lobby CSS/JS strip + product footer.dasha-foot <p> links.
 * Live /lobby 200 still serializes leftover `footer.dasha-foot nav` CSS after
 * footer <nav> was already DOM-stripped (footer is $dasha · Buy · Bag · Telegram
 * in a <p>). Humans see it in view-source. Distinct leftover vs leftover
 * class=lobby-text / leftover .forum-list. footer.dasha-foot + a + .buy-dasha stay.
 * Chess leftover footer.dasha-foot nav is a separate leftover. Disk only. No Designer.
 * Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
  stripLobbyLeftoverDashaFootNavCss,
} from "./dasha-lobby-worker.mjs";
import { LOBBY_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const lobbyDisk = readFileSync(join(root, "dasha-lobby-page.html"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover /lobby dropped-selector CSS after footer.dasha-foot <nav> was already DOM-stripped"));
assert.match(workerSrc, /export function stripLobbyLeftoverDashaFootNavCss/);
assert.match(workerSrc, /out = stripLobbyLeftoverDashaFootNavCss\(out\);/);
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
.forum-form,.lobby-form{display:grid}
.forum-body,.lobby-body{margin:0}
.forum-status,.lobby-status{min-height:1.2rem}
.dasha-lobby{display:flex;flex-direction:column;gap:1rem}
.lobby-log{flex:1 1 auto;min-height:8rem}
footer{margin:24px 0 0;color:var(--muted)}
footer a{color:var(--acid)}
footer.dasha-foot{margin:0;padding:1.25rem 0;background:var(--ink)}
footer.dasha-foot a{color:var(--paper)}
footer.dasha-foot a:hover{color:var(--acid)}
footer.dasha-foot .buy-dasha,footer.dasha-foot .buy-dasha:hover{background:var(--acid);color:var(--ink)}
footer.dasha-foot nav{display:flex;flex-wrap:wrap;gap:.15rem .25rem}
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
<footer class="dasha-foot"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a></p></footer>
</body></html>`;

assert.match(LIVE, /footer\.dasha-foot nav\{/, "fixture leftover footer.dasha-foot nav CSS paints");
assert.doesNotMatch(afterStyleScript(LIVE), /<nav\b/i, "fixture footer has no <nav>");
assert.match(afterStyleScript(LIVE), /<footer class="dasha-foot">/, "fixture footer.dasha-foot stays");

const gone = stripLobbyLeftoverDashaFootNavCss(LIVE);
assert.doesNotMatch(gone, /footer\.dasha-foot nav\s*\{/, "drops leftover footer.dasha-foot nav CSS");
assert.match(gone, /footer\.dasha-foot\{/, "footer.dasha-foot CSS stays");
assert.match(gone, /footer\.dasha-foot a\{/, "footer.dasha-foot a CSS stays");
assert.match(gone, /footer\.dasha-foot \.buy-dasha/, "footer.dasha-foot .buy-dasha CSS stays");
assert.match(gone, /footer\{margin:24px/, "generic footer CSS stays");
assert.match(gone, /class=["']forum-play["']/, "class=forum-play stays");
assert.match(gone, /id=["']forum-play-go["']/, "#forum-play-go stays");
assert.match(gone, /id=["']dasha-forum["']/, "#dasha-forum stays");
assert.match(gone, /\.dasha-lobby\{/, ".dasha-lobby stays");
assert.match(gone, /\.forum-form,\.lobby-form/, "mixed .forum-form stays");
assert.match(gone, /\.forum-body,\.lobby-body/, "mixed .forum-body stays");
assert.match(gone, /\.forum-status,\.lobby-status/, "mixed .forum-status stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-rule, not eat-the-page");

{
  const keep = LIVE.replace(
    '<footer class="dasha-foot"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=' +
      MINT +
      '">Buy</a></p></footer>',
    '<footer class="dasha-foot"><nav><a href="/">$dasha</a></nav></footer>',
  );
  const out = stripLobbyLeftoverDashaFootNavCss(keep);
  assert.match(out, /footer\.dasha-foot nav\{/, "keeps footer.dasha-foot nav CSS when footer still has <nav>");
}

{
  const chess = `<!doctype html><html><head><style>footer.dasha-foot nav{display:flex}</style></head><body>
<div id="chess-stage" class="app"><div class="gate"></div></div>
<footer class="dasha-foot wrap"><p><a class="buy-dasha" href="https://jup.ag/swap">Buy</a></p></footer>
</body></html>`;
  const out = stripLobbyLeftoverDashaFootNavCss(chess);
  assert.match(out, /footer\.dasha-foot nav\{/, "chess keeps leftover footer.dasha-foot nav CSS");
}

assert.match(lobbyDisk, /footer\.dasha-foot nav\{/, "disk source still has leftover footer.dasha-foot nav CSS (polish drops it; did not run static-gen)");
assert.match(LOBBY_PAGE_HTML, /footer\.dasha-foot nav\{/, "bundled still has leftover footer.dasha-foot nav CSS");
assert.doesNotMatch(chessDisk, /footer\.dasha-foot nav\{/, "prior chess leftover footer.dasha-foot nav CSS stays dropped on disk");

function assertNoFootNavCss(html, label) {
  assert.doesNotMatch(html, /footer\.dasha-foot nav\s*\{/, `${label} no leftover footer.dasha-foot nav CSS`);
  assert.match(html, /footer\.dasha-foot\{/, `${label} footer.dasha-foot CSS`);
  assert.match(html, /footer\.dasha-foot a\{/, `${label} footer.dasha-foot a CSS`);
  assert.match(html, /class=["']forum-play["']/, `${label} class=forum-play`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} #forum-play-go`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} #dasha-forum`);
  assert.match(html, /class=["']dasha-lobby["']|\.dasha-lobby\{/, `${label} .dasha-lobby`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoFootNavCss(stripLobbyLeftoverDashaFootNavCss(LIVE), "strip leftover fixture");
assertNoFootNavCss(rewriteLobbyForumChrome(LIVE), "rewrite leftover fixture");
assertNoFootNavCss(asStandaloneLobbyPage(LIVE), "standalone leftover fixture");
assertNoFootNavCss(asStandaloneLobbyPage(lobbyDisk), "standalone disk");
assertNoFootNavCss(asStandaloneLobbyPage(LOBBY_PAGE_HTML), "standalone bundled");
assert.match(asStandaloneLobbyPage(lobbyDisk), /class=["']forum-play["']/, "standalone disk class=forum-play");

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get("x-dasha-edge"), "lobby-page");
  const html = await lobby.text();
  assertNoFootNavCss(html, "served lobby");
  assert.match(html, /<footer class="dasha-foot">/, "served footer.dasha-foot");
  assert.doesNotMatch(afterStyleScript(html), /<nav\b/i, "served lobby footer has no <nav>");
  assert.match(html, /class=["']buy-dasha["']/, "served .buy-dasha stays");
  assert.doesNotMatch(html, /\.forum-form/, "served leftover .forum-form CSS stays dropped");
  assert.match(html, /\.lobby-form\{/, "served .lobby-form CSS stays");
  assert.doesNotMatch(html, /\.forum-body/, "served leftover mixed .forum-body CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-status/, "served leftover mixed .forum-status CSS stays dropped");
  assert.match(html, /\.lobby-body/, "served .lobby-body CSS stays");
  assert.match(html, /\.lobby-status/, "served .lobby-status CSS stays");
  assert.doesNotMatch(html, /class=["'][^"']*\blobby-text\b/, "prior leftover class=lobby-text stays dropped");
  assert.doesNotMatch(html, /\bid=["']forum-play["']/, "prior leftover id=forum-play stays dropped");
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
  assert.doesNotMatch(html, /footer\.dasha-foot nav\s*\{/, "chess leftover footer.dasha-foot nav CSS is a separate strip");
  assert.match(html, /class=["']buy-dasha["']/, "chess .buy-dasha stays");
  assert.match(html, /id=["']buy-dasha["']/, "chess #buy-dasha stays");
  assert.match(html, /jup\.ag/, "jup.ag stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  const html = await howto.text();
  assert.doesNotMatch(html, /nav a\.btn\s*\{/, "prior leftover howto nav a.btn CSS stays dropped");
  assert.match(html, />Buy on Jupiter/, "Buy on Jupiter stays");
  assert.match(html, /id=["']ca["']/, "#ca stays");
  assert.match(html, /id=["']copy["']/, "id=copy stays");
}

{
  const privacy = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, "privacy product skip-link stays");
}

{
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /id=["']bb-x["']/, "bounties quiet Connect X stays");
  assert.match(html, /id=["']bb-app["']/, "#bb-app empty inventory stays");
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
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

console.log("dasha-lobby-dasha-foot-nav-css-leftover: PASS (lobby leftover footer.dasha-foot nav CSS gone; footer.dasha-foot + Play stay)");
