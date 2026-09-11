#!/usr/bin/env node
/**
 * Fleet P2-2: quiet #build guest CTA for logged-out humans.
 * Get 24h guest key → POST /compute/api/guest-keys. Copy once. Chat at /compute/api/v1.
 * Create API key stays behind Sign in. Do not replace developer keys.
 * No wrangler. Stay off desk ocm/. #180 marketplace/login skin stays.
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

function assertGuestCta(html, label) {
  assert.match(html, /id=["']get-guest-key["']/, `${label} guest CTA id`);
  assert.match(
    html,
    /id=["']get-guest-key["'][^>]*>Get 24h guest key</,
    `${label} guest CTA copy`,
  );
  assert.match(html, /id=["']guest-key-line["']/, `${label} guest-key-line`);
  assert.match(html, /id=["']guest-key-output["'][^>]*hidden/, `${label} output hidden until mint`);
  assert.match(
    html,
    /id=["']copy-guest-key["'][^>]*data-copy=["']guest-key-output["'][^>]*hidden[^>]*>Copy</,
    `${label} copy once`,
  );
  assert.match(html, /\/compute\/api\/guest-keys/, `${label} POSTs guest-keys`);
  assert.match(
    html,
    /method:\s*['"]POST['"][\s\S]{0,180}\/compute\/api\/guest-keys|\/compute\/api\/guest-keys[\s\S]{0,180}method:\s*['"]POST['"]/,
    `${label} POST guest-keys`,
  );
  assert.match(
    html,
    /Copy now\. 24h\. Chat at \/compute\/api\/v1/,
    `${label} points chat at /compute/api/v1`,
  );
  assert.match(html, /guestBtn\.hidden=loggedIn/, `${label} hide guest when signed in`);
  assert.match(html, /id=["']create-api-key["'][^>]*>Create API key</, `${label} Create API key stays`);
  assert.match(html, /\$\(['"]create-api-key['"]\)\.hidden=!loggedIn/, `${label} create key still Sign-in`);
  assert.match(
    html,
    /id=["']api-key-output["'][\s\S]{0,40}Sign in to create a developer key/,
    `${label} developer output stays`,
  );
  assert.match(html, /id=["']gate-ocm["'][^>]*href=["']\/compute\/ocm["']/, `${label} #180 gate-ocm stays`);
  assert.doesNotMatch(html, /dasha-ocm-login-skin/, `${label} no OCM skin on compute page`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertGuestCta(disk, 'disk');
assertGuestCta(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'));
assert.equal(res.status, 200);
assert.equal(res.headers.get('x-dasha-edge'), 'compute');
assertGuestCta(await res.text(), 'worker');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { if (typeof showTf === 'function') showTf('build'); });
    const first = await page.evaluate(() => {
      const btn = document.getElementById('get-guest-key');
      const create = document.getElementById('create-api-key');
      return {
        copy: btn?.textContent || '',
        guestHidden: !!btn?.hidden,
        createHidden: !!create?.hidden,
        createDisabled: !!create?.disabled,
        outHidden: !!document.getElementById('guest-key-output')?.hidden,
        copyHidden: !!document.getElementById('copy-guest-key')?.hidden,
      };
    });
    assert.equal(first.copy, 'Get 24h guest key', 'first-paint copy');
    assert.equal(first.guestHidden, false, 'guest CTA visible logged-out');
    assert.equal(first.createHidden, true, 'Create API key still Sign-in');
    assert.equal(first.createDisabled, true, 'Create API key disabled logged-out');
    assert.equal(first.outHidden, true, 'key hidden until mint');
    assert.equal(first.copyHidden, true, 'copy hidden until mint');

    await page.evaluate(() => {
      const orig = window.fetch.bind(window);
      window.fetch = (url, opts = {}) => {
        if (String(url).includes('/compute/api/guest-keys') && String(opts.method || '').toUpperCase() === 'POST') {
          return Promise.resolve(new Response(JSON.stringify({
            api_key: 'dgk_testguestky.abcdefghijklmnopqrstuvwx',
          }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
        }
        return orig(url, opts);
      };
    });
    await page.click('#get-guest-key');
    await page.waitForFunction(() => {
      const out = document.getElementById('guest-key-output');
      return out && !out.hidden && /dgk_testguestky/.test(out.textContent || '');
    }, { timeout: 3000 });
    const minted = await page.evaluate(() => {
      const out = document.getElementById('guest-key-output');
      const copy = document.getElementById('copy-guest-key');
      const dev = document.getElementById('api-key-output');
      return {
        text: out?.textContent || '',
        outHidden: !!out?.hidden,
        copyHidden: !!copy?.hidden,
        copyLabel: copy?.textContent || '',
        dev: dev?.textContent || '',
      };
    });
    assert.match(minted.text, /dgk_testguestky\.abcdefghijklmnopqrstuvwx/, 'shows key once');
    assert.match(minted.text, /Chat at \/compute\/api\/v1/, 'points chat at v1');
    assert.equal(minted.outHidden, false, 'output visible after mint');
    assert.equal(minted.copyHidden, false, 'copy visible after mint');
    assert.equal(minted.copyLabel, 'Copy', 'copy label');
    assert.match(minted.dev, /Sign in to create a developer key/, 'developer output untouched');

    const signedIn = await page.evaluate(() => {
      loggedIn = true;
      updateProvideAuth();
      return {
        guestHidden: !!document.getElementById('get-guest-key')?.hidden,
        lineHidden: !!document.getElementById('guest-key-line')?.hidden,
        outHidden: !!document.getElementById('guest-key-output')?.hidden,
        copyHidden: !!document.getElementById('copy-guest-key')?.hidden,
        createHidden: !!document.getElementById('create-api-key')?.hidden,
        createDisabled: !!document.getElementById('create-api-key')?.disabled,
      };
    });
    assert.equal(signedIn.guestHidden, true, 'guest CTA gone when signed in');
    assert.equal(signedIn.lineHidden, true, 'guest line gone when signed in');
    assert.equal(signedIn.outHidden, true, 'guest output gone when signed in');
    assert.equal(signedIn.copyHidden, true, 'guest copy gone when signed in');
    assert.equal(signedIn.createHidden, false, 'Create API key appears when signed in');
    assert.equal(signedIn.createDisabled, false, 'Create API key enabled when signed in');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-guest-key-cta: PASS');
