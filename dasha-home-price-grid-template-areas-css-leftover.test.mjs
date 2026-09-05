#!/usr/bin/env node
/**
 * Leftover after leftover @media(max-width:600px) .price spark/note grid was already stripped.
 * Live / 200 still serializes leftover parent grid-template-areas:"main spark" "note note"
 * after live home DOM has no class="price"/#price (no spark, no price-note after style/script strip).
 * Named areas have no occupants and no .price box, so the parent grid-template-areas never paints.
 * Distinct leftover vs leftover @media spark/note grid / leftover .price-note CSS / leftover .spark CSS.
 * Keep .price{ remount belt. Keep Watch chrome-hide .price-note selector.
 * Keep .price-chg.up/.price-chg.down. Keep @keyframes dasha-rise (still used by .dasha section,.contract).
 * Keep Watch #spark hide. Keep .ticker remount belt.
 * Disk static-gen still emits leftover (polish drops it).
 * No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripHomeLeftoverPriceGridTemplateAreasCss,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const staticGen = readFileSync(join(root, "dasha-lobby-static-gen.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover home unused parent .price grid-template-areas after leftover @media spark/note grid was already stripped"),
);
assert.match(workerSrc, /export function stripHomeLeftoverPriceGridTemplateAreasCss/);
assert.match(workerSrc, /out = stripHomeLeftoverPriceGridTemplateAreasCss\(out\);/);
assert.match(
  staticGen,
  /grid-template-areas:"main spark" "note note"/,
  "disk static-gen still emits leftover parent .price grid-template-areas (polish drops it)",
);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /#grwm \.grwm-phone/,
  "mobile-scroll still unlocks GRWM phone",
);
assert.match(
  (workerSrc.match(/const style = '<style id="dasha-home-chrome-hide">[\s\S]*?<\/style>';/) || [""])[0],
  /\.price,#price,\.ticker.*\.price-note.*#spark\{display:none!important\}/,
  "Watch belt selector list stays including .price-note hide",
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
.dasha section,.contract{animation:dasha-rise linear both;animation-timeline:view();animation-range:entry 10% cover 28%}
#spark-fill{animation:dasha-rise .6s ease-out both}
.price{margin:22px 0 0;max-width:520px;display:grid;grid-template-columns:auto 1fr;grid-template-areas:"main spark" "note note";gap:6px 16px;align-items:center;padding:14px 16px;border:1px solid var(--line);background:rgba(255,255,255,.04)}.price[hidden]{display:none}.price-main{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important}.price-now{font-size:clamp(20px,3vw,26px);font-weight:950;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.price-chg{font-size:14px;font-weight:900;font-variant-numeric:tabular-nums}.price-chg.up{color:var(--acid)}.price-chg.down{color:#ff9db8}.spark{grid-area:spark;width:100%;height:44px;display:block}.price-note{grid-area:note;margin:0;font-size:14px;color:rgba(244,237,219,.82);line-height:1.45}@media(max-width:600px){.price{grid-template-columns:1fr;grid-template-areas:"main" "spark" "note"}}
.ticker{position:relative}
#dasha-home h1, #dasha-home h2 { color: var(--ink, #F2EDE7); }
.dasha h1,.dasha h2{color:var(--paper)!important}
</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><header class="dasha-hero"><h1>It’s time<br><span class="stroke">$dasha.</span></h1></header><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="grwm"><div class="grwm-phone"></div></section><section id="grok-door"></section></main></div>
</body></html>`;

assert.match(LIVE, /grid-template-areas:"main spark" "note note"/, "fixture leftover parent .price grid-template-areas paints");
assert.doesNotMatch(afterStyleScript(LIVE), /\bclass=["'][^"']*\bprice\b/, "fixture home DOM has no class price");
assert.doesNotMatch(afterStyleScript(LIVE), /\bid=["']price["']/, "fixture home DOM has no id price");
assert.doesNotMatch(afterStyleScript(LIVE), /\bclass=["'][^"']*\bspark\b/, "fixture home DOM has no class spark");
assert.doesNotMatch(afterStyleScript(LIVE), /\bid=["']spark["']/, "fixture home DOM has no id spark");
assert.doesNotMatch(afterStyleScript(LIVE), /\bclass=["'][^"']*\bprice-note\b/, "fixture home DOM has no class price-note");
assert.doesNotMatch(afterStyleScript(LIVE), /\bid=["']price-note["']/, "fixture home DOM has no id price-note");
assert.match(LIVE, /@keyframes dasha-draw/, "fixture @keyframes dasha-draw stays (separate leftover)");
assert.match(LIVE, /@keyframes dasha-rise/, "fixture @keyframes dasha-rise stays");
assert.match(LIVE, /\.dasha section,\.contract\{animation:dasha-rise/, "fixture section rise stays");

const gone = stripHomeLeftoverPriceGridTemplateAreasCss(LIVE);
assert.doesNotMatch(gone, /grid-template-areas:"main spark" "note note"/, "drops leftover parent .price grid-template-areas");
assert.match(gone, /\.price\{margin:22px 0 0;max-width:520px;display:grid;grid-template-columns:auto 1fr;gap:6px 16px/, ".price remount belt stays without named areas");
assert.match(gone, /@media\(max-width:600px\)\{\.price\{grid-template-columns:1fr;grid-template-areas:"main" "spark" "note"\}\}/, "fixture media query stays until its own strip");
assert.match(gone, /\.price-note,#price-now,#price-chg,#price-note,#spark\{display:none!important\}/, "Watch chrome-hide .price-note stays");
assert.match(gone, /\.price-chg\.up\{color:var\(--acid\)\}/, ".price-chg.up stays");
assert.match(gone, /\.price-chg\.down\{color:#ff9db8\}/, ".price-chg.down stays");
assert.match(gone, /\.spark\{grid-area:spark;width:100%;height:44px;display:block\}/, "fixture .spark CSS token stays until its own strip");
assert.match(gone, /\.price-note\{grid-area:note;margin:0;font-size:14px;color:rgba\(244,237,219,\.82\);line-height:1\.45\}/, "fixture .price-note CSS token stays until its own strip");
assert.match(gone, /@keyframes dasha-draw/, "@keyframes dasha-draw stays (separate leftover)");
assert.match(gone, /@keyframes dasha-rise/, "@keyframes dasha-rise stays (section animation)");
assert.match(gone, /#spark-fill\{animation:dasha-rise \.6s ease-out both\}/, "fixture #spark-fill CSS token stays until its own strip");
assert.match(gone, /\.dasha section,\.contract\{animation:dasha-rise/, "section rise stays");
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
  const keep = LIVE.replace("</header>", '<div class="price" id="price"></div></header>');
  const out = stripHomeLeftoverPriceGridTemplateAreasCss(keep);
  assert.match(out, /grid-template-areas:"main spark" "note note"/, "keeps parent grid-template-areas when home still has class price");
}

{
  const lobby = stripHomeLeftoverPriceGridTemplateAreasCss(`<!doctype html><html><head><style>.price{grid-template-areas:"main spark" "note note"}</style></head>
<body><div id="dasha-lobby" class="dasha-lobby"></div><button id="forum-play-go"></button></body></html>`);
  assert.match(lobby, /grid-template-areas:"main spark" "note note"/, "lobby does not eat leftover home parent .price grid-template-areas");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /grid-template-areas:"main spark" "note note"/, "served home drops leftover parent .price grid-template-areas");
  assert.doesNotMatch(html, /@media\(max-width:600px\)\{\.price\{grid-template-columns:1fr;grid-template-areas:"main" "spark" "note"\}\}/, "prior leftover .price spark/note media query stays dropped");
  assert.doesNotMatch(afterStyleScript(html), /\bclass=["'][^"']*\bprice\b/, "served home DOM has no class price");
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']price["']/, "served home DOM has no id price");
  assert.doesNotMatch(afterStyleScript(html), /\bclass=["'][^"']*\bspark\b/, "served home DOM has no class spark");
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']spark["']/, "served home DOM has no id spark");
  assert.doesNotMatch(afterStyleScript(html), /\bclass=["'][^"']*\bprice-note\b/, "served home DOM has no class price-note");
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']price-note["']/, "served home DOM has no id price-note");
  assert.match(html, /\.price-note,#price-now,#price-chg,#price-note,#spark\{display:none!important\}/, "served Watch chrome-hide .price-note stays");
  assert.match(html, /\.price-chg\.up\{/, "served .price-chg.up stays");
  assert.match(html, /\.price-chg\.down\{/, "served .price-chg.down stays");
  assert.doesNotMatch(html, /\.spark\{grid-area:spark/, "prior leftover .spark CSS stays dropped");
  assert.doesNotMatch(html, /\.price-note\{grid-area:note/, "prior leftover .price-note layout CSS stays dropped");
  assert.doesNotMatch(html, /@keyframes dasha-draw/, "prior leftover @keyframes dasha-draw stays dropped");
  assert.doesNotMatch(html, /#spark-fill\s*\{/, "prior leftover #spark-fill CSS stays dropped");
  assert.doesNotMatch(html, /#spark-line\s*\{/, "prior leftover #spark-line CSS stays dropped");
  assert.match(html, /@keyframes dasha-rise/, "served @keyframes dasha-rise stays");
  assert.match(html, /animation:dasha-rise linear both/, "served section rise stays");
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
  assert.match(html, /\.price,#price,\.ticker/, "served Watch chrome-hide .price/.ticker stays");
  assert.match(html, /\.ticker\{/, "served .ticker remount belt stays");
  assert.match(html, /DashaHomeMint/, "mint COPY helper stays");
  assert.match(html, /class=["']copy["']/, "contract .copy stays");
  assert.match(html, /id=["']mint["']/, "mint stays");
  assert.match(html, /id=["']dasha-home-lede["']/, "#dasha-home-lede stays");
  assert.match(html, /53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/, "mint stays");
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
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  const html = await howto.text();
  assert.match(html, /How to buy/i, "how-to-buy stays 200");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const missing = await edgeWorker.fetch(new Request("https://www.getdasha.com/howto"), {});
  assert.equal(missing.status, 308, "/howto folds to /how-to-buy (dasha-howto-pretty-path pins the alias family)");
  assert.equal(missing.headers.get("location"), "https://www.getdasha.com/how-to-buy");
}

{
  const privacy = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, "privacy product skip-link stays");
}

{
  const contribute = await edgeWorker.fetch(new Request("https://www.getdasha.com/contribute"), {});
  assert.equal(contribute.status, 200);
  const html = await contribute.text();
  assert.match(html, /<h1>Build Dasha\.<\/h1>/, "contribute h1 stays");
}

{
  const simp = await edgeWorker.fetch(new Request("https://www.getdasha.com/simp"), {});
  assert.equal(simp.status, 200);
  const html = await simp.text();
  assert.match(html, /simp/i, "simp stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const studio = await edgeWorker.fetch(new Request("https://www.getdasha.com/studio"), {});
  assert.equal(studio.status, 308);
  assert.equal(studio.headers.get("location"), "https://www.getdasha.com/");
}

console.log("dasha-home-price-grid-template-areas-css-leftover: PASS (home leftover parent .price grid-template-areas gone; .price remount belt + Watch hide .price-note + dasha-rise + Watch #spark hide + .ticker stay)");
