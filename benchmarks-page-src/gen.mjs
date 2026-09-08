#!/usr/bin/env node
/** Generates ../dasha-benchmarks-page.mjs (BENCHMARKS_PAGE_HTML) from page.html.
 *  Run: node benchmarks-page-src/gen.mjs  (no deps - plain fetch page, no bundle step) */
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('./page.html', import.meta.url), 'utf8');
const out = `export const BENCHMARKS_PAGE_HTML = ${JSON.stringify(html)};\n`;
writeFileSync(new URL('../dasha-benchmarks-page.mjs', import.meta.url), out);
console.log(`wrote dasha-benchmarks-page.mjs ${out.length} bytes`);
