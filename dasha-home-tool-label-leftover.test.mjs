#!/usr/bin/env node
/**
 * Leftover after #tool DOM-strip.
 * Live / 200 still serializes leftover repair CSS `#dasha-home #tool label`
 * after id=tool is gone from the DOM. Humans see it in view-source.
 * Repair #dasha-home h1/h2 stay. Watch price/ticker belt stays.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripHomeLeftoverToolLabelCss,
  stripHomeWebflowBoot,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover #dasha-home #tool label repair CSS still serializes"));
assert.match(workerSrc, /export function stripHomeLeftoverToolLabelCss/);
assert.match(workerSrc, /out = stripHomeLeftoverToolLabelCss\(out\);/);
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

const REPAIR = `#dasha-home h1,
#dasha-home h2 { color: var(--ink, #F2EDE7); }
#dasha-home #tool label { color: var(--ink, #F2EDE7); }`;

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-mobile-scroll">html{overflow-x:clip}body,body.body,.dasha,.dasha-root{overflow:visible}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
<style>
${REPAIR}
</style>
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<div id="dasha-home"><main class="dasha" id="top"><header class="dasha-hero wrap"><div><h1>$dasha</h1></div></header><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
</body></html>`;

assert.doesNotMatch(LIVE, /\bid=["']tool["']/, "fixture has no id=tool in DOM");
assert.match(LIVE, /#dasha-home #tool label/, "fixture leftover #tool label CSS paints");
assert.match(LIVE, /#dasha-home h1/, "fixture repair h1 stays");
assert.match(LIVE, /#dasha-home h2/, "fixture repair h2 stays");

const gone = stripHomeLeftoverToolLabelCss(LIVE);
assert.doesNotMatch(gone, /#dasha-home\s+#tool\s+label/, "drops leftover #tool label rule");
assert.doesNotMatch(gone, /#tool/, "no leftover #tool token in CSS");
assert.match(gone, /#dasha-home h1/, "repair h1 stays");
assert.match(gone, /#dasha-home h2/, "repair h2 stays");
assert.match(gone, /var\(--ink, #F2EDE7\)/, "repair color stays");
assert.match(gone, /id=["']dasha-mobile-scroll["']/, "mobile-scroll stays");
assert.match(gone, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.match(gone, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(gone, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
assert.match(gone, /#spark\{display:none!important\}/, "Watch #spark hide stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.match(gone, /id=["']simp-door["']/, "simp-door stays");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.ok(gone.length > LIVE.length * 0.7, "tool-label drop is per-rule, not eat-the-page");

{
  const other = stripHomeLeftoverToolLabelCss(`<!doctype html><html><head><style>#dasha-home #tool label{color:red}</style></head><body><main id="dasha-page">x</main></body></html>`);
  assert.match(other, /#dasha-home #tool label/, "non-home pages keep leftover #tool label CSS");
}

{
  const booted = stripHomeWebflowBoot(LIVE);
  assert.doesNotMatch(booted, /#dasha-home\s+#tool\s+label/, "boot drops leftover #tool label");
  assert.match(booted, /#dasha-home h1/, "boot keeps repair h1");
  assert.match(booted, /#dasha-home h2/, "boot keeps repair h2");
  assert.match(booted, /\.price,#price,\.ticker/, "boot Watch belt stays");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("x-dasha-edge"), "html-security");
  const html = await home.text();
  assert.doesNotMatch(html, /\bid=["']tool["']/, "served home no id=tool");
  assert.doesNotMatch(html, /#dasha-home\s+#tool\s+label/, "served home no leftover #tool label CSS");
  assert.doesNotMatch(html, /#tool/, "served home no #tool token");
  assert.match(html, /#dasha-home h1/, "served repair h1 stays");
  assert.match(html, /#dasha-home h2/, "served repair h2 stays");
  assert.match(html, /var\(--ink, #F2EDE7\)/, "served repair color stays");
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, "served Watch chrome-hide stays");
  assert.match(html, /\.price,#price,\.ticker/, "served Watch price/ticker belt stays");
  assert.match(html, /#spark\{display:none!important\}/, "served Watch #spark hide stays");
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "served mobile-scroll stays");
  assert.match(html, /#grwm \.grwm-phone/, "served GRWM phone CSS stays");
  assert.match(html, /\$dasha/);
  assert.match(html, /Chat/);
  assert.match(html, /Buy/);
  assert.match(html, new RegExp(MINT));
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const studio = await edgeWorker.fetch(new Request("https://www.getdasha.com/studio"), {});
  assert.equal(studio.status, 308);
  assert.equal(studio.headers.get("location"), "https://www.getdasha.com/");
}

console.log("dasha-home-tool-label-leftover: PASS (leftover #tool label CSS gone; h1/h2 repair + Watch belt stay)");
