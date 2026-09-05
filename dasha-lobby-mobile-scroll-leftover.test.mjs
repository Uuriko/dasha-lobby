#!/usr/bin/env node
/**
 * Leftover after home mobile-scroll.
 * Live /lobby 200 still serializes #dasha-mobile-scroll after polishServedSlim
 * always injected HOME GRWM CSS. Humans see #grwm / #dasha-home in view-source.
 * Home mobile-scroll + GRWM stay. #dasha-forum / #forum-play-go / #dasha-chess stay.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripLobbyLeftoverHomeMobileScroll,
  unlockHomeMobileScroll,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover home #dasha-mobile-scroll on /lobby after polishServedSlim"));
assert.match(workerSrc, /export function stripLobbyLeftoverHomeMobileScroll/);
assert.match(workerSrc, /export function isLobbyLeftoverHomeMobileScrollPage/);
assert.match(workerSrc, /out = stripLobbyLeftoverHomeMobileScroll\(out\);/);
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

const LOBBY = `<!doctype html><html lang="en"><head>
<title>$dasha Lobby</title>
<style id="dasha-mobile-scroll">html{overflow-x:clip}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
</head><body>
<div id="dasha-lobby">
<h1>Lobby</h1>
<section class="forum-play"><button type="button" id="forum-play-go">Play</button><div id="dasha-chess" hidden></div></section>
<div id="dasha-forum"><p class="forum-empty">None yet.</p></div>
<div class="lobby-log"></div>
<section id="dasha-digest"><h2>Tape.</h2><ol></ol></section>
</div>
</body></html>`;

assert.match(LOBBY, /id=["']dasha-mobile-scroll["']/, "fixture leftover mobile-scroll paints");
const gone = stripLobbyLeftoverHomeMobileScroll(LOBBY);
assert.doesNotMatch(gone, /id=["']dasha-mobile-scroll["']/, "drops leftover lobby mobile-scroll");
assert.doesNotMatch(gone, /#grwm/, "drops leftover GRWM CSS from lobby");
assert.match(gone, /id=["']forum-play-go["']/, "Play stays");
assert.match(gone, /id=["']dasha-forum["']/, "threads mount stays");
assert.match(gone, /id=["']dasha-chess["']/, "in-room chess stays");
assert.match(gone, /id=["']dasha-digest["']/, "lobby tape section stays");
assert.match(gone, /lobby-log/, "lobby .lobby-log stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > 400, "mobile-scroll drop is per-style, not eat-the-page");

const polished = polishServedSlim(LOBBY.replace(/<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>/i, ""));
assert.doesNotMatch(polished, /id=["']dasha-mobile-scroll["']/, "polish does not inject leftover lobby mobile-scroll");
assert.doesNotMatch(polished, /#grwm \.grwm-phone/, "polish does not paint leftover GRWM CSS on lobby");
assert.match(polished, /id=["']forum-play-go["']/, "Play stays after polish");
assert.match(polished, /lobby-log/, "lobby .lobby-log stays after polish");

const HOME = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
<script>(()=>{const CA='${MINT}';window.DashaHomeMint={CA}})()</script>
</body></html>`;

assert.equal(
  stripLobbyLeftoverHomeMobileScroll(HOME),
  HOME,
  "home is not a lobby leftover mobile-scroll page",
);
const unlocked = unlockHomeMobileScroll(HOME);
assert.match(unlocked, /id=["']dasha-mobile-scroll["']/, "home mobile-scroll still injects");
assert.match(unlocked, /#grwm \.grwm-phone/, "home GRWM phone CSS stays");
assert.match(unlocked, /DashaHomeMint/, "mint COPY helper stays");
assert.match(unlocked, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(unlocked, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "served lobby drops leftover mobile-scroll");
  assert.doesNotMatch(html, /#grwm \.grwm-phone/, "served lobby has no leftover GRWM CSS");
  assert.doesNotMatch(html, /id=["']dasha-digest-remount["']/, "prior leftover lobby remount stays dropped");
  assert.match(html, /id=["']dasha-chess["']/, "lobby #dasha-chess stays");
  assert.match(html, /lobby-log/, "lobby .lobby-log stays");
  assert.match(html, /id=["']forum-play-go["']/, "Play stays");
  assert.match(html, /id=["']dasha-forum["']/, "threads mount stays");
  assert.match(html, /id=["']dasha-digest["']/, "lobby tape section stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "lobby no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "served home mobile-scroll stays");
  assert.match(html, /#grwm \.grwm-phone/, "served GRWM phone CSS stays");
  assert.match(html, /id=["']dasha-digest-remount["']/, "served remount stays");
  assert.match(html, /\/digest\.json/, "served remount still fetches /digest.json");
  assert.match(html, /DashaHomeMint/, "served mint COPY helper stays");
  assert.match(html, /function mintCopiedOk/, "served mintCopiedOk stays");
  assert.match(html, /class=["']copy["']/, "served contract .copy stays");
  assert.match(html, /id=["']mint["']/, "served mint stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /id=["']dasha-home["']/, "dasha-home stays");
  assert.match(html, /id=["']grwm["']/, "served GRWM stays");
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
  assert.match(html, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
  assert.match(html, /#spark\{display:none!important\}/, "Watch #spark hide stays");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /@view-transition/, "@view-transition stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class=["']skip-link["']/, "privacy skip-link stays");
  assert.match(html, /href=["']#dasha-page["']/, "privacy skip target stays #dasha-page");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/login"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Sign in with Grok Bot|Grok Bot|siwg/i, "/login SIWG stays");
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

console.log("dasha-lobby-mobile-scroll-leftover: PASS (lobby home mobile-scroll gone; home GRWM + Play/forum/chess stay)");
