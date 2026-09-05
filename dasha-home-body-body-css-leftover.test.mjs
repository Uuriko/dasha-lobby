#!/usr/bin/env node
/**
 * Leftover after leftover home Webflow body class DOM-strip.
 * Live / 200 still serializes leftover mixed `body.body` CSS in #dasha-mobile-scroll
 * after <body> has no class="body". Humans see leftover body.body in view-source.
 * Distinct leftover vs leftover body class. Keep body,.dasha,.dasha-root,main,#dasha-home,#top.
 * HOME_MOBILE_SCROLL still emits leftover body.body (polish drops it). Disk only.
 * No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripHomeLeftoverBodyBodyCss,
  stripHomeLeftoverBodyClass,
  unlockHomeMobileScroll,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover home dropped-selector CSS after leftover body class was already DOM-stripped"),
);
assert.match(workerSrc, /export function stripHomeLeftoverBodyBodyCss/);
assert.match(workerSrc, /out = stripHomeLeftoverBodyBodyCss\(out\);/);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /#grwm \.grwm-phone/,
  "mobile-scroll still unlocks GRWM phone",
);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /body,body\.body/,
  "HOME_MOBILE_SCROLL still emits leftover body.body (polish drops it)",
);
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /\.dasha-root/,
  "mobile-scroll still unlocks .dasha-root",
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

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>$dasha</title>
<link href="https://cdn.prod.website-files.com/5f1458122ba25e70a3ff2bd0/css/johns-awesome-project-39b1b5.webflow.shared.4e493bbf3.min.css" rel="stylesheet">
<style id="dasha-mobile-scroll">html{overflow-x:clip}body,body.body,.dasha,.dasha-root,main,#dasha-home,#top{overflow:visible}html,body,.dasha,.dasha-root,main{touch-action:pan-y}#grwm video,#grwm .grwm-go{touch-action:pan-y}@media(max-width:800px){#grwm .grwm-phone{max-height:min(52svh,420px)}}</style>
<style id="dasha-home-chrome-hide">.price,#price,.ticker,.ticker-loop,.price-main,.price-now,.price-chg,.price-note,#price-now,#price-chg,#price-note,#spark{display:none!important}</style>
</head><body>
<div id="dasha-home"><main class="dasha" id="top"><section id="chat-door"><h2>Chat.</h2></section><section id="simp-door"><h2>Simp Quiz.</h2><a class="pill primary" href="/simp">Take the quiz</a></section><section id="grwm"><div class="grwm-phone"></div></section><section id="grok-door"></section></main></div>
</body></html>`;

assert.match(LIVE, /body,body\.body/, "fixture leftover body.body CSS paints");
assert.doesNotMatch(afterStyleScript(LIVE), /<body\b[^>]*\bclass=["'][^"']*\bbody\b/, "fixture <body> has no leftover body class");
assert.match(LIVE, /id=["']dasha-home["']/, "fixture #dasha-home stays");
assert.match(LIVE, /class=["']dasha["']/, "fixture .dasha stays");
assert.match(LIVE, /id=["']top["']/, "fixture #top stays");

const gone = stripHomeLeftoverBodyBodyCss(LIVE);
assert.doesNotMatch(gone, /body\.body/, "drops leftover body.body CSS");
assert.match(gone, /body,\.dasha,\.dasha-root,main,#dasha-home,#top\{/, "body + .dasha + .dasha-root + #dasha-home + #top stay");
assert.match(gone, /html,body,\.dasha,\.dasha-root,main\{/, "touch-action keepers stay");
assert.match(gone, /\.dasha-root/, ".dasha-root unlock stays");
assert.match(gone, /johns-awesome/, "johns-awesome CSS stays");
assert.match(gone, /id=["']dasha-mobile-scroll["']/, "mobile-scroll stays");
assert.match(gone, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
assert.match(gone, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
assert.match(gone, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
assert.match(gone, /#spark\{display:none!important\}/, "Watch #spark hide stays");
assert.match(gone, /id=["']chat-door["']/, "chat-door stays");
assert.match(gone, /id=["']simp-door["']/, "simp-door stays");
assert.match(gone, /id=["']grok-door["']/, "grok-door stays");
assert.match(gone, /id=["']grwm["']/, "GRWM stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-prefix, not eat-the-page");

{
  const keep = LIVE.replace("<body>", '<body class="body">');
  const out = stripHomeLeftoverBodyBodyCss(keep);
  assert.match(out, /body,body\.body/, "keeps leftover body.body CSS when DOM still has class=body");
}

{
  const lobby = stripHomeLeftoverBodyBodyCss(`<!doctype html><html><head><style>body,body.body,.dasha{overflow:visible}</style></head>
<body><div id="dasha-lobby" class="dasha-lobby"></div><button id="forum-play-go"></button></body></html>`);
  assert.match(lobby, /body,body\.body/, "lobby does not eat leftover home body.body CSS");
}

{
  const classGone = stripHomeLeftoverBodyClass(LIVE.replace("<body>", '<body class="body">'));
  assert.match(classGone, /body,body\.body/, "body-class leftover still keeps body.body CSS (this leftover drops it)");
  const polished = stripHomeLeftoverBodyBodyCss(classGone);
  assert.doesNotMatch(polished, /body\.body/, "polish after class strip drops leftover body.body CSS");
}

{
  const unlocked = unlockHomeMobileScroll('<html><head></head><body><div id="dasha-home"></div><section id="chat-door"></section><section id="grwm"></section></body></html>');
  assert.match(unlocked, /body,body\.body/, "unlock still emits leftover body.body");
  const polished = stripHomeLeftoverBodyBodyCss(unlocked);
  assert.doesNotMatch(polished, /body\.body/, "polish drops leftover body.body after unlock");
  assert.match(polished, /#grwm \.grwm-phone/, "unlock GRWM phone stays");
  assert.match(polished, /\.dasha-root/, "unlock .dasha-root stays");
  assert.match(polished, /#dasha-home/, "unlock #dasha-home stays");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.doesNotMatch(html, /body\.body/, "served home drops leftover body.body CSS");
  assert.doesNotMatch(html, /<body\b[^>]*\bclass=["'][^"']*\bbody\b/, "prior leftover body class stays dropped");
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "served mobile-scroll stays");
  assert.match(html, /#grwm \.grwm-phone/, "served GRWM phone CSS stays");
  assert.match(html, /body,\.dasha,\.dasha-root,main,#dasha-home,#top\{/, "served body + .dasha + .dasha-root + #dasha-home + #top stay");
  assert.match(html, /\.dasha-root/, "served .dasha-root unlock stays");
  assert.match(html, /id=["']dasha-home["']/, "served #dasha-home stays");
  assert.match(html, /id=["']top["']/, "served #top stays");
  assert.match(html, /class=["'][^"']*\bdasha\b/, "served .dasha stays");
  assert.doesNotMatch(html, /class=["'][^"']*\bdasha-root\b/, "prior leftover dasha-root class stays dropped");
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
  assert.match(html, /DashaHomeMint/, "mint COPY helper stays");
  assert.match(html, /class=["']copy["']/, "contract .copy stays");
  assert.match(html, /id=["']mint["']/, "mint stays");
  assert.match(html, /id=["']dasha-home-lede["']/, "#dasha-home-lede stays");
  assert.doesNotMatch(html, /class=["'][^"']*\bbuy-dasha\b/, "prior leftover home buy-dasha class stays dropped");
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
  assert.match(html, /\.lobby-body\{/, ".lobby-body CSS stays");
  assert.match(html, /\.lobby-status\{/, ".lobby-status CSS stays");
  assert.match(html, /\.dasha-lobby/, ".dasha-lobby stays");
  assert.doesNotMatch(html, /\.forum-form/, "prior leftover .forum-form CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-body/, "prior leftover .forum-body CSS stays dropped");
  assert.doesNotMatch(html, /\.forum-status/, "prior leftover .forum-status CSS stays dropped");
  assert.doesNotMatch(html, /\bid=["']forum-play["']/, "prior leftover id=forum-play stays dropped");
  assert.doesNotMatch(html, /id=["']dasha-mobile-scroll["']/, "prior leftover lobby mobile-scroll stays dropped");
  assert.match(html, /x-connect\.js/, "lobby x-connect.js stays");
}

{
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /class=["']buy-dasha["']/, "chess .buy-dasha stays");
  assert.match(html, /x-connect\.js/, "chess x-connect.js stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  const html = await howto.text();
  assert.match(html, />Buy on Jupiter/, "Buy on Jupiter stays");
  assert.match(html, /id=["']ca["']/, "#ca stays");
  assert.match(html, /id=["']copy["']/, "id=copy stays");
  assert.doesNotMatch(html, /nav a\.btn\s*\{/, "prior leftover howto nav a.btn CSS stays dropped");
  assert.doesNotMatch(html, /x-connect\.js/, "prior leftover howto x-connect.js stays dropped");
}

{
  const privacy = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.doesNotMatch(html, /a,code\{/, "prior leftover privacy a,code CSS stays dropped");
  assert.match(html, /a\{color:#dfff00\}/, "privacy a color stays");
  assert.match(html, /class=["']skip-link["']/, "privacy skip-link stays");
}

{
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.doesNotMatch(html, /a,code\{/, "prior leftover bounties a,code CSS stays dropped");
  assert.match(html, /a\{color:#dfff00\}/, "bounties a color stays");
  assert.match(html, /id=["']bb-x["']/, "#bb-x stays");
  assert.match(html, /id=["']bb-app["']/, "#bb-app stays");
  assert.match(html, /x-connect\.js/, "bounties x-connect.js stays");
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
}

{
  const contribute = await edgeWorker.fetch(new Request("https://www.getdasha.com/contribute"), {});
  assert.equal(contribute.status, 200);
  const html = await contribute.text();
  assert.doesNotMatch(html, /a,code\{/, "contribute leftover a,code CSS stays dropped");
  assert.match(html, /a\{color:#dfff00\}/, "contribute a color stays");
  assert.match(html, /class=["']cta["']/, "contribute .cta stays");
}

{
  const nf = await edgeWorker.fetch(new Request("https://www.getdasha.com/checkout"), {});
  assert.equal(nf.status, 404);
  const html = await nf.text();
  assert.match(html, /<code>/, "404 mint <code> stays");
  assert.match(html, /a,code\{/, "404 a,code CSS stays");
}

{
  const compute = await edgeWorker.fetch(new Request("https://www.getdasha.com/compute"), {});
  assert.equal(compute.status, 200);
  const html = await compute.text();
  assert.match(html, /hostedLive=status\.live===true/, "hosted live flag stays honest");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const faucet = await edgeWorker.fetch(new Request("https://www.getdasha.com/faucet"), {});
  assert.equal(faucet.status, 200);
  const html = await faucet.text();
  assert.match(html, /x-connect\.js/, "faucet x-connect.js stays");
  assert.match(html, /faucet\.js/, "faucet.js stays");
}

{
  const login = await edgeWorker.fetch(new Request("https://www.getdasha.com/login"), {});
  assert.equal(login.status, 200);
  const html = await login.text();
  assert.match(html, /x-connect\.js/, "login x-connect.js stays");
}

{
  const studio = await edgeWorker.fetch(new Request("https://www.getdasha.com/studio"), {});
  assert.equal(studio.status, 308);
  assert.equal(studio.headers.get("location"), "https://www.getdasha.com/");
}
{
  const verse = await edgeWorker.fetch(new Request("https://www.getdasha.com/verse"), {});
  assert.equal(verse.status, 308);
  assert.equal(verse.headers.get("location"), "https://www.getdasha.com/");
}
{
  const learn = await edgeWorker.fetch(new Request("https://www.getdasha.com/learn"), {});
  assert.equal(learn.status, 308);
  assert.equal(learn.headers.get("location"), "https://www.getdasha.com/");
}
{
  const forum = await edgeWorker.fetch(new Request("https://www.getdasha.com/forum"), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get("location"), "https://www.getdasha.com/lobby");
}
{
  const siwg = await edgeWorker.fetch(new Request("https://www.getdasha.com/siwg"), {});
  assert.equal(siwg.status, 308);
  assert.equal(siwg.headers.get("location"), "https://www.getdasha.com/login#grok");
}
for (const path of ["/compute/use", "/compute/provide", "/compute/night", "/compute/build", "/compute/sponsor"]) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 308, `${path} 308`);
  assert.equal(res.headers.get("location"), "https://www.getdasha.com/compute", `${path} → /compute`);
}
{
  const head = await edgeWorker.fetch(new Request("https://www.getdasha.com/oauth/x/start", { method: "HEAD" }), {});
  assert.equal(head.status, 308);
}
{
  const health = await edgeWorker.fetch(new Request("https://lobby.getdasha.com/health"), {});
  assert.equal(health.status, 200);
}

console.log("dasha-home-body-body-css-leftover: PASS (home leftover body.body CSS gone; body + .dasha + .dasha-root + GRWM stay)");
