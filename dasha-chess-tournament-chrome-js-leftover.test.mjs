#!/usr/bin/env node
/**
 * Leftover after chess unused tournament chrome CSS strip. Live /chess 200 still
 * serializes leftover unused JS className strings
 * 'tournament-meta' / 'tournament-actions' / 'entrants' / 'bracket' / 'champion'
 * inside renderTournament / renderChallenge after CSS drop.
 * Those classes never paint: static DOM has #tournament + .tournament-form only;
 * wantTournamentChrome() is false. Functions still run for the hidden form path
 * so they stay; leftover className cluster never paints. Humans see leftover
 * tournament className strings in view-source.
 * Distinct leftover vs leftover unused tournament chrome CSS / leftover unused JS casualRematch.
 * Keep #tournament + .tournament-form. Keep renderTournament() + renderChallenge().
 * Keep showCasualBar() + hidePlayPair(). Keep #gate-find + #gate-action.
 * Keep hideLecture() + watchingGame() + g.watch===true.
 * Disk still emits leftover (polish drops it). No Designer. Never plugin.jup.ag.
 * Do not restore leftover CSS rules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import edgeWorker, {
  polishServedSlim,
  stripChessLeftoverTournamentChromeJs,
} from "./dasha-lobby-worker.mjs";
import { CHESS_PAGE_HTML } from "./dasha-lobby-static-gen.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, "dasha-lobby-worker.mjs"), "utf8");
const chessDisk = readFileSync(join(root, "dasha-chess-page.html"), "utf8");
const MINT = "53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump";

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, "worker must not mention plugin.jup.ag");
assert.ok(
  workerSrc.includes("Leftover /chess unused JS tournament-meta / tournament-actions / entrants / bracket / champion className strings after CSS drop"),
);
assert.match(workerSrc, /export function stripChessLeftoverTournamentChromeJs/);
assert.match(workerSrc, /out = stripChessLeftoverTournamentChromeJs\(out\);/);
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

function noPaintedClass(html, name, label) {
  assert.doesNotMatch(
    afterStyleScript(html),
    new RegExp(`class=["'][^"']*\\b${name}\\b`),
    `${label} ${name} never in DOM`,
  );
}

function noLeftoverClassName(src, label) {
  assert.doesNotMatch(src, /,'tournament-meta'/, `${label} drops leftover 'tournament-meta' className`);
  assert.doesNotMatch(src, /'tournament-actions'/, `${label} drops leftover 'tournament-actions' className`);
  assert.doesNotMatch(src, /,null,'entrants'/, `${label} drops leftover 'entrants' className`);
  assert.doesNotMatch(src, /,null,'bracket'/, `${label} drops leftover 'bracket' className`);
  assert.doesNotMatch(src, /,'champion'/, `${label} drops leftover 'champion' className`);
}

function keepLiveChrome(src, label) {
  assert.match(src, /function renderTournament\(\)/, `${label} renderTournament stays`);
  assert.match(src, /function renderChallenge\(\)/, `${label} renderChallenge stays`);
  assert.match(src, /function wantTournamentChrome\(\)\{return false\}/, `${label} wantTournamentChrome stays false`);
  assert.match(src, /id=["']tournament["']/, `${label} #tournament stays`);
  assert.match(src, /class=["']tournament-form["']/, `${label} .tournament-form stays`);
  assert.match(src, /\.tournament-form\{/, `${label} .tournament-form CSS stays`);
  assert.match(src, /function showCasualBar\(\)/, `${label} showCasualBar stays`);
  assert.match(src, /function hidePlayPair\(\)/, `${label} hidePlayPair stays`);
  assert.match(src, /function hideLecture\(\)/, `${label} hideLecture stays`);
  assert.match(src, /id=["']gate-find["']/, `${label} #gate-find stays`);
  assert.match(src, /id=["']gate-action["']/, `${label} #gate-action stays`);
  assert.match(src, /function watchingGame\(g\)/, `${label} watchingGame stays`);
  assert.match(src, /g\.watch===true/, `${label} g.watch===true stays`);
  assert.match(src, /id=["']gate-invite["']/, `${label} #gate-invite stays`);
  assert.match(src, /textContent='Invite'/, `${label} Invite textContent stays`);
  assert.match(src, />Invite</, `${label} Invite button copy stays`);
  assert.match(src, /Play\. Invite\. Find\./, `${label} JSON-LD Play. Invite. Find. stays`);
  assert.match(src, /class=["']buy-dasha["']/, `${label} .buy-dasha stays`);
  assert.match(src, /id=["']chess-stage["']/, `${label} chess-stage stays`);
  assert.match(src, /id=["']buy-sheet["']/, `${label} buy sheet stays`);
  assert.match(src, /jup\.ag/, `${label} jup.ag stays`);
  assert.match(src, new RegExp(MINT), `${label} mint stays`);
  assert.match(src, /chess-local\.js/, `${label} chess-local stays`);
  assert.doesNotMatch(src, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
}
