#!/usr/bin/env node
/**
 * /compute/how-agents-pay-for-inference (Sep 29 2026): how agents pay for GPU
 * inference - four payment models, signed receipt chain differentiator, worked
 * guest-key example with the honest settled-chain caveat, constraints, FAQ.
 * 200 on www + lobby, sitemap lists it, no plugin.jup.ag, no people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { HOW_AGENTS_PAY_PAGE_HTML } from './dasha-how-agents-pay-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

// Dated facts, all checked against live sources Sep 29 2026
for (const fact of [
  'How AI agents pay for GPU inference',
  '$5/month default, $1-$1,000 or uncapped at creation',
  'the API answers 402 when the key hits its cap',
  '$5.00 by card, $4.85 in USDC, $4.75 in $DASHA',
  'guest receipts do not land on the public settled chain',
  'found: false',
  'ANCHORED',
  'SELF-CONSISTENT',
  'A successful paid job bills $0.05 from prepaid credits',
  'x402',
  'Last checked September 29, 2026',
  '<link rel="canonical" href="https://www.getdasha.com/compute/how-agents-pay-for-inference">',
  'og:title',
  'twitter:card',
  '"@type":"FAQPage"',
]) {
  assert.ok(HOW_AGENTS_PAY_PAGE_HTML.includes(fact), `page states: ${fact}`);
}
assert.doesNotMatch(HOW_AGENTS_PAY_PAGE_HTML, /plugin\.jup\.ag/, 'no plugin');

// route stays 200 (not a 308 leftover)
assert.equal(potterHome308Dest('/compute/how-agents-pay-for-inference'), null, 'stays 200');
assert.equal(potterHome308Dest('/compute/how-agents-pay-for-inference/'), null, 'slash stays 200');

// sitemap lists it (worker const == static-gen parity enforced elsewhere)
const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(sitemapXml.includes('https://www.getdasha.com/compute/how-agents-pay-for-inference</loc>'), 'sitemap lists the page');

// fetch-level: 200 on both hosts, GET + HEAD
const env = {
  LOBBY_SESSION_SECRET: 'how-agents-pay-secret',
  AI: { run: async () => ({ response: 'ok' }) },
  LOBBY: {
    idFromName() { return 'public'; },
    get() {
      return {
        async fetch() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          });
        },
      };
    },
  },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of ['/compute/how-agents-pay-for-inference', '/compute/how-agents-pay-for-inference/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method}`);
      assert.match(res.headers.get('content-type') || '', /text\/html/, `${host} ${path} html`);
      assert.equal(res.headers.get('x-dasha-edge'), 'how-agents-pay', `${host} ${path} edge header`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
      else {
        const body = await res.text();
        assert.ok(body.includes('How AI agents pay for GPU inference.'), `${host} ${path} body`);
        assert.ok(body.includes('guest receipts do not land on the public settled chain'), `${host} ${path} caveat`);
        assert.doesNotMatch(body, /plugin\.jup\.ag/, `${host} ${path} no plugin`);
      }
    }
  }
}

console.log('dasha-how-agents-pay-page: PASS (200 www+lobby GET+HEAD, four models, receipt chain, settled-chain caveat, canonical+OG+FAQ, sitemap, no plugin)');
