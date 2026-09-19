#!/usr/bin/env node
/**
 * /caps is a real page (Sep 15 queued fix): spend-cap facts enforced by
 * dasha-compute-network.mjs, 200 on www + lobby, /compute/caps folds to /caps,
 * sitemap lists it, no plugin.jup.ag, no people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { CAPS_PAGE_HTML } from './dasha-compute-caps-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

// Page facts (server-enforced values from dasha-compute-network.mjs)
for (const fact of [
  '$5 / month',
  '$1 &ndash; $1,000',
  'uncapped',
  'monthly (default) or weekly',
  '402 key spend limit reached',
  '$0.05 per successful chat completion',
  '/compute/api/keys',
  'limit_cents',
  'limit_remaining_cents',
  'spend_cents',
  'limit_reset',
  '<link rel="canonical" href="https://www.getdasha.com/caps">',
  'og:title',
  'twitter:card',
]) {
  assert.ok(CAPS_PAGE_HTML.includes(fact), `caps page states: ${fact}`);
}
assert.doesNotMatch(CAPS_PAGE_HTML, /plugin\.jup\.ag/, 'no plugin');

// 308 dest shape
assert.equal(potterHome308Dest('/caps'), null, '/caps stays 200');
assert.equal(potterHome308Dest('/caps/'), null, '/caps/ stays 200');
assert.equal(potterHome308Dest('/compute/caps'), 'https://www.getdasha.com/caps');
assert.equal(potterHome308Dest('/compute/caps/'), 'https://www.getdasha.com/caps');
assert.equal(potterHome308Dest('/Compute/Caps'), 'https://www.getdasha.com/caps', 'case-fold');

// sitemap lists /caps (worker const == static-gen parity enforced elsewhere)
const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(sitemapXml.includes('https://www.getdasha.com/caps</loc>'), 'sitemap lists /caps');

// fetch-level: 200 on both hosts, GET + HEAD
const env = {
  LOBBY_SESSION_SECRET: 'caps-page-secret',
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
  for (const path of ['/caps', '/caps/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method}`);
      assert.match(res.headers.get('content-type') || '', /text\/html/, `${host} ${path} html`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
      else {
        const body = await res.text();
        assert.ok(body.includes('Spend caps.'), `${host} ${path} body`);
        assert.doesNotMatch(body, /plugin\.jup\.ag/, `${host} ${path} no plugin`);
      }
    }
  }
  // /compute/caps folds to /caps
  for (const method of ['GET', 'HEAD']) {
    const res = await edgeWorker.fetch(new Request(`https://${host}/compute/caps`, { method }), env);
    assert.equal(res.status, 308, `${host} /compute/caps ${method} 308`);
    assert.equal(res.headers.get('location'), 'https://www.getdasha.com/caps', `${host} /compute/caps loc`);
  }
}

console.log('dasha-compute-caps-page: PASS (/caps 200 www+lobby GET+HEAD, facts, canonical+OG, /compute/caps 308 -> /caps, sitemap, no plugin)');
