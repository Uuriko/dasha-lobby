#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 2608ea9d): live /faucet/fill-the-jar
 * /faucet/fill_the_jar (+slash / Title-case) html-404 → 308 /faucet;
 * /bounty (+slash / Title-case) html-404 → 308 /bounties;
 * /how-tobuy /howto_buy (+slash / Title-case) html-404 → 308 /how-to-buy.
 * Keep existing peers (/fill-the-jar, /bounties, /how-to-buy, /howtobuy, …).
 * Exact /faucet /bounties /how-to-buy stay 200 (null dest).
 * Never invent /aeo /shorts /social. Bare /me now folds via compute-door leftover
 * (dasha-hosts-tips-job-receipt-pretty-path). Disk only. No Designer.
 * Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_FAUCET_DOOR_308_PATHS/, 'faucet door 308 set present');
assert.match(workerSrc, /POTTER_HOWTO_308_PATHS/, 'howto 308 set present');
assert.match(workerSrc, /POTTER_BOUNTIES_308_PATHS/, 'bounty leftover 308 set present');
assert.match(
  workerSrc,
  /\/faucet\/fill-the-jar \/faucet\/fill_the_jar/,
  'faucet leftover comment lists /faucet/fill-the-jar /faucet/fill_the_jar',
);
assert.match(
  workerSrc,
  /Leftover \/bounty \(\+slash \/ Title-case\)/,
  'bounty leftover comment',
);
assert.match(
  workerSrc,
  /\/how-tobuy \/howto_buy/,
  'howto leftover comment lists /how-tobuy /howto_buy',
);
assert.doesNotMatch(
  workerSrc,
  /POTTER_FAUCET_LEAF_CASEFOLD[\s\S]*\/faucet\/jar/,
  'do not invent /faucet/jar',
);
assert.doesNotMatch(workerSrc, /['"]\/aeo['"]/, 'do not invent /aeo');
assert.doesNotMatch(workerSrc, /['"]\/shorts['"]/, 'do not invent /shorts');
assert.doesNotMatch(workerSrc, /['"]\/social['"]/, 'do not invent /social');

const FAUCET = 'https://www.getdasha.com/faucet';
const BOUNTIES = 'https://www.getdasha.com/bounties';
const HOWTO = 'https://www.getdasha.com/how-to-buy';

const TO_FAUCET = [
  '/faucet/fill-the-jar', '/faucet/fill-the-jar/', '/Faucet/fill-the-jar', '/FAUCET/FILL-THE-JAR', '/Faucet/Fill-The-Jar/',
  '/faucet/fill_the_jar', '/faucet/fill_the_jar/', '/Faucet/fill_the_jar', '/FAUCET/FILL_THE_JAR', '/Faucet/Fill_The_Jar/',
];
const FAUCET_PEERS = [
  '/fill-the-jar', '/fill-the-jar/', '/Fill-the-jar', '/FILL-THE-JAR',
  '/fill', '/fill/', '/Fill',
  '/jar', '/jar/', '/Jar',
  '/tip', '/tip/', '/Tip',
  '/tip-me', '/Tip-me',
  '/compute/faucet', '/Compute/faucet',
];
const TO_BOUNTIES = [
  '/bounty', '/bounty/', '/Bounty', '/BOUNTY', '/Bounty/',
];
const TO_HOWTO = [
  '/how-tobuy', '/how-tobuy/', '/How-tobuy', '/HOW-TOBUY', '/How-Tobuy/',
  '/howto_buy', '/howto_buy/', '/Howto_buy', '/HOWTO_BUY', '/HowTo_Buy/',
];
const HOWTO_PEERS = [
  '/howtobuy', '/howtobuy/', '/Howtobuy',
  '/howto', '/howto/', '/Howto',
  '/how-to', '/how-to/', '/How-to',
  '/how', '/how/', '/How',
  '/buy', '/buy/', '/Buy',
  '/dasha', '/desk',
];
const STAY_200 = [
  '/faucet',
  '/faucet/',
  '/bounties',
  '/bounties/',
  '/how-to-buy',
  '/how-to-buy/',
];
const STAY_OUT = [
  '/aeo',
  '/shorts',
  '/social',
  '/faucet/jar',
  '/Faucet/jar',
];

for (const path of TO_FAUCET) {
  assert.equal(potterHome308Dest(path), FAUCET, path);
}
for (const path of FAUCET_PEERS) {
  assert.equal(potterHome308Dest(path), FAUCET, `peer ${path}`);
}
for (const path of TO_BOUNTIES) {
  assert.equal(potterHome308Dest(path), BOUNTIES, path);
}
for (const path of TO_HOWTO) {
  assert.equal(potterHome308Dest(path), HOWTO, path);
}
for (const path of HOWTO_PEERS) {
  assert.equal(potterHome308Dest(path), HOWTO, `peer ${path}`);
}
for (const path of STAY_200) {
  assert.equal(potterHome308Dest(path), null, `${path} stays 200`);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `do not invent ${path}`);
}
assert.equal(potterHome308Dest('/Bounties'), BOUNTIES, 'Title-case /Bounties still product-casefolds');
assert.equal(potterHome308Dest('/How-to-buy'), HOWTO, 'Title-case /How-to-buy still product-casefolds');
assert.equal(potterHome308Dest('/faucet/fill'), null, 'bare fill share stays fillShareApi');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [paths, dest] of [
    [TO_FAUCET, FAUCET],
    [FAUCET_PEERS, FAUCET],
    [TO_BOUNTIES, BOUNTIES],
    [TO_HOWTO, HOWTO],
    [HOWTO_PEERS, HOWTO],
  ]) {
    for (const path of paths) {
      for (const method of ['GET', 'HEAD']) {
        const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
        assert.equal(res.status, 308, `${host} ${path} ${method}`);
        assert.equal(res.headers.get('location'), dest, `${host} ${path} ${method} loc`);
        assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
        if (method === 'HEAD') assert.equal(await res.text(), '');
      }
    }
  }
  for (const [path, edge] of [
    ['/faucet', 'faucet'],
    ['/bounties', 'bounties'],
    ['/how-to-buy', 'howto'],
  ]) {
    const page = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.equal(page.status, 200, `${host} ${path} stays 200`);
    if (host === 'www.getdasha.com') {
      assert.equal(page.headers.get('x-dasha-edge'), edge, `${host} ${path} edge`);
    }
  }
}

{
  const bare = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/fill'), env);
  assert.equal(bare.status, 308);
  assert.equal(bare.headers.get('location'), FAUCET);
  assert.equal(bare.headers.get('x-dasha-edge'), 'faucet-fill');
}
{
  const jar = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/jar'), env);
  assert.equal(jar.status, 404, 'www /faucet/jar stays 404');
  assert.equal(jar.headers.get('x-dasha-edge'), 'html-404');
}
for (const path of STAY_OUT) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), env);
  assert.equal(res.status, 404, `www ${path} stays 404`);
  assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${path} html-404`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/faucet<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/bounties<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/how-to-buy<\/loc>/);
for (const path of [
  '/faucet/fill-the-jar', '/faucet/fill_the_jar', '/fill-the-jar',
  '/bounty', '/how-tobuy', '/howto_buy', '/howtobuy', '/howto', '/buy',
  '/aeo', '/shorts', '/social',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-faucet-bounty-howto-leftover-pretty-path: PASS (/faucet/fill-the-jar+/faucet/fill_the_jar 308 /faucet; /bounty 308 /bounties; /how-tobuy+/howto_buy 308 /how-to-buy; Title-case+slash; peers; /faucet+/bounties+/how-to-buy 200; no /aeo /shorts /social; no plugin.jup.ag)');
