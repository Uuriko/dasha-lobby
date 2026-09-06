#!/usr/bin/env node
/**
 * Live home first-paint has Lobby + Simp + Buy, but no /which and no Telegram.
 * Traders never reach dash_eats vs VVAIFU from the door stack; the one group is missing.
 * Disk only. No Designer. Never plugin.jup.ag. Official TG only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orderHomeLongPage } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /id=["']which-door["']/, 'HOME_WHICH_DOOR in worker');
assert.match(workerSrc, /https:\/\/t\.me\/\+xB7S8mIQaKFiZjRh/, 'official TG only');

const fixture = `<!doctype html><html lang="en"><head><title>$dasha</title></head>
<body>
<header id="content" class="dasha-hero"><a class="word" href="/">$<b>dasha</b></a></header>
<main id="dasha-home">
<p id="dasha-home-lede" class="dasha-home-lede">dash_eats culture. Match the mint.</p>
<section id="chat-door"><h2>Chat.</h2></section>
</main>
</body></html>`;

const out = orderHomeLongPage(fixture);
assert.match(out, /id=["']which-door["']/, 'which-door remounts');
assert.match(out, /href="\/which"/, '/which door');
assert.match(out, /id=["']tg-door["']/, 'tg-door remounts');
assert.match(out, /https:\/\/t\.me\/\+xB7S8mIQaKFiZjRh/, 'official TG href');
assert.match(out, /id=["']chat-door["']/, 'chat-door stays');
assert.match(out, /id=["']simp-door["']/, 'simp-door stays');
assert.doesNotMatch(out, /plugin\.jup\.ag/);
assert.ok(
  out.indexOf('id="which-door"') < out.indexOf('id="simp-door"'),
  'which-door before simp-door',
);

console.log('dasha-home-which-tg-doors: PASS');
