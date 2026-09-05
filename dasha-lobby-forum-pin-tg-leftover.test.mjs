#!/usr/bin/env node
/**
 * Leftover after quiet-pin lock (no mint/Buy/Chess/TG dump in the pin).
 * Live /lobby 200 still serializes leftover <a>TG</a> inside .forum-pin after
 * footer already keeps official Telegram. Humans see leftover pin TG in view-source.
 * Distinct leftover vs leftover id="forum-play" / leftover .forum-back / leftover .forum-form.
 * Keep .forum-pin + .forum-ca + #forum-copy. Keep footer Telegram
 * https://t.me/+xB7S8mIQaKFiZjRh only. Do not ban all t.me.
 * Disk still emits leftover (rewrite drops it). No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  asStandaloneLobbyPage,
  rewriteLobbyForumChrome,
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
  workerSrc.includes("Leftover /lobby TG dump inside .forum-pin after quiet-pin lock"),
);
assert.match(workerSrc, /export function stripLobbyLeftoverForumPinTg/);
assert.match(workerSrc, /out = stripLobbyLeftoverForumPinTg\(out\);/);
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

function pinInner(html) {
  const m = afterStyleScript(html).match(
    /<p\b[^>]*\bclass=["'][^"']*\bforum-pin\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
  );
  return m ? m[1] : "";
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha Lobby</title>
<style>
.forum-pin{position:static;margin:0 0 2.2rem}.forum-pin a,.forum-copy{color:var(--acid)}
.forum-copy{appearance:none;border:0;background:none}.forum-ca{letter-spacing:.02em}
.forum-play{margin:4.5rem 0 0}.forum-send,.lobby-send{min-height:48px}
.dasha-lobby{display:flex;flex-direction:column;gap:1rem}.lobby-log{flex:1 1 auto;min-height:8rem}
#dasha-chess{margin-top:1.2rem}
footer.dasha-foot{padding:1.25rem 0}
</style>
</head><body>
<header class="dasha-slim shell"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy $dasha</a></header>
<h1>Lobby</h1>
<p class="forum-sub">Chat in the lobby.</p>
<p class="forum-pin"><span class="forum-ca" title="${MINT}">53ux…pump</span> <button type="button" class="forum-copy" id="forum-copy">Copy</button> <a href="${TG}" target="_blank" rel="noopener noreferrer">TG</a></p>
<div id="dasha-lobby"></div>
<section class="forum-play" aria-label="Play">
<h2>Play</h2>
<button type="button" class="forum-send" id="forum-play-go">Play</button>
<div id="dasha-chess" hidden></div>
</section>
<section class="forum-threads"><h2>Threads</h2><div id="dasha-forum"><p class="forum-empty">None yet.</p></div></section>
<footer class="dasha-foot"><p><a href="https://www.getdasha.com/">$dasha</a> · <a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy</a> · <a href="https://www.getdasha.com/bag">Bag</a> · <a href="${TG}" target="_blank" rel="noopener noreferrer">Telegram</a></p></footer>
</body></html>`;

assert.match(pinInner(LIVE), />TG</, "fixture leftover pin TG paints after style/script strip");
assert.match(afterStyleScript(LIVE), /class=["']forum-pin["']/, "fixture .forum-pin stays");
assert.match(afterStyleScript(LIVE), />Telegram</, "fixture footer Telegram stays");

const gone = stripLobbyLeftoverForumPinTg(LIVE);
assert.doesNotMatch(pinInner(gone), />TG</, "drops leftover pin TG");
assert.doesNotMatch(pinInner(gone), /t\.me\/\+xB7S8mIQaKFiZjRh/, "drops leftover pin t.me");
assert.match(gone, /class=["']forum-pin["']/, ".forum-pin stays");
assert.match(gone, /class=["']forum-ca["']/, ".forum-ca stays");
assert.match(gone, /id=["']forum-copy["']/, "#forum-copy stays");
assert.match(gone, />Copy</, "Copy button stays");
assert.match(afterStyleScript(gone), />Telegram</, "footer Telegram stays");
assert.match(gone, new RegExp(TG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "official TG URL stays (footer)");
assert.match(gone, /id=["']forum-play-go["']/, "#forum-play-go stays");
assert.match(gone, /id=["']dasha-forum["']/, "threads mount stays");
assert.match(gone, /id=["']dasha-lobby["']/, "#dasha-lobby stays");
assert.match(gone, /class=["']buy-dasha["']/, ".buy-dasha stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "pin TG drop is per-anchor, not eat-the-page");

{
  const other = stripLobbyLeftoverForumPinTg(
    `<!doctype html><html><head></head><body><p class="forum-pin"><a href="${TG}">TG</a></p><footer><a href="${TG}">Telegram</a></footer></body></html>`,
  );
  assert.match(other, />TG</, "non-lobby pages keep leftover pin TG");
}

{
  const home = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2></section><section id="grwm"><div class="grwm-phone"></div></section></main></div>
<p class="forum-pin"><a href="${TG}">TG</a></p>
</body></html>`;
  assert.equal(stripLobbyLeftoverForumPinTg(home), home, "home is not a lobby leftover pin-TG page");
}

const rewritten = rewriteLobbyForumChrome(LIVE);
assert.doesNotMatch(pinInner(rewritten), />TG</, "rewrite drops leftover pin TG");
assert.match(afterStyleScript(rewritten), />Telegram</, "rewrite keeps footer Telegram");
assert.match(rewritten, /id=["']forum-copy["']/, "rewrite #forum-copy stays");

assert.match(pinInner(lobbyDisk), />TG</, "disk source still has leftover pin TG (rewrite drops it)");
assert.match(pinInner(LOBBY_PAGE_HTML), />TG</, "bundled still has leftover pin TG");
assert.match(afterStyleScript(lobbyDisk), />Telegram</, "disk footer Telegram stays");

function assertQuietPin(html, label) {
  assert.doesNotMatch(pinInner(html), />TG</, `${label} no leftover pin TG after style/script strip`);
  assert.doesNotMatch(pinInner(html), /t\.me\/\+xB7S8mIQaKFiZjRh/, `${label} no leftover pin t.me`);
  assert.match(html, /class=["']forum-pin["']/, `${label} .forum-pin stays`);
  assert.match(html, /id=["']forum-copy["']/, `${label} #forum-copy stays`);
  assert.match(html, /class=["']forum-ca["']/, `${label} .forum-ca stays`);
  assert.match(afterStyleScript(html), />Telegram</, `${label} footer Telegram stays`);
  assert.match(html, new RegExp(TG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} official TG URL stays`);
  assert.match(html, /id=["']forum-play-go["']/, `${label} Play`);
  assert.match(html, /class=["']forum-play["']/, `${label} class=forum-play stays`);
  assert.match(html, /id=["']dasha-forum["']/, `${label} threads mount`);
  assert.match(html, /id=["']dasha-lobby["']/, `${label} #dasha-lobby`);
  assert.match(html, /id=["']dasha-chess["']/, `${label} in-room chess`);
  assert.match(html, /\.dasha-lobby/, `${label} .dasha-lobby stays`);
  assert.match(html, /<h1>Lobby<\/h1>/, `${label} Lobby H1`);
  assert.match(html, /class=["']buy-dasha["']/, `${label} .buy-dasha stays`);
  assert.match(html, /jup\.ag/, `${label} jup.ag stays`);
  assert.match(html, new RegExp(MINT), `${label} mint stays`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertQuietPin(asStandaloneLobbyPage(LIVE), "standalone leftover fixture");
assertQuietPin(asStandaloneLobbyPage(lobbyDisk), "standalone disk");
assertQuietPin(asStandaloneLobbyPage(LOBBY_PAGE_HTML), "standalone bundled");

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  assert.equal(lobby.headers.get("x-dasha-edge"), "lobby-page");
  const html = await lobby.text();
  assertQuietPin(html, "served lobby");
  assert.doesNotMatch(html, /\bid=["']forum-play["']/, "prior leftover id=forum-play stays dropped");
  assert.doesNotMatch(html, /\.forum-back\{/, "prior leftover .forum-back CSS stays dropped");
  assert.doesNotMatch(html, /\.dasha-quiet\{/, "prior leftover .dasha-quiet CSS stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "prior leftover lobby mobile-scroll stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-digest-remount["']/, "prior leftover lobby remount stays dropped");
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.match(html, /getElementById\('forum-copy'\)/, "served pin Copy script stays");
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
  assert.match(html, />Buy on Jupiter/, "Buy on Jupiter stays");
  assert.match(html, /id=["']ca["']/, "#ca stays");
  assert.match(html, /id=["']copy["']/, "id=copy stays");
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

console.log("dasha-lobby-forum-pin-tg-leftover: PASS (lobby pin TG dump gone; footer Telegram + #forum-copy stay)");
