#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forumSitemapXml } from './dasha-lobby-worker.mjs';
import { SITEMAP_XML as GEN_SITEMAP, ROBOTS_TXT as GEN_ROBOTS } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const sitemap = worker.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
const robots = worker.match(/const ROBOTS_TXT = `([\s\S]*?)`;/)[1];

assert.equal(sitemap.trim(), GEN_SITEMAP.trim(), 'worker and static-gen sitemaps agree');
assert.match(robots, /^Allow:\s*\/forum\s*$/m);
assert.match(robots, /^Allow:\s*\/bag\s*$/m);
assert.match(robots, /^Allow:\s*\/listings\s*$/m);
assert.match(robots, /^Allow:\s*\/listings\.json\s*$/m);
assert.ok(!/^Allow:\s*\/dasha\s*$/m.test(robots));
assert.ok(!/^Allow:\s*\/studio\s*$/m.test(robots));

for (const path of ['/forum', '/privacy', '/bag', '/which', '/listings', '/listings.json', '/crew', '/digest', '/compute', '/contribute', '/bounties']) {
  assert.ok(sitemap.includes(`https://www.getdasha.com${path}</loc>`), `sitemap has ${path}`);
}
assert.match(sitemap, /https:\/\/www\.getdasha\.com\/<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemap, /https:\/\/www\.getdasha\.com\/which<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemap, /https:\/\/www\.getdasha\.com\/crew<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemap, /https:\/\/www\.getdasha\.com\/digest<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemap, /https:\/\/www\.getdasha\.com\/compute<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemap, /https:\/\/www\.getdasha\.com\/contribute<\/loc><lastmod>2026-09-01<\/lastmod>/);
for (const path of ['/studio', '/dasha', '/desk', '/login', '/grok', '/siwg', '/verse', '/learn', '/graph', '/index.html', '/compute/night', '/compute/use', '/compute/provide', '/compute/build', '/compute/sponsor']) {
  assert.ok(!sitemap.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits ${path}`);
}
assert.doesNotMatch(sitemap, /lobby\?/);

const injected = forumSitemapXml(sitemap, [{ id: 'abc123', title: 'nope', lastTs: Date.now() }]);
assert.doesNotMatch(injected, /\?t=/);
assert.doesNotMatch(injected, /lobby\?/);
assert.ok(injected.includes('https://www.getdasha.com/forum</loc>'));

console.log('dasha-sitemap: PASS (no lobby?t=, has /forum /privacy /bag /which /listings /crew /digest /compute /contribute /bounties, no /studio /login)');
