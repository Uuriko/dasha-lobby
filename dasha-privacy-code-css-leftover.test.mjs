#!/usr/bin/env node
/**
 * Leftover after privacy leftover .cta CSS + CSS/JS strip.
 * Live /privacy 200 still serializes leftover mixed `a,code` CSS after <code>
 * was never in the privacy DOM (htmlPage still emits a,code). Humans see leftover
 * code in view-source. Distinct leftover vs leftover .cta CSS. a color stays.
 * Product skip-link stays. 404 mint <code> a,code stays. Contribute a,code stays.
 * Bounties leftover a,code is a separate leftover. Disk htmlPage still emits a,code
 * (polish drops leftover code on /privacy). No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  stripPrivacyDroppedCtaCss,
  stripPrivacyLeftoverCodeCss,
} from "./dasha-lobby-worker.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes(
    "Leftover /privacy dropped-selector CSS after <code> was never in the privacy DOM",
  ),
);
assert.match(workerSrc, /export function stripPrivacyLeftoverCodeCss/);
assert.match(
  workerSrc,
  /stripPrivacyLeftoverCodeCss\(stripPrivacyDroppedCtaCss\(PRIVACY_HTML\)\)/,
);
assert.match(
  workerSrc,
  /a,code\{color:#dfff00\}/,
  "htmlPage still emits leftover a,code CSS (privacy polish drops leftover code)",
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
<title>Dasha privacy</title>
<link rel="canonical" href="https://www.getdasha.com/privacy">
<style>body{font:16px/1.45 Arial,Helvetica,sans-serif;background:#070608;color:#f4eddb;max-width:28rem;margin:3rem auto;padding:0 1rem}a,code{color:#dfff00}.cta{display:inline-flex;align-items:center;min-height:48px;padding:0 16px;background:#dfff00;color:#070608;font-weight:900;text-decoration:none;box-shadow:4px 4px 0 #ff3b81}.skip-link{position:absolute;left:-9999px;top:0;z-index:100;padding:12px 16px;background:#dfff00;color:#070608!important;font-weight:900;text-decoration:none}.skip-link:focus{left:12px;top:12px;outline:3px solid #f4eddb;outline-offset:2px}</style>
</head>
<body><a class="skip-link" href="#dasha-page">Skip to content</a><main id="dasha-page"><h1>Privacy</h1>
<p>Updated 29 August 2026.</p>
<p>Dasha never collects seed phrases, private keys, DMs, email, phone numbers, or payment cards.</p>
<p><a href="https://www.getdasha.com/">Back to Dasha</a> · <a href="https://www.getdasha.com/how-to-buy">How to buy</a> · <a href="https://www.getdasha.com/faucet">Faucet</a></p></main></body></html>`;

assert.match(LIVE, /a,code\{/, "fixture leftover a,code CSS paints in live <style>");
assert.doesNotMatch(afterStyleScript(LIVE), /<code\b/i, "fixture privacy DOM has no <code>");
assert.match(LIVE, /class=["']skip-link["']/, "fixture skip-link stays in DOM");

const gone = stripPrivacyLeftoverCodeCss(stripPrivacyDroppedCtaCss(LIVE));
assert.doesNotMatch(gone, /a,code\{/, "drops leftover mixed a,code CSS");
assert.doesNotMatch(gone, /,\s*code\{/, "no leftover code in mixed selector");
assert.match(gone, /a\{color:#dfff00\}/, "a color stays");
assert.doesNotMatch(gone, /\.cta\s*\{/, "prior leftover .cta CSS stays dropped");
assert.match(gone, /class=["']skip-link["']/, "skip-link class stays");
assert.match(gone, /\.skip-link\{/, "skip-link CSS stays");
assert.match(gone, /\.skip-link:focus\{/, "skip-link:focus CSS stays");
assert.match(gone, /<h1>Privacy<\/h1>/, "Privacy H1 stays");
assert.match(gone, /Dasha never collects seed phrases/, "privacy copy stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/, "no plugin.jup.ag");
assert.ok(gone.length > LIVE.length * 0.7, "CSS drop is per-token, not eat-the-page");

{
  const keepCode = LIVE.replace(
    "</p></main>",
    `</p><p><code>${MINT}</code></p></main>`,
  );
  const out = stripPrivacyLeftoverCodeCss(keepCode);
  assert.match(out, /a,code\{/, "keeps a,code CSS when privacy still has <code>");
}

{
  const keepContribute = stripPrivacyLeftoverCodeCss(`<!doctype html><html><head>
<link rel="canonical" href="https://www.getdasha.com/contribute">
<style>a,code{color:#dfff00}.cta{display:inline-flex}</style></head>
<body><h1>Build Dasha.</h1><p><a class="cta" href="https://github.com/Uuriko/dasha-desk/contribute">Pick a first issue ↗</a></p></body></html>`);
  assert.match(keepContribute, /a,code\{/, "contribute leftover a,code CSS stays (separate leftover)");
  assert.match(keepContribute, /class="cta"/, "contribute .cta class stays");
}

{
  const keepBounties = stripPrivacyLeftoverCodeCss(`<!doctype html><html><head>
<link rel="canonical" href="https://www.getdasha.com/bounties">
<style>a,code{color:#dfff00}</style></head>
<body><h1>Bounties</h1><section id="bb-app"></section><p id="bb-x"></p></body></html>`);
  assert.match(keepBounties, /a,code\{/, "bounties leftover a,code CSS stays (separate leftover)");
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-dasha-edge"), "privacy");
  const html = await res.text();
  assert.doesNotMatch(html, /a,code\{/, "served /privacy drops leftover a,code CSS");
  assert.match(html, /a\{color:#dfff00\}/, "served a color stays");
  assert.doesNotMatch(afterStyleScript(html), /<code\b/i, "served privacy DOM has no <code>");
  assert.doesNotMatch(html, /\.cta\s*\{/, "served leftover .cta CSS stays dropped");
  assert.match(html, /class=["']skip-link["']/, "served skip-link stays");
  assert.match(html, /\.skip-link\{/, "served skip-link CSS stays");
  assert.match(html, /<h1>Privacy<\/h1>/);
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/contribute"), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /a,code\{/, "contribute leftover a,code CSS stays dropped");
  assert.match(html, /a\{color:#dfff00\}/, "contribute a color stays");
  assert.match(html, /class=["']cta["']/, "contribute .cta stays");
  assert.match(html, /Pick a first issue/);
}

{
  const res = await edgeWorker.fetch(new Request("https://www.getdasha.com/checkout"), {});
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
  assert.match(html, /id=["']dasha-digest-remount["']/, "home remount stays");
  assert.match(html, /\/digest\.json/, "home remount still fetches /digest.json");
  assert.match(html, /id=["']dasha-home-chrome-hide["']/, "Watch chrome-hide stays");
  assert.match(html, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
  assert.match(html, /#spark\{display:none!important\}/, "Watch #spark hide stays");
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
  assert.doesNotMatch(html, /\.forum-form/, "lobby leftover .forum-form CSS stays dropped");
  assert.match(html, /\.lobby-form\{/, ".lobby-form CSS stays");
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
  const bounties = await edgeWorker.fetch(new Request("https://www.getdasha.com/bounties"), {});
  assert.equal(bounties.status, 200);
  const html = await bounties.text();
  assert.match(html, /id=["']bb-x["']/, "bounties #bb-x stays");
  assert.match(html, /id=["']bb-app["']/, "#bb-app empty inventory stays");
  assert.match(html, /x-connect\.js/, "bounties x-connect.js stays");
  assert.doesNotMatch(html, /board\.js/, "do not mount board.js");
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

{
  const siwg = await edgeWorker.fetch(new Request("https://www.getdasha.com/siwg"), {});
  assert.equal(siwg.status, 308);
  assert.equal(siwg.headers.get("location"), "https://www.getdasha.com/login#grok");
}

{
  const use = await edgeWorker.fetch(new Request("https://www.getdasha.com/compute/use"), {});
  assert.equal(use.status, 308);
  assert.equal(use.headers.get("location"), "https://www.getdasha.com/compute");
}

console.log("dasha-privacy-code-css-leftover: PASS (privacy leftover a,code CSS gone; a color + skip-link stay)");
