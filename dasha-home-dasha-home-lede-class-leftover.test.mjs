#!/usr/bin/env node
/**
 * Leftover after home CSS/JS strip + culture/mint lede.
 * Live / 200 still serializes leftover class="dasha-home-lede" after CSS never
 * targets .dasha-home-lede (lede paints via #dasha-home-lede) and JS never reads
 * querySelector('.dasha-home-lede'). Humans see it in view-source.
 * Distinct leftover vs leftover class="dasha-quiz" / leftover class="dasha-root".
 * Keep #dasha-home-lede + culture/mint line. Keep #chat-door + #simp-door.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripHomeLeftoverDashaHomeLedeClass,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover home class="dasha-home-lede" after CSS/JS strip'));
assert.match(workerSrc, /export function stripHomeLeftoverDashaHomeLedeClass/);
assert.match(workerSrc, /out = stripHomeLeftoverDashaHomeLedeClass\(out\);/);
assert.match(workerSrc, /const HOME_LEDE = `<p id="dasha-home-lede" class="dasha-home-lede">/);
assert.match(
  (workerSrc.match(/const HOME_FAUCET_STYLE = '<style id="dasha-home-faucet-css">[\s\S]*?<\/style>';/) || [""])[0],
  /#dasha-home-lede\{/,
  "faucet CSS still paints #dasha-home-lede",
);
assert.doesNotMatch(
  (workerSrc.match(/const HOME_FAUCET_STYLE = '<style id="dasha-home-faucet-css">[\s\S]*?<\/style>';/) || [""])[0],
  /\.dasha-home-lede\b/,
  "faucet CSS never targets .dasha-home-lede",
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
<style id="dasha-mobile-scroll">html{overflow-x:clip}body,body.body,.dasha,.dasha-root{overflow:visible}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
<style id="dasha-home-faucet-css">#dasha-home-faucet,#dasha-faucet{width:min(36rem,calc(100% - 32px));margin:28px auto 64px}#dasha-home-lede{width:min(40rem,calc(100% - 32px));margin:18px auto 8px;color:var(--paper,#f4eddb);font:900 1.05rem/1.35 Arial,Helvetica,sans-serif}.dasha-bag-line{margin:.6rem 0 0;font:800 .95rem/1.3 Arial,Helvetica,sans-serif}</style>
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<main id="dasha-home" class="dasha">
<header class="dasha-hero"><div><h1>It’s time<br><span class="stroke">$dasha.</span></h1></div></header>
<p id="dasha-home-lede" class="dasha-home-lede">dash_eats culture. Match the mint.</p>
<section id="chat-door" aria-labelledby="chat-title"><h2 id="chat-title">Chat.</h2><a class="pill primary" href="/lobby">Open chat →</a></section>
<section id="simp-door" aria-labelledby="simp-title"><h2 id="simp-title">Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section>
<section id="dasha-home-faucet" aria-label="Faucet"><div id="dasha-faucet"></div></section>
<section id="grwm"><div class="grwm-phone"></div></section>
<section id="grok-door"><h2>Sign in with Grok Bot.</h2></section>
</main>
</body></html>`;

assert.match(afterStyleScript(LIVE), /class=["']dasha-home-lede["']/, "fixture leftover class=dasha-home-lede paints after style/script strip");
assert.doesNotMatch(afterStyleScript(LIVE), /querySelector\(['"]\.dasha-home-lede['"]\)/, "fixture JS never reads .dasha-home-lede");
assert.doesNotMatch(LIVE, /\.dasha-home-lede\b/, "fixture CSS never targets .dasha-home-lede");
assert.match(LIVE, /#dasha-home-lede\{/, "fixture CSS paints via #dasha-home-lede");
assert.match(LIVE, /id=["']dasha-home-lede["']/, "fixture #dasha-home-lede stays in DOM");
assert.match(LIVE, /dash_eats culture\. Match the mint\./, "fixture culture/mint line stays");

const gone = stripHomeLeftoverDashaHomeLedeClass(LIVE);
assert.doesNotMatch(gone, /class=["'][^"']*\bdasha-home-lede\b/, "drops leftover class=dasha-home-lede");
assert.match(gone, /id=["']dasha-home-lede["']/, "#dasha-home-lede stays");
assert.match(gone, /dash_eats culture\. Match the mint\./, "culture/mint line stays");
assert.match(gone, /#dasha-home-lede\{/, "#dasha-home-lede CSS stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.match(gone, /id=["']simp-door["']/, "simp-door stays");
assert.match(gone, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
assert.match(gone, /class=["']pill primary["']/, "door pills stay");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.match(gone, /johns-awesome/, "johns-awesome stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "class drop is per-attr, not eat-the-page");

{
  const other = stripHomeLeftoverDashaHomeLedeClass(`<!doctype html><html><head></head><body><p class="dasha-home-lede">x</p></body></html>`);
  assert.match(other, /class="dasha-home-lede"/, "non-home pages keep leftover dasha-home-lede class");
}

{
  const mixed = stripHomeLeftoverDashaHomeLedeClass(`<!doctype html><html><head></head><body><p id="dasha-home-lede" class="dasha-home-lede quiet">dash_eats culture. Match the mint.</p></body></html>`);
  assert.match(mixed, /id="dasha-home-lede" class="quiet"/, "keeps other classes on the lede");
  assert.doesNotMatch(mixed, /class=["'][^"']*\bdasha-home-lede\b/, "drops only leftover dasha-home-lede token");
}

function assertNoLedeClass(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /class=["'][^"']*\bdasha-home-lede\b/, `${label} no leftover class=dasha-home-lede after style/script strip`);
  assert.match(html, /id=["']dasha-home-lede["']/, `${label} #dasha-home-lede stays`);
  assert.match(html, /dash_eats culture\. Match the mint\./, `${label} culture/mint line`);
  assert.match(html, /#dasha-home-lede\{/, `${label} #dasha-home-lede CSS stays`);
  assert.match(html, /id=["']chat-door["']/, `${label} chat-door stays`);
  assert.match(html, /id=["']simp-door["']/, `${label} simp-door stays`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoLedeClass(stripHomeLeftoverDashaHomeLedeClass(LIVE), "strip leftover fixture");

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  assert.equal(home.headers.get("x-dasha-edge"), "html-security");
  const html = await home.text();
  assertNoLedeClass(html, "served home");
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
  assert.doesNotMatch(html, /class=["'][^"']*\bdasha-root\b/, "prior leftover dasha-root class stays dropped");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
}

{
  const simp = await edgeWorker.fetch(new Request("https://www.getdasha.com/simp"), {});
  assert.equal(simp.status, 200);
  const html = await simp.text();
  assert.doesNotMatch(html, /class=["'][^"']*\bdasha-quiz\b/, "prior leftover class=dasha-quiz stays dropped");
  assert.match(html, /id=["']dasha-quiz["']/, "#dasha-quiz stays");
  assert.match(html, /id=["']dasha-simp-board["']/, "#dasha-simp-board stays");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.doesNotMatch(html, /class=["'][^"']*\blobby-text\b/, "prior leftover class=lobby-text stays dropped");
  assert.match(html, /class=["']lobby-form["']/, "lobby .lobby-form stays");
  assert.match(html, /id=["']dasha-forum["']/, "#dasha-forum stays");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.doesNotMatch(html, /\bid=["']leaders-panel["']/, "prior leftover id=leaders-panel stays dropped");
  assert.match(html, /class=["']app["']/, "chess .app stays");
}

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  const html = await howto.text();
  assert.doesNotMatch(html, /id=["']buy2["']/, "prior leftover howto id=buy2 stays dropped");
  assert.match(html, />Buy on Jupiter/, "Buy on Jupiter stays");
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

console.log("dasha-home-dasha-home-lede-class-leftover: PASS (home leftover class=dasha-home-lede gone; #dasha-home-lede stays)");
