#!/usr/bin/env node
/** Shareable /bag?mint= — OG for Slack/X, hers Jupiter Buy, Copy link. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { HERS_BUY, HERS_MINT, OTHER_MINT } from './dasha-bag-record.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const recordSrc = readFileSync(join(root, 'dasha-bag-record.mjs'), 'utf8');

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(recordSrc, /plugin\.jup\.ag/);
assert.doesNotMatch(workerSrc, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);
assert.doesNotMatch(recordSrc, /t\.me\//);

const boom = async () => {
  throw new Error('ansem must not be called');
};

{
  const res = await edgeWorker.fetch(
    new Request(`https://www.getdasha.com/bag?mint=${HERS_MINT}`),
    { fetch: boom },
  );
  assert.equal(res.status, 200, 'hers share 200');
  assert.equal(res.headers.get('x-dasha-edge'), 'bag');
  const html = await res.text();
  assert.match(html, new RegExp(`og:url" content="https://www.getdasha.com/bag\\?mint=${HERS_MINT}"`));
  assert.match(html, new RegExp(`rel="canonical" href="https://www.getdasha.com/bag\\?mint=${HERS_MINT}"`));
  assert.match(html, /<title>\$dasha · hers<\/title>/);
  assert.match(html, /og:title" content="\$dasha · hers"/);
  assert.match(html, /dash_eats\. Mint-dead\. Freeze-dead\. Burned Raydium LP\./);
  assert.match(html, new RegExp(`jup\\.ag/tokens/${HERS_MINT}`));
  assert.match(html, /<p>Hers\.<\/p>/);
  assert.match(html, /Copy link/);
  assert.match(html, /data-painted="1"/);
  assert.match(html, new RegExp(`value="${HERS_MINT}"`));
  assert.match(html, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(html, /t\.me\//);
}

{
  const res = await edgeWorker.fetch(
    new Request(`https://www.getdasha.com/bag?mint=${OTHER_MINT}`),
    { fetch: boom },
  );
  assert.equal(res.status, 200, 'VVAIFU share 200');
  const html = await res.text();
  assert.match(html, /<title>Not this \$dasha<\/title>/);
  assert.match(html, /VVAIFU\. Not this\./);
  assert.match(html, /href="\/which"/);
  assert.doesNotMatch(html, new RegExp(`jup\\.ag/tokens/${OTHER_MINT}`));
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  assert.doesNotMatch(html, /Buy \$dasha/);
}

{
  const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/bag'), { fetch: boom });
  assert.equal(res.status, 200, 'default bag 200');
  const html = await res.text();
  assert.match(html, /<title>\$dasha · hers<\/title>/);
  assert.match(html, /og:title" content="\$dasha · hers"/);
  assert.match(html, /og:description" content="Buy \$dasha\."/);
  assert.match(html, /twitter:title" content="\$dasha · hers"/);
  assert.match(html, /twitter:description" content="Buy \$dasha\."/);
  assert.match(html, /og:url" content="https:\/\/www\.getdasha\.com\/bag"/);
  assert.doesNotMatch(html, /Match the full mint/);
  assert.match(html, /Mint-dead/);
  assert.match(html, /id="out" hidden/);
  const paint = html.split('id="record"')[0] || html;
  assert.doesNotMatch(paint, /VVAIFU/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

{
  const res = await edgeWorker.fetch(
    new Request(`https://www.getdasha.com/bag?mint=${HERS_MINT}`, { method: 'HEAD' }),
    { fetch: boom },
  );
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');
}

console.log('dasha-bag-share: PASS (hers OG + jup tokens, VVAIFU /which no Buy, default token-card OG)');
