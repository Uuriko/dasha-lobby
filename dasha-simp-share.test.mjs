#!/usr/bin/env node
/** Simp challenge share cards: unique OG + 308 challenge redirect. */
import assert from 'node:assert/strict';
import edgeWorker from './dasha-lobby-worker.mjs';
import { simpBoardOgPng, simpQuizOgPng, SIMP_OG_WIDTH, SIMP_OG_HEIGHT } from './dasha-handoff-og.mjs';
import {
  LIVE_SIMP_BOARD_SRI,
  challengeRedirectPath,
  simpPageHtml,
  simpResultHtml,
  simpShareTitle,
} from './dasha-simp-share-html.mjs';

const ID = 'abc123xyz';
assert.equal(challengeRedirectPath('?challenge=abc123xyz'), '/simp/r/abc123xyz');
assert.equal(challengeRedirectPath(new URLSearchParams('challenge=abc123xyz')), '/simp/r/abc123xyz');
assert.equal(challengeRedirectPath('?challenge=nope'), null);

assert.equal(simpShareTitle({ title: 'Confirmed simp', correct: 16, total: 19 }), 'Beat my Simp — 16/19');

const page = simpPageHtml();
assert.match(page, /property="og:title" content="\$dasha \/ Beat this"/);
assert.match(page, /property="og:description" content="How big of a Dasha simp are you\?"/);
assert.match(page, /property="og:image" content="https:\/\/www\.getdasha\.com\/og\/simp"/);
assert.match(page, /name="twitter:card" content="summary_large_image"/);
assert.match(page, new RegExp(LIVE_SIMP_BOARD_SRI.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const html = simpResultHtml({ id: ID, title: 'Confirmed simp', correct: 16, total: 19 });
assert.match(html, /property="og:title" content="Beat my Simp — 16\/19"/);
assert.match(html, /<title>Beat my Simp — 16\/19<\/title>/);
assert.match(html, /property="og:image" content="https:\/\/www\.getdasha\.com\/og\/simp\/abc123xyz"/);
assert.match(html, /property="og:image:width" content="1200"/);
assert.match(html, /property="og:image:height" content="630"/);
assert.match(html, /name="twitter:card" content="summary_large_image"/);
assert.match(html, /data-url="https:\/\/www\.getdasha\.com\/simp\/r\/abc123xyz"/);
assert.doesNotMatch(html, /wallet|So11111111111111111111111111111111111111112/i);
assert.match(html, new RegExp(LIVE_SIMP_BOARD_SRI.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

const other = simpResultHtml({ id: 'other9id', title: 'Dasha curious', correct: 3, total: 19 });
assert.match(other, /Beat my Simp — 3\/19/);
assert.doesNotMatch(other, /Beat my Simp — 16\/19/);
assert.match(other, /og\/simp\/other9id/);

function pngSize(bytes) {
  const buf = Buffer.from(bytes);
  assert.equal(buf.subarray(1, 4).toString(), 'PNG');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

const boardPng = await simpBoardOgPng();
assert.deepEqual(pngSize(boardPng), [SIMP_OG_WIDTH, SIMP_OG_HEIGHT]);
const resultPng = await simpQuizOgPng({ title: 'Confirmed simp', correct: 16, total: 19 });
assert.deepEqual(pngSize(resultPng), [1200, 630]);

const challenge = await edgeWorker.fetch(new Request('https://www.getdasha.com/?challenge=abc123xyz'), {});
assert.equal(challenge.status, 308);
assert.equal(challenge.headers.get('location'), 'https://www.getdasha.com/simp/r/abc123xyz');

const simpChallenge = await edgeWorker.fetch(new Request('https://www.getdasha.com/simp?challenge=abc123xyz'), {});
assert.equal(simpChallenge.status, 308);
assert.equal(simpChallenge.headers.get('location'), 'https://www.getdasha.com/simp/r/abc123xyz');

const og = await edgeWorker.fetch(new Request('https://www.getdasha.com/og/simp'), {});
assert.equal(og.status, 200);
assert.match(og.headers.get('content-type') || '', /image\/png/);
assert.deepEqual(pngSize(new Uint8Array(await og.arrayBuffer())), [1200, 630]);

const simp = await edgeWorker.fetch(new Request('https://www.getdasha.com/simp'), {});
assert.equal(simp.status, 200);
const simpHtml = await simp.text();
assert.match(simpHtml, /property="og:image" content="https:\/\/www\.getdasha\.com\/og\/simp"/);
assert.match(simpHtml, /property="og:title" content="\$dasha \/ Beat this"/);

console.log('dasha-simp-share: PASS (unique OG + 308 challenge + generated 1200x630 PNG)');
