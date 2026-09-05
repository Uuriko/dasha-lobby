#!/usr/bin/env node
/**
 * Leftover after home CSS/JS strip + contract Buy pill.
 * Live / 200 still serializes leftover class="buy-dasha" after CSS never
 * targets .buy-dasha (contract Buy paints via .pill.primary) and JS never reads
 * querySelector('.buy-dasha'). Humans see it in view-source.
 * Distinct leftover vs leftover class="dasha-home-lede" / leftover class="dasha-root".
 * Keep .pill.primary + Buy $dasha ↗ + jup.ag + #mint + .copy.
 * Lobby/chess/simp .buy-dasha stay.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripHomeLeftoverBuyDashaClass,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover home class="buy-dasha" after CSS/JS strip'));
assert.match(workerSrc, /export function stripHomeLeftoverBuyDashaClass/);
assert.match(workerSrc, /out = stripHomeLeftoverBuyDashaClass\(out\);/);
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
<style id="dasha-mobile-scroll">html{overflow-x:clip}body,body.body,.dasha,.dasha-root{overflow:visible}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
<style id="dasha-home-faucet-css">#dasha-home-faucet,#dasha-faucet{width:min(36rem,calc(100% - 32px));margin:28px auto 64px}#dasha-home-lede{width:min(40rem,calc(100% - 32px));margin:18px auto 8px;color:var(--paper,#f4eddb);font:900 1.05rem/1.35 Arial,Helvetica,sans-serif}.pill{display:inline-flex}.pill.primary{background:#dfff00;color:#070608}.copy{cursor:pointer}.dasha-bag-line{margin:.6rem 0 0}</style>
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main id="dasha-home" class="dasha">
<header class="dasha-hero"><div><h1>It’s time<br><span class="stroke">$dasha.</span></h1></div></header>
<p id="dasha-home-lede">dash_eats culture. Match the mint.</p>
<section id="chat-door" aria-labelledby="chat-title"><h2 id="chat-title">Chat.</h2><a class="pill primary" href="/lobby">Open chat →</a></section>
<section id="simp-door" aria-labelledby="simp-title"><h2 id="simp-title">Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section>
<section id="dasha-home-faucet" aria-label="Faucet"><div id="dasha-faucet"></div></section>
<section id="grwm"><div class="grwm-phone"></div></section>
<section id="grok-door"><h2>Sign in with Grok Bot.</h2></section>
<div class="wrap contract"><div class="ca"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div><a class="pill primary buy-dasha" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy $dasha ↗</a></div>
</main>
</body></html>`;

assert.match(afterStyleScript(LIVE), /class=["'][^"']*\bbuy-dasha\b/, "fixture leftover class=buy-dasha paints after style/script strip");
assert.doesNotMatch(afterStyleScript(LIVE), /querySelector\(['"]\.buy-dasha['"]\)/, "fixture JS never reads .buy-dasha");
assert.doesNotMatch(LIVE, /\.buy-dasha\b/, "fixture CSS never targets .buy-dasha");
assert.match(LIVE, /\.pill\.primary\{/, "fixture CSS paints via .pill.primary");
assert.match(LIVE, /class=["']pill primary buy-dasha["']/, "fixture leftover class token sits on the pill");
assert.match(LIVE, />Buy \$dasha ↗</, "fixture Buy $dasha stays");

const gone = stripHomeLeftoverBuyDashaClass(LIVE);
assert.doesNotMatch(gone, /class=["'][^"']*\bbuy-dasha\b/, "drops leftover class=buy-dasha");
assert.match(gone, /class=["']pill primary["']/, ".pill.primary stays");
assert.match(gone, />Buy \$dasha ↗</, "Buy $dasha ↗ stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, /id=["']mint["']/, "#mint stays");
assert.match(gone, /class=["']copy["']/, ".copy stays");
assert.match(gone, /id=["']dasha-home-lede["']/, "#dasha-home-lede stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.match(gone, /id=["']simp-door["']/, "simp-door stays");
assert.match(gone, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
assert.match(gone, /class=["']pill primary["']/, "door pills stay");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.match(gone, /johns-awesome/, "johns-awesome stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "class drop is per-attr, not eat-the-page");

{
  const other = stripHomeLeftoverBuyDashaClass(`<!doctype html><html><head></head><body><a class="buy-dasha" href="/">Buy</a></body></html>`);
  assert.match(other, /class="buy-dasha"/, "non-home pages keep leftover buy-dasha class");
}

{
  const mixed = stripHomeLeftoverBuyDashaClass(`<!doctype html><html><head></head><body><main id="dasha-home"><a class="pill primary buy-dasha extra" href="https://jup.ag/swap">Buy $dasha ↗</a></main></body></html>`);
  assert.match(mixed, /class="pill primary extra"/, "keeps other classes on the pill");
  assert.doesNotMatch(mixed, /class=["'][^"']*\bbuy-dasha\b/, "drops only leftover buy-dasha token");
}

function assertNoBuyDashaClass(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /class=["'][^"']*\bbuy-dasha\b/, `${label} no leftover class=buy-dasha after style/script strip`);
  assert.match(html, /class=["']pill primary["']/, `${label} .pill.primary stays`);
  assert.match(html, />Buy \$dasha ↗</, `${label} Buy $dasha ↗ stays`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag stays`);
  assert.match(html, /id=["']mint["']/, `${label} #mint stays`);
  assert.match(html, /class=["']copy["']/, `${label} .copy stays`);
  assert.match(html, /id=["']chat-door["']/, `${label} chat-door stays`);
  assert.match(html, /id=["']simp-door["']/, `${label} simp-door stays`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoBuyDashaClass(stripHomeLeftoverBuyDashaClass(LIVE), "strip leftover fixture");

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("x-dasha-edge"), "html-security");
  const html = await home.text();
  assertNoBuyDashaClass(html, "served home");
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "home mobile-scroll stays");
  assert.match(html, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
  assert.match(html, /id=["']dasha-digest-remount["']/, "home remount stays");
  assert.match(html, /\/digest\.json/, "home remount still fetches /digest.json");
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
  assert.match(html, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
  assert.match(html, /#spark\{display:none!important\}/, "Watch #spark hide stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /johns-awesome/, "johns-awesome CSS stays");
  assert.match(html, /image\/svg\+xml/, "cherries SVG favicon stays");
  assert.doesNotMatch(html, /class=["'][^"']*\bdasha-home-lede\b/, "prior leftover dasha-home-lede class stays dropped");
  assert.match(html, /id=["']dasha-home-lede["']/, "#dasha-home-lede stays");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
}

{
  const simp = await edgeWorker.fetch(new Request("https://www.getdasha.com/simp"), {});
  assert.equal(simp.status, 200);
  const html = await simp.text();
  assert.match(html, /class=["'][^"']*\bbuy-dasha\b/, "simp .buy-dasha stays");
  assert.match(html, /id=["']dasha-quiz["']/, "#dasha-quiz stays");
  assert.doesNotMatch(html, /class=["'][^"']*\bdasha-quiz\b/, "prior leftover class=dasha-quiz stays dropped");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /class=["'][^"']*\bbuy-dasha\b/, "lobby .buy-dasha stays");
  assert.match(html, /id=["']dasha-forum["']/, "#dasha-forum stays");
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.match(html, /id=["']forum-play-go["']/, "#forum-play-go stays");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /class=["'][^"']*\bbuy-dasha\b/, "chess .buy-dasha stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "chess no plugin.jup.ag");
}

{
  const compute = await edgeWorker.fetch(new Request("https://www.getdasha.com/compute"), {});
  assert.equal(compute.status, 200);
  const html = await compute.text();
  assert.doesNotMatch(html, /\bid=["']code-python["']/, "prior leftover id=code-python stays dropped");
  assert.doesNotMatch(html, /id=["']code-curl["']/, "#code-curl retired with the Start gate");
  assert.match(html, /hostedLive=status\?\.live===true|hostedLive=status\.live===true/, "hosted live flag stays honest");
}

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  const html = await howto.text();
  assert.doesNotMatch(html, /id=["']buy2["']/, "prior leftover howto id=buy2 stays dropped");
  assert.match(html, />Buy on Jupiter/, "Buy on Jupiter stays");
  assert.match(html, /id=["']ca["']/, "#ca stays");
  assert.match(html, /id=["']copy["']/, "id=copy stays");
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

console.log("dasha-home-buy-dasha-class-leftover: PASS (home leftover class=buy-dasha gone; .pill.primary stays)");
