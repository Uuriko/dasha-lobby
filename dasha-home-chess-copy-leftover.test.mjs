#!/usr/bin/env node
/**
 * Leftover after home chess-door / #chess-copy / .door-actions DOM-strip.
 * Live / 200 still serializes leftover chess-copy JS + window.DashaHomeChess
 * after the home DOM never had id="chess-copy". Humans see it in view-source.
 * Mint COPY + DashaHomeMint stay. GRWM stays. Watch price/ticker remount belt stays.
 * Lobby #dasha-chess stays. Distinct leftover vs #dasha-chess iframe CSS.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, { stripHomeChessCopy } from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover home chess-copy JS after chess-door / #chess-copy DOM-strip"));
assert.match(workerSrc, /export function stripHomeChessCopy/);
assert.match(workerSrc, /out = stripHomeChessCopy\(out\);/);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /#grwm \.grwm-phone/,
  "mobile-scroll still unlocks GRWM phone",
);
assert.doesNotMatch(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /#dasha-chess/,
  "HOME_MOBILE_SCROLL still DRY of leftover #dasha-chess CSS",
);
assert.match(
  (workerSrc.match(/const style = '<style id="dasha-home-chrome-hide">[\s\S]*?<\/style>';/) || [""])[0],
  /\.price,#price,\.ticker.*#spark\{display:none!important\}/,
  "Watch belt selector list stays",
);

const COPY_SCRIPT = `<script>(()=>{const CA='${MINT}';const CHESS='https://www.getdasha.com/chess';function mintCopiedOk(got,want){return String(got||'').replace(/\\s+/g,'')===String(want||'')}function linkCopiedOk(got,want){return String(got||'').replace(/\\s+/g,'')===String(want||'')}function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('copy-timeout')),ms))])}const b=document.querySelector('.copy'),m=document.querySelector('#mint');b?.addEventListener('click',async()=>{try{await withTimeout(navigator.clipboard.writeText(CA),800);if(navigator.clipboard.readText){const got=await withTimeout(navigator.clipboard.readText(),800);b.textContent=mintCopiedOk(got,CA)?'COPIED':'SELECT'}else b.textContent='COPIED'}catch{b.textContent='SELECT';if(m){const s=getSelection(),r=document.createRange();r.selectNodeContents(m);s.removeAllRanges();s.addRange(r)}}setTimeout(()=>b.textContent='COPY',1800)});const c=document.getElementById('chess-copy');c?.addEventListener('click',async()=>{const label=c.textContent;try{await withTimeout(navigator.clipboard.writeText(CHESS),800);if(navigator.clipboard.readText){const got=await withTimeout(navigator.clipboard.readText(),800);c.textContent=linkCopiedOk(got,CHESS)?'Copied':'Select'}else c.textContent='Copied'}catch{c.textContent='Select'}setTimeout(()=>c.textContent=label,1800)});window.DashaHomeMint={CA,mintCopiedOk};window.DashaHomeChess={URL:CHESS,linkCopiedOk}})()</script>`;

const LIVE = `<!doctype html><html lang="en" id="dasha-home"><head>
<title>$dasha</title>
<style id="dasha-mobile-scroll">html{overflow-x:clip}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main>
${COPY_SCRIPT}
</body></html>`;

assert.match(LIVE, /getElementById\(['"]chess-copy['"]\)/, "fixture leftover chess-copy JS paints");
assert.match(LIVE, /DashaHomeChess/, "fixture leftover DashaHomeChess paints");
assert.doesNotMatch(LIVE, /id=["']chess-copy["']/, "fixture home never had #chess-copy");
assert.doesNotMatch(LIVE, /id=["']chess-door["']/, "fixture home never had chess-door");
assert.match(LIVE, /DashaHomeMint/, "fixture mint COPY helper stays");
assert.match(LIVE, /class=["']copy["']/, "fixture contract .copy stays");

const gone = stripHomeChessCopy(LIVE);
assert.doesNotMatch(gone, /chess-copy/, "drops leftover chess-copy");
assert.doesNotMatch(gone, /DashaHomeChess/, "drops leftover DashaHomeChess");
assert.doesNotMatch(gone, /function linkCopiedOk/, "drops leftover linkCopiedOk");
assert.doesNotMatch(gone, /const CHESS=/, "drops leftover CHESS const");
assert.match(gone, /DashaHomeMint/, "mint COPY helper stays");
assert.match(gone, /function mintCopiedOk/, "mintCopiedOk stays");
assert.match(gone, /querySelector\('\.copy'\)/, "mint .copy listener stays");
assert.match(gone, /querySelector\('#mint'\)/, "mint #mint stays in script");
assert.match(gone, /id=["']mint["']/, "mint id stays in DOM");
assert.match(gone, /class=["']copy["']/, "contract .copy stays");
assert.match(gone, /id=["']dasha-mobile-scroll["']/, "mobile-scroll stays");
assert.match(gone, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.match(gone, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(gone, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
assert.match(gone, /#spark\{display:none!important\}/, "Watch #spark hide stays");
assert.match(gone, /class=["']pill primary["']/, "simp-door pill stays");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.ok(gone.length > LIVE.length * 0.7, "JS drop is per-handler, not eat-the-page");

{
  const other = stripHomeChessCopy(`<!doctype html><html><head></head><body><button id="chess-copy">Copy chess link</button>${COPY_SCRIPT}</body></html>`);
  assert.match(other, /id=["']chess-copy["']/, "non-home pages keep #chess-copy");
  assert.match(other, /DashaHomeChess/, "non-home pages keep DashaHomeChess");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /chess-copy/, "served home drops leftover chess-copy");
  assert.doesNotMatch(html, /DashaHomeChess/, "served home drops leftover DashaHomeChess");
  assert.match(html, /DashaHomeMint/, "served mint COPY helper stays");
  assert.match(html, /function mintCopiedOk/, "served mintCopiedOk stays");
  assert.match(html, /class=["']copy["']/, "served contract .copy stays");
  assert.match(html, /id=["']mint["']/, "served mint stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /id=["']dasha-home-faucet-css["']/, "faucet CSS id stays");
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
  assert.doesNotMatch(html, /DashaHomeChess/, "lobby does not pick up leftover home chess copy");
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
  assert.doesNotMatch(html, /Mac Studio/, "Mac Studio retired off the /compute page (sponsors API carries it)");
  assert.match(html, /Start\. Ask\. Provide\. Pay\. Credits\./, "compute Start-gate copy");
  assert.doesNotMatch(html, /Use\. Provide\. Night\. Build\./, "old compute slogan retired");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /function jup\(/, "chess jup() stays");
  assert.match(html, /jup\.ag/, "chess jup.ag stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(html, /bootJup/);
  assert.doesNotMatch(html, /DashaHomeChess/, "chess page does not lecture leftover home DashaHomeChess");
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

console.log("dasha-home-chess-copy-leftover: PASS (home leftover chess-copy / DashaHomeChess gone; mint COPY + GRWM + Watch belt stay)");
