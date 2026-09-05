#!/usr/bin/env node
/**
 * Leftover after home footer DOM-strip + digest remount.
 * Live / 200 still serializes remount querySelector('footer') after footer was
 * already dropped. Humans see it in view-source. grok-door / grwm / main insert
 * paths stay. Mint COPY + DashaHomeMint stay. GRWM stays. Watch belt stays.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker from "./dasha-lobby-worker.mjs";
import { digestRemountScript, injectDigestRemount } from "./dasha-digest.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const digestSrc = readFileSync(join(root, "dasha-digest.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.doesNotMatch(digestSrc, /plugin\.jup\.ag/, "digest must not mention plugin.jup.ag");
assert.ok(digestSrc.includes("Leftover remount querySelector('footer') dropped after home footer"));
assert.match(digestSrc, /export function digestRemountScript/);
assert.match(workerSrc, /injectDigestRemount\(out\)/);
assert.match(workerSrc, /dropTagged\(out, 'footer'\)/);
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

const remount = digestRemountScript();
assert.doesNotMatch(remount, /querySelector\(['"]footer['"]\)/, "remount drops leftover footer querySelector");
assert.doesNotMatch(remount, /var foot=/, "remount drops leftover foot variable");
assert.doesNotMatch(remount, /foot&&foot\.parentNode/, "remount drops leftover foot insertBefore branch");
assert.match(remount, /#grok-door/, "remount still anchors on #grok-door");
assert.match(remount, /getElementById\('grwm'\)/, "remount still anchors on #grwm");
assert.match(remount, /querySelector\('main'\)/, "remount still falls back to main");
assert.match(remount, /\/digest\.json/, "remount still fetches /digest.json");
assert.match(remount, /dasha-crew-line|crew-line/, "remount still paints quiet crew line");
assert.match(remount, /\/crew/, "crew line still links /crew");
assert.doesNotMatch(remount, /window\.Webflow/, "prior leftover Webflow.push stays dropped");
assert.doesNotMatch(remount, /plugin\.jup\.ag/);

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<style id="dasha-mobile-scroll">html{overflow-x:clip}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<header class="bar"><a class="word" href="https://www.getdasha.com/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}" target="_blank" rel="noopener noreferrer">Buy</a></header>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="token"><div class="wrap contract"><code id="mint">${MINT}</code><button class="copy" type="button">COPY</button></div></section><section id="grwm"><div class="grwm-phone"></div><a class="grwm-go" href="/lobby">Watch</a></section><section id="grok-door"><h2>Sign in with Grok Bot.</h2></section></main></div>
<script>(()=>{const CA='${MINT}';window.DashaHomeMint={CA}})()</script>
</body></html>`;

const injected = injectDigestRemount(LIVE);
assert.match(injected, /id=["']dasha-digest-remount["']/, "remount injects");
assert.doesNotMatch(injected, /querySelector\(['"]footer['"]\)/, "injected remount has no footer querySelector");
assert.match(injected, /#grok-door/, "injected remount keeps grok-door");
assert.match(injected, /getElementById\('grwm'\)/, "injected remount keeps grwm");
assert.match(injected, /querySelector\('main'\)/, "injected remount keeps main");
assert.match(injected, /DashaHomeMint/, "mint COPY helper stays");
assert.match(injected, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(injected, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
assert.match(injected, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.doesNotMatch(injected, /plugin\.jup\.ag/);

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /querySelector\(['"]footer['"]\)/, "served home drops leftover remount footer querySelector");
  assert.doesNotMatch(html, /var foot=document\.querySelector\(['"]footer['"]\)/, "served home drops leftover foot var");
  assert.match(html, /id=["']dasha-digest-remount["']/, "served remount stays");
  assert.match(html, /\/digest\.json/, "served remount still fetches /digest.json");
  assert.match(html, /#grok-door/, "served remount still anchors grok-door");
  assert.match(html, /getElementById\('grwm'\)/, "served remount still anchors grwm");
  assert.match(html, /querySelector\('main'\)/, "served remount still falls back to main");
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
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /class=["']pill primary["']/, "simp-door pill stays");
  assert.match(html, /@view-transition/, "@view-transition stays");
  assert.doesNotMatch(html, /window\.Webflow/, "prior leftover Webflow.push stays dropped");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
  assert.doesNotMatch(html, /<footer\b/i, "home footer stays dropped");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /id=["']dasha-chess["']/, "lobby #dasha-chess stays");
  assert.match(html, /lobby-log/, "lobby .lobby-log stays");
  assert.match(html, /id=["']forum-play-go["']/, "Play stays");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class=["']skip-link["']/, "privacy skip-link stays");
  assert.match(html, /href=["']#dasha-page["']/, "privacy skip target stays #dasha-page");
  assert.match(html, /id=["']dasha-page["']/, "privacy #dasha-page stays");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/login"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Sign in with Grok Bot|Grok Bot|siwg/i, "/login SIWG stays");
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

console.log("dasha-home-footer-remount-leftover: PASS (remount footer querySelector gone; grok/grwm/main + mint COPY + GRWM + Watch belt stay)");
