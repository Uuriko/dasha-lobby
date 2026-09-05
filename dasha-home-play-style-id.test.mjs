#!/usr/bin/env node
/**
 * Leftover after home never had Play.
 * Live / 200 still serializes leftover style id="dasha-home-play" wrapping faucet CSS
 * after Play was never on home. Humans see it in view-source.
 * Faucet CSS + HOME_FAUCET_MOUNT stay. GRWM stays. Watch price/ticker remount belt stays.
 * Distinct leftover vs #dasha-chess iframe CSS.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, { stripHomePlayStyleId } from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover home style id="dasha-home-play" after Play was never on home'));
assert.match(workerSrc, /export function stripHomePlayStyleId/);
assert.match(
  workerSrc,
  /const HOME_FAUCET_STYLE = '<style id="dasha-home-faucet-css">/,
  "HOME_FAUCET_STYLE no leftover dasha-home-play id",
);
assert.doesNotMatch(
  (workerSrc.match(/const HOME_FAUCET_STYLE = '<style id="[^"]+">[\s\S]*?<\/style>';/) || [""])[0],
  /dasha-home-play/,
  "HOME_FAUCET_STYLE id is not leftover play",
);
assert.match(
  (workerSrc.match(/const HOME_FAUCET_STYLE = '<style id="[^"]+">[\s\S]*?<\/style>';/) || [""])[0],
  /#dasha-home-faucet/,
  "faucet CSS stays",
);
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

const LIVE = `<!doctype html><html lang="en" id="dasha-home"><head>
<title>$dasha</title>
<style id="dasha-mobile-scroll">html{overflow-x:clip}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
<style id="dasha-home-play">#dasha-home-faucet,#dasha-faucet{width:min(36rem,calc(100% - 32px));margin:28px auto 64px}#dasha-home-lede{width:min(40rem,calc(100% - 32px));margin:18px auto 8px}.dasha-bag-line{margin:.6rem 0 0}</style>
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="dasha-home-faucet"><div id="dasha-faucet"></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main>
</body></html>`;

assert.match(LIVE, /id=["']dasha-home-play["']/, "fixture leftover dasha-home-play style id paints");
assert.match(LIVE, /#dasha-home-faucet/, "fixture faucet CSS paints");
assert.doesNotMatch(LIVE, /id=["']dasha-chess["']/, "fixture home never had #dasha-chess");
assert.match(LIVE, /id=["']grwm["']/, "fixture GRWM stays in DOM");
assert.match(LIVE, /class=["']pill primary["']/, "fixture simp-door pill stays");

const gone = stripHomePlayStyleId(LIVE);
assert.doesNotMatch(gone, /id=["']dasha-home-play["']/, "drops leftover dasha-home-play style id");
assert.match(gone, /id=["']dasha-home-faucet-css["']/, "faucet style id stays product");
assert.match(gone, /#dasha-home-faucet/, "faucet CSS stays");
assert.match(gone, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
assert.match(gone, /id=["']dasha-mobile-scroll["']/, "mobile-scroll stays");
assert.match(gone, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.match(gone, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(gone, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
assert.match(gone, /#spark\{display:none!important\}/, "Watch #spark hide stays");
assert.match(gone, /class=["']pill primary["']/, "simp-door pill stays");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.ok(gone.length > LIVE.length * 0.7, "id rename is per-style, not eat-the-page");

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /id=["']dasha-home-play["']/, "served home drops leftover dasha-home-play");
  assert.match(html, /id=["']dasha-home-faucet-css["']/, "served faucet CSS id stays");
  assert.match(html, /#dasha-home-faucet/, "served faucet CSS stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
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
  assert.match(html, /@view-transition/, "@view-transition stays");
  assert.match(html, /johns-awesome/, "johns-awesome stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
  assert.doesNotMatch(html, /id=["']dasha-chess["']/, "no leftover #dasha-chess");
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
  assert.doesNotMatch(html, /id=["']dasha-home-play["']/, "lobby does not pick up leftover play style id");
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
  assert.match(html, /function jup\(/, "chess jup() stays");
  assert.match(html, /jup\.ag/, "chess jup.ag stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(html, /bootJup/);
  assert.doesNotMatch(html, /id=["']dasha-home-play["']/, "chess does not lecture leftover play style id");
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

console.log("dasha-home-play-style-id: PASS (home leftover dasha-home-play gone; faucet CSS + GRWM + Watch belt stay)");
