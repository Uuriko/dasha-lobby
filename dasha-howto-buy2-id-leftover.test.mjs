#!/usr/bin/env node
/**
 * Leftover after howto CSS/JS strip + Buy on Jupiter.
 * Live /how-to-buy 200 still serializes leftover id="buy2" after JS never reads
 * getElementById('buy2') and CSS never targets #buy2. Humans see it in view-source.
 * Distinct leftover vs route disclaimer / when-lecture. Buy on Jupiter + jup.ag +
 * #ca + skip-link stay. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishHowtoHtml,
  stripHowtoLeftoverBuy2Id,
} from "./dasha-lobby-worker.mjs";
import { HOWTO_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(workerSrc.includes('Leftover /how-to-buy id="buy2" after CSS/JS strip'));
assert.match(workerSrc, /export function stripHowtoLeftoverBuy2Id/);
assert.match(workerSrc, /page = stripHowtoLeftoverBuy2Id\(page\);/);
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
<title>How to buy $dasha</title>
<style>.skip-link{position:absolute;left:-9999px}.actions{display:flex}</style>
</head><body>
<a class="skip-link" href="#ca">Skip to mint</a>
<main class="wrap">
  <h1>How to buy $dasha</h1>
  <p class="lede">SOL → mint → Buy.</p>
  <code class="ca" id="ca">${MINT}</code>
  <button type="button" class="btn" id="copy">Copy CA</button>
  <article class="step" data-n="03">
    <h2>Swap SOL → $dasha</h2>
    <p>Opens Jupiter with SOL selling into the exact mint above.</p>
    <div class="actions">
      <a class="btn" id="buy2" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}">Buy on Jupiter ↗</a>
    </div>
  </article>
  <footer><p><a href="/">Home</a> · <a href="/lobby">Lobby</a> · <a href="/privacy">Privacy</a></p></footer>
</main>
</body></html>`;

assert.match(afterStyleScript(LIVE), /id=["']buy2["']/, "fixture leftover id=buy2 paints after style/script strip");
assert.doesNotMatch(afterStyleScript(LIVE), /getElementById\(['"]buy2['"]\)/, "fixture JS never reads buy2");

const gone = stripHowtoLeftoverBuy2Id(LIVE);
assert.doesNotMatch(gone, /id=["']buy2["']/, "drops leftover id=buy2");
assert.match(gone, />Buy on Jupiter/, "Buy on Jupiter stays");
assert.match(gone, /class=["']btn["'] href="https:\/\/jup\.ag\/swap/, "Buy link stays a .btn");
assert.match(gone, /id=["']ca["']/, "#ca stays");
assert.match(gone, /id=["']copy["']/, "id=copy stays");
assert.match(gone, /class=["']skip-link["']/, "skip-link stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "id drop is per-attr, not eat-the-page");

const polished = polishHowtoHtml(LIVE);
assert.doesNotMatch(polished, /id=["']buy2["']/, "polish drops leftover id=buy2");
assert.match(polished, />Buy on Jupiter/, "polish Buy on Jupiter stays");
assert.match(polished, /id=["']ca["']/, "polish #ca stays");
assert.match(polished, /id=["']copy["']/, "polish id=copy stays");

assert.match(HOWTO_HTML, /id=["']buy2["']/, "disk source still has leftover id=buy2 (polish drops it; did not run static-gen)");

function assertNoBuy2(html, label) {
  assert.doesNotMatch(afterStyleScript(html), /id=["']buy2["']/, `${label} no leftover id=buy2 after style/script strip`);
  assert.match(html, />Buy on Jupiter/, `${label} Buy on Jupiter`);
  assert.match(html, /jup\.ag\/swap/, `${label} jup.ag`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, /id=["']ca["']/, `${label} #ca`);
  assert.match(html, /class=["']skip-link["']/, `${label} skip-link`);
  assert.match(html, /<h1>How to buy \$dasha<\/h1>/, `${label} H1`);
  assert.match(html, /SOL → mint → Buy\./, `${label} lede`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}

assertNoBuy2(polishHowtoHtml(LIVE), "polished leftover fixture");
assertNoBuy2(polishHowtoHtml(HOWTO_HTML), "polished disk");

{
  const howto = await edgeWorker.fetch(new Request("https://www.getdasha.com/how-to-buy"), {});
  assert.equal(howto.status, 200);
  assert.equal(howto.headers.get("x-dasha-edge"), "howto");
  const html = await howto.text();
  assertNoBuy2(html, "served howto");
  assert.match(html, /id=["']copy["']/, "served id=copy stays");
  assert.match(html, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.doesNotMatch(afterStyleScript(html), /Review the route there before confirming/);
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
  assert.match(html, /#dasha-home h1/, "repair h1 stays");
  assert.doesNotMatch(html, /#dasha-home\s+#tool\s+label/, "leftover #tool label gone");
  assert.match(html, /#dasha-home h2/, "repair h2 stays");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /johns-awesome/, "johns-awesome CSS stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const privacy = await edgeWorker.fetch(new Request("https://www.getdasha.com/privacy"), {});
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /class=["']skip-link["']/, "privacy product skip-link stays");
  assert.match(html, /href=["']#dasha-page["']/, "privacy skip target stays #dasha-page");
}

{
  const forum = await edgeWorker.fetch(new Request("https://www.getdasha.com/forum"), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get("location"), "https://www.getdasha.com/lobby");
}

console.log("dasha-howto-buy2-id-leftover: PASS (howto leftover id=buy2 gone; Buy on Jupiter + #ca stay)");
