#!/usr/bin/env node
/**
 * Quiet "Listed on" footer on /compute — post-Start. gate only.
 * AiToolsList.Tools documented dofollow badge (submit page). stork.ai
 * documents rel="nofollow" only — omitted. Lobby live-badge src stays.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const LOBBY_BADGE = 'https://lobby.getdasha.com/compute/badge.svg';
const LISTED_EMBED = '<a href="https://aitoolslist.tools" target="_blank" rel="dofollow"><img src="https://aitoolslist.tools/badges/aitoolslist-listed-light.svg" alt="Listed on AiToolsList.Tools" width="220" height="58" /></a>';
const FOOTER_LINE = `Listed on ${LISTED_EMBED}`;

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function listedFooter(html) {
  const start = html.indexOf('id="listed-on"');
  assert.ok(start > 0, 'listed-on id');
  const tagStart = html.lastIndexOf('<footer', start);
  const tagEnd = html.indexOf('</footer>', start);
  assert.ok(tagStart >= 0 && tagEnd > tagStart, 'listed-on footer bounds');
  return html.slice(tagStart, tagEnd + 9);
}

function listingLinks(html) {
  const footer = listedFooter(html);
  return [...footer.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
}

function assertListedOn(html, label) {
  const footer = listedFooter(html);
  assert.match(footer, /id=["']listed-on["']/, `${label} listed-on footer`);
  assert.match(footer, /\bhidden\b/, `${label} hidden first paint`);
  assert.match(html, new RegExp(FOOTER_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} exact footer line`);
  assert.equal(footer.includes(FOOTER_LINE), true, `${label} footer line inside listed-on`);

  const links = listingLinks(html);
  assert.equal(links.length, 1, `${label} one listing link`);
  assert.match(links[0], /rel=["']dofollow["']/, `${label} documented dofollow`);
  assert.doesNotMatch(links[0], /nofollow/i, `${label} listing link not nofollow`);
  assert.match(links[0], /href=["']https:\/\/aitoolslist\.tools["']/, `${label} aitoolslist href`);
  assert.match(links[0], /target=["']_blank["']/, `${label} new tab as documented`);

  assert.match(html, new RegExp(`id=["']compute-live-badge["'][^>]*src=["']${LOBBY_BADGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`), `${label} lobby badge src`);
  assert.doesNotMatch(html, /www\.getdasha\.com\/compute\/badge\.svg/, `${label} not www badge src`);

  const gate = html.slice(html.indexOf('id="step-gate"'), html.indexOf('id="step-how"'));
  assert.match(gate, /Start\./, `${label} Start. gate`);
  assert.doesNotMatch(gate, /listed-on|aitoolslist|Listed on/, `${label} not inside Start. gate`);

  assert.doesNotMatch(html, /stork\.ai/, `${label} stork omitted (documented nofollow only)`);
  assert.doesNotMatch(html, /we are listed|already listed|now listed/i, `${label} no listed claim`);
  assert.doesNotMatch(footer, /disclaimer/i, `${label} no disclaimer`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertListedOn(disk, 'disk');
assertListedOn(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertListedOn(await res.text(), 'worker.fetch');

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
      const listed = document.getElementById('listed-on');
      const badge = document.getElementById('compute-live-badge');
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const link = listed?.querySelector('a');
      return {
        step: document.body.dataset.step,
        listedHidden: listed?.hidden === true,
        listedVisible: vis(listed),
        inGate: !!document.querySelector('#step-gate #listed-on'),
        line: (listed?.textContent || '').replace(/\s+/g, ' ').trim(),
        href: link?.getAttribute('href') || '',
        rel: link?.getAttribute('rel') || '',
        target: link?.getAttribute('target') || '',
        badgeSrc: badge?.getAttribute('src') || '',
      };
    });
    assert.equal(gate.step, 'gate', 'cold boot Start.');
    assert.equal(gate.listedHidden, true, 'listed-on hidden on Start.');
    assert.equal(gate.listedVisible, false, 'listed-on not on Start. first paint');
    assert.equal(gate.inGate, false, 'listed-on not inside step-gate');
    assert.equal(gate.line, 'Listed on', 'quiet Listed on line');
    assert.equal(gate.href, 'https://aitoolslist.tools');
    assert.equal(gate.rel, 'dofollow');
    assert.doesNotMatch(gate.rel, /nofollow/i);
    assert.equal(gate.target, '_blank');
    assert.equal(gate.badgeSrc, LOBBY_BADGE, 'lobby badge src on first paint');

    const ask = await page.evaluate(() => {
      showTf('ask');
      const listed = document.getElementById('listed-on');
      const badge = document.getElementById('compute-live-badge');
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      return {
        step: document.body.dataset.step,
        listedHidden: listed?.hidden === true,
        listedVisible: vis(listed),
        badgeSrc: badge?.getAttribute('src') || '',
      };
    });
    assert.equal(ask.step, 'ask', 'Ask past Start.');
    assert.equal(ask.listedHidden, false, 'listed-on after Start.');
    assert.equal(ask.listedVisible, true, 'listed-on visible after Start.');
    assert.equal(ask.badgeSrc, LOBBY_BADGE);
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-listed-on-footer: PASS');
