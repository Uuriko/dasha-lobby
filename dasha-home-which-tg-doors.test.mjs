#!/usr/bin/env node
/**
 * Live home first-paint (verified 2026-09-07 against www.getdasha.com): chat, simp,
 * faucet, grwm, grok, list, bag doors only. The /which and Telegram doors are
 * retired from the home stack - orderHomeLongPage no longer cuts or remounts them,
 * and HOME_WHICH_DOOR / HOME_TG_DOOR are deleted from the worker. /tg still 308s
 * to the official TG via potterHome308Dest. Disk only. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orderHomeLongPage } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(workerSrc, /HOME_WHICH_DOOR/, 'HOME_WHICH_DOOR retired');
assert.doesNotMatch(workerSrc, /HOME_TG_DOOR/, 'HOME_TG_DOOR retired');
assert.match(workerSrc, /https:\/\/t\.me\/\+xB7S8mIQaKFiZjRh/, 'official TG only (via /tg 308)');

const fixture = `<!doctype html><html lang="en"><head><title>$dasha</title></head>
<body>
<header id="content" class="dasha-hero"><a class="word" href="/">$<b>dasha</b></a></header>
<main id="dasha-home">
<p id="dasha-home-lede" class="dasha-home-lede">dash_eats culture. Match the mint.</p>
<section id="chat-door"><h2>Chat.</h2></section>
</main>
</body></html>`;

const out = orderHomeLongPage(fixture);
assert.match(out, /id=["']chat-door["']/, 'chat-door stays');
assert.match(out, /id=["']simp-door["']/, 'simp-door stays');
assert.match(out, /id=["']list-door["']/, 'list-door stays');
assert.doesNotMatch(out, /id=["']which-door["']/, 'no which-door remount');
assert.doesNotMatch(out, /id=["']tg-door["']/, 'no tg-door remount');
assert.doesNotMatch(out, /plugin\.jup\.ag/);
