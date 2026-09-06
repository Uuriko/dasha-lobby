#!/usr/bin/env node
/**
 * Leftover after leftover privacy a,code + leftover bounties a,code.
 * Live /contribute 200 still serializes leftover mixed `a,code` CSS after <code>
 * was never in the contribute DOM (htmlPage still emits a,code). Humans see leftover
 * code in view-source. Distinct leftover vs leftover privacy a,code / leftover bounties a,code.
 * a color stays. .cta stays. Product skip-link stays. 404 mint <code> a,code stays.
 * Disk htmlPage still emits a,code (polish drops leftover code on /contribute).
 * No Designer. Never plugin.jup.ag. Do not mount board.js.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripContributeLeftoverCodeCss,
  stripPrivacyLeftoverCodeCss,
  stripBountiesLeftoverCodeCss,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes(
    "Leftover /contribute dropped-selector CSS after <code> was never in the contribute DOM",
  ),
);
assert.match(workerSrc, /export function stripContributeLeftoverCodeCss/);
assert.match(
  workerSrc,
  /stripContributeLeftoverCodeCss\(CONTRIBUTE_HTML\)/,
);
assert.match(
  workerSrc,
  /a,code\{color:#dfff00\}/,
  "htmlPage still emits leftover a,code CSS (contribute polish drops leftover code)",
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
assert.match(
  (workerSrc.match(/const HOME_MOBILE_SCROLL = '<style id="dasha-mobile-scroll">[\s\S]*?<\/style>';/) || [""])[0],
  /body,\.dasha,\.dasha-root,main,#dasha-home,#top/,
  "GRWM phone unlock body,.dasha,.dasha-root stays",
);

function afterStyleScript(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

const LIVE = `<!doctype html><html lang="en"><head>
<title>Contribute to Dasha</title>
<link rel="canonical" href="https://www.getdasha.com/contribute">
<style>body{font:16px/1.45 Arial,Helvetica,sans-serif;background:#070608;color:#f4eddb;max-width:28rem;margin:3rem auto;padding:0 1rem}a,code{color:#dfff00}.cta{display:inline-flex;align-items:center;min-height:48px;padding:0 16px;background:#dfff00;color:#070608;font-weight:900;text-decoration:none;box-shadow:4px 4px 0 #ff3b81}.skip-link{position:absolute;left:-9999px;top:0;z-index:100;padding:12px 16px;background:#dfff00;color:#070608!important;font-weight:900;text-decoration:none}.skip-link:focus{left:12px;top:12px;outline:3px solid #f4eddb;outline-offset:2px}</style>
</head>
<body><a class="skip-link" href="#dasha-page">Skip to content</a><main id="dasha-page"><h1>Build Dasha.</h1>
<p>Open a pull request.</p>
<p><a class="cta" href="https://github.com/Uuriko/dasha-desk/contribute" target="_blank" rel="noopener noreferrer">Pick a first issue ↗</a></p>
<p><a href="https://github.com/Uuriko/dasha-desk/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">Read the guide ↗</a></p>
<p><a href="https://www.getdasha.com/">Home</a> · <a href="https://www.getdasha.com/lobby">Lobby</a></p></main></body></html>`;

assert.match(LIVE, /a,code\{/, "fixture leftover a,code CSS paints in live <style>");
assert.doesNotMatch(afterStyleScript(LIVE), /<code\b/i, "fixture contribute DOM has no <code>");
assert.match(LIVE, /class=["']cta["']/, "fixture .cta stays in DOM");
assert.match(LIVE, /class=["']skip-link["']/, "fixture skip-link stays in DOM");

const gone = stripContributeLeftoverCodeCss(LIVE);
assert.doesNotMatch(gone, /a,code\{/, "drops leftover mixed a,code CSS");
assert.doesNotMatch(gone, /,\s*code\{/, "no leftover code in mixed selector");
assert.match(gone, /a\{color:#dfff00\}/, "a color stays");
assert.match(gone, /\.cta\{/, ".cta CSS stays");
assert.match(gone, /class=["']cta["']/, ".cta class stays");
assert.match(gone, /class=["']skip-link["']/, "skip-link class stays");
assert.match(gone, /\.skip-link\{/, "skip-link CSS stays");
assert.match(gone, /\.skip-link:focus\{/, "skip-link:focus CSS stays");
assert.match(gone, /<h1>Build Dasha\.<\/h1>/, "Build Dasha H1 stays");
assert.match(gone, /Pick a first issue/, "first issue CTA stays");
assert.match(gone, /Open a pull request\./, "PR copy stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.doesNotMatch(gone, /board\.js/, "do not mount board.js");
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-token, not eat-the-page");

{
  const keepCode = LIVE.replace(
    "</p></main>",
    `</p><p><code>${MINT}</code></p></main>`,
  );
  const out = stripContributeLeftoverCodeCss(keepCode);
  assert.match(out, /a,code\{/, "keeps a,code CSS when contribute still has <code>");
}

{
  const keepPrivacy = stripContributeLeftoverCodeCss(`<!doctype html><html><head>
<link rel="canonical" href="https://www.getdasha.com/privacy">
<style>a,code{color:#dfff00}</style></head>
<body><h1>Privacy</h1><p>Updated 29 August 2026.</p></body></html>`);
  assert.match(keepPrivacy, /a,code\{/, "privacy leftover a,code is a separate leftover (privacy strip)");
}

{
  const keepBounties = stripContributeLeftoverCodeCss(`<!doctype html><html><head>
<link rel="canonical" href="https://www.getdasha.com/bounties">
<style>a,code{color:#dfff00}</style></head>
<body><h1>Bounties</h1><section id="bb-app"></section><p id="bb-x"></p></body></html>`);
  assert.match(keepBounties, /a,code\{/, "bounties leftover a,code is a separate leftover (bounties strip)");
}

{
  const keepPrivacyStrip = stripPrivacyLeftoverCodeCss(`<!doctype html><html><head>
<link rel="canonical" href="https://www.getdasha.com/contribute">
<style>a,code{color:#dfff00}.cta{display:inline-flex}</style></head>
<body><h1>Build Dasha.</h1><p><a class="cta" href="https://github.com/Uuriko/dasha-desk/contribute">Pick a first issue ↗</a></p></body></html>`);
  assert.match(keepPrivacyStrip, /a,code\{/, "privacy strip does not eat contribute leftover a,code");
  assert.match(keepPrivacyStrip, /class="cta"/, "privacy strip does not eat .cta");
}

{
  const keepBountiesStrip = stripBountiesLeftoverCodeCss(`<!doctype html><html><head>
<link rel="canonical" href="https://www.getdasha.com/contribute">
<style>a,code{color:#dfff00}.cta{display:inline-flex}</style></head>
<body><h1>Build Dasha.</h1><p><a class="cta" href="https://github.com/Uuriko/dasha-desk/contribute">Pick a first issue ↗</a></p></body></html>`);
  assert.match(keepBountiesStrip, /a,code\{/, "bounties strip does not eat contribute leftover a,code");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/contribute"), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-dasha-edge"), "contribute");
  const html = await res.text();
  assert.doesNotMatch(html, /a,code\{/, "served /contribute drops leftover a,code CSS");
  assert.match(html, /a\{color:#dfff00\}/, "served a color stays");
  assert.doesNotMatch(afterStyleScript(html), /<code\b/i, "served contribute DOM has no <code>");
  assert.match(html, /\.cta\{/, "served .cta CSS stays");
  assert.match(html, /class=["']cta["']/, "served .cta class stays");
  assert.match(html, /class=["']skip-link["']/, "served skip-link stays");
  assert.match(html, /\.skip-link\{/, "served skip-link CSS stays");
  assert.match(html, /<h1>Build Dasha\.<\/h1>/);
  assert.match(html, /Pick a first issue/);
  assert.match(html, /Open a pull request\./);
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /a,code\{/, "privacy leftover a,code CSS stays dropped");
  assert.match(html, /a\{color:#dfff00\}/, "privacy a color stays");
  assert.doesNotMatch(html, /\.cta\s*\{/, "privacy leftover .cta CSS stays dropped");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /a,code\{/, "bounties leftover a,code CSS stays dropped");
  assert.match(html, /a\{color:#dfff00\}/, "bounties a color stays");
  assert.match(html, /id=["']bb-x["']/, "bounties #bb-x stays");
  assert.match(html, /id=["']bb-app["']/, "#bb-app empty inventory stays");
  assert.match(html, /x-connect\.js/, "bounties x-connect.js stays");
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/paypal-checkout"), {});
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /<code>/, "404 mint <code> stays");
  assert.match(html, /a,code\{/, "404 a,code CSS stays (paints mint <code>)");
  assert.match(html, new RegExp(MINT), "404 mint stays");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "home mobile-scroll stays");
  assert.match(html, /#grwm \.grwm-phone/, "GRWM phone CSS stays");
  assert.match(html, /body,\.dasha,\.dasha-root,main,#dasha-home,#top/, "GRWM unlock stays");
  assert.doesNotMatch(html, /body\.body/, "prior leftover body.body CSS stays dropped");
  assert.match(html, /id=["']dasha-digest-remount["']/, "home remount stays");
  assert.match(html, /\/digest\.json/, "home remount still fetches /digest.json");
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
  assert.match(html, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /@view-transition/, "product @view-transition stays");
  assert.match(html, /johns-awesome/, "johns-awesome CSS stays");
  assert.match(html, /data:image\/svg\+xml/, "cherries SVG stays");
  assert.match(html, /faucet\.js/, "faucet.js stays");
  assert.match(html, /x-connect\.js/, "x-connect.js stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.match(html, /id=["']forum-play-go["']/, "#forum-play-go stays");
  assert.match(html, /id=["']dasha-forum["']/, "#dasha-forum stays");
  assert.match(html, /\.dasha-lobby\{/, ".dasha-lobby stays");
  assert.match(html, /\.lobby-form\{/, ".lobby-form CSS stays");
  assert.match(html, /\.lobby-body\{/, ".lobby-body CSS stays");
  assert.match(html, /\.lobby-status\{/, ".lobby-status CSS stays");
  assert.match(html, /x-connect\.js/, "lobby x-connect.js stays");
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
  const chess = await edgeWorker.fetch(new Request("https://www.getdasha.com/chess"), {});
  assert.equal(chess.status, 200);
  const html = await chess.text();
  assert.match(html, /x-connect\.js/, "chess x-connect.js stays");
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

{
  const compute = await edgeWorker.fetch(new Request("https://www.getdasha.com/compute"), {});
  assert.equal(compute.status, 200);
  const html = await compute.text();
  assert.match(html, /hostedLive\s*=\s*status\?\.live\s*===\s*true|hostedLive\s*=\s*status\.live\s*===\s*true/, "hostedLive flag stays honest");
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

console.log("dasha-contribute-code-css-leftover: PASS (contribute leftover a,code CSS gone; a color + .cta + skip-link stay)");
