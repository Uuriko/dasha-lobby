#!/usr/bin/env node
/**
 * Leftover after home digest remount.
 * Live /lobby 200 still serializes #dasha-digest-remount after remount boot
 * is home-only (`if(path!=='/'&&path!=='')return`). Humans see it in view-source.
 * Home remount + /digest.json stay. #dasha-forum / #forum-play-go / #dasha-chess stay.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, { applyDigestTape } from "./dasha-lobby-worker.mjs";
import {
  digestRemountScript,
  injectDigestRemount,
  stripLobbyLeftoverDigestRemount,
} from "./dasha-digest.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const digestSrc = readFileSync(join(root, "dasha-digest.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.doesNotMatch(digestSrc, /plugin\.jup\.ag/, "digest must not mention plugin.jup.ag");
assert.ok(digestSrc.includes("Leftover remount on /lobby after boot is home-only"));
assert.ok(workerSrc.includes("Leftover remount on /lobby after boot is home-only"));
assert.match(digestSrc, /export function stripLobbyLeftoverDigestRemount/);
assert.match(digestSrc, /export function injectDigestRemount/);
assert.match(workerSrc, /injectDigestRemount\(out\)/);
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

const remount = digestRemountScript();
assert.match(remount, /if\(path!=='\/'&&path!==''\)return/, "remount boot is still home-only");
assert.match(remount, /\/digest\.json/, "remount still fetches /digest.json");
assert.match(remount, /#grok-door/, "remount still anchors on #grok-door");
assert.match(remount, /getElementById\('grwm'\)/, "remount still anchors on #grwm");
assert.match(remount, /querySelector\('main'\)/, "remount still falls back to main");
assert.doesNotMatch(remount, /querySelector\(['"]footer['"]\)/, "prior leftover remount footer stays dropped");
assert.doesNotMatch(remount, /window\.Webflow/, "prior leftover Webflow.push stays dropped");
assert.doesNotMatch(remount, /plugin\.jup\.ag/);

const LOBBY = `<!doctype html><html lang="en"><head>
<title>$dasha Lobby</title>
<style id="dasha-mobile-scroll">html{overflow-x:clip}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
</head><body>
<div id="dasha-lobby">
<h1>Lobby</h1>
<section class="forum-play"><button type="button" id="forum-play-go">Play</button><div id="dasha-chess" hidden></div></section>
<div id="dasha-forum"><p class="forum-empty">None yet.</p></div>
<section id="dasha-digest"><h2>Tape.</h2><ol></ol></section>
</div>
</body></html>`;

assert.equal(injectDigestRemount(LOBBY), LOBBY, "inject skips leftover lobby remount");
assert.doesNotMatch(injectDigestRemount(LOBBY), /id=["']dasha-digest-remount["']/, "lobby inject does not add remount");

const painted = `${LOBBY.replace("</head>", `<script id="dasha-digest-remount">${remount}</script></head>`)}`;
assert.match(painted, /id=["']dasha-digest-remount["']/, "fixture leftover remount paints");
const gone = stripLobbyLeftoverDigestRemount(painted);
assert.doesNotMatch(gone, /id=["']dasha-digest-remount["']/, "drops leftover lobby remount");
assert.match(gone, /id=["']forum-play-go["']/, "Play stays");
assert.match(gone, /id=["']dasha-forum["']/, "threads mount stays");
assert.match(gone, /id=["']dasha-chess["']/, "in-room chess stays");
assert.match(gone, /id=["']dasha-digest["']/, "lobby tape section stays");
assert.match(gone, /id=["']dasha-mobile-scroll["']/, "mobile-scroll stays");
assert.match(gone, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > 400, "remount drop is per-script, not eat-the-page");

const HOME = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
<script>(()=>{const CA='${MINT}';window.DashaHomeMint={CA}})()</script>
</body></html>`;

const homeInjected = injectDigestRemount(HOME);
assert.match(homeInjected, /id=["']dasha-digest-remount["']/, "home remount still injects");
assert.match(homeInjected, /\/digest\.json/, "home remount still fetches /digest.json");
assert.match(homeInjected, /DashaHomeMint/, "mint COPY helper stays");
assert.match(homeInjected, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(homeInjected, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");

{
  const taped = applyDigestTape(LOBBY, [{ source: "Dexscreener", title: "$dasha $0.0001", href: "https://dexscreener.com/solana/x" }]);
  assert.doesNotMatch(taped, /id=["']dasha-digest-remount["']/, "applyDigestTape does not remount lobby");
  assert.match(taped, /id=["']dasha-digest["']/, "lobby tape stays");
  assert.match(taped, /id=["']forum-play-go["']/, "Play stays after tape");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.doesNotMatch(html, /id=["']dasha-digest-remount["']/, "served lobby drops leftover remount");
  assert.doesNotMatch(html, /querySelector\(['"]footer['"]\)/, "served lobby has no leftover footer remount");
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
  assert.match(html, /id=["']dasha-digest-remount["']/, "served home remount stays");
  assert.match(html, /\/digest\.json/, "served remount still fetches /digest.json");
  assert.match(html, /#grok-door/, "served remount still anchors grok-door");
  assert.match(html, /getElementById\('grwm'\)/, "served remount still anchors grwm");
  assert.match(html, /querySelector\('main'\)/, "served remount still falls back to main");
  assert.doesNotMatch(html, /querySelector\(['"]footer['"]\)/, "prior leftover remount footer stays dropped");
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

console.log("dasha-lobby-digest-remount-leftover: PASS (lobby remount gone; home remount + Play/forum/chess stay)");
