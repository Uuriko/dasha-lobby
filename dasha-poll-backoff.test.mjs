#!/usr/bin/env node
/**
 * Poll backoff: idle client polling must not burn the Cloudflare daily request cap.
 * The chess client and the home price strip back off exponentially while nothing
 * changes, and snap back to fast polling on state change, user input, or tab return.
 *
 * Burn math that motivates this (per visible tab):
 *   lobby wait-poll was a fixed 2s tick = 43,200 req/day
 *   in-game opponent-turn poll was 400ms = 216,000 req/day
 *   open-challenge poll was 2s = 43,200 req/day
 *   home price strip was 30s = 2,880 req/day
 * Durable Object requests share the same 100k/day account pool, so every page poll
 * can cost a Worker request plus a DO request.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const gen = readFileSync(join(root, 'dasha-lobby-static-gen.mjs'), 'utf8');
const chessDisk = readFileSync(join(root, 'dasha-chess-page.html'), 'utf8');

function checkChessClient(src, label) {
  // Backoff machinery exists
  assert.match(src, /function pollDelay\(key,base,cap\)/, `${label}: pollDelay helper`);
  assert.match(src, /function pollResetAll\(\)/, `${label}: pollResetAll helper`);
  assert.match(src, /function gameKey\(\)/, `${label}: gameKey change detector`);
  // Snap-back hooks: user input + tab return reset every ladder
  assert.match(src, /addEventListener\('pointerdown',pollResetAll/, `${label}: pointer reset`);
  assert.match(src, /addEventListener\('keydown',pollResetAll\)/, `${label}: key reset`);
  assert.match(src, /visibilitychange',function\(\)\{if\(!document\.hidden\)pollResetAll\(\)\}/, `${label}: visibility reset`);
  // Wait poll: adaptive, queued users stay faster than idle browsers
  assert.match(src, /pollDelay\('wait',2000,\(me&&me\.queued\)\?10000:30000\)/, `${label}: wait ladder`);
  assert.doesNotMatch(src, /poll=setTimeout\(tick,2000\)/, `${label}: fixed 2s wait poll retired`);
  // In-game poll: 400ms base preserved, capped 3s active / 5s watching
  assert.match(src, /pollDelay\('play',watchingGame\(game\)\?1000:400,watchingGame\(game\)\?5000:3000\)/, `${label}: play ladder`);
  assert.doesNotMatch(src, /poll=setTimeout\(tick,watchingGame\(game\)\?1000:400\)/, `${label}: fixed 400ms play poll retired`);
  // Challenge + tournament polls backed off, not removed
  assert.match(src, /pollDelay\('chal',2000,8000\)/, `${label}: challenge ladder`);
  assert.match(src, /pollDelay\('tour',8000,15000\)/, `${label}: tournament ladder`);
  // Change detection resets the ladders
  assert.match(src, /if\(gameKey\(\)!==before\)pollIdle\.(play|wait)=0/, `${label}: change reset`);
}

checkChessClient(gen, 'static-gen chess client');
checkChessClient(chessDisk, 'disk chess page');

// Home price strip: exponential backoff replacing the fixed 30s interval
assert.match(gen, /let tickDelay=30000/, 'home: ladder state');
assert.match(gen, /tickDelay=Math\.min\(tickDelay\*2,300000\)/, 'home: doubles to a 5-minute cap');
assert.doesNotMatch(gen, /const every=setInterval\(tick,30000\)/, 'home: fixed 30s interval retired');
assert.match(gen, /pagehide',.*=>clearTimeout\(every\)/, 'home: pagehide clears the timeout chain');
assert.match(gen, /visibilitychange.*tickDelay=30000;tick\(\)/, 'home: tab return refreshes immediately at base cadence');

console.log('dasha-poll-backoff: OK');
