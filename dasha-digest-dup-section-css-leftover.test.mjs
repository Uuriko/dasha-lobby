#!/usr/bin/env node
/**
 * Leftover after /digest PAGE_CSS already serializes SECTION_CSS + flush reset.
 * Live /digest 200 still serializes leftover duplicate #dasha-digest section
 * <style> (home-tape chrome). Inner style fights the reset. Humans see
 * duplicate #dasha-digest rules in view-source. Home/lobby inner <style> stay.
 * Home remount + /digest.json stay. Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, { stripDigestLeftoverDupSectionCss } from "./dasha-lobby-worker.mjs";
import { DEFAULT, digestPageHtml, digestSectionHtml } from "./dasha-digest.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const digestSrc = readFileSync(join(root, "dasha-digest.mjs"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.doesNotMatch(digestSrc, /plugin\.jup\.ag/, "digest must not mention plugin.jup.ag");
assert.ok(digestSrc.includes("Leftover /digest duplicate #dasha-digest section <style>"));
assert.ok(workerSrc.includes("Leftover /digest duplicate #dasha-digest section <style>"));
assert.match(digestSrc, /export function stripDigestLeftoverDupSectionCss/);
assert.match(workerSrc, /stripDigestLeftoverDupSectionCss\(/);
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

function innerDigestStyleCount(html) {
  return [...String(html).matchAll(/<section id=["']dasha-digest["']><style>/gi)].length;
}

const LIVE = digestPageHtml(DEFAULT.items, {});
assert.equal(innerDigestStyleCount(LIVE), 1, "fixture leftover inner #dasha-digest <style> paints");
assert.match(LIVE, /#dasha-digest\{margin:3\.25rem/, "fixture PAGE_CSS still has tape chrome rules");
assert.match(LIVE, /#dasha-digest\{margin:0;padding:0;border-top:0\}/, "fixture flush reset stays");
assert.equal((LIVE.match(/#dasha-digest\{margin:3\.25rem/g) || []).length, 2, "fixture duplicate tape chrome (head + inner)");

const gone = stripDigestLeftoverDupSectionCss(LIVE);
assert.equal(innerDigestStyleCount(gone), 0, "drops leftover inner #dasha-digest <style>");
assert.equal((gone.match(/#dasha-digest\{margin:3\.25rem/g) || []).length, 1, "PAGE_CSS tape chrome stays once");
assert.match(gone, /#dasha-digest\{margin:0;padding:0;border-top:0\}/, "flush reset stays");
assert.match(gone, /<section id="dasha-digest">/, "tape section stays");
assert.match(gone, /<h2>Tape\./, "Tape h2 stays");
assert.match(gone, /class="dd-src"/, ".dd-src stays");
assert.match(gone, /class="dd-row"/, ".dd-row stays");
assert.match(gone, /\$dasha Tape/, "title stays");
assert.match(gone, /class="bar"/, "bar stays");
assert.match(gone, /jup\.ag\/swap/, "jup.ag stays");
assert.match(gone, new RegExp(MINT), "mint stays");
assert.doesNotMatch(gone, /plugin\.jup\.ag/);
assert.ok(gone.length > LIVE.length * 0.7, "dup drop is per-style, not eat-the-page");

{
  const home = `<!doctype html><html><head></head><body>
<main id="dasha-home"><section id="chat-door"></section><section id="grwm"></section>
${digestSectionHtml(DEFAULT.items)}
</main></body></html>`;
  const out = stripDigestLeftoverDupSectionCss(home);
  assert.equal(innerDigestStyleCount(out), 1, "home keeps inner #dasha-digest <style>");
  assert.match(out, /id=["']chat-door["']/, "home chat-door stays");
  assert.match(out, /id=["']grwm["']/, "home GRWM stays");
}

{
  const lobby = `<!doctype html><html><head></head><body>
<div id="dasha-lobby"><button id="forum-play-go">Play</button><div id="dasha-forum"></div>
${digestSectionHtml(DEFAULT.items)}
</div></body></html>`;
  const out = stripDigestLeftoverDupSectionCss(lobby);
  assert.equal(innerDigestStyleCount(out), 1, "lobby keeps inner #dasha-digest <style>");
  assert.match(out, /id=["']forum-play-go["']/, "Play stays");
  assert.match(out, /id=["']dasha-forum["']/, "threads mount stays");
}

{
  const digest = await edgeWorker.fetch(new Request("https://www.getdasha.com/digest"), {});
  assert.equal(digest.status, 200);
  assert.equal(digest.headers.get("x-dasha-edge"), "digest");
  const html = await digest.text();
  assert.equal(innerDigestStyleCount(html), 0, "served /digest no leftover inner #dasha-digest <style>");
  assert.match(html, /#dasha-digest\{margin:3\.25rem/, "served PAGE_CSS tape chrome");
  assert.match(html, /#dasha-digest\{margin:0;padding:0;border-top:0\}/, "served flush reset");
  assert.equal((html.match(/#dasha-digest\{margin:3\.25rem/g) || []).length, 1, "served tape chrome once");
  assert.match(html, /<section id="dasha-digest">/, "served tape section");
  assert.match(html, /<h2>Tape\./, "served Tape h2");
  assert.match(html, /class="dd-src"/, "served .dd-src");
  assert.match(html, /class="dd-row"/, "served .dd-row");
  assert.match(html, /jup\.ag\/swap/, "served jup.ag");
  assert.match(html, new RegExp(MINT), "served mint");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "served digest no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const home = await edgeWorker.fetch(new Request("https://www.getdasha.com/"), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.equal(innerDigestStyleCount(html), 1, "served home keeps inner #dasha-digest <style>");
  assert.match(html, /id=["']dasha-digest-remount["']/, "served home remount stays");
  assert.match(html, /\/digest\.json/, "served remount still fetches /digest.json");
  assert.match(html, /id=["']chat-door["']/, "chat-door stays");
  assert.match(html, /id=["']simp-door["']/, "simp-door stays");
  assert.match(html, /id=["']grok-door["']/, "grok-door stays");
  assert.match(html, /id=["']grwm["']/, "GRWM stays");
  assert.match(html, /id=["']dasha-home-faucet["']/, "HOME_FAUCET_MOUNT stays");
  assert.match(html, /@view-transition/, "product @view-transition stays");
  assert.match(html, /johns-awesome/, "johns-awesome stays");
  assert.match(html, /data:image\/svg\+xml/, "cherries SVG stays");
  assert.match(html, /faucet\.js/, "faucet.js stays");
  assert.match(html, /x-connect\.js/, "x-connect.js stays");
  assert.match(html, /id=["']dasha-mobile-scroll["']/, "home mobile-scroll stays");
  assert.match(html, /#grwm \.grwm-phone/, "GRWM phone unlock stays");
  assert.match(html, /\.price,#price,\.ticker/, "Watch price/ticker belt stays");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "home no plugin.jup.ag");
  assert.doesNotMatch(html, /id=["']compute-door["']/, "no compute-door");
}

{
  const lobby = await edgeWorker.fetch(new Request("https://www.getdasha.com/lobby"), {});
  assert.equal(lobby.status, 200);
  const html = await lobby.text();
  assert.equal(innerDigestStyleCount(html), 1, "served lobby keeps inner #dasha-digest <style>");
  assert.match(html, /id=["']forum-play-go["']/, "Play stays");
  assert.match(html, /id=["']dasha-forum["']/, "threads mount stays");
  assert.match(html, /class=["']forum-play["']/, "class=forum-play stays");
  assert.match(html, /class=["']dasha-lobby["']|\.dasha-lobby\{/, ".dasha-lobby stays");
  assert.doesNotMatch(html, /id=["']dasha-digest-remount["']/, "lobby remount stays dropped");
  assert.doesNotMatch(html, /plugin\.jup\.ag/, "lobby no plugin.jup.ag");
}

{
  const forum = await edgeWorker.fetch(new Request("https://www.getdasha.com/forum"), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get("location"), "https://www.getdasha.com/lobby");
}

{
  const siwg = await edgeWorker.fetch(new Request("https://www.getdasha.com/siwg"), {});
  assert.equal(siwg.status, 308);
  assert.match(siwg.headers.get("location") || "", /\/login#grok/);
}

console.log("dasha-digest-dup-section-css-leftover: PASS (leftover /digest inner #dasha-digest <style> dropped; PAGE_CSS + home/lobby inner style stay)");
