#!/usr/bin/env node
/**
 * Leftover after home skip-link DOM-strip.
 * Live / 200 still serializes leftover Webflow id="content" on the hero header
 * after skip-link to #content was already dropped. Home has no skip-link.
 * Privacy uses #dasha-page. Product #dasha-home + #top stay. Mint COPY stays.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, { stripHomeLeftoverContentId } from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover home Webflow skip target id="content" after skip-link DOM-strip'));
assert.match(workerSrc, /export function stripHomeLeftoverContentId/);
assert.match(workerSrc, /out = stripHomeLeftoverContentId\(out\);/);
assert.match(workerSrc, /export function stripHomeLeftoverDashaRootClass/);
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

const COPY_SCRIPT = `<script>(()=>{const CA='${MINT}';function mintCopiedOk(got,want){return String(got||'').replace(/\\s+/g,'')===String(want||'')}function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('copy-timeout')),ms))])}const b=document.querySelector('.copy'),m=document.querySelector('#mint');b?.addEventListener('click',async()=>{try{await withTimeout(navigator.clipboard.writeText(CA),800);if(navigator.clipboard.readText){const got=await withTimeout(navigator.clipboard.readText(),800);b.textContent=mintCopiedOk(got,CA)?'COPIED':'SELECT'}else b.textContent='COPIED'}catch{b.textContent='SELECT';if(m){const s=getSelection(),r=document.createRange();r.selectNodeContents(m);s.removeAllRanges();s.addRange(r)}}setTimeout(()=>b.textContent='COPY',1800)});window.DashaHomeMint={CA,mintCopiedOk}})()</script>`;

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-mobile-scroll">html{overflow-x:clip}body,body.body,.dasha,.dasha-root{overflow:visible}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<div id="dasha-home"><main class="dasha" id="top"><header class="dasha-hero wrap" id="content"><div><h1>$dasha</h1></div></header><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
${COPY_SCRIPT}
</body></html>`;

assert.match(LIVE, /<header class="dasha-hero wrap" id="content">/, "fixture leftover id=content paints");
assert.match(LIVE, /id=["']dasha-home["']/, "fixture dasha-home stays");
assert.match(LIVE, /id=["']top["']/, "fixture #top stays");
assert.match(LIVE, /DashaHomeMint/, "fixture mint COPY helper stays");

const gone = stripHomeLeftoverContentId(LIVE);
assert.doesNotMatch(gone, /\bid=["']content["']/, "drops leftover id=content");
assert.match(gone, /<header class="dasha-hero wrap">/, "hero header stays without content id");
assert.match(gone, /id=["']dasha-home["']/, "dasha-home id stays");
assert.match(gone, /id=["']top["']/, "#top stays");
assert.match(gone, /DashaHomeMint/, "mint COPY helper stays");
assert.match(gone, /function mintCopiedOk/, "mintCopiedOk stays");
assert.match(gone, /class=["']copy["']/, "contract .copy stays");
assert.match(gone, /id=["']mint["']/, "mint id stays");
assert.match(gone, /id=["']dasha-mobile-scroll["']/, "mobile-scroll stays");
assert.match(gone, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.match(gone, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(gone, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
assert.match(gone, /#spark\{display:none!important\}/, "Watch #spark hide stays");
assert.match(gone, /class=["']pill primary["']/, "simp-door pill stays");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.ok(gone.length > LIVE.length * 0.7, "id drop is per-attr, not eat-the-page");

{
  const other = stripHomeLeftoverContentId(`<!doctype html><html><head></head><body><main id="dasha-page"><a class="skip-link" href="#dasha-page">Skip</a><header id="content">x</header></main></body></html>`);
  assert.match(other, /id="content"/, "non-home pages keep leftover content id");
  assert.match(other, /id="dasha-page"/, "privacy #dasha-page stays untouched on non-home");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /<header\b[^>]*\bid=["']content["']/, "served home hero drops leftover id=content");
  assert.doesNotMatch(html, /\bid=["']content["']/, "served home has no id=content");
  assert.match(html, /id=["']dasha-home["']/, "served dasha-home id stays");
  assert.match(html, /id=["']top["']/, "served #top stays");
  assert.match(html, /class=["'][^"']*\bdasha-hero\b/, "served dasha-hero stays");
  assert.match(html, /DashaHomeMint/, "served mint COPY helper stays");
  assert.match(html, /function mintCopiedOk/, "served mintCopiedOk stays");
  assert.match(html, /class=["']copy["']/, "served contract .copy stays");
  assert.match(html, /id=["']mint["']/, "served mint stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /id=["']grwm["']/, "served GRWM stays");
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
  assert.match(html, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.doesNotMatch(html, /class=["']skip-link["']/, "home skip-link stays dropped");
  assert.doesNotMatch(html, /href=["']#content["']/, "home has no #content skip");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /querySelector\(['"]footer['"]\)/, "prior leftover remount footer stays dropped");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class=["']skip-link["']/, "privacy skip-link stays");
  assert.match(html, /href=["']#dasha-page["']/, "privacy skip target stays #dasha-page");
  assert.match(html, /id=["']dasha-page["']/, "privacy #dasha-page stays");
  assert.doesNotMatch(html, /href=["']#content["']/, "privacy does not use #content");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class=["']skip-link["']/, "bounties skip-link stays");
  assert.match(html, /href=["']#dasha-page["']/, "bounties skip target stays #dasha-page");
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

console.log("dasha-home-content-id-leftover: PASS (home leftover id=content gone; #dasha-home + #top + privacy #dasha-page stay)");
