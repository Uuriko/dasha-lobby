#!/usr/bin/env node
/**
 * Leftover after leftover .price[hidden] was already stripped.
 * Live / 200 still serializes leftover `.price-main{grid-area:main;display:inline-flex;...}`
 * after live home DOM has no class="price-main" (style/script stripped). Never paints.
 * Distinct leftover vs leftover .price[hidden] / leftover parent .price display:grid layout / Watch chrome-hide .price-main hide list.
 * Keep Watch chrome-hide .price-main (different string). Keep .price-now / .price-chg type / .price-chg.up/.price-chg.down.
 * Keep @keyframes dasha-rise (still used by .dasha section,.contract).
 * Keep Watch #spark hide. Keep .ticker remount belt.
 * Disk static-gen still emits leftover (polish drops it).
 * No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripHomeLeftoverPriceMainCss,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const staticGen = readFileSync(join(root, "dasha-lobby-static-gen.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover home unused .price-main layout after leftover .price[hidden] was already stripped"),
);
assert.match(workerSrc, /export function stripHomeLeftoverPriceMainCss/);
assert.match(workerSrc, /out = stripHomeLeftoverPriceMainCss\(out\);/);
assert.match(
  staticGen,
  /\.price-main\{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important\}/,
  "disk static-gen still emits leftover .price-main layout (polish drops it)",
);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /#grwm \.grwm-phone/,
  "mobile-scroll still unlocks GRWM phone",
);
assert.match(
  (workerSrc.match(/const style = '<style id="dasha-home-chrome-hide">[\s\S]*?<\/style>';/) || [""])[0],
  /\.price,#price,\.ticker.*\.price-note.*#spark\{display:none!important\}/,
  "Watch belt selector list stays including .price-main hide (different string from layout block)",
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
@keyframes dasha-rise{from{transform:translateY(18px)}to{transform:none}}
.dasha section,.contract{animation:dasha-rise linear both;animation-timeline:view();animation-range:entry 10% cover 28%}
.price-main{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important}.price-now{font-size:clamp(20px,3vw,26px);font-weight:950;letter-spacing:-.02em;font-variant-numeric:tabular-nums}.price-chg{font-size:14px;font-weight:900;font-variant-numeric:tabular-nums}.price-chg.up{color:var(--acid)}.price-chg.down{color:#ff9db8}
.ticker{position:relative}
#dasha-home h1, #dasha-home h2 { color: var(--ink, #F2EDE7); }
.dasha h1,.dasha h2{color:var(--paper)!important}
</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><header class="dasha-hero"><h1>It’s time<br><span class="stroke">$dasha.</span></h1></header><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="grwm"><div class="grwm-phone"></div></section><section id="grok-door"></section></main></div>
</body></html>`;

assert.match(LIVE, /\.price-main\{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important\}/, "fixture leftover .price-main paints");
assert.doesNotMatch(LIVE, /\.price\{margin:22px 0 0;max-width:520px;display:grid;grid-template-columns:auto 1fr;gap:6px 16px/, "fixture already dropped leftover parent display:grid layout");
assert.doesNotMatch(LIVE, /grid-template-areas:"main spark" "note note"/, "fixture already dropped leftover named areas");
assert.doesNotMatch(afterStyleScript(LIVE), /\bclass=["'][^"']*\bprice-main\b/, "fixture home DOM has no class price-main");
assert.doesNotMatch(afterStyleScript(LIVE), /\bclass=["'][^"']*\bprice\b/, "fixture home DOM has no class price");
assert.doesNotMatch(afterStyleScript(LIVE), /\bid=["']price["']/, "fixture home DOM has no id price");
assert.doesNotMatch(afterStyleScript(LIVE), /\bclass=["'][^"']*\bspark\b/, "fixture home DOM has no class spark");
assert.doesNotMatch(afterStyleScript(LIVE), /\bid=["']spark["']/, "fixture home DOM has no id spark");
assert.doesNotMatch(afterStyleScript(LIVE), /\bclass=["'][^"']*\bprice-note\b/, "fixture home DOM has no class price-note");
assert.doesNotMatch(afterStyleScript(LIVE), /\bid=["']price-note["']/, "fixture home DOM has no id price-note");
assert.match(LIVE, /@keyframes dasha-rise/, "fixture @keyframes dasha-rise stays");
assert.match(LIVE, /\.dasha section,\.contract\{animation:dasha-rise/, "fixture section rise stays");

const gone = stripHomeLeftoverPriceMainCss(LIVE);
assert.doesNotMatch(gone, /\.price-main\{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important\}/, "drops leftover .price-main layout");
assert.match(gone, /\.price,#price,\.ticker/, "Watch chrome-hide .price stays");
assert.match(gone, /\.price-main,\.price-now,\.price-chg/, "Watch chrome-hide .price-main stays");
assert.match(gone, /\.price-note,#price-now,#price-chg,#price-note,#spark\{display:none!important\}/, "Watch chrome-hide .price-note stays");
assert.match(gone, /\.price-chg\.up\{color:var\(--acid\)\}/, ".price-chg.up stays");
assert.match(gone, /\.price-chg\.down\{color:#ff9db8\}/, ".price-chg.down stays");
assert.doesNotMatch(gone, /\.price-main\{grid-area:main/, "drops leftover .price-main layout");
assert.match(gone, /\.price-now\{font-size:clamp/, "fixture .price-now stays until its own strip");
assert.match(gone, /\.price-chg\{font-size:14px/, "fixture .price-chg type stays until its own strip");
assert.match(gone, /@keyframes dasha-rise/, "@keyframes dasha-rise stays (section animation)");
assert.match(gone, /\.dasha section,\.contract\{animation:dasha-rise/, "section rise stays");
assert.match(gone, /#dasha-home h1/, "repair #dasha-home h1 stays");
assert.match(gone, /\.ticker\{/, ".ticker remount belt stays");
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
  const keep = LIVE.replace("</header>", '<a class="price-main" href="#"></a></header>');
  const out = stripHomeLeftoverPriceMainCss(keep);
  assert.match(out, /\.price-main\{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important\}/, "keeps .price-main when home still has class price-main");
}

{
  const lobby = stripHomeLeftoverPriceMainCss(`<!doctype html><html><head><style>.price-main{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important}</style></head>
<body><div id="dasha-lobby" class="dasha-lobby"></div><button id="forum-play-go"></button></body></html>`);
  assert.match(lobby, /\.price-main\{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important\}/, "lobby does not eat leftover home .price-main");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /\.price-main\{grid-area:main;display:inline-flex;align-items:baseline;gap:10px;min-height:44px;text-decoration:none!important\}/, "served home drops leftover .price-main layout");
  assert.doesNotMatch(html, /\.price\[hidden\]\{display:none\}/, "prior leftover .price[hidden] stays dropped");
  assert.doesNotMatch(html, /\.price\{margin:22px 0 0;max-width:520px;display:grid;grid-template-columns:auto 1fr;gap:6px 16px/, "prior leftover parent .price display:grid layout stays dropped");
  assert.doesNotMatch(html, /grid-template-areas:"main spark" "note note"/, "prior leftover parent .price grid-template-areas stays dropped");
  assert.doesNotMatch(html, /@media\(max-width:600px\)\{\.price\{grid-template-columns:1fr;grid-template-areas:"main" "spark" "note"\}\}/, "prior leftover .price spark/note media query stays dropped");
  assert.doesNotMatch(afterStyleScript(html), /\bclass=["'][^"']*\bprice-main\b/, "served home DOM has no class price-main");
  assert.doesNotMatch(afterStyleScript(html), /\bclass=["'][^"']*\bprice\b/, "served home DOM has no class price");
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']price["']/, "served home DOM has no id price");
  assert.doesNotMatch(afterStyleScript(html), /\bclass=["'][^"']*\bspark\b/, "served home DOM has no class spark");
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']spark["']/, "served home DOM has no id spark");
  assert.doesNotMatch(afterStyleScript(html), /\bclass=["'][^"']*\bprice-note\b/, "served home DOM has no class price-note");
  assert.doesNotMatch(afterStyleScript(html), /\bid=["']price-note["']/, "served home DOM has no id price-note");
  assert.match(html, /\.price-note,#price-now,#price-chg,#price-note,#spark\{display:none!important\}/, "served Watch chrome-hide .price-note stays");
  assert.match(html, /\.price,#price,\.ticker/, "served Watch chrome-hide .price/.ticker stays");
  assert.match(html, /\.price-main,\.price-now,\.price-chg/, "served Watch chrome-hide .price-main stays");
  assert.doesNotMatch(html, /\.price-now\{font-size:clamp\(20px,3vw,26px\);font-weight:950;letter-spacing:-.02em;font-variant-numeric:tabular-nums\}/, "later leftover .price-now type may already be stripped");
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
  assert.match(html, /#spark\{display:none!important\}/, "Watch #spark hide stays");
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
  assert.match(html, /hostedLive=status\.live===true/, "hosted live flag stays honest");
  assert.match(html, /id=["']model["']><option value=["']qwen3-8b["']>/, "filled #model stays");
  assert.match(html, /id=["']chip["']><option/, "filled #chip stays");
  assert.match(html, /id=["']ram["']><option/, "filled #ram stays");
  assert.match(html, /id=["']night-model["']><option/, "filled #night-model stays");
  assert.match(html, /Checking…/, "Checking… stays");
  assert.match(html, /Checking login…/, "Checking login… stays");
  assert.match(html, /id=["']gateway-state["']>checking</, "gateway-state checking stays");
  assert.match(html, /id=["']provider-count["']>checking</, "provider-count checking stays");
  assert.match(html, /id=["']top-state["']>checking hosted demo</, "top-state checking hosted demo stays");
  assert.match(html, /id=["']staged["'][^>]*hidden/, "hidden #staged stays");
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
  assert.equal(missing.status, 404, "/howto 404 is expected");
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

void MINT;
console.log("dasha-home-price-main-css-leftover: PASS (home leftover .price-main gone; Watch hide .price-main + dasha-rise + Watch #spark hide + .ticker stay)");
