#!/usr/bin/env node
/**
 * Leftover after home CSS/JS strip + product body CSS.
 * Live / 200 still serializes leftover Webflow <body class="body"> which paints
 * johns-awesome .body (slate/purple, Schibsted, margin-top:-13px) over product
 * body rules. Humans see it after style/script strip. johns-awesome stays.
 * Mint COPY + DashaHomeMint stay. GRWM stays. Watch price/ticker remount belt stays.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, { stripHomeLeftoverBodyClass } from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes("Leftover home Webflow body class after product body CSS"));
assert.match(workerSrc, /export function stripHomeLeftoverBodyClass/);
assert.match(workerSrc, /out = stripHomeLeftoverBodyClass\(out\);/);
assert.match(workerSrc, /export function stripHomeSimpHashRedirect/);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /#grwm \.grwm-phone/,
  "mobile-scroll still unlocks GRWM phone",
);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /body,body\.body/,
  "mobile-scroll still unlocks body even if leftover class returns",
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

const COPY_SCRIPT = `<script>(()=>{const CA='${MINT}';function mintCopiedOk(got,want){return String(got||'').replace(/\\s+/g,'')===String(want||'')}function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('copy-timeout')),ms))])}const b=document.querySelector('.copy'),m=document.querySelector('#mint');b?.addEventListener('click',async()=>{try{await withTimeout(navigator.clipboard.writeText(CA),800);if(navigator.clipboard.readText){const got=await withTimeout(navigator.clipboard.readText(),800);b.textContent=mintCopiedOk(got,CA)?'COPIED':'SELECT'}else b.textContent='COPIED'}catch{b.textContent='SELECT';if(m){const s=getSelection(),r=document.createRange();r.selectNodeContents(m);s.removeAllRanges();s.addRange(r)}}setTimeout(()=>b.textContent='COPY',1800)});window.DashaHomeMint={CA,mintCopiedOk}})()</script>`;

const LIVE = `<!doctype html><html lang="en" id="dasha-home"><head>
<title>$dasha</title>
<link href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/css/johns-awesome-project-39b1b5.webflow.shared.4e493bbf3.min.css" rel="stylesheet">
<style id="dasha-mobile-scroll">html{overflow-x:clip}body,body.body,.dasha{overflow:visible}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body class="body">
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main>
${COPY_SCRIPT}
</body></html>`;

assert.match(LIVE, /<body class="body">/, "fixture leftover Webflow body class paints");
assert.match(LIVE, /johns-awesome/, "fixture johns-awesome stays");
assert.match(LIVE, /DashaHomeMint/, "fixture mint COPY helper stays");
assert.match(LIVE, /class=["']copy["']/, "fixture contract .copy stays");

const gone = stripHomeLeftoverBodyClass(LIVE);
assert.doesNotMatch(gone, /<body\b[^>]*\bclass=["'][^"']*\bbody\b/, "drops leftover body class from <body>");
assert.match(gone, /<body>/, "body tag stays");
assert.match(gone, /johns-awesome/, "johns-awesome CSS stays");
assert.match(gone, /body,body\.body/, "mobile-scroll body.body unlock stays");
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
assert.ok(gone.length > LIVE.length * 0.7, "class drop is per-body-tag, not eat-the-page");

{
  const mixed = stripHomeLeftoverBodyClass(`<!doctype html><html id="dasha-home"><head></head><body class="body dasha-root">x</body></html>`);
  assert.match(mixed, /<body class="dasha-root">/, "keeps other body classes");
  assert.doesNotMatch(mixed, /<body class="[^"]*\bbody\b/, "drops only leftover body token");
}

{
  const other = stripHomeLeftoverBodyClass(`<!doctype html><html><head></head><body class="body">x</body></html>`);
  assert.match(other, /<body class="body">/, "non-home pages keep leftover body class");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /<body\b[^>]*\bclass=["'][^"']*\bbody\b/, "served home drops leftover Webflow body class");
  assert.match(html, /<body\b/, "served body tag stays");
  assert.match(html, /johns-awesome/, "served johns-awesome stays");
  assert.match(html, /<html[^>]*\blang=["']en["']/, "served html lang stays");
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
  assert.match(html, /id=["']dasha-digest-remount["']/, "served remount stays");
  assert.match(html, /\/digest\.json/, "served remount still fetches /digest.json");
  assert.doesNotMatch(html, /window\.Webflow/, "prior leftover Webflow.push stays dropped");
  assert.doesNotMatch(html, /location\.hash==='#simp'/, "prior leftover #simp hash stays dropped");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
  assert.doesNotMatch(html, /id=["']dasha-chess["']/, "no leftover #dasha-chess");
  assert.doesNotMatch(html, /chess-copy/, "prior leftover chess-copy stays dropped");
  assert.doesNotMatch(html, /DashaHomeChess/, "prior leftover DashaHomeChess stays dropped");
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

{
  const quiz = await edgeWorker.fetch(new Request("https://www.getdasha.com/quiz"), {});
  assert.equal(quiz.status, 308);
  assert.equal(quiz.headers.get("location"), "https://www.getdasha.com/simp");
}

{
  const challenge = await edgeWorker.fetch(new Request("https://www.getdasha.com/?challenge=abc123xyz"), {});
  assert.equal(challenge.status, 308);
  assert.equal(challenge.headers.get("location"), "https://www.getdasha.com/simp/r/abc123xyz");
}

console.log("dasha-home-body-class-leftover: PASS (home leftover Webflow body class gone; johns-awesome + mint COPY + GRWM + Watch belt stay)");
