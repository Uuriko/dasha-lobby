#!/usr/bin/env node
/**
 * Quiet buyer live-model line on /compute from GET /compute/api/network.
 * Live. {models_available ids} only when providers_online>=1 and models nonempty.
 * Empty / fail → No Mac online. Never invent a model. No tok/s. No $0.05/job on Ask.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag. No /which or /contribute.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function askBlock(html) {
  const start = html.indexOf('id="step-ask"');
  const end = html.indexOf('id="step-market"', start);
  assert.ok(start >= 0 && end > start, 'Ask section bounds');
  return html.slice(start, end);
}

function buyerBlock(html) {
  const m = html.match(/<section id=["']buyer-one-path["']>[\s\S]*?<\/section>/);
  assert.ok(m, 'buyer-one-path section');
  return m[0];
}

function assertBuyerLiveModels(html, label) {
  assert.match(html, /<!-- buyer-live-models:2026-09-08 -->/, `${label} marker`);
  assert.match(html, /id=["']buyer-live-line["'][^>]*>No Mac online\.</, `${label} Ask first paint no invented model`);
  assert.match(html, /id=["']buyer-live-line-build["'][^>]*>No Mac online\.</, `${label} API first paint no invented model`);
  assert.match(html, /function paintBuyerLiveLine\(/, `${label} paintBuyerLiveLine`);
  assert.match(html, /paintBuyerLiveLine\(\)/, `${label} paintBuyerLiveLine called`);
  assert.match(html, /api\(['"]\/compute\/api\/network['"]\)/, `${label} reads GET /compute/api/network`);
  assert.match(
    html,
    /Show Live\. \{models_available ids\} only when providers_online>=1 and models_available nonempty/,
    `${label} show condition`,
  );
  assert.match(html, /const live=n>=1&&ids\.length>0/, `${label} live = n>=1 && ids`);
  assert.match(html, /'Live\. '\+ids\.join\(' '\)/, `${label} Live. + response ids`);
  assert.match(html, /'No Mac online\.'/, `${label} empty/fail copy`);
  assert.match(html, /never invent a model/, `${label} never invent`);
  assert.match(html, /No tok\/s/, `${label} skip tok/s`);
  assert.match(html, /No \$0\.05\/job/, `${label} no earn rate on buyer line`);
  assert.match(html, /id=["']ask-free-fine["'][^>]*>3 free \/ 10 min · then credits\./, `${label} Hosted Ask path stays`);

  const ask = askBlock(html);
  assert.match(ask, /id=["']buyer-live-line["']/, `${label} live line on Ask`);
  assert.doesNotMatch(ask, /\$0\.05\/job/, `${label} no \$0.05/job on buyer Ask path`);
  assert.doesNotMatch(ask, /\$0\.01\/1k/, `${label} no provider token rate on Ask`);
  assert.doesNotMatch(ask, /tok\/s/, `${label} no tok/s on Ask markup`);

  const block = buyerBlock(html);
  assert.match(block, /id=["']buyer-live-line-build["']/, `${label} live line on buyer one-path`);
  assert.doesNotMatch(block, /\$0\.05\/job/, `${label} no \$0.05/job on buyer block`);
  assert.doesNotMatch(block, /tok\/s/, `${label} no tok/s on buyer block`);

  assert.match(html, /id=["']earn-rates["'][^>]*>\$0\.05\/job/, `${label} Provide still shows earn rates`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /id=["']which["']|\/which/, `${label} no /which`);
  assert.doesNotMatch(html, /id=["']contribute["']|\/contribute/, `${label} no /contribute`);
}

assertBuyerLiveModels(disk, 'disk');
assertBuyerLiveModels(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertBuyerLiveModels(await res.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const first = await page.evaluate(() => {
      const read = (id) => (document.getElementById(id)?.textContent || '').trim();
      return {
        ask: read('buyer-live-line'),
        build: read('buyer-live-line-build'),
        hosted: read('ask-free-fine'),
        askHasEarn: (document.getElementById('step-ask')?.innerText || '').includes('$0.05/job'),
      };
    });
    assert.equal(first.ask, 'No Mac online.', 'first paint does not invent a model');
    assert.equal(first.build, 'No Mac online.', 'API first paint does not invent a model');
    assert.match(first.hosted, /3 free \/ 10 min · then credits\.|Hosted · unavailable/, 'Hosted Ask path stays');
    assert.equal(first.askHasEarn, false, 'Ask path has no $0.05/job');
    assert.doesNotMatch(first.ask, /gemma3-27b|qwen3-8b|gpt-oss/);

    const painted = await page.evaluate(() => {
      const read = () => ({
        ask: (document.getElementById('buyer-live-line')?.textContent || '').trim(),
        build: (document.getElementById('buyer-live-line-build')?.textContent || '').trim(),
      });
      const run = (n, models, capacity = []) => {
        providersOnline = n;
        networkModels = new Set(models);
        networkCapacity = capacity;
        paintBuyerLiveLine();
        return read();
      };
      return {
        fixture: run(1, ['fixture-model-xyz'], [{ model: 'fixture-model-xyz', measured_providers: 1, tokens_per_second: 31.2 }]),
        two: run(2, ['gemma3-27b', 'qwen3-8b'], [{ model: 'gemma3-27b', measured_providers: 1, tokens_per_second: 2.93 }]),
        zero: run(0, [], []),
        onlineEmptyModels: run(1, [], [{ measured_providers: 1, tokens_per_second: 9 }]),
        modelsButOffline: run(0, ['gemma3-27b'], [{ model: 'gemma3-27b', measured_providers: 1, tokens_per_second: 2.93 }]),
      };
    });

    assert.equal(painted.fixture.ask, 'Live. fixture-model-xyz', 'network fixture shows response ids');
    assert.equal(painted.fixture.build, 'Live. fixture-model-xyz');
    assert.doesNotMatch(painted.fixture.ask, /tok\/s|31\.2/, 'skip tok/s even when measured');

    assert.equal(painted.two.ask, 'Live. gemma3-27b qwen3-8b', 'all models_available ids');
    assert.doesNotMatch(painted.two.ask, /tok\/s|2\.93/);

    assert.equal(painted.zero.ask, 'No Mac online.', 'empty fleet does not invent a model');
    assert.doesNotMatch(painted.zero.ask, /Live\.|gemma3|qwen3|fixture-model|gpt-oss/);

    assert.equal(painted.onlineEmptyModels.ask, 'No Mac online.', 'online without models_available does not invent');
    assert.doesNotMatch(painted.onlineEmptyModels.ask, /gemma3|qwen3|gpt-oss|Live\./);

    assert.equal(painted.modelsButOffline.ask, 'No Mac online.', 'providers_online 0 ignores leftover model ids');
    assert.doesNotMatch(painted.modelsButOffline.ask, /Live\.|gemma3-27b/);

    const fetched = await page.evaluate(async () => {
      const orig = window.fetch;
      const read = () => (document.getElementById('buyer-live-line')?.textContent || '').trim();
      const stub = (payload, fail = false) => async (url) => {
        const href = String(url);
        if (href.includes('/compute/api/network')) {
          if (fail) throw new Error('network down');
          return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (href.includes('/compute/api/status')) {
          return new Response(JSON.stringify({ live: true }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (href.includes('/compute/api/factory')) {
          return new Response(JSON.stringify({ settled_24h: { tokens: 0, jobs: 0, cents: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        if (href.includes('/compute/ocm/healthz')) {
          return new Response(JSON.stringify({ hosts: 0 }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      };

      tfStep = 'ask';
      window.fetch = stub({
        providers_online: 1,
        models_available: ['fixture-model-xyz'],
        capacity: [{ model: 'fixture-model-xyz', measured_providers: 1, tokens_per_second: 12.5 }],
      });
      await refreshHonesty();
      const live = read();

      window.fetch = stub({ providers_online: 0, models_available: [], capacity: [] });
      await refreshHonesty();
      const empty = read();

      window.fetch = stub({}, true);
      providersOnline = 0;
      networkModels = new Set();
      await refreshHonesty();
      const failed = read();

      window.fetch = orig;
      return { live, empty, failed };
    });

    assert.equal(fetched.live, 'Live. fixture-model-xyz', 'runtime network fixture paints response ids');
    assert.doesNotMatch(fetched.live, /tok\/s|12\.5/);
    assert.equal(fetched.empty, 'No Mac online.', 'runtime empty does not invent a model');
    assert.doesNotMatch(fetched.empty, /Live\.|fixture-model|gemma3|qwen3/);
    assert.equal(fetched.failed, 'No Mac online.', 'fetch fail does not invent a model');
    assert.doesNotMatch(fetched.failed, /Live\.|fixture-model|gemma3|qwen3|gpt-oss/);
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-buyer-live-models: PASS');
