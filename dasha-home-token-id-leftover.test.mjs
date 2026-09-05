#!/usr/bin/env node
/**
 * Leftover after home CSS/JS strip + mint COPY.
 * Live / 200 still serializes leftover id="token" after JS never reads
 * getElementById('token') and CSS never targets #token (mint COPY is #mint +
 * .copy / DashaHomeMint). Humans see it in view-source.
 * Distinct leftover vs leftover id="content". Keep #mint + .copy + Chart.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, { stripHomeLeftoverTokenId } from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover home Webflow contract id="token" after CSS/JS strip'));
assert.match(workerSrc, /export function stripHomeLeftoverTokenId/);
assert.match(workerSrc, /out = stripHomeLeftoverTokenId\(out\);/);
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

const COPY_SCRIPT = `<script>(()=>{const CA='${MINT}';function mintCopiedOk(got,want){return String(got||'').replace(/\\s+/g,'')===String(want||'')}function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('copy-timeout')),ms))])}const b=document.querySelector('.copy'),m=document.querySelector('#mint');b?.addEventListener('click',async()=>{try{await withTimeout(navigator.clipboard.writeText(CA),800);if(navigator.clipboard.readText){const got=await withTimeout(navigator.clipboard.readText(),800);b.textContent=mintCopiedOk(got,CA)?'COPIED':'SELECT'}else b.textContent='COPIED'}catch{b.textContent='SELECT';if(m){const s=getSelection(),r=document.createRange();r.selectNodeContents(m);s.removeAllRanges();s.addRange(r)}}setTimeout(()=>b.textContent='COPY',1800)});window.DashaHomeMint={CA,mintCopiedOk}})()</script>`;

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-mobile-scroll">html{overflow-x:clip}body,body.body,.dasha,.dasha-root{overflow:visible}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
<link href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/css/johns-awesome-project-39b1b5.webflow.shared.4e493bbf3.min.css" rel="stylesheet" integrity="sha384-Tkk7vziP9mLxc4zf1kMfBKSPv36KYsnK3ahvDL+P6Ar2CqzTC2gKNNyj2d6Kh9g0" crossorigin="anonymous"/>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ctitle%3EDasha%3C%2Ftitle%3E%3C%2Fsvg%3E">
<style>@view-transition{navigation:auto}</style>
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<div id="dasha-home"><main class="dasha" id="top"><header class="dasha-hero wrap"><div><h1>$dasha</h1></div></header><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button><div class="linkrow"><a href="https://www.geckoterminal.com/solana/pools/9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7">Chart ↗</a></div></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
${COPY_SCRIPT}
</body></html>`;

assert.match(afterStyleScript(LIVE), /id=["']token["']/, "fixture leftover id=token paints after style/script strip");
assert.doesNotMatch(afterStyleScript(LIVE), /getElementById\(['"]token['"]\)/, "fixture JS never reads token");
assert.doesNotMatch(LIVE, /#token\b/, "fixture CSS never targets #token");
assert.match(LIVE, /id=["']mint["']/, "fixture #mint stays");
assert.match(LIVE, /class=["']copy["']/, "fixture .copy stays");
assert.match(LIVE, /querySelector\(['"]#mint['"]\)/, "fixture mint COPY reads #mint");

const gone = stripHomeLeftoverTokenId(LIVE);
assert.doesNotMatch(gone, /\bid=["']token["']/, "drops leftover id=token");
assert.match(gone, /<section><div class="wrap contract">/, "contract section stays without token id");
assert.match(gone, /id=["']mint["']/, "mint id stays");
assert.match(gone, /class=["']copy["']/, "contract .copy stays");
assert.match(gone, /DashaHomeMint/, "mint COPY helper stays");
assert.match(gone, /function mintCopiedOk/, "mintCopiedOk stays");
assert.match(gone, /geckoterminal\.com\/solana\/pools/, "Chart stays");
assert.match(gone, /id=["']dasha-home["']/, "dasha-home id stays");
assert.match(gone, /id=["']top["']/, "#top stays");
assert.match(gone, /id=["']dasha-mobile-scroll["']/, "mobile-scroll stays");
assert.match(gone, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.match(gone, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(gone, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
assert.match(gone, /#spark\{display:none!important\}/, "Watch #spark hide stays");
assert.match(gone, /body,body\.body,\.dasha,\.dasha-root/, "mobile-scroll body.body / .dasha-root unlock stays");
assert.match(gone, /johns-awesome-project/, "johns-awesome CDN stays");
assert.match(gone, /image\/svg\+xml/, "cherries SVG stays");
assert.match(gone, /@view-transition/, "@view-transition stays");
assert.match(gone, /class=["']pill primary["']/, "simp-door pill stays");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.match(gone, /id=["']grok-door["']/, "grok-door stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.ok(gone.length > LIVE.length * 0.7, "id drop is per-attr, not eat-the-page");

{
  const other = stripHomeLeftoverTokenId(`<!doctype html><html><head></head><body><main id="dasha-page"><section id="token">x</section></main></body></html>`);
  assert.match(other, /id="token"/, "non-home pages keep leftover token id");
  assert.match(other, /id="dasha-page"/, "privacy #dasha-page stays untouched on non-home");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /\bid=["']token["']/, "served home has no leftover id=token");
  assert.match(html, /id=["']dasha-home["']/, "served dasha-home id stays");
  assert.match(html, /id=["']top["']/, "served #top stays");
  assert.match(html, /DashaHomeMint/, "served mint COPY helper stays");
  assert.match(html, /function mintCopiedOk/, "served mintCopiedOk stays");
  assert.match(html, /class=["']copy["']/, "served contract .copy stays");
  assert.match(html, /id=["']mint["']/, "served mint stays");
  assert.match(html, /geckoterminal\.com\/solana\/pools/, "served Chart stays");
  assert.match(html, /class=["'][^"']*\bcontract\b/, "served contract wrap stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /id=["']grwm["']/, "served GRWM stays");
  assert.match(html, /id=["']dasha-digest-remount["']/, "home remount stays");
  assert.match(html, /\/digest\.json/, "home remount /digest.json stays");
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "home mobile-scroll stays");
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
  assert.match(html, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /johns-awesome-project/, "served johns-awesome stays");
  assert.match(html, /image\/svg\+xml/, "served cherries SVG stays");
  assert.doesNotMatch(html, /\bid=["']forum-play["']/, "prior leftover lobby forum-play id stays dropped");
  assert.doesNotMatch(html, /\bid=["']buy2["']/, "prior leftover howto buy2 id stays dropped");
  assert.doesNotMatch(html, /\bid=["']content["']/, "prior leftover id=content stays dropped");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /querySelector\(['"]footer['"]\)/, "prior leftover remount footer stays dropped");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class=["']skip-link["']/, "privacy skip-link stays");
  assert.match(html, /id=["']dasha-page["']/, "privacy #dasha-page stays");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /id=["']bb-x["']/, "bounties #bb-x stays");
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

console.log("dasha-home-token-id-leftover: PASS (home leftover id=token gone; #mint + .copy + Chart stay)");
