#!/usr/bin/env node
/**
 * Motley leftover agent-ish file synonyms + Muse brand door.
 * Live GET/HEAD /contribute.md /crew.json /bag.json /muse
 * (+slash / Title-case) html-404 on www while faces already 200.
 * Fold to /contribute /crew /bag / (home is Muse Webflow).
 * Exact /humans.txt is a 200 text/plain face (not a leftover into /contribute).
 * Slash /humans.txt/ + Title-case fold to that face.
 * Do not fold /muse → /start — /start is reserved for Muse #225.
 * Stay out of /providers /developers /network /start (Muse #225 200 faces).
 * Do not invent /contribute.json /crew.md /bag.md /muse.md /humans.
 * Disk only. No Designer. Never plugin.jup.ag. No Room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /dasha-muse-product/, 'Muse #225 faces imported; leftover maps stay out');
assert.match(workerSrc, /Apex agent-ish file synonyms \(2026-09-17\)/, 'synonym leftover comment');
assert.match(workerSrc, /Do not fold \/muse → \/start/, 'muse brand door stays off /start');
assert.match(workerSrc, /Stay out of \/providers/, 'stay-out names Muse #225 faces');
assert.match(workerSrc, /POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST/, 'motley leftover map');

const discoveryMap = workerSrc.match(/const POTTER_MOTLEY_AGENT_DISCOVERY_308_DEST = new Map\(\[[\s\S]*?\]\);/)[0];
for (const path of [
  '/contribute.md', '/contribute.md/',
  '/crew.json', '/crew.json/',
  '/bag.json', '/bag.json/',
  '/muse', '/muse/',
]) {
  assert.match(discoveryMap, new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), `map lists ${path}`);
}
assert.doesNotMatch(discoveryMap, /['"]\/humans\.txt['"]/, '/humans.txt is the 200 face, not Motley leftover');
assert.doesNotMatch(discoveryMap, /['"]\/humans\.txt\/['"]/, '/humans.txt/ leftover lives in its Set');
assert.match(discoveryMap, /https:\/\/www\.getdasha\.com\/contribute/, 'contribute.md dest is /contribute');
assert.match(discoveryMap, /https:\/\/www\.getdasha\.com\/crew/, 'crew.json dest is /crew');
assert.match(discoveryMap, /https:\/\/www\.getdasha\.com\/bag/, 'bag.json dest is /bag');
assert.match(discoveryMap, /\['\/muse',\s*'https:\/\/www\.getdasha\.com\/'\]/, 'muse dest is home');
for (const path of [
  '/start', '/start/',
  '/providers', '/providers/',
  '/developers', '/developers/',
  '/network', '/network/',
  '/contribute.json', '/crew.md', '/bag.md', '/muse.md', '/humans',
]) {
  assert.doesNotMatch(
    discoveryMap,
    new RegExp(`['"]${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `do not claim ${path} on Motley map`,
  );
}

const WWW = 'https://www.getdasha.com';
const CONTRIBUTE = `${WWW}/contribute`;
const CREW = `${WWW}/crew`;
const BAG = `${WWW}/bag`;
const HOME = `${WWW}/`;
const COMPUTE = `${WWW}/compute`;
const START = `${WWW}/start`;

const FOLDS = [
  ['/contribute.md', CONTRIBUTE],
  ['/contribute.md/', CONTRIBUTE],
  ['/Contribute.md', CONTRIBUTE],
  ['/CONTRIBUTE.MD', CONTRIBUTE],
  ['/Contribute.md/', CONTRIBUTE],
  ['/crew.json', CREW],
  ['/crew.json/', CREW],
  ['/Crew.json', CREW],
  ['/CREW.JSON', CREW],
  ['/Crew.json/', CREW],
  ['/bag.json', BAG],
  ['/bag.json/', BAG],
  ['/Bag.json', BAG],
  ['/BAG.JSON', BAG],
  ['/Bag.json/', BAG],
  ['/muse', HOME],
  ['/muse/', HOME],
  ['/Muse', HOME],
  ['/MUSE', HOME],
  ['/Muse/', HOME],
];

const HUMANS = `${WWW}/humans.txt`;
const HUMANS_FOLDS = [
  ['/humans.txt/', HUMANS],
  ['/Humans.txt', HUMANS],
  ['/HUMANS.TXT', HUMANS],
  ['/Humans.txt/', HUMANS],
];

const STAY_200 = [
  ['/contribute', null],
  ['/crew', null],
  ['/bag', null],
  ['/humans.txt', null],
];

const STAY_OUT = [
  '/contribute.json',
  '/crew.md',
  '/bag.md',
  '/muse.md',
  '/humans',
  '/network',
  '/network/',
];

for (const [path, dest] of FOLDS) {
  assert.equal(potterHome308Dest(path), dest, path);
  assert.notEqual(potterHome308Dest(path), START, `${path} is not /start`);
}
for (const [path, dest] of HUMANS_FOLDS) {
  assert.equal(potterHome308Dest(path), dest, path);
  assert.notEqual(potterHome308Dest(path), CONTRIBUTE, `${path} is not /contribute`);
}
for (const [path, dest] of STAY_200) {
  assert.equal(potterHome308Dest(path), dest, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
}
assert.equal(potterHome308Dest('/start'), null, '/start is Muse home 200');
assert.equal(potterHome308Dest('/start/'), null, '/start/ is Muse home 200');
assert.equal(potterHome308Dest('/Start'), START, '/Start casefolds to Muse /start');
assert.equal(potterHome308Dest('/providers'), null, '/providers is Muse face 200');
assert.equal(potterHome308Dest('/developers'), null, '/developers is Muse face 200');
assert.notEqual(potterHome308Dest('/muse'), START, '/muse is not /start');
assert.notEqual(potterHome308Dest('/muse'), COMPUTE, '/muse is not /compute');
assert.equal(potterHome308Dest('/compute/api/crew'), CREW, 'nested /compute/api/crew still Motley crew leftover');
assert.equal(potterHome308Dest('/compute/api/bag'), BAG, 'nested /compute/api/bag still Motley bag leftover');

const env = {
  LOBBY_SESSION_SECRET: 'motley-agent-synonym-leftover-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      assert.notEqual(res.headers.get('location'), START, `${host} ${path} ${method} not /start`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const [path, dest] of HUMANS_FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
      assert.notEqual(res.headers.get('location'), CONTRIBUTE, `${host} ${path} ${method} not /contribute`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const contribute = await edgeWorker.fetch(new Request(`https://${host}/contribute`, { method }), env);
    assert.equal(contribute.status, 200, `${host} /contribute ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await contribute.text(), '');
    const crew = await edgeWorker.fetch(new Request(`https://${host}/crew`, { method }), env);
    assert.equal(crew.status, 200, `${host} /crew ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await crew.text(), '');
    const bag = await edgeWorker.fetch(new Request(`https://${host}/bag`, { method }), env);
    assert.equal(bag.status, 200, `${host} /bag ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await bag.text(), '');
    const humans = await edgeWorker.fetch(new Request(`https://${host}/humans.txt`, { method }), env);
    assert.equal(humans.status, 200, `${host} /humans.txt ${method} stays 200`);
    assert.match(humans.headers.get('content-type') || '', /^text\/plain; charset=utf-8$/i, `${host} /humans.txt ${method} content-type`);
    assert.doesNotMatch(humans.headers.get('content-type') || '', /text\/html/i, `${host} /humans.txt ${method} not HTML`);
    if (method === 'HEAD') {
      assert.equal(await humans.text(), '');
    } else {
      const body = await humans.text();
      assert.match(body, /^\/\* TEAM \*\//, `${host} /humans.txt body prefix`);
      assert.doesNotMatch(body, /Contribute to Dasha/, `${host} /humans.txt is not contribute HTML`);
      assert.doesNotMatch(body, /<html/i, `${host} /humans.txt is not HTML`);
    }
  }
  const start = await edgeWorker.fetch(new Request(`https://${host}/start`), env);
  assert.equal(start.status, 200, `${host} /start Muse 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(start.headers.get('x-dasha-edge'), 'muse-start');
  }
  const providers = await edgeWorker.fetch(new Request(`https://${host}/providers`), env);
  assert.equal(providers.status, 200, `${host} /providers Muse 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(providers.headers.get('x-dasha-edge'), 'muse-providers');
  }
  const developers = await edgeWorker.fetch(new Request(`https://${host}/developers`), env);
  assert.equal(developers.status, 200, `${host} /developers Muse 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(developers.headers.get('x-dasha-edge'), 'muse-developers');
  }
  const network = await edgeWorker.fetch(new Request(`https://${host}/network`), env);
  assert.equal(network.status, 200, `${host} /network Muse 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(network.headers.get('x-dasha-edge'), 'muse-network');
  }
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/contribute.md', '/crew.json', '/bag.json', '/muse']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}
assert.ok(!sitemapXml.includes('https://www.getdasha.com/humans.txt</loc>'), 'sitemap omits /humans.txt (machine face, not product page)');
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/contribute<\/loc>/, 'sitemap keeps /contribute face');
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/crew<\/loc>/, 'sitemap keeps /crew face');
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/bag<\/loc>/, 'sitemap keeps /bag face');

console.log('dasha-motley-agent-synonym-leftover-pretty-path: PASS (/contribute.md 308 /contribute; /crew.json 308 /crew; /bag.json 308 /bag; /muse 308 /; /humans.txt 200 text/plain; slash+Title-case 308 /humans.txt; www+lobby GET+HEAD; dests 200; Muse /start|/providers|/developers|/network 200; no /muse→/start; no plugin.jup.ag)');
