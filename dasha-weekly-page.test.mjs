#!/usr/bin/env node
/**
 * /weekly revival (Sep 29 2026): the Dasha week - one dated entry per week,
 * newest first, permalink anchors, append-only. Dated-fact only: chain state,
 * supply state, shipped fixes, short try-it. 200 on www + lobby, sitemap
 * lists it, no plugin.jup.ag, no people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { WEEKLY_PAGE_HTML } from './dasha-weekly-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

// Week-of-Sep-29 restart entry facts (dated, from the growth lane draft)
for (const fact of [
  'Week of September 29, 2026',
  'id="w-2026-09-29"',
  '300 settled jobs',
  '$15.00 paid to providers',
  '62,551 tokens',
  'No settled jobs since Sep 25',
  'kit 0.3.1',
  '66% as of Sep 28 noon',
  'anomaly-hold expiry',
  '504 with retry guidance',
  'https://www.getdasha.com/compute',
  'https://lobby.getdasha.com/compute/api/chain',
  '<link rel="canonical" href="https://www.getdasha.com/weekly">',
  'og:title',
  'twitter:card',
]) {
  assert.ok(WEEKLY_PAGE_HTML.includes(fact), `weekly page states: ${fact}`);
}
assert.doesNotMatch(WEEKLY_PAGE_HTML, /plugin\.jup\.ag/, 'no plugin');

// /weekly stays 200 (not a 308 leftover)
assert.equal(potterHome308Dest('/weekly'), null, '/weekly stays 200');
assert.equal(potterHome308Dest('/weekly/'), null, '/weekly/ stays 200');

// sitemap lists /weekly (worker const == static-gen parity enforced elsewhere)
const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.ok(sitemapXml.includes('https://www.getdasha.com/weekly</loc>'), 'sitemap lists /weekly');

// fetch-level: 200 on both hosts, GET + HEAD
const env = {
  LOBBY_SESSION_SECRET: 'weekly-page-secret',
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
  for (const path of ['/weekly', '/weekly/']) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 200, `${host} ${path} ${method}`);
      assert.match(res.headers.get('content-type') || '', /text\/html/, `${host} ${path} html`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
      else {
        const body = await res.text();
        assert.ok(body.includes('The Dasha week.'), `${host} ${path} body`);
        assert.ok(body.includes('Week of September 29, 2026'), `${host} ${path} entry`);
        assert.doesNotMatch(body, /plugin\.jup\.ag/, `${host} ${path} no plugin`);
      }
    }
  }
}

console.log('dasha-weekly-page: PASS (/weekly 200 www+lobby GET+HEAD, Sep-29 entry facts, permalink anchor, canonical+OG, sitemap, no plugin)');
