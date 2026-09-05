#!/usr/bin/env node
/**
 * Leftover after home never had in-room chess.
 * Live / 200 still serializes leftover `#dasha-chess iframe` CSS in `#dasha-mobile-scroll`
 * after the home DOM never had id="dasha-chess". Humans see it in view-source.
 * GRWM stays. Watch price/ticker remount belt stays. Lobby #dasha-chess stays.
 * Distinct leftover vs .lobby-log dropped-selector CSS.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, { unlockHomeMobileScroll } from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover home dropped-selector CSS after #dasha-chess was never in the home DOM"));
assert.match(workerSrc, /export function unlockHomeMobileScroll/);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /#grwm \.grwm-phone/,
  "mobile-scroll still unlocks GRWM phone",
);
assert.doesNotMatch(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /#dasha-chess/,
  "HOME_MOBILE_SCROLL no leftover #dasha-chess CSS",
);
assert.doesNotMatch(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /\.lobby-log/,
  "HOME_MOBILE_SCROLL still DRY of leftover .lobby-log CSS",
);
assert.match(
  (workerSrc.match(/const style = '<style id="dasha-home-chrome-hide">[\s\S]*?<\/style>';/) || [""])[0],
  /\.price,#price,\.ticker.*#spark\{display:none!important\}/,
  "Watch belt selector list stays",
);

const LIVE = `<!doctype html><html lang="en" id="dasha-home"><head>
<title>$dasha</title>
<style id="dasha-mobile-scroll">html{overflow-x:clip}#grwm video,#grwm .grwm-go,#dasha-chess iframe{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main>
</body></html>`;

assert.match(LIVE, /#dasha-chess iframe\{/, "fixture leftover #dasha-chess iframe CSS paints in live #dasha-mobile-scroll");
assert.doesNotMatch(LIVE, /id=["']dasha-chess["']/, "fixture home never had #dasha-chess");
assert.match(LIVE, /id=["']grwm["']/, "fixture GRWM stays in DOM");
assert.match(LIVE, /class=["']pill primary["']/, "fixture simp-door pill stays");

const gone = unlockHomeMobileScroll(LIVE);
const mobile = (gone.match(/<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>/i) || [""])[0];
assert.doesNotMatch(mobile, /#dasha-chess/, "drops leftover #dasha-chess iframe CSS");
assert.doesNotMatch(gone, /id=["']dasha-chess["']/, "no leftover #dasha-chess id");
assert.match(mobile, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.match(mobile, /#grwm video/, "GRWM video CSS stays");
assert.match(mobile, /#grwm \.grwm-go/, "GRWM go CSS stays");
assert.match(mobile, /id=["']dasha-mobile-scroll["']/, "mobile-scroll stays");
assert.match(gone, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(gone, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
assert.match(gone, /#spark\{display:none!important\}/, "Watch #spark hide stays");
assert.match(gone, /class=["']pill primary["']/, "simp-door pill stays");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-rule, not eat-the-page");

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  const servedMobile = (html.match(/<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>/i) || [""])[0];
  assert.doesNotMatch(servedMobile, /#dasha-chess/, "served home drops leftover #dasha-chess iframe CSS");
  assert.doesNotMatch(html, /id=["']dasha-chess["']/, "served home has no #dasha-chess");
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "served mobile-scroll stays");
  assert.match(html, /#grwm \.grwm-phone/, "served GRWM phone CSS stays");
  assert.match(html, /id=["']grwm["']/, "served GRWM stays");
  assert.match(html, /\$dasha/);
  assert.match(html, /Chat/);
  assert.match(html, /Buy/);
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
  assert.match(html, /johns-awesome/, "johns-awesome stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /id=["']dasha-chess["']/, "lobby #dasha-chess stays");
  assert.match(html, /#dasha-chess iframe\{/, "lobby product #dasha-chess iframe CSS stays");
  assert.match(html, /lobby-log/, "lobby .lobby-log stays");
  assert.match(html, /id=["']forum-play-go["']/, "Play stays");
  assert.match(html, /id=["']dasha-forum["']/, "forum mount stays");
  assert.match(html, /class=["']forum-play["']/, ".forum-play stays");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/contribute"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class=["']cta["']/, "contribute .cta stays");
  assert.match(html, /\.cta\{/, "contribute .cta CSS stays");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class=["']skip-link["']/, "privacy skip-link stays");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class=["']skip-link["']/, "bounties skip-link stays");
  assert.match(html, /id=["']bb-app["']/, "bb-app stays");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/login"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Verify holder perks/, "/login hidden perks stay");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/which"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /VVAIFU/, "/which VVAIFU stays");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/compute"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Mac Studio/, "Mac Studio stays");
  assert.match(html, /Use\. Provide\. Night\. Build\. Sponsor\./, "compute OG stays");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  const chessMobile = (html.match(/<style\b[^>]*id=["']dasha-mobile-scroll["'][^>]*>[\s\S]*?<\/style>/i) || [""])[0];
  assert.doesNotMatch(chessMobile, /#dasha-chess/, "chess page mobile-scroll does not lecture leftover #dasha-chess");
  assert.match(html, /function jup\(/, "chess jup() stays");
  assert.match(html, /jup\.ag/, "chess jup.ag stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(html, /bootJup/);
}

{
  const nf = await edgeWorker.fetch(new Request("https://www.getdasha.com/not-this-page"), {});
  assert.equal(nf.status, 404);
  const html = await nf.text();
  assert.match(html, /class=["']skip-link["']/, "404 skip-link stays");
  assert.match(html, /<h1>Not this page\.<\/h1>/, "404 H1 stays");
  assert.doesNotMatch(html, /\.cta\s*\{/, "404 leftover .cta CSS stays dropped");
}

{
  const forum = await edgeWorker.fetch(new Request("https://www.getdasha.com/forum"), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get("location"), "https://www.getdasha.com/lobby");
}

console.log("dasha-home-chess-iframe-css: PASS (home leftover #dasha-chess iframe CSS gone; GRWM + Watch belt + lobby #dasha-chess stay)");
