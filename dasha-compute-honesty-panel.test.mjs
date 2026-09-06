#!/usr/bin/env node
/**
 * Compute honesty panel — post-Start live /network + /factory strip.
 * Honest zeros; no fake Macs; Prefer MLX stays on Provide only.
 * Quiet measured tok/s on #honesty-macs when capacity.measured_providers≥1.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs sync');

assert.match(html, /id=["']honesty-panel["']/);
assert.match(html, /id=["']honesty-hosted["'][^>]*>Hosted · live</);
assert.match(html, /id=["']honesty-macs["'][^>]*>No Mac online</);
assert.match(html, /id=["']honesty-settled["'][^>]*>0 tok · 24h</);
assert.match(html, /data-honesty=["']live["']/);
assert.match(html, /aria-live=["']polite["']/);
assert.match(html, /id=["']honesty-panel["'][^>]*\bhidden\b/);

const gate = html.slice(html.indexOf('id="step-gate"'), html.indexOf('id="step-how"'));
assert.match(gate, /Start\./);
assert.doesNotMatch(gate, /honesty-panel|honesty-macs|Hosted · live/);

assert.match(html, /\/compute\/api\/network/);
assert.match(html, /\/compute\/api\/factory/);
assert.match(html, /function paintHonestyPanel\(/);
assert.match(html, /function refreshHonesty\(/);
assert.match(html, /startHonestyPoll/);
assert.match(html, /api\(['"]\/compute\/api\/network['"]\)/);
assert.match(html, /api\(['"]\/compute\/api\/factory['"]\)/);

assert.match(html, /No Mac online/);
assert.match(html, /n\+' online'/);
assert.match(html, /online · ~'\+tpsLabel\+' tok\/s/);
assert.match(html, /measured_providers/);
assert.match(html, /mp>=1&&Number\.isFinite\(tps\)&&tps>0/);
assert.match(html, /never invent\/pad/);
assert.match(html, /Hosted · live/);
assert.match(html, /Hosted · —/);
assert.match(html, /0 tok · 24h/);
assert.match(html, /tok\/s measured/);

assert.match(html, /if\(step===['"]gate['"]\)\{clearHonestyPoll\(\);paintHonestyPanel\(\)\}/);
assert.match(html, /else\{paintHonestyPanel\(\);startHonestyPoll\(\)\}/);

const panelStart = html.indexOf('id="honesty-panel"');
const panel = html.slice(panelStart, html.indexOf('</aside>', panelStart) + 8);
assert.doesNotMatch(panel, /Prefer MLX|provide-prefer-mlx/);
assert.match(html, /id=["']provide-prefer-mlx["'][^>]*>Prefer MLX when you can/);

assert.doesNotMatch(html, /~12 Macs|12 Macs online|fake sparkline|plugin\.jup\.ag/i);
assert.doesNotMatch(html, /network warming up|join our waitlist|alpha may be empty/i);

assert.match(html, /id=["']settled-24h["']/);
assert.match(html, /id=["']night-q["'][^>]*>No Mac online\.</);
assert.match(html, /paintSettled24h[\s\S]*?paintHonestyPanel\(\)/);

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
      const panel = document.getElementById('honesty-panel');
      const macs = document.getElementById('honesty-macs');
      return { hidden: panel?.hidden === true, text: (macs?.textContent || '').trim() };
    });
    assert.equal(first.hidden, true, 'gate first paint hides panel');
    assert.equal(first.text, 'No Mac online');

    const zero = await page.evaluate(() => {
      providersOnline = 0;
      networkCapacity = [];
      hostedLive = true;
      showTf('ask');
      const panel = document.getElementById('honesty-panel');
      const macs = document.getElementById('honesty-macs');
      return { hidden: panel.hidden === true, text: macs.textContent, title: macs.title || '' };
    });
    assert.equal(zero.hidden, false, 'panel visible past gate');
    assert.equal(zero.text, 'No Mac online');
    assert.equal(zero.title, '');

    const measured = await page.evaluate(() => {
      providersOnline = 1;
      networkCapacity = [{ model: 'gemma3-27b', measured_providers: 1, tokens_per_second: 2.93 }];
      paintHonestyPanel();
      const macs = document.getElementById('honesty-macs');
      return { text: macs.textContent, title: macs.title, aria: macs.getAttribute('aria-label') };
    });
    assert.equal(measured.text, '1 online · ~2.93 tok/s');
    assert.equal(measured.title, 'gemma3-27b · 2.93 tok/s measured');
    assert.equal(measured.aria, measured.title);

    const unmeasured = await page.evaluate(() => {
      providersOnline = 2;
      networkCapacity = [{ model: 'qwen3-8b', measured_providers: 0, tokens_per_second: 42 }];
      paintHonestyPanel();
      const macs = document.getElementById('honesty-macs');
      return { text: macs.textContent, title: macs.title || '', aria: macs.getAttribute('aria-label') };
    });
    assert.equal(unmeasured.text, '2 online');
    assert.equal(unmeasured.title, '');
    assert.equal(unmeasured.aria, null);

    const fakeZero = await page.evaluate(() => {
      providersOnline = 1;
      networkCapacity = [{ model: 'qwen3-8b', measured_providers: 1, tokens_per_second: 0 }];
      paintHonestyPanel();
      return document.getElementById('honesty-macs').textContent;
    });
    assert.equal(fakeZero, '1 online', 'never invent/pad tok/s zeros');

    const stillGate = await page.evaluate(() => {
      providersOnline = 1;
      networkCapacity = [{ model: 'gemma3-27b', measured_providers: 1, tokens_per_second: 2.93 }];
      showTf('gate');
      const panel = document.getElementById('honesty-panel');
      const macs = document.getElementById('honesty-macs');
      return { hidden: panel.hidden === true, text: macs.textContent };
    });
    assert.equal(stillGate.hidden, true, 'gate stays hidden even with measured capacity');
    assert.equal(stillGate.text, '1 online', 'gate return leaves prior macs text');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-honesty-panel: PASS');
