#!/usr/bin/env node
/**
 * Leftover 2026-09-01: live /bounties 200 injects x-connect.js only.
 * Site-hunt X-connect needs oauth/x or id=bb-x / #bb-x. GitHub is already
 * required via github.com. Quiet optional Connect X. No disclaimer lecture.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { bountiesHtml } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const SITE_HUNT_X = /oauth\/x|id=["']bb-x/;

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /id="bb-x" href="\/oauth\/x\/start\?continue=1"/, 'bountiesHtml ships #bb-x');

function afterStyleScript(src) {
  return String(src)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

{
  const empty = bountiesHtml({ listings: [] });
  const visible = afterStyleScript(empty);
  assert.match(visible, SITE_HUNT_X, 'empty bountiesHtml matches site-hunt X-connect');
  assert.match(visible, /id=["']bb-x["']/, 'empty bountiesHtml has #bb-x');
  assert.match(visible, /href=["']\/oauth\/x\/start\?continue=1["']/, 'empty bountiesHtml Continue X href');
  assert.match(visible, />Connect X</, 'empty bountiesHtml Connect X copy');
  assert.match(visible, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'GitHub contribute stays');
  assert.match(visible, /id=["']bb-app["']/, 'bb-app stays');
  assert.match(visible, /No funded bounties right now\./, 'empty inventory stays');
  assert.doesNotMatch(visible, /not required|does not post|neither is required|not an airdrop/i, 'no disclaimer lecture');
  assert.doesNotMatch(visible, /plugin\.jup\.ag/);
}

{
  const funded = bountiesHtml({
    listings: [{
      kind: 'item',
      name: 'Ship leftover',
      amount: '10',
      repo: 'Uuriko/dasha-desk',
      payTo: 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb',
      itemUrl: 'https://github.com/Uuriko/dasha-desk/issues/45',
    }],
  });
  const visible = afterStyleScript(funded);
  assert.match(visible, SITE_HUNT_X, 'funded bountiesHtml matches site-hunt X-connect');
  assert.match(visible, /id=["']bb-x["']/, 'funded bountiesHtml has #bb-x');
  assert.match(visible, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'GitHub contribute stays on funded');
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/bounties'), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-dasha-edge'), 'bounties');
  const html = await res.text();
  const visible = afterStyleScript(html);
  assert.match(html, SITE_HUNT_X, 'served /bounties matches site-hunt X-connect (oauth/x or id=bb-x)');
  assert.match(visible, SITE_HUNT_X, 'X-connect is in the visible DOM, not only x-connect.js');
  assert.match(visible, /id=["']bb-x["']/);
  assert.match(visible, /href=["']\/oauth\/x\/start\?continue=1["']/);
  assert.match(visible, />Connect X</);
  assert.match(visible, /github\.com\/Uuriko\/dasha-desk\/contribute/, 'GitHub required stays');
  assert.match(html, /client\/x-connect\.js/, 'x-connect.js inject may stay');
  assert.match(html, /<h1>Bounties<\/h1>/);
  assert.match(html, /id=["']bb-app["']/);
  assert.match(html, /class=["']skip-link["']/, 'skip-link stays');
  assert.match(html, /USDC on Solana\. We don.t hold it\./);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(visible, /not required|does not post|neither is required|not an airdrop/i);
}

{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.match(html, /\$dasha/);
  assert.match(html, /Chat/);
  assert.match(html, /Buy/);
  assert.match(html, new RegExp(MINT));
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
  assert.equal(studio.status, 308);
  assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');
}

console.log('dasha-bounties-x-connect-leftover: PASS (site-hunt X-connect via #bb-x; GitHub stays; no lecture)');
