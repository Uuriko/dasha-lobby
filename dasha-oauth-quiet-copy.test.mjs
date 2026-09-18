#!/usr/bin/env node
/**
 * OAuth failure copy stays quiet: no backend details leak to the browser.
 *
 * - /oauth/google/start when unconfigured: quiet recovery copy, no env var names.
 * - /oauth/google/callback and /oauth/github/callback failures: generic copy,
 *   never echoing error.message (which can carry backend detail).
 *
 * Disk only. No wrangler. No Designer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

// Source-level: OAuth handlers must not echo raw error messages.
assert.doesNotMatch(
  workerSrc,
  /Could not sign in with Google<\/h1><p>\$\{/,
  'google callback failure copy does not echo error.message',
);
assert.doesNotMatch(
  workerSrc,
  /Could not link GitHub<\/h1><p>\$\{/,
  'github callback failure copy does not echo error.message',
);
assert.match(workerSrc, /Something went wrong on our side\. Please try again\./, 'generic failure copy present');
assert.doesNotMatch(
  workerSrc,
  /Google sign-in not configured<\/h1><p>[^]*GOOGLE_CLIENT_ID/,
  'unconfigured google page does not name env vars',
);

// Live-handler: unconfigured Google start is a quiet 503.
{
  const res = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/oauth/google/start'), {});
  assert.equal(res.status, 503, 'unconfigured google start 503');
  const html = await res.text();
  assert.match(html, /Google sign-in is not on yet/, 'quiet unconfigured copy');
  assert.doesNotMatch(html, /GOOGLE_CLIENT_ID/, 'no env var names');
  assert.doesNotMatch(html, /GOOGLE_CLIENT_SECRET/, 'no env var names');
  assert.doesNotMatch(html, /LOBBY_SESSION_SECRET/, 'no env var names');
}

// Live-handler: unconfigured callbacks stay quiet.
{
  const cb = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/oauth/google/callback?code=x&state=y'), {});
  assert.equal(cb.status, 503, 'unconfigured google callback 503');
  assert.doesNotMatch(await cb.text(), /GOOGLE_CLIENT_ID/, 'no env var names');

  const gh = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/oauth/github/callback?code=x&state=y'), {});
  assert.equal(gh.status, 503, 'unconfigured github callback 503');
  const ghHtml = await gh.text();
  assert.match(ghHtml, /not configured/, 'quiet github unconfigured copy');
  assert.doesNotMatch(ghHtml, /GITHUB_CLIENT/, 'no env var names');
}

console.log('dasha-oauth-quiet-copy: PASS (unconfigured pages quiet, failure copy generic)');
