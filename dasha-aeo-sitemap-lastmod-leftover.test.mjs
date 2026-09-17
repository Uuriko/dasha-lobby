#!/usr/bin/env node
/**
 * AEO discovery leftover: refresh sitemap lastmod for crawlable
 * Compute/identity faces. Link headers for /llms.txt are already live
 * on home/which/compute — do not re-add. Do not invent sitemap URLs.
 * robots already Allows llms files. No IndexNow helper in-tree. No
 * /verse /learn. No plugin.jup.ag. No new Telegram.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { SITEMAP_XML as GEN_SITEMAP, ROBOTS_TXT as GEN_ROBOTS } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const diskSitemap = readFileSync(join(root, 'dasha-sitemap.xml'), 'utf8');
const diskRobots = readFileSync(join(root, 'dasha-robots.txt'), 'utf8');
const sitemap = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
const robots = workerSrc.match(/const ROBOTS_TXT = `([\s\S]*?)`;/)[1];

assert.equal(sitemap.trim(), GEN_SITEMAP.trim(), 'worker and static-gen sitemaps agree');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(workerSrc, /indexnow/i, 'do not invent IndexNow');
assert.doesNotMatch(sitemap + diskSitemap, /indexnow/i, 'sitemap must not mention IndexNow');

const BUMPED = [
  '/',
  '/which',
  '/llms.txt',
  '/llms-full.txt',
  '/compute',
  '/how-to-buy',
  '/ai.txt',
];
for (const path of BUMPED) {
  const loc = `https://www.getdasha.com${path === '/' ? '/' : path}`;
  const needle = `<loc>${loc}</loc><lastmod>2026-09-16</lastmod>`;
  assert.ok(sitemap.includes(needle), `worker lastmod 2026-09-16 for ${path}`);
  assert.ok(diskSitemap.includes(needle), `disk lastmod 2026-09-16 for ${path}`);
}

assert.doesNotMatch(sitemap, /<loc>https:\/\/www\.getdasha\.com\/compute\/skill\.md<\/loc>/);
assert.doesNotMatch(sitemap, /<loc>https:\/\/www\.getdasha\.com\/compute\/llms\.txt<\/loc>/);
assert.doesNotMatch(diskSitemap, /<loc>https:\/\/www\.getdasha\.com\/compute\/skill\.md<\/loc>/);
assert.doesNotMatch(diskSitemap, /<loc>https:\/\/www\.getdasha\.com\/compute\/llms\.txt<\/loc>/);

for (const path of ['/verse', '/learn', '/studio', '/dasha', '/desk', '/graph', '/dancer']) {
  assert.ok(!sitemap.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits ${path}`);
  assert.ok(!diskSitemap.includes(`https://www.getdasha.com${path}</loc>`), `disk sitemap omits ${path}`);
}

assert.match(robots, /^Allow:\s*\/llms\.txt\s*$/m, 'robots already Allows /llms.txt');
assert.match(robots, /^Allow:\s*\/llms-full\.txt\s*$/m, 'robots already Allows /llms-full.txt');
assert.match(GEN_ROBOTS, /^Allow:\s*\/llms\.txt\s*$/m);
assert.match(diskRobots, /^Allow:\s*\/llms\.txt\s*$/m);
assert.ok(!/^Allow:\s*\/verse\s*$/m.test(robots));
assert.ok(!/^Allow:\s*\/learn\s*$/m.test(robots));
assert.ok(!/^Allow:\s*\/verse\s*$/m.test(diskRobots));
assert.ok(!/^Allow:\s*\/learn\s*$/m.test(diskRobots));

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const map = await edgeWorker.fetch(new Request(`${origin}/sitemap.xml`), {});
  assert.equal(map.status, 200, `${origin}/sitemap.xml`);
  const body = await map.text();
  for (const path of BUMPED) {
    const loc = `https://www.getdasha.com${path === '/' ? '/' : path}`;
    assert.ok(
      body.includes(`<loc>${loc}</loc><lastmod>2026-09-16</lastmod>`),
      `${origin} sitemap lastmod 2026-09-16 for ${path}`,
    );
  }
  assert.doesNotMatch(body, /<loc>https:\/\/www\.getdasha\.com\/compute\/skill\.md<\/loc>/);
  assert.doesNotMatch(body, /<loc>https:\/\/www\.getdasha\.com\/compute\/llms\.txt<\/loc>/);
  assert.doesNotMatch(body, /plugin\.jup\.ag/);
  assert.doesNotMatch(body, /t\.me/);
}

assert.match(workerSrc, /const LLMS_DESCRIBEDBY = '<\/llms\.txt>; rel="describedby"/, 'HTTP Link already live — do not re-add');
assert.match(workerSrc, /if \(isHome\) html = attachLlmsHtmlLinks\(html\)/, 'home already attaches llms describedby');

async function assertExistingLlmsLink(path) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 200, `${path} 200`);
  assert.match(res.headers.get('link') || '', /<\/llms\.txt>\s*;\s*rel="describedby"/, `${path} already has Link /llms.txt`);
}

await assertExistingLlmsLink('/which');
await assertExistingLlmsLink('/compute');

console.log('dasha-aeo-sitemap-lastmod-leftover: PASS (lastmod 2026-09-16 for / /which /llms.txt /llms-full.txt /compute /how-to-buy /ai.txt; no invented skill/llms URLs; Link headers already present; robots llms Allow left alone; no IndexNow)');
