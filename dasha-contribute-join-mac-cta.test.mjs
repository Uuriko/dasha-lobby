#!/usr/bin/env node
/**
 * /contribute: stronger Join a Mac CTA only when /compute/api/network
 * advertising says a Mac is online. First paint stays hidden.
 * Quiet Ask · Join · Benchmarks line stays. No invented Mac count.
 * Contribute is not stripHomeCompute / stripRetiredProductDoors
 * (those eat /compute on home + howto). Disk only. No Designer.
 * Never plugin.jup.ag. No wrangler.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  contributeJoinMacOnline,
  paintContributeJoinMacCta,
  stripHomeCompute,
  stripRetiredProductDoors,
} from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

assert.doesNotMatch(worker, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(worker, /<!-- contribute-join-mac-cta:2026-09-10 -->/, 'marker');
assert.match(worker, /export function contributeJoinMacOnline/);
assert.match(worker, /export function paintContributeJoinMacCta/);
assert.match(worker, /fetch\('\/compute\/api\/network'/, 'honest network advertising');
assert.match(worker, /stripContributeLeftoverCodeCss\(CONTRIBUTE_HTML\)/, 'contribute polish is leftover CSS only');
assert.doesNotMatch(
  worker.match(/function contributePageResponse\([\s\S]*?\n\}/)?.[0] || '',
  /stripHomeCompute|stripRetiredProductDoors/,
  'contribute response does not run Instinct compute strips',
);

assert.equal(contributeJoinMacOnline(1), true, '1 Mac online');
assert.equal(contributeJoinMacOnline(2), true, '2 Macs still online (no count painted)');
assert.equal(contributeJoinMacOnline(0), false, '0 stays quiet');
assert.equal(contributeJoinMacOnline('0'), false, 'string 0 stays quiet');
assert.equal(contributeJoinMacOnline(undefined), false, 'missing stays quiet');
assert.equal(contributeJoinMacOnline(null), false, 'null stays quiet');
assert.equal(contributeJoinMacOnline('nope'), false, 'garbage stays quiet');

const block = worker.match(/const CONTRIBUTE_HTML = htmlPage\([\s\S]*?\);\n/);
assert.ok(block, 'CONTRIBUTE_HTML');
assert.match(
  block[0],
  /<p id="join-mac-cta" hidden><a class="cta" href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac<\/a><\/p>/,
  'Join CTA hidden first paint',
);
assert.match(block[0], /<p id="join-mac-note" hidden>A Mac is online\.<\/p>/, 'honest note hidden first paint');
assert.match(
  block[0],
  /<p>Compute\. <a href="https:\/\/www\.getdasha\.com\/compute#ask">Ask a Mac<\/a> · <a href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac<\/a> · <a href="https:\/\/www\.getdasha\.com\/benchmarks">Benchmarks<\/a><\/p>/,
  'quiet Compute line stays',
);
assert.doesNotMatch(block[0], /\b\d+\s+Macs?\b/i, 'no invented Mac count on disk');
assert.doesNotMatch(block[0], /plugin\.jup\.ag/);

function assertHiddenCta(html, label) {
  assert.match(html, /id=["']join-mac-cta["'][^>]*\bhidden/, `${label} CTA hidden`);
  assert.match(html, /id=["']join-mac-note["'][^>]*\bhidden/, `${label} note hidden`);
  assert.match(html, /href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac/, `${label} Join href`);
  assert.doesNotMatch(html, /\b\d+\s+Macs?\b/i, `${label} no invented Mac count`);
}

function assertShownCta(html, label) {
  assert.match(html, /<p id="join-mac-cta"><a class="cta" href="https:\/\/www\.getdasha\.com\/compute#provide">Join a Mac<\/a><\/p>/, `${label} CTA shown`);
  assert.match(html, /<p id="join-mac-note">A Mac is online\.<\/p>/, `${label} note shown`);
  assert.doesNotMatch(html, /\b\d+\s+Macs?\b/i, `${label} still no invented count`);
}

const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/contribute'), {});
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'contribute');
const first = await res.text();
assertHiddenCta(first, 'served first paint');
assert.match(first, /Pick a first issue/, 'code CTA stays');
assert.equal(paintContributeJoinMacCta(first, 0), first, '0 leaves first paint');
assertShownCta(paintContributeJoinMacCta(first, 1), 'paint online');
assertHiddenCta(paintContributeJoinMacCta(first, 0), 'paint offline');

const lobby = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/contribute'), {});
assert.equal(lobby.status, 200);
assertHiddenCta(await lobby.text(), 'lobby first paint');

{
  const eaten = stripRetiredProductDoors(first);
  assert.doesNotMatch(eaten, /href="https:\/\/www\.getdasha\.com\/compute#provide"/, 'howto strip would eat Join');
  assert.match(first, /href="https:\/\/www\.getdasha\.com\/compute#provide"/, 'contribute keeps Join because that strip is not applied');
}

{
  const homeKill = stripHomeCompute('<a class="compute" href="/compute">Compute</a><a href="/compute#provide">Join a Mac</a>');
  assert.doesNotMatch(homeKill, /href="\/compute"/, 'stripHomeCompute eats exact /compute');
  assert.match(homeKill, /href="\/compute#provide"/, 'hash Join survives stripHomeCompute');
}

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const { createServer } = await import('node:http');
  async function withNetworkPage(providersOnline, fn) {
    const server = createServer((req, res) => {
      if (String(req.url || '').startsWith('/compute/api/network')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ providers_online: providersOnline, models_available: [] }));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(first);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}/contribute`, { waitUntil: 'networkidle0' });
      await fn(page);
    } finally {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
    }
  }
  await withNetworkPage(1, async (page) => {
    const painted = await page.evaluate(() => {
      const cta = document.getElementById('join-mac-cta');
      const note = document.getElementById('join-mac-note');
      const a = cta?.querySelector('a');
      return {
        ctaHidden: cta?.hidden === true,
        noteHidden: note?.hidden === true,
        note: (note?.textContent || '').trim(),
        href: a?.getAttribute('href') || '',
        text: (a?.textContent || '').trim(),
        cls: a?.className || '',
      };
    });
    assert.equal(painted.ctaHidden, false, 'puppeteer shows Join CTA when Mac online');
    assert.equal(painted.noteHidden, false, 'puppeteer shows A Mac is online.');
    assert.equal(painted.note, 'A Mac is online.');
    assert.equal(painted.href, 'https://www.getdasha.com/compute#provide');
    assert.equal(painted.text, 'Join a Mac');
    assert.match(painted.cls, /\bcta\b/);
  });
  await withNetworkPage(0, async (page) => {
    const quiet = await page.evaluate(() => ({
      ctaHidden: document.getElementById('join-mac-cta')?.hidden === true,
      noteHidden: document.getElementById('join-mac-note')?.hidden === true,
    }));
    assert.equal(quiet.ctaHidden, true, 'puppeteer keeps Join CTA hidden at providers_online:0');
    assert.equal(quiet.noteHidden, true, 'puppeteer keeps note hidden at providers_online:0');
  });
}

console.log('dasha-contribute-join-mac-cta: PASS (Join CTA hidden until providers_online>=1; quiet Compute line stays; no count; contribute skips Instinct compute strips)');
