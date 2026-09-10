#!/usr/bin/env node
/**
 * /crew quiet Compute Use a Mac / Join a Mac doors.
 * Hash URLs only. Crew is not stripHomeCompute / stripRetiredProductDoors
 * (those eat /compute on home + howto). Disk only. No Designer.
 * Never plugin.jup.ag. No wrangler. No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  stripHomeCompute,
  stripRetiredProductDoors,
} from './dasha-lobby-worker.mjs';
import { CREW_PAGE_HTML } from './dasha-crew-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-crew.html'), 'utf8');
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

assert.doesNotMatch(worker, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.equal(html, CREW_PAGE_HTML, 'embed matches dasha-crew.html');
assert.match(html, /<!-- crew-use-a-mac:2026-09-10 -->/, 'marker');
assert.match(
  worker.match(/function crewPageResponse\([\s\S]*?\n\}/)?.[0] || '',
  /applyCrewShareOg\(CREW_PAGE_HTML/,
  'crew serves CREW_PAGE_HTML',
);
assert.doesNotMatch(
  worker.match(/function crewPageResponse\([\s\S]*?\n\}/)?.[0] || '',
  /stripHomeCompute|stripRetiredProductDoors/,
  'crew response does not run Instinct compute strips',
);

const DOOR =
  /<p class="mac-door">Compute\. <a href="https:\/\/www\.getdasha\.com\/compute#ask">Use a Mac<\/a> · <a href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac<\/a><\/p>/;

function assertCrewDoor(body, label) {
  assert.match(body, DOOR, `${label} quiet Compute Use/Join doors`);
  assert.match(body, /href="https:\/\/www\.getdasha\.com\/compute#ask">Use a Mac/, `${label} Use a Mac`);
  assert.match(body, /href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac/, `${label} Join a Mac`);
  assert.doesNotMatch(body, /Ask a Mac/, `${label} no Ask a Mac`);
  assert.doesNotMatch(body, /href="(?:https:\/\/(?:www\.)?getdasha\.com)?\/compute"/, `${label} no exact /compute`);
  assert.doesNotMatch(body, /id=["']compute-door["']/, `${label} no compute-door id`);
  assert.doesNotMatch(body, /class=["'][^"']*\bcompute\b/, `${label} no class=compute`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${label} no plugin.jup.ag`);
  assert.doesNotMatch(body, /\b\d+\s+Macs?\b/i, `${label} no invented Mac count`);
  assert.match(body, /<h1>Dasha Crew<\/h1>/, `${label} title stays`);
  assert.match(body, /Five jobs\. You keep the keys\./, `${label} five jobs stay`);
  assert.match(body, />Buy</, `${label} Buy stays`);
  assert.match(body, /href="\/dasha-crew\.tar\.gz"/, `${label} kit stays`);
  {
    const line = body.match(/<p class="mac-door">[\s\S]*?<\/p>/);
    assert.ok(line, `${label} mac-door line`);
    assert.doesNotMatch(line[0], /lobby/i, `${label} Compute line does not stuff Room`);
  }
}

assertCrewDoor(html, 'disk');
assertCrewDoor(CREW_PAGE_HTML, 'embed');

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/crew'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'crew');
const served = await res.text();
assertCrewDoor(served, 'served');

const lobby = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/crew'), {});
assert.equal(lobby.status, 200);
assertCrewDoor(await lobby.text(), 'lobby');

{
  const eaten = stripRetiredProductDoors(served);
  assert.doesNotMatch(eaten, /href="https:\/\/www\.getdasha\.com\/compute#ask"/, 'howto strip would eat Use a Mac');
  assert.match(served, /href="https:\/\/www\.getdasha\.com\/compute#ask"/, 'crew keeps Use a Mac because that strip is not applied');
}

{
  const homeKill = stripHomeCompute('<a class="compute" href="/compute">Compute</a><a href="/compute#ask">Use a Mac</a>');
  assert.doesNotMatch(homeKill, /href="\/compute"/, 'stripHomeCompute eats exact /compute');
  assert.match(homeKill, /href="\/compute#ask"/, 'hash Use a Mac survives stripHomeCompute');
}

console.log('dasha-crew-compute-door: PASS (quiet Use a Mac · Join a Mac; hash only; crew skips Instinct compute strips)');
