#!/usr/bin/env node
/**
 * Start. / gate proof chip — live /compute/api/network capacity.
 * When providers_online≥1 and a capacity row has measured_providers≥1 + finite tok/s,
 * #gate-proof repeats the winning measured Mac: `1 Mac · qwen3-8b ~24 tok/s`.
 * Kate Tolo: if it works, say it again. Never invent tok/s, Macs, or models.
 * providers_online=0 or unmeasured capacity stays the quiet static line.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag. No Room Phase 0.
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

function gateSlice(html) {
  const start = html.indexOf('id="step-gate"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, 'gate slice');
  return html.slice(start, end);
}

function assertGateProofLive(html, label) {
  const gate = gateSlice(html);
  assert.match(html, /<!-- gate-proof-live:2026-09-11 -->/, `${label} marker`);
  assert.match(gate, /id=["']gate-proof["'][^>]*>Measured Mac speed via network capacity\.</, `${label} quiet first-paint copy`);
  assert.match(html, /function winningMeasuredCapacity\(/, `${label} winningMeasuredCapacity`);
  assert.match(html, /function formatGateProofTok\(/, `${label} formatGateProofTok`);
  assert.match(html, /function formatGateProofLine\(/, `${label} formatGateProofLine`);
  assert.match(html, /function paintGateProof\(/, `${label} paintGateProof`);
  assert.match(html, /paintGateProof\(\)/, `${label} paintGateProof call`);
  assert.match(html, /n>=1&&win/, `${label} live path requires measured win`);
  assert.match(html, /mp>=1&&Number\.isFinite\(tps\)&&tps>0/, `${label} measured_providers + finite tok\/s`);
  assert.match(html, /Kate Tolo: if it works, say it again/, `${label} Kate Tolo`);
  assert.match(html, /never invent tok\/s, models, or Macs/, `${label} never invent`);
  assert.match(html, /never invent teams/, `${label} no fake teams`);
  assert.match(html, /'1 Mac'/, `${label} singular Mac`);
  assert.match(html, /count\+' Macs'/, `${label} plural Macs`);
  assert.match(html, /' ~'\+tpsLabel\+' tok\/s'/, `${label} ~tok\/s from live`);
  assert.match(html, /api\(['"]\/compute\/api\/network['"]\)/, `${label} reads GET \/compute\/api\/network`);
  assert.match(html, /refreshHonesty[\s\S]*?paintHonestyPanel\(\)/, `${label} refreshHonesty → paint`);
  assert.match(html, /paintHonestyPanel\(\)[\s\S]*?paintPresenceActBoot\(\)/, `${label} panel paints boot`);
  assert.match(html, /paintPresenceActBoot\(\)[\s\S]*?paintGateProof\(\)/, `${label} boot paints proof`);
  assert.match(gate, /id=["']ux-demo-pair["'][^>]*>Hosted vs Community</, `${label} Hosted vs Community stays`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(gate, /\/room|Project Room|Phase 0/i, `${label} no Room Phase 0`);
  assert.doesNotMatch(gate, /disclaimer|not financial advice|\bdyor\b|\bnfa\b/i, `${label} no lecture`);
}

assertGateProofLive(disk, 'disk');
assertGateProofLive(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
assertGateProofLive(await served.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });

    const first = await page.evaluate(() => {
      const el = document.getElementById('gate-proof');
      const vis = !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      return { vis, text: (el?.textContent || '').trim(), step: document.body.dataset.step };
    });
    assert.equal(first.step, 'gate', 'cold first paint Start.');
    assert.equal(first.vis, true, 'proof chip on Start.');
    assert.equal(first.text, 'Measured Mac speed via network capacity.', 'static first paint does not invent tok/s');

    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const painted = await page.evaluate(() => {
      const read = () => (document.getElementById('gate-proof')?.textContent || '').trim();
      const run = (n, capacity) => {
        providersOnline = n;
        networkCapacity = capacity;
        paintGateProof();
        return read();
      };
      const liveShape = [
        { model: 'qwen3-8b', providers: 1, measured_providers: 1, tokens_per_second: 24.37 },
        { model: 'gemma3-12b', providers: 1, measured_providers: 1, tokens_per_second: 16.22 },
        { model: 'gemma3-27b', providers: 1, measured_providers: 1, tokens_per_second: 5.37 },
      ];
      return {
        winning: run(1, liveShape),
        slowerFirst: run(1, [
          { model: 'gemma3-27b', measured_providers: 1, tokens_per_second: 5.37 },
          { model: 'qwen3-8b', measured_providers: 1, tokens_per_second: 24.37 },
        ]),
        twoMacs: run(2, [{ model: 'qwen3-8b', measured_providers: 1, tokens_per_second: 38 }]),
        noModel: run(1, [{ measured_providers: 1, tokens_per_second: 24.37 }]),
        unmeasured: run(1, [{ model: 'qwen3-8b', measured_providers: 0, tokens_per_second: 42 }]),
        zeroTps: run(1, [{ model: 'qwen3-8b', measured_providers: 1, tokens_per_second: 0 }]),
        nanTps: run(1, [{ model: 'qwen3-8b', measured_providers: 1, tokens_per_second: Number.NaN }]),
        offline: run(0, liveShape),
        empty: run(0, []),
      };
    });

    assert.equal(painted.winning, '1 Mac · qwen3-8b ~24 tok/s', 'winning live qwen3-8b 24.37');
    assert.equal(painted.slowerFirst, '1 Mac · qwen3-8b ~24 tok/s', 'winning row not capacity[0]');
    assert.equal(painted.twoMacs, '2 Macs · qwen3-8b ~38 tok/s', 'plural Macs from providers_online');
    assert.equal(painted.noModel, '1 Mac · ~24 tok/s', 'omit empty model — never invent');
    assert.equal(painted.unmeasured, 'Measured Mac speed via network capacity.', 'unmeasured stays quiet');
    assert.equal(painted.zeroTps, 'Measured Mac speed via network capacity.', 'never fake zero as fast');
    assert.equal(painted.nanTps, 'Measured Mac speed via network capacity.', 'NaN tok/s stays quiet');
    assert.equal(painted.offline, 'Measured Mac speed via network capacity.', 'providers_online=0 ignores leftover capacity');
    assert.equal(painted.empty, 'Measured Mac speed via network capacity.', 'empty fleet stays honest');

    const fetched = await page.evaluate(async () => {
      const orig = window.fetch;
      const read = () => (document.getElementById('gate-proof')?.textContent || '').trim();
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

      tfStep = 'gate';
      window.fetch = stub({
        providers_online: 1,
        models_available: ['qwen3-8b', 'gemma3-12b', 'gemma3-27b'],
        capacity: [
          { model: 'qwen3-8b', providers: 1, measured_providers: 1, tokens_per_second: 24.37 },
          { model: 'gemma3-12b', providers: 1, measured_providers: 1, tokens_per_second: 16.22 },
          { model: 'gemma3-27b', providers: 1, measured_providers: 1, tokens_per_second: 5.37 },
        ],
      });
      await refreshHonesty();
      const live = read();
      const presence = (document.getElementById('presence-community')?.textContent || '').trim();

      window.fetch = stub({ providers_online: 0, models_available: [], capacity: [] });
      await refreshHonesty();
      const empty = read();

      window.fetch = stub({
        providers_online: 1,
        models_available: ['qwen3-8b'],
        capacity: [{ model: 'qwen3-8b', measured_providers: 0, tokens_per_second: 99 }],
      });
      await refreshHonesty();
      const unmeasured = read();

      window.fetch = stub({}, true);
      providersOnline = 0;
      networkCapacity = [];
      await refreshHonesty();
      const failed = read();

      window.fetch = orig;
      return { live, empty, unmeasured, failed, presence };
    });

    assert.equal(fetched.live, '1 Mac · qwen3-8b ~24 tok/s', 'refreshHonesty paints winning live capacity');
    assert.match(fetched.presence, /qwen3-8b/, 'presence chip still names the live model');
    assert.match(fetched.presence, /tok\/s/, 'presence chip still shows measured tok/s');
    assert.equal(fetched.empty, 'Measured Mac speed via network capacity.', 'refreshHonesty empty stays quiet');
    assert.equal(fetched.unmeasured, 'Measured Mac speed via network capacity.', 'refreshHonesty unmeasured stays quiet');
    assert.equal(fetched.failed, 'Measured Mac speed via network capacity.', 'fetch fail does not invent tok/s');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-gate-proof-live: PASS (winning Mac · model ~tok/s; quiet offline; never invent)');
