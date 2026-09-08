#!/usr/bin/env node
/** Task 25: /benchmarks live benchmark page - route, generated page parity, honesty framing. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BENCHMARKS_PAGE_HTML } from './dasha-benchmarks-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, 'benchmarks-page-src/page.html'), 'utf8');
assert.equal(BENCHMARKS_PAGE_HTML, src, 'generated page matches benchmarks-page-src/page.html (run node benchmarks-page-src/gen.mjs)');

assert.match(BENCHMARKS_PAGE_HTML, /Measured on a real Mac\./, 'honesty framing headline');
assert.match(BENCHMARKS_PAGE_HTML, /\/compute\/api\/network/, 'reads the live network API');
assert.match(BENCHMARKS_PAGE_HTML, /no measured providers online right now/, 'honest empty state');
assert.match(BENCHMARKS_PAGE_HTML, /tokens_per_second/, 'renders measured tok/s');
assert.match(BENCHMARKS_PAGE_HTML, /measured_providers/, 'shows measured-provider counts');
assert.doesNotMatch(BENCHMARKS_PAGE_HTML, /\d+\s*tok\/s<\/td>/, 'no hardcoded tok/s numbers in markup');
assert.match(BENCHMARKS_PAGE_HTML, /canonical" href="https:\/\/www\.getdasha\.com\/benchmarks"/);

const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.match(worker, /import \{ BENCHMARKS_PAGE_HTML \} from '\.\/dasha-benchmarks-page\.mjs';/);
assert.equal((worker.match(/isBenchmarksPath\(url\.pathname\)/g) || []).length, 3, 'route wired beside kit.json on every host branch');
const sitemap = worker.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemap, /https:\/\/www\.getdasha\.com\/benchmarks<\/loc>/, 'sitemap lists /benchmarks');
assert.ok(!sitemap.includes('https://www.getdasha.com/benchmark</loc>'), 'locked singular stays out of sitemap');

const routes = readFileSync(join(root, 'ROUTES.md'), 'utf8');
assert.match(routes, /\| `\/benchmarks` \| 200 \|/, 'ROUTES.md records the new live route');

console.log('dasha-benchmarks-page: PASS');
