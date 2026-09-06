#!/usr/bin/env node
/**
 * Regression: live /chess served an inline app script that failed to parse —
 * `return /^/chess/(challenge|queue|tournament)/.test(path)` in chessApiError()
 * ends the regex at the second `/`, so `chess` is read as regex flags and the
 * whole <script> dies with "SyntaxError: Invalid regular expression flags".
 * Result in every browser: board stays data-readonly="true" (all 64 squares
 * aria-disabled), PLAY/INVITE/FIND listeners never attach, no /chess/me fetch.
 * Found via L4 browser walk + live console (cloud browser, 2026-09-05).
 *
 * This test parses every inline <script> in the chess disk source, the bundled
 * CHESS_PAGE_HTML, and the worker-served /chess HTML so no inline script on the
 * page can ship an unparseable body again. JSON-LD blocks are parsed as JSON.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { CHESS_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const chessDisk = readFileSync(join(root, 'dasha-chess-page.html'), 'utf8');

function inlineScripts(html, label) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  let i = 0;
  const out = [];
  while ((m = re.exec(html))) {
    i += 1;
    const attrs = m[1] || '';
    const body = m[2] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (!body.trim()) continue;
    if (/application\/ld\+json/.test(attrs)) {
      assert.doesNotThrow(() => JSON.parse(body), `${label} script #${i} JSON-LD parses`);
      continue;
    }
    out.push({ i, body });
  }
  assert.ok(out.length > 0, `${label} carries at least one inline app script`);
  return out.map(({ i, body }) => ({ label: `${label} script #${i}`, body }));
}

function assertParses({ label, body }) {
  assert.doesNotThrow(() => new Function(body), `${label} parses (no SyntaxError)`);
}

const diskScripts = inlineScripts(chessDisk, 'chess disk');
const bundledScripts = inlineScripts(CHESS_PAGE_HTML, 'bundled chess');
for (const s of [...diskScripts, ...bundledScripts]) assertParses(s);

assert.match(
  chessDisk,
  /return \/\^\\\/chess\\\/\(challenge\|queue\|tournament\)\//,
  'chessApiError regex escapes the /chess/ path slashes',
);
assert.match(
  CHESS_PAGE_HTML,
  /return \/\^\\\/chess\\\/\(challenge\|queue\|tournament\)\//,
  'bundled chessApiError regex escapes the /chess/ path slashes',
);

{
  const chess = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess'), {});
  assert.equal(chess.status, 200);
  assert.equal(chess.headers.get('x-dasha-edge'), 'chess');
  const html = await chess.text();
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  const servedScripts = inlineScripts(html, 'served chess');
  for (const s of servedScripts) assertParses(s);
  assert.match(
    html,
    /return \/\^\\\/chess\\\/\(challenge\|queue\|tournament\)\//,
    'served chessApiError regex escapes the /chess/ path slashes',
  );
}

console.log('dasha-chess-inline-script-parse.test.mjs: ok');
