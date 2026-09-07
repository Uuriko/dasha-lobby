#!/usr/bin/env node
/**
 * Empty /bounties leftover: strip drops .cta CSS and its #ff3b81 shadow.
 * Restore Dasha hot pink (#ff3b81) on product skip-link so fleet hunt + humans
 * still see acid/hot-pink accent when inventory is empty. Funded .cta stays.
 * Bounties only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  restoreBountiesHotPinkAccent,
  stripBountiesDroppedCtaCss,
  bountiesHtml,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.ok(workerSrc.includes('export function restoreBountiesHotPinkAccent'));
assert.ok(workerSrc.includes('restoreBountiesHotPinkAccent(stripBountiesLeftoverCodeCss'));
assert.match(workerSrc, /box-shadow:4px 4px 0 #ff3b81/, 'hot pink shadow stays in source');

{
  const empty = bountiesHtml({ listings: [] });
  assert.match(empty, /\.cta\{/, 'disk still emits .cta CSS');
  assert.match(empty, /#ff3b81/, 'disk .cta carries #ff3b81');
  const stripped = stripBountiesDroppedCtaCss(empty);
  assert.doesNotMatch(stripped, /\.cta\s*\{/, 'empty polish drops leftover .cta');
  assert.doesNotMatch(stripped, /#ff3b81/, 'empty polish lost #ff3b81 with .cta');
  const restored = restoreBountiesHotPinkAccent(stripped);
  assert.match(restored, /#ff3b81/, 'restore puts #ff3b81 back');
  assert.match(restored, /\.skip-link\{[^}]*box-shadow:4px 4px 0 #ff3b81/, 'skip-link carries hot pink');
  assert.doesNotMatch(restored, /\.cta\s*\{/, 'restore does not revive leftover .cta CSS');
  assert.match(restored, /No funded bounties right now\./, 'empty copy stays');
  assert.match(restored, /class=["']skip-link["']/, 'skip-link stays');
  assert.match(restored, /id=["']bb-app["']/, 'bb-app stays');
  assert.match(restored, /id=["']bb-x["']/, 'bb-x stays');
}

{
  const fundedDisk = `<!doctype html><html><head>
<link rel="canonical" href="https://www.getdasha.com/bounties">
<style>a{color:#dfff00}.cta{display:inline-flex;box-shadow:4px 4px 0 #ff3b81}.skip-link{position:absolute}</style></head>
<body><a class="skip-link" href="#dasha-page">Skip</a><h1>Bounties</h1>
<section id="bb-app"><a class="cta" href="solana:x">Pay 1 USDC</a></section></body></html>`;
  const keep = restoreBountiesHotPinkAccent(stripBountiesDroppedCtaCss(fundedDisk));
  assert.match(keep, /\.cta\{/, 'funded .cta CSS stays');
  assert.equal((keep.match(/#ff3b81/gi) || []).length, 1, 'funded path does not double-inject pink');
}

{
  const privacy = `<!doctype html><html><head><style>.skip-link{position:absolute}</style></head>
<body><h1>Privacy</h1><a class="skip-link" href="#dasha-page">Skip</a></body></html>`;
  assert.equal(restoreBountiesHotPinkAccent(privacy), privacy, 'privacy untouched');
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/bounties'), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'bounties');
  const html = await res.text();
  assert.match(html, /#ff3b81/, 'served /bounties HTML contains #ff3b81');
  assert.match(html, /class=["']skip-link["']/, 'served skip-link stays');
  assert.match(html, /No funded bounties right now\.|class=["'][^"']*\bcta\b/, 'empty or funded inventory');
  const visible = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  if (!/class=["'][^"']*\bcta\b/.test(visible)) {
    assert.doesNotMatch(html, /\.cta\s*\{/, 'served empty still drops leftover .cta CSS');
    assert.match(html, /\.skip-link\{[^}]*box-shadow:4px 4px 0 #ff3b81/, 'served empty skip-link has hot pink');
  }
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const which = await edgeWorker.fetch(new Request('https://www.getdasha.com/which'), {});
  assert.equal(which.status, 200);
  assert.match(await which.text(), /VVAIFU/, '/which stays');
}

console.log('dasha-bounties-hot-pink-accent: PASS (#ff3b81 on empty /bounties skip-link; leftover .cta stays dropped)');
