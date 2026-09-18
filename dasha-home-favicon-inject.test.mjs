#!/usr/bin/env node
/** Proxied pages get a favicon link when the head has none (home strips the
 * default Webflow favicon). Idempotent: keeps an existing rel=icon. */
import assert from 'node:assert/strict';
import { ensureFavicon } from './dasha-lobby-worker.mjs';

const bare = ensureFavicon('<html><head><title>t</title></head><body></body></html>');
assert.match(bare, /<link rel="icon" type="image\/png" href="\/favicon\.ico">/, 'icon injected');
assert.equal(bare.indexOf('favicon.ico'), bare.lastIndexOf('favicon.ico'), 'single injection');

const kept = ensureFavicon('<html><head><link rel="icon" href="https://example.com/i.png"></head></html>');
assert.ok(!kept.includes('/favicon.ico'), 'existing icon kept');

const keptShortcut = ensureFavicon('<html><head><link rel="shortcut icon" href="/i.ico"></head></html>');
assert.ok(!keptShortcut.includes('/favicon.ico'), 'shortcut icon kept');

const noHead = ensureFavicon('<p>hi</p>');
assert.ok(noHead.startsWith('<link rel="icon"'), 'prepends without head');

console.log('dasha-home-favicon-inject: PASS');
