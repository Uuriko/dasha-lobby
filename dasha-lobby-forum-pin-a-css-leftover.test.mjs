#!/usr/bin/env node
/**
 * Leftover after leftover /lobby pin TG dump DOM-strip.
 * Live /lobby 200 still serializes leftover mixed `.forum-pin a` CSS after
 * quiet-pin has no <a> (mint chip + Copy only). Humans see leftover
 * .forum-pin a,.forum-copy in view-source. Distinct leftover vs leftover pin TG dump.
 * Keep .forum-copy + .forum-pin + .forum-ca + #forum-copy. Keep footer Telegram
 * https://t.me/+xB7S8mIQaKFiZjRh. Do not restore pin TG dump.
 * Disk still emits leftover (rewrite drops it). No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
  stripLobbyLeftoverForumPinACss,
  stripLobbyLeftoverForumPinTg,
} from "./dasha-lobby-worker.mjs";
import { LOBBY_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const lobbyDisk = readFileSync(join(root, "dasha-lobby-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";
const TG = "https://t.me/+xB7S8mIQaKFiZjRh";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover /lobby dropped-selector CSS after leftover pin TG dump was already DOM-stripped"),
);
assert.match(workerSrc, /export function stripLobbyLeftoverForumPinACss/);
assert.match(workerSrc, /out = stripLobbyLeftoverForumPinACss\(out\);/);
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
.forum-pin{position:static;margin:0 0 2.2rem}
.forum-pin a,.forum-copy{color:var(--acid);font:inherit}
.forum-copy{appearance:none;border:0;background:none;min-height:48px}
.forum-ca{letter-spacing:.02em}
.forum-play{margin:4.5rem 0 0}
.dasha-lobby{display:flex;flex-direction:column;gap:1rem}
.lobby-form{display:grid}
.lobby-body{overflow-wrap:anywhere}
.lobby-status{min-height:1.2em}
footer.dasha-foot{padding:1.25rem 0}
</style>
</head><body>
<h1>Lobby</h1>
<p class="forum-pin"><span class="forum-ca" title="${MINT}">53ux…pump</span> <button type="button" class="forum-copy" id="forum-copy">Copy</button></p>
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
<footer class="dasha-foot"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a> · <a href="${TG}" target="_blank" rel="noopener noreferrer">Telegram</a></p></footer>
</body></html>`;

assert.match(LIVE, /\.forum-pin a,\.forum-copy\{/, "fixture leftover mixed .forum-pin a CSS paints");
{
  const pin = afterStyleScript(LIVE).match(/<p class="forum-pin">[\s\S]*?<\/p>/);
  assert.ok(pin, "fixture pin present");
  assert.doesNotMatch(pin[0], /<a\b/, "fixture pin has no leftover <a>");
}
assert.match(LIVE, /class=["']forum-copy["']/, "fixture .forum-copy stays in DOM");
assert.match(LIVE, /id=["']forum-copy["']/, "fixture #forum-copy stays");
assert.match(LIVE, new RegExp(TG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "fixture footer Telegram stays");

const gone = stripLobbyLeftoverForumPinACss(LIVE);
assert.doesNotMatch(gone, /\.forum-pin a/, "drops leftover .forum-pin a CSS");
assert.match(gone, /\.forum-copy\{color:var\(--acid\);font:inherit\}/, ".forum-copy color CSS stays");
assert.match(gone, /\.forum-copy\{appearance:none/, ".forum-copy button CSS stays");
assert.match(gone, /class=["']forum-pin["']/, ".forum-pin class stays");
assert.match(gone, /class=["']forum-ca["']/, ".forum-ca stays");
assert.match(gone, /id=["']forum-copy["']/, "#forum-copy stays");
assert.match(gone, /class=["']forum-play["']/, "class=forum-play stays");
assert.match(gone, /id=["']forum-play-go["']/, "#forum-play-go stays");
assert.match(gone, /id=["']dasha-forum["']/, "#dasha-forum stays");
assert.match(gone, /\.dasha-lobby\{/, ".dasha-lobby stays");
assert.match(gone, /class=["']lobby-form["']/, ".lobby-form stays");
assert.match(gone, /\.lobby-body\{/, ".lobby-body stays");
assert.match(gone, /\.lobby-status\{/, ".lobby-status stays");
assert.match(gone, new RegExp(TG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "footer Telegram stays");
{
  const pin = afterStyleScript(gone).match(/<p class="forum-pin">[\s\S]*?<\/p>/);
  assert.ok(pin, "gone pin present");
  assert.doesNotMatch(pin[0], /<a\b/, "does not restore pin TG dump");
}
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-prefix, not eat-the-page");

{
  const keep = LIVE.replace(
    "</button></p>",
    `</button> <a href="${TG}" target="_blank" rel="noopener noreferrer">TG</a></p>`,
  );
  const out = stripLobbyLeftoverForumPinACss(keep);
  assert.match(out, /\.forum-pin a,\.forum-copy\{/, "keeps mixed .forum-pin a CSS when pin still has <a>");
}

{
  const home = `<!doctype html><html><head><style>.forum-pin a,.forum-copy{color:var(--acid)}</style></head>
<body><div id="dasha-home"></div><div id="chat-door"></div><div id="grwm"></div></body></html>`;
  const out = stripLobbyLeftoverForumPinACss(home);
  assert.match(out, /\.forum-pin a,\.forum-copy/, "home does not eat leftover lobby .forum-pin a CSS");
}

assert.match(lobbyDisk, /\.forum-pin a,\.forum-copy\{/, "disk source still has leftover .forum-pin a CSS (rewrite drops it; did not run static-gen)");
assert.match(LOBBY_PAGE_HTML, /\.forum-pin a,\.forum-copy\{/, "bundled still has leftover .forum-pin a CSS");
assert.match(lobbyDisk, /<p class="forum-pin">[\s\S]*?>TG<\/a>/, "disk still emits leftover pin TG dump (rewrite drops it)");

{
  const raw = stripLobbyLeftoverForumPinACss(lobbyDisk);
  assert.match(raw, /\.forum-pin a,\.forum-copy\{/, "strip alone keeps CSS while disk pin still has leftover <a>");
}

function assertNoForumPinACss(html, label) {
  assert.doesNotMatch(html, /\.forum-pin a/, `${label} no leftover .forum-pin a CSS`);
  assert.match(html, /\.forum-copy\{/, `${label} .forum-copy CSS`);
  assert.match(html, /class=["']forum-pin["']/, `${label} class=forum-pin`);
  assert.match(html, /id=["']forum-copy["']/, `${label} #forum-copy`);
  assert.match(html, /class=["']forum-play["']/, `${label} class=forum-play`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} #forum-play-go`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} #dasha-forum`);
  assert.match(html, /\.dasha-lobby/, `${label} .dasha-lobby`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.match(html, new RegExp(TG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} footer Telegram`);
  {
    const pin = afterStyleScript(html).match(/<p class="forum-pin">[\s\S]*?<\/p>/);
    assert.ok(pin, `${label} pin present`);
    assert.doesNotMatch(pin[0], /<a\b/, `${label} pin TG dump stays dropped`);
  }
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoForumPinACss(stripLobbyLeftoverForumPinACss(LIVE), "strip leftover fixture");
assertNoForumPinACss(rewriteLobbyForumChrome(LIVE), "rewrite leftover fixture");
assertNoForumPinACss(asStandaloneLobbyPage(LIVE), "standalone leftover fixture");
assertNoForumPinACss(asStandaloneLobbyPage(lobbyDisk), "standalone disk");
assertNoForumPinACss(asStandaloneLobbyPage(LOBBY_PAGE_HTML), "standalone bundled");
assert.match(asStandaloneLobbyPage(lobbyDisk), new RegExp(MINT), "standalone disk mint");
assert.match(asStandaloneLobbyPage(lobbyDisk), /Telegram/, "standalone disk footer Telegram copy");
{
  const pin = afterStyleScript(asStandaloneLobbyPage(lobbyDisk)).match(/<p class="forum-pin">[\s\S]*?<\/p>/);
  assert.ok(pin, "standalone disk pin present");
  assert.doesNotMatch(pin[0], />TG</, "standalone disk does not restore pin TG dump");
  assert.doesNotMatch(pin[0], /<a\b/, "standalone disk pin has no <a>");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get("x-dasha-edge"), "lobby-page");
  const html = await lobby.text();
  assertNoForumPinACss(html, "served lobby");
  assert.match(html, new RegExp(MINT), "served lobby mint");
  assert.match(html, /class=["']lobby-form["']/, "served .lobby-form");
  assert.match(html, /\.lobby-body\{/, "served .lobby-body CSS stays");
  assert.match(html, /\.lobby-status\{/, "served .lobby-status CSS stays");
  assert.doesNotMatch(html, /\.forum-form/, "prior leftover .forum-form CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-body/, "prior leftover .forum-body CSS stays dropped");
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
  assert.match(html, /\.dasha h1,\.dasha h2/, "home .dasha h1,.dasha h2 stays");
  assert.match(html, /#dasha-home h1/, "repair #dasha-home h1 stays");
  assert.match(html, /\.dasha a,\.dasha strong/, "home mixed .dasha a,.dasha strong stays (separate leftover)");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /class=["']buy-dasha["']/, "chess .buy-dasha stays");
  assert.match(html, /id=["']buy-dasha["']/, "chess #buy-dasha stays");
  assert.match(html, /function tournamentAction\(action,name\)/, "chess tournamentAction(action,name) stays");
  assert.match(html, /tournamentAction\('create'/, "chess tournamentAction create stays");
  assert.doesNotMatch(html, /\bshareTournament\b/, "shareTournament stays dropped");
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
  assert.match(html, /class=["']cta["']/, "contribute .cta stays");
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

void stripLobbyLeftoverForumPinTg;
