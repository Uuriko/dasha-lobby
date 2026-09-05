#!/usr/bin/env node
/** /bag is the health page: mint-dead, freeze-dead, burned Raydium LP. Listed on llms. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { dropBagFromSlim, potterHome308Dest, potterHome308Response } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const LP = '8GDvsE3NbiKuo5uUFR9zgRY76mdhXuJfeDsy8hn7h3Aj';

assert.doesNotMatch(worker, /plugin\.jup\.ag/);
assert.doesNotMatch(worker, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);

function extractConst(name) {
  const m = worker.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(m, `${name} embedded`);
  return m[1];
}

const bag = extractConst('BAG_HTML');
assert.match(bag, /<title>\$dasha · hers<\/title>/);
assert.match(bag, /og:title" content="\$dasha · hers"/);
assert.match(bag, /og:description" content="Buy \$dasha\."/);
assert.match(bag, /twitter:title" content="\$dasha · hers"/);
assert.match(bag, /twitter:description" content="Buy \$dasha\."/);
assert.doesNotMatch(bag, /Match the full mint/);
assert.match(bag, /<h1>The bag<\/h1>/);
assert.match(bag, new RegExp(MINT));
assert.match(bag, new RegExp(PAIR));
assert.match(bag, new RegExp(LP));
assert.match(bag, /Mint-dead/);
assert.match(bag, /Freeze-dead/);
assert.match(bag, /Burned Raydium LP/);
assert.match(bag, /jup\.ag\/tokens\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
assert.doesNotMatch(bag, /plugin\.jup\.ag/);
assert.doesNotMatch(bag, /t\.me/);
assert.doesNotMatch(bag, /\bstake\b|\btax\b/i);
assert.doesNotMatch(bag, /disclaimer|not financial advice|NFA|dyor/i);
assert.doesNotMatch(bag, /rug-proof|rugproof|\block(ed)?\b|safe token/i);
assert.doesNotMatch(bag, /No outstanding LP claim/);
assert.doesNotMatch(bag, /supply 0 on 2026-08-18/);

const llms = extractConst('LLMS_TXT');
assert.ok(llms.includes('/bag'), 'llms.txt lists /bag');
assert.doesNotMatch(llms, /t\.me/);
const full = extractConst('LLMS_FULL_TXT');
assert.match(full, /^## The bag/m);
assert.match(full, /Mint-dead/);
assert.match(full, /Freeze-dead/);
assert.match(full, /Burned Raydium LP/);
assert.doesNotMatch(full, /mintAuthority|freezeAuthority/);
assert.doesNotMatch(full, /No new supply can be created/);
assert.doesNotMatch(full, /Holders can still burn/);
assert.doesNotMatch(full, /No outstanding LP claim/);
assert.doesNotMatch(full, /supply 0 on 2026-08-18/);
assert.match(full, /8GDvsE3NbiKuo5uUFR9zgRY76mdhXuJfeDsy8hn7h3Aj/);
assert.doesNotMatch(full, /t\.me/);

const robots = extractConst('ROBOTS_TXT');
assert.ok(robots.includes('/bag'));
const sitemap = extractConst('SITEMAP_XML');
assert.match(sitemap, /<loc>https:\/\/www\.getdasha\.com\/bag<\/loc><lastmod>2026-09-01<\/lastmod>/);

const kept = dropBagFromSlim('<a href="/bag">Bag</a> · <a href="https://www.getdasha.com/bag">Bag</a>');
assert.match(kept, /href="\/bag"/);
assert.match(kept, /href="https:\/\/www\.getdasha\.com\/bag"/);

for (const path of ['/studio', '/verse', '/learn', '/graph', '/index.html']) {
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, `${path} still 308`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/');
}
for (const path of ['/dasha', '/desk']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/how-to-buy');
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, `${path} 308`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/how-to-buy');
}
assert.equal(potterHome308Dest('/privacy'), null);
assert.equal(potterHome308Response(new Request('https://www.getdasha.com/privacy'), new URL('https://www.getdasha.com/privacy')), null);


for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const res = await edgeWorker.fetch(new Request(`${origin}/bag`), {});
  assert.equal(res.status, 200, `${origin}/bag`);
  assert.equal(res.headers.get('x-dasha-edge'), 'bag');
  const body = await res.text();
  assert.ok(body.includes(MINT));
  assert.ok(body.includes(PAIR));
  assert.match(body, /Mint-dead/);
  assert.match(body, /Freeze-dead/);
  assert.match(body, /Burned Raydium LP/);
  assert.match(body, /jup\.ag\/tokens\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
  assert.doesNotMatch(body, /plugin\.jup\.ag/);
  assert.doesNotMatch(body, /mintAuthority|freezeAuthority/);
  assert.doesNotMatch(body, /No new supply can be created/);
  assert.doesNotMatch(body, /No outstanding LP claim/);
  assert.doesNotMatch(body, /supply 0 on 2026-08-18/);
  assert.doesNotMatch(body, /t\.me/);
}

console.log('dasha-bag-leftover: PASS (/bag 200 health, llms lists /bag, links kept, dest-by-path 308s)');
