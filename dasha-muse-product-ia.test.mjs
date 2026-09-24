#!/usr/bin/env node
/**
 * Muse product IA canary: Worker-served /start /providers /developers /network
 * are 200 paper faces. /compute stays Typeform Start. Privacy stays 200.
 * Buy $dasha → /how-to-buy + exact Jupiter mint. No plugin.jup.ag.
 * No invented Mac counts. No Google Fonts / Inter / Geist. Disk + worker.fetch.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import {
  MUSE_FACES,
  MUSE_JUP,
  MUSE_MINT,
  isMuseProductPath,
  musePageHtml,
  museProductKind,
} from './dasha-muse-product.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const museSrc = readFileSync(join(root, 'dasha-muse-product.mjs'), 'utf8');

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(museSrc, /plugin\.jup\.ag/, 'muse module must not mention plugin.jup.ag');
assert.doesNotMatch(museSrc, /fonts\.googleapis|fonts\.gstatic|Inter|Geist/i, 'no Google Fonts / Inter / Geist');
assert.match(museSrc, /Arial Black/, 'display stack is Arial Black');
assert.match(museSrc, /#f4eddb/, 'paper field');
assert.match(museSrc, /#dfff00/, 'acid');
assert.match(museSrc, /#070608/, 'ink');
assert.match(museSrc, /#ff3b81/, 'hot');
assert.match(museSrc, /box-shadow:4px 4px 0 var\(--hot\)/, 'Buy hot 4px offset');
assert.doesNotMatch(museSrc, /#7c4dff|violet/i, 'no violet hero');
assert.doesNotMatch(museSrc, /disclaimer|not financial advice|\bNFA\b|\bdyor\b/i, 'no disclaimer lecture');
assert.doesNotMatch(museSrc, /providers_online=\d|Macs online:\s*\d/i, 'no invented capacity');
assert.equal(MUSE_MINT, '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump');
assert.equal(
  MUSE_JUP,
  'https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump',
);
assert.match(museSrc, /href="\/how-to-buy"/, 'Buy goes through /how-to-buy');
assert.equal(MUSE_FACES.developers.cta.href, '/compute');
assert.match(museSrc, /MUSE_START_HREF = '\/compute'/, 'Start CTA → /compute');
assert.match(museSrc, /MUSE_PROVIDE_HREF = '\/compute#provide'/, 'Connect a Mac → /compute#provide');

assert.equal(isMuseProductPath('/start'), true);
assert.equal(isMuseProductPath('/start/'), true);
assert.equal(museProductKind('/providers'), 'providers');
assert.equal(isMuseProductPath('/compute'), false);
assert.equal(isMuseProductPath('/privacy'), false);

const COPY = {
  start: [/Macs,/, /working together/, /Share capacity\. Run AI workloads\./],
  providers: [/Your Mac\./, /On your terms\./, /Connect a Mac/],
  developers: [/Send work\./, /Get results\./, /Run a job/],
  network: [/Capacity/, /meets demand\./, /Macs join\. Requests route\. Results return\./],
};

for (const [kind, face] of Object.entries(MUSE_FACES)) {
  const html = musePageHtml(kind);
  assert.match(html, new RegExp(`rel="canonical" href="https://www\\.getdasha\\.com${face.path}"`));
  assert.match(html, /class="muse-pill"/);
  const pill = (html.match(/<nav class="muse-pill"[\s\S]*?<\/nav>/) || [''])[0];
  const pillHrefs = [...pill.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(pillHrefs, ['/lobby', '/compute', '/how-to-buy', '/bag', '/login#grok'], `${kind} pill`);
  assert.doesNotMatch(pill, /href="\/(?:start|providers|developers|network|crew|listings|digest|simp)"/);
  const secondary = (html.match(/<nav class="muse-secondary"[\s\S]*?<\/nav>/) || [''])[0];
  assert.match(secondary, /href="\/start"/);
  assert.match(secondary, /href="\/providers"/);
  assert.match(secondary, /href="\/developers"/);
  assert.match(secondary, /href="\/network"/);
  assert.match(html, />Start</);
  assert.match(html, /Buy \$dasha/);
  assert.match(html, new RegExp(MUSE_MINT));
  assert.match(html, /jup\.ag\/swap\?sell=/);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
  for (const re of COPY[kind]) assert.match(html, re, `${kind} copy`);
}

assert.equal(potterHome308Dest('/start'), null);
assert.equal(potterHome308Dest('/providers'), null);
assert.equal(potterHome308Dest('/developers'), null);
assert.equal(potterHome308Dest('/network'), null);
assert.equal(potterHome308Dest('/privacy'), null);
assert.equal(potterHome308Dest('/compute'), null);
assert.equal(potterHome308Dest('/Start'), 'https://www.getdasha.com/start');
assert.equal(potterHome308Dest('/Providers'), 'https://www.getdasha.com/providers');
assert.equal(potterHome308Dest('/Developers'), 'https://www.getdasha.com/developers');
assert.equal(potterHome308Dest('/Network'), 'https://www.getdasha.com/network');
assert.equal(potterHome308Dest('/provider'), 'https://www.getdasha.com/compute');
assert.equal(potterHome308Dest('/developer'), 'https://www.getdasha.com/compute/api');
assert.equal(potterHome308Dest('/compute/network'), 'https://www.getdasha.com/compute/api/network');
assert.equal(potterHome308Dest('/api/network'), 'https://www.getdasha.com/compute/api/network');

{
  const productEdge = workerSrc.slice(workerSrc.indexOf('async function productEdge'));
  const museIdx = productEdge.indexOf('isMuseProductPath');
  const potterIdx = productEdge.indexOf('potterHome308Response');
  assert.ok(museIdx >= 0 && potterIdx >= 0 && museIdx < potterIdx, 'productEdge Muse GET/HEAD returns before leftover 308s');
  const fetchSrc = workerSrc.slice(workerSrc.indexOf('const room = await roomDiscoveryResponse'));
  const fetchMuse = fetchSrc.indexOf('isMuseProductPath');
  const fetchPotter = fetchSrc.indexOf('potterHome308Response');
  assert.ok(fetchMuse >= 0 && fetchPotter >= 0 && fetchMuse < fetchPotter, 'default fetch Muse GET/HEAD returns before leftover 308s');
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/start', '/providers', '/developers', '/network', '/compute', '/privacy', '/how-to-buy']) {
  assert.match(sitemapXml, new RegExp(`https://www\\.getdasha\\.com${path}</loc>`), `sitemap ${path}`);
}

const env = { LOBBY_SESSION_SECRET: 'muse-product-ia-secret', AI: { run: async () => ({ response: 'ok' }) } };
const FACES = [
  ['/start', 'muse-start', /Macs,/],
  ['/start/', 'muse-start', /working together/],
  ['/providers', 'muse-providers', /Your Mac\./],
  ['/providers/', 'muse-providers', /On your terms\./],
  ['/developers', 'muse-developers', /Send work\./],
  ['/developers/', 'muse-developers', /Get results\./],
  ['/network', 'muse-network', /Capacity/],
  ['/network/', 'muse-network', /meets demand\./],
];

for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, edge, copy] of FACES) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method}`);
      if (host === 'www.getdasha.com') {
        assert.equal(res.headers.get('x-dasha-edge'), edge, `${host} ${path} edge`);
      }
      if (method === 'HEAD') {
        assert.equal(await res.text(), '');
      } else {
        const html = await res.text();
        assert.match(html, copy, `${host} ${path} copy`);
        assert.match(html, /Buy \$dasha/);
        assert.match(html, /href="\/how-to-buy"/);
        assert.match(html, /href="\/compute"/);
        assert.match(html, new RegExp(MUSE_MINT));
        assert.doesNotMatch(html, /plugin\.jup\.ag/);
        assert.doesNotMatch(html, /disclaimer|not financial advice|\bNFA\b/i);
        assert.doesNotMatch(html, /fonts\.googleapis|Inter|Geist/i);
      }
    }
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  }
  const privacy = await edgeWorker.fetch(new Request(`https://${host}/privacy`), env);
  assert.equal(privacy.status, 200, `${host} /privacy stays 200`);
  if (host === 'www.getdasha.com') {
    assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  }
}

console.log('dasha-muse-product-ia: PASS (/start+/providers+/developers+/network 200 Muse faces; /compute+/privacy 200; Buy mint+Jupiter; no plugin.jup.ag)');
