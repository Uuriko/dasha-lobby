#!/usr/bin/env node
/**
 * Leftover after leftover CSS lecture sparkline comments were already stripped.
 * Live / 200 still serializes leftover `#spark-line{stroke-dasharray:1;animation:dasha-draw .9s ease-out both}`
 * after #spark-line was never in the live home DOM (Watch chrome-hide #spark; price/spark SVG
 * already DOM-stripped). Humans see leftover #spark-line animation CSS in view-source. Never paints.
 * Distinct leftover vs leftover CSS lecture comments / leftover .dasha h3.
 * Keep #spark-fill (separate leftover). Keep @keyframes dasha-draw. Keep Watch #spark hide.
 * Keep .price/.ticker remount belt. Disk static-gen still emits leftover (polish drops it).
 * No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripHomeLeftoverSparkLineCss,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const staticGen = readFileSync(join(root, "dasha-lobby-static-gen.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover home dropped-selector CSS after sparkline lecture comments were already stripped"),
);
assert.match(workerSrc, /export function stripHomeLeftoverSparkLineCss/);
assert.match(workerSrc, /out = stripHomeLeftoverSparkLineCss\(out\);/);
assert.match(
  staticGen,
  /#spark-line\{stroke-dasharray:1;animation:dasha-draw \.9s ease-out both\}/,
  "disk static-gen still emits leftover #spark-line CSS (polish drops it)",
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

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<link href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/css/johns-awesome-project-39b1b5.webflow.shared.4e493bbf3.min.css" rel="stylesheet">
<style id="dasha-mobile-scroll">html{overflow-x:clip}body,.dasha,.dasha-root,main,#dasha-home,#top{overflow:visible}html,body,.dasha,.dasha-root,main{touch-action:pan-y}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
<style>@view-transition{navigation:auto}
@keyframes dasha-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes dasha-rise{from{transform:translateY(18px)}to{transform:none}}
#spark-line{stroke-dasharray:1;animation:dasha-draw .9s ease-out both}
#spark-fill{animation:dasha-rise .6s ease-out both}
.price{margin:22px 0 0}.ticker{position:relative}
#dasha-home h1, #dasha-home h2 { color: var(--ink, #F2EDE7); }
.dasha h1,.dasha h2{color:var(--paper)!important}
</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><header class="dasha-hero"><h1>It’s time<br><span class="stroke">$dasha.</span></h1></header><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="grwm"><div class="grwm-phone"></div></section><section id="grok-door"></section></main></div>
</body></html>`;

assert.match(LIVE, /#spark-line\{stroke-dasharray:1;animation:dasha-draw \.9s ease-out both\}/, "fixture leftover #spark-line CSS paints");
assert.doesNotMatch(afterStyleScript(LIVE), /\bid=["']spark-line["']/, "fixture home DOM has no #spark-line");
assert.match(LIVE, /#spark-fill\{/, "fixture #spark-fill stays (separate leftover)");
assert.match(LIVE, /@keyframes dasha-draw/, "fixture @keyframes dasha-draw stays");

const gone = stripHomeLeftoverSparkLineCss(LIVE);
assert.doesNotMatch(gone, /#spark-line\s*\{/, "drops leftover #spark-line CSS");
assert.match(gone, /#spark-fill\{animation:dasha-rise/, "#spark-fill stays (separate leftover)");
assert.match(gone, /@keyframes dasha-draw/, "@keyframes dasha-draw stays");
assert.match(gone, /#dasha-home h1/, "repair #dasha-home h1 stays");
assert.match(gone, /\.price\{/, "Watch price CSS stays");
assert.match(gone, /\.ticker\{/, "Watch ticker CSS stays");
assert.match(gone, /#spark\{display:none!important\}/, "Watch #spark hide stays");
assert.match(gone, /@view-transition/, "product @view-transition stays");
assert.match(gone, /johns-awesome/, "johns-awesome CSS stays");
assert.match(gone, /id=["']dasha-mobile-scroll["']/, "mobile-scroll stays");
assert.match(gone, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.match(gone, /id=["']simp-door["']/, "simp-door stays");
assert.match(gone, /id=["']grok-door["']/, "grok-door stays");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.doesNotMatch(gone, /id=["']compute-door["']/, "no compute-door");
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-token, not eat-the-page");

{
  const keep = LIVE.replace("</header>", '<svg id="spark"><path id="spark-line"></path></svg></header>');
  const out = stripHomeLeftoverSparkLineCss(keep);
  assert.match(out, /#spark-line\{stroke-dasharray:1;animation:dasha-draw \.9s ease-out both\}/, "keeps #spark-line CSS when home still has #spark-line");
}

{
  const lobby = stripHomeLeftoverSparkLineCss(`<!doctype html><html><head><style>#spark-line{stroke-dasharray:1}</style></head>
<body><div id="dasha-lobby" class="dasha-lobby"></div><button id="forum-play-go"></button></body></html>`);
  assert.match(lobby, /#spark-line\{/, "lobby does not eat leftover home #spark-line CSS");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /#spark-line\s*\{/, "served home drops leftover #spark-line CSS");
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']spark-line["']/, "served home DOM has no #spark-line");
  assert.doesNotMatch(html, /#spark-fill\s*\{/, "follow-on leftover #spark-fill CSS dropped");
  assert.doesNotMatch(html, /@keyframes dasha-draw/, "follow-on leftover @keyframes dasha-draw dropped");
  assert.doesNotMatch(html, /\.dasha h3/, "prior leftover .dasha h3 CSS stays dropped");
  assert.match(html, /#dasha-home h1/, "served repair #dasha-home h1 stays");
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "served mobile-scroll stays");
  assert.match(html, /#grwm \.grwm-phone/, "served GRWM phone CSS stays");
  assert.match(html, /id=["']dasha-home["']/, "served #dasha-home stays");
  assert.match(html, /johns-awesome/, "served johns-awesome stays");
  assert.match(html, /data:image\/svg\+xml/, "served cherries SVG stays");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /id=["']grwm["']/, "GRWM stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /id=["']dasha-digest-remount["']/, "home remount stays");
  assert.match(html, /\/digest\.json/, "home remount still fetches /digest.json");
  assert.match(html, /faucet\.js/, "faucet.js stays");
  assert.match(html, /x-connect\.js/, "x-connect.js stays");
  assert.match(html, /@view-transition/, "product @view-transition stays");
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
  assert.match(html, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
  assert.match(html, /#spark\{display:none!important\}/, "Watch #spark hide stays");
  assert.match(html, /DashaHomeMint/, "mint COPY helper stays");
  assert.match(html, /class=["']copy["']/, "contract .copy stays");
  assert.match(html, /id=["']mint["']/, "mint stays");
  assert.match(html, /id=["']dasha-home-lede["']/, "#dasha-home-lede stays");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.match(html, /id=["']forum-play-go["']/, "#forum-play-go stays");
  assert.match(html, /id=["']dasha-forum["']/, "#dasha-forum stays");
  assert.match(html, /class=["']lobby-form["']/, ".lobby-form stays");
  assert.match(html, /t\.me\/\+xB7S8mIQaKFiZjRh/, "footer Telegram stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /class=["']buy-dasha["']/, "chess .buy-dasha stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /id=["']bb-x["']/, "#bb-x stays");
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
}

{
  const compute = await edgeWorker.fetch(new Request("https://www.getdasha.com/compute"), {});
  assert.equal(compute.status, 200);
  const html = await compute.text();
  assert.match(html, /hostedLive=status\?\.live===true|hostedLive=status\.live===true/, "hosted live flag stays honest");
  // Start-gate page contract (#172 lock; empty-select contract tests pin this):
  // selects mount empty until Start, old filled/checking/staged UI retired.
  assert.match(html, /id=["']model["']/, "#model mount stays");
  assert.doesNotMatch(html, /id=["']model["']><option/, "#model starts empty (Start gate)");
  assert.doesNotMatch(html, /id=["']chip["']><option/, "#chip starts empty (Start gate)");
  assert.doesNotMatch(html, /id=["']ram["']><option/, "#ram starts empty (Start gate)");
  assert.doesNotMatch(html, /id=["']night-model["']><option/, "#night-model starts empty (Start gate)");
  assert.match(html, /Checking…/, "Checking… stays");
  assert.doesNotMatch(html, /Checking login…/, "Checking login… retired with the Start gate");
  assert.doesNotMatch(html, /id=["']gateway-state["']>checking</, "gateway-state checking retired");
  assert.doesNotMatch(html, /id=["']provider-count["']>checking</, "provider-count checking retired");
  assert.doesNotMatch(html, /id=["']top-state["']>checking hosted demo</, "top-state checking retired");
  assert.doesNotMatch(html, /id=["']staged["']/, "#staged retired with the Start gate");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const faucet = await edgeWorker.fetch(new Request("https://www.getdasha.com/faucet"), {});
  assert.equal(faucet.status, 200);
  const html = await faucet.text();
  assert.match(html, /faucet\.js/, "faucet.js stays");
}

{
  const studio = await edgeWorker.fetch(new Request("https://www.getdasha.com/studio"), {});
  assert.equal(studio.status, 308);
  assert.equal(studio.headers.get("location"), "https://www.getdasha.com/");
}

console.log("dasha-home-spark-line-css-leftover: PASS (home leftover #spark-line CSS gone; #spark-fill + Watch #spark hide stay)");
