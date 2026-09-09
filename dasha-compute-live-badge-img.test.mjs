#!/usr/bin/env node
/**
 * Quiet live Mac-count badge on /compute honesty strip.
 * Locks lobby src — www /compute/badge.svg is still 404 until Worker deploy.
 * Not on first-paint Start. gate. Listed-on footer is a separate cut.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const LOBBY_BADGE = 'https://lobby.getdasha.com/compute/badge.svg';
const IMG_RE = /<img\b[^>]*\bid=["']compute-live-badge["'][^>]*>/;

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function assertLiveBadge(html, label) {
  const imgs = html.match(new RegExp(IMG_RE.source, 'g')) || [];
  assert.equal(imgs.length, 1, `${label} one compute-live-badge`);
  const img = imgs[0];
  assert.match(img, new RegExp(`src=["']${LOBBY_BADGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`), `${label} lobby src`);
  assert.match(img, /alt=["']Dasha Compute · live Macs["']/, `${label} alt`);
  assert.match(img, /loading=["']lazy["']/, `${label} lazy`);
  assert.doesNotMatch(img, /www\.getdasha\.com\/compute\/badge\.svg/, `${label} not www src until deploy`);

  const panelStart = html.indexOf('id="honesty-panel"');
  assert.ok(panelStart > 0, `${label} honesty-panel`);
  const panel = html.slice(panelStart, html.indexOf('</aside>', panelStart) + 8);
  assert.match(panel, IMG_RE, `${label} badge in honesty strip`);

  const gate = html.slice(html.indexOf('id="step-gate"'), html.indexOf('id="step-how"'));
  assert.doesNotMatch(gate, /compute-live-badge|badge\.svg/, `${label} not Start. gate`);

  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertLiveBadge(disk, 'disk');
assertLiveBadge(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertLiveBadge(await res.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});

    const gate = await page.evaluate(() => {
      const panel = document.getElementById('honesty-panel');
      const badge = document.getElementById('compute-live-badge');
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      return {
        step: document.body.dataset.step,
        panelHidden: panel?.hidden === true,
        badgeSrc: badge?.getAttribute('src') || '',
        badgeAlt: badge?.getAttribute('alt') || '',
        badgeLazy: badge?.getAttribute('loading') || '',
        badgeVisible: vis(badge),
        inGate: !!document.querySelector('#step-gate #compute-live-badge'),
      };
    });
    assert.equal(gate.step, 'gate', 'cold boot Start.');
    assert.equal(gate.panelHidden, true, 'honesty strip hidden on Start.');
    assert.equal(gate.badgeSrc, LOBBY_BADGE, 'lobby src on first paint');
    assert.equal(gate.badgeAlt, 'Dasha Compute · live Macs');
    assert.equal(gate.badgeLazy, 'lazy');
    assert.equal(gate.badgeVisible, false, 'badge not on Start. gate');
    assert.equal(gate.inGate, false, 'badge not inside step-gate');

    const ask = await page.evaluate(() => {
      showTf('ask');
      const panel = document.getElementById('honesty-panel');
      const badge = document.getElementById('compute-live-badge');
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      return {
        step: document.body.dataset.step,
        panelHidden: panel?.hidden === true,
        inPanel: !!(badge && panel?.contains(badge)),
        badgeVisible: vis(badge),
        badgeSrc: badge?.getAttribute('src') || '',
      };
    });
    assert.equal(ask.step, 'ask', 'Ask past Start.');
    assert.equal(ask.panelHidden, false, 'honesty strip after Start.');
    assert.equal(ask.inPanel, true, 'badge stays in honesty strip');
    assert.equal(ask.badgeVisible, true, 'badge visible after Start.');
    assert.equal(ask.badgeSrc, LOBBY_BADGE);
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-live-badge-img: PASS');
