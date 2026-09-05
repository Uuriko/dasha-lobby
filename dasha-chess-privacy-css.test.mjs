#!/usr/bin/env node
/**
 * Leftover after CSS/JS strip on /chess.
 * Live /chess 200 still serializes leftover `.privacy` CSS after that class was
 * never in the chess DOM (JS never mounts it). Humans see it in view-source.
 * Distinct leftover vs leftover home #dasha-mobile-scroll on /chess.
 * Keep .empty + .identity. Buy sheet + jup.ag + chess-local stay.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverPrivacyCss,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover /chess dropped-selector CSS after .privacy was never in the chess DOM"));
assert.match(workerSrc, /export function stripChessLeftoverPrivacyCss/);
assert.match(workerSrc, /out = stripChessLeftoverPrivacyCss\(out\);/);
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

const LIVE = `<!doctype html><html lang="en"><head>
<title>Dasha Chess</title>
<style>
.empty{color:var(--muted);margin:0}.privacy{font-size:12px;color:var(--muted);margin:0}.identity{font-weight:900;color:var(--acid)}
#buy-sheet{position:fixed}
</style>
</head><body>
<header class="dasha-slim"><a class="dasha-word" href="https://www.getdasha.com/">$dasha</a><a class="buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy $dasha ↗</a></header>
<div id="chess-stage"></div>
<p class="empty">No rated games yet</p>
<p class="identity">@dash_eats</p>
<script src="/client/chess-local.js"></script>
<div id="buy-sheet" hidden><div class="buy-chips" id="buy-chips"></div><div id="buy-sheet-fallback"><code id="buy-mint">${MINT}</code><a class="btn" id="buy-open" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Jupiter</a></div></div>
</body></html>`;

assert.match(LIVE, /\.privacy\{/, "fixture leftover .privacy CSS paints");
assert.doesNotMatch(LIVE, /class=["'][^"']*\bprivacy\b/, "fixture .privacy never in DOM");
assert.match(LIVE, /class=["']empty["']/, "fixture .empty stays in DOM");
assert.match(LIVE, /class=["']identity["']/, "fixture .identity stays in DOM");

const gone = stripChessLeftoverPrivacyCss(LIVE);
assert.doesNotMatch(gone, /\.privacy/, "drops leftover .privacy CSS");
assert.match(gone, /\.empty\{/, ".empty CSS stays");
assert.match(gone, /\.identity\{/, ".identity CSS stays");
assert.match(gone, /id=["']chess-stage["']/, "chess-stage stays");
assert.match(gone, /id=["']buy-sheet["']/, "buy sheet stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, /src="\/client\/chess-local\.js"/, "chess-local stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-rule, not eat-the-page");

const polished = polishServedSlim(LIVE);
assert.doesNotMatch(polished, /\.privacy/, "polish drops leftover .privacy CSS");
assert.match(polished, /\.empty\{/, "polish keeps .empty");
assert.match(polished, /\.identity\{/, "polish keeps .identity");
assert.match(polished, /id=["']buy-sheet["']/, "buy sheet stays after polish");
assert.match(polished, /src="\/client\/chess-local\.js"/, "chess-local stays after polish");

assert.match(chessDisk, /\.privacy\{/, "disk source still has leftover .privacy CSS (polish drops it; did not run static-gen)");
assert.match(CHESS_PAGE_HTML, /\.privacy\{/, "bundled still has leftover .privacy CSS");

const HOME = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
<script>(()=>{const CA='${MINT}';window.DashaHomeMint={CA}})()</script>
</body></html>`;

assert.equal(stripChessLeftoverPrivacyCss(HOME), HOME, "home is not a chess leftover .privacy page");

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get("x-dasha-edge"), "chess");
  const html = await chess.text();
  assert.doesNotMatch(html, /\.privacy/, "served chess drops leftover .privacy CSS");
  assert.doesNotMatch(html, /class=["'][^"']*\bprivacy\b/, "served chess has no privacy class");
  assert.match(html, /\.empty\{/, "served .empty CSS stays");
  assert.match(html, /\.identity\{/, "served .identity CSS stays");
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "prior leftover chess mobile-scroll stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-jup["']/, "prior leftover empty jup mount stays dropped");
  assert.doesNotMatch(html, /bootJup/, "prior leftover bootJup stays dropped");
  assert.match(html, /id=["']chess-stage["']/, "chess-stage stays");
  assert.match(html, /id=["']buy-sheet["']/, "buy sheet stays");
  assert.match(html, /jup\.ag/, "jup.ag stays");
  assert.match(html, new RegExp(MINT), "mint stays");
  assert.match(html, /chess-local\.js/, "chess-local stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "chess no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.doesNotMatch(html, /\.forum-meta/, "prior leftover .forum-meta CSS stays dropped");
  assert.match(html, /\.lobby-meta/, "lobby .lobby-meta stays");
  assert.match(html, /id=["']forum-play-go["']/, "Play stays");
  assert.match(html, /id=["']dasha-forum["']/, "threads mount stays");
  assert.match(html, /id=["']dasha-chess["']/, "in-room chess stays");
  assert.match(html, /\.lobby-log/, "lobby .lobby-log stays");
  assert.match(html, /\.forum-threads/, ".forum-threads stays");
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
  assert.match(html, /@view-transition/, "@view-transition stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
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

console.log("dasha-chess-privacy-css: PASS (chess .privacy CSS gone; .empty + .identity + buy sheet stay)");
