#!/usr/bin/env node
/**
 * Muse home pill is nowrap inside overflow-x:hidden. At 390 the Start tab and
 * the orbit "request" label clip. Fit only pages that actually paint .muse-pill.
 */
import assert from "node:assert/strict";
import { fitHomeMuseChrome } from "./dasha-lobby-worker.mjs";

const home = `<!doctype html><html><head></head><body>
<nav class="muse-pill" aria-label="Main"><a href="/">Home</a><a class="muse-start" href="/start">Start</a></nav>
<div class="muse-diagram"><span class="muse-flow req">request →</span></div>
</body></html>`;

const fitted = fitHomeMuseChrome(home);
assert.match(fitted, /id=["']dasha-home-muse-fit["']/);
assert.match(fitted, /\.muse-pill\{max-width:100%;flex-wrap:wrap/);
assert.match(fitted, /\.muse-flow\.req\{right:8px\}/);
assert.equal(fitted.match(/dasha-home-muse-fit/g).length, 1, "one fit style");

const again = fitHomeMuseChrome(fitted);
assert.equal(again.match(/dasha-home-muse-fit/g).length, 1, "replace, do not stack");

const other = fitHomeMuseChrome("<!doctype html><html><head></head><body><p>lobby</p></body></html>");
assert.doesNotMatch(other, /dasha-home-muse-fit/);

console.log("dasha-home-muse-fit: PASS");
