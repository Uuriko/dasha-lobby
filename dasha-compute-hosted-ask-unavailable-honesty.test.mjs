#!/usr/bin/env node
/**
 * Ask/How Hosted unavailable honesty — leftover of #94 Night mute.
 * After auth + hostedLive===false: mute #eng-hosted, Ask engine Hosted · —,
 * never paint 3-free. Pre-auth optimistic Hosted stays. Status refresh
 * re-paints ask/how/model. Disk only. No wrangler. No Designer. No plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'html ↔ page.mjs sync');

function assertAskUnavailableHonesty(html, label) {
  assert.match(html, /<!-- hosted-ask-unavailable-honesty:2026-09-07 -->/, `${label} marker comment`);
  assert.match(html, /<!-- hosted-denial-honesty:2026-09-07 -->/, `${label} denial sibling stays`);
  assert.match(
    html,
    /<!-- hosted-denial-honesty:2026-09-07 -->\s*<!-- hosted-ask-unavailable-honesty:2026-09-07 -->/,
    `${label} marker next to hosted-denial`,
  );
  assert.match(html, /function paintAskEngine\(/, `${label} paintAskEngine`);
  assert.match(html, /function paintAskFreeFine\(/, `${label} paintAskFreeFine`);
  assert.match(
    html,
    /eng==='hosted'&&window\.__dashaAuthReady&&hostedLive===false\)btn\.textContent='Hosted · —'/,
    `${label} paintAskEngine Hosted · — when down`,
  );
  assert.match(html, /btn\.textContent=['"]Hosted['"]/, `${label} paintAskEngine Hosted restore`);
  assert.match(
    html,
    /el\.textContent='Hosted · unavailable · try Community\.'/,
    `${label} free-fine unavailable copy`,
  );
  assert.match(
    html,
    /el\.textContent='3 free \/ 10 min · then credits\.'/,
    `${label} free-fine 3-free restore`,
  );
  assert.match(
    html,
    /never paint 3-free while Hosted is down/,
    `${label} never 3-free comment`,
  );
  assert.match(html, /engHost\.textContent='Hosted · —'/, `${label} #eng-hosted Hosted · —`);
  assert.match(html, /engHost\.disabled=true/, `${label} #eng-hosted disabled`);
  assert.match(html, /engHost\.setAttribute\(['"]aria-disabled['"],['"]true['"]\)/, `${label} #eng-hosted aria-disabled`);
  assert.match(html, /engHost\.setAttribute\(['"]aria-label['"],['"]Hosted · unavailable['"]\)/, `${label} #eng-hosted aria-label`);
  assert.match(html, /engHost\.title='Hosted · unavailable'/, `${label} #eng-hosted title`);
  assert.match(html, /engHost\.textContent='Hosted'/, `${label} #eng-hosted restore Hosted`);
  assert.match(
    html,
    /engines \[data-engine\]['"]\)\.forEach\(b=>b\.addEventListener\(['"]click['"],\(\)=>\{if\(b\.dataset\.engine==='hosted'&&window\.__dashaAuthReady&&hostedLive===false\)return;(?:if\(b\.dataset\.engine==='hosted'\)hostedChosenThisSession=true;)?setEngine\(b\.dataset\.engine,true\)\}\)/,
    `${label} How click does not setEngine into dead Run`,
  );
  assert.match(html, /if\(tfStep==='night'\)paintNightAuth\(\)/, `${label} Night re-paint stays`);
  assert.match(
    html,
    /if\(tfStep==='ask'\|\|tfStep==='how'\|\|tfStep==='model'\)updateRun\(\)/,
    `${label} re-paint Ask/How/model after status`,
  );
  assert.match(html, /id=["']eng-hosted["'][^>]*>Hosted</, `${label} first-paint optimistic Hosted`);
  assert.match(html, /id=["']ask-free-fine["'][^>]*>3 free \/ 10 min · then credits\.</, `${label} first-paint 3-free`);
  assert.match(html, /id=["']change-engine["'][^>]*>Hosted</, `${label} first-paint Ask Hosted`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertAskUnavailableHonesty(disk, 'disk');
assertAskUnavailableHonesty(COMPUTE_PAGE_HTML, 'embed');

const servedRes = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(servedRes.status, 200);
assert.equal(servedRes.headers.get('x-dasha-edge'), 'compute');
assertAskUnavailableHonesty(await servedRes.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });

    const muted = await page.evaluate(() => {
      window.__dashaAuthReady = true;
      hostedLive = false;
      $('engine').value = 'hosted';
      showTf('how');
      updateRun();
      const btn = document.getElementById('eng-hosted');
      btn?.click();
      return {
        text: (btn?.textContent || '').trim(),
        disabled: btn?.disabled === true,
        aria: btn?.getAttribute('aria-label') || '',
        title: btn?.title || '',
        ariaDisabled: btn?.getAttribute('aria-disabled') || '',
        engine: document.getElementById('engine')?.value || '',
        step: document.body.dataset.step || '',
        askLabel: (document.getElementById('change-engine')?.textContent || '').trim(),
        fine: (document.getElementById('ask-free-fine')?.textContent || '').trim(),
      };
    });
    assert.equal(muted.text, 'Hosted · —');
    assert.equal(muted.disabled, true);
    assert.equal(muted.aria, 'Hosted · unavailable');
    assert.equal(muted.title, 'Hosted · unavailable');
    assert.equal(muted.ariaDisabled, 'true');
    assert.equal(muted.engine, 'hosted', 'muted Hosted does not change engine');
    assert.equal(muted.step, 'how', 'muted Hosted does not setEngine(hosted) → Ask');
    assert.equal(muted.askLabel, 'Hosted · —');
    assert.equal(muted.fine, 'Hosted · unavailable · try Community.');
    assert.doesNotMatch(muted.fine, /3 free/);

    const askFace = await page.evaluate(() => {
      window.__dashaAuthReady = true;
      hostedLive = false;
      $('engine').value = 'hosted';
      showTf('ask');
      paintAskEngine();
      paintAskFreeFine();
      return {
        label: (document.getElementById('change-engine')?.textContent || '').trim(),
        fine: (document.getElementById('ask-free-fine')?.textContent || '').trim(),
      };
    });
    assert.equal(askFace.label, 'Hosted · —');
    assert.equal(askFace.fine, 'Hosted · unavailable · try Community.');
    assert.doesNotMatch(askFace.fine, /3 free/);

    const optimistic = await page.evaluate(() => {
      window.__dashaAuthReady = false;
      hostedLive = false;
      $('engine').value = 'hosted';
      updateRun();
      paintAskEngine();
      paintAskFreeFine();
      const btn = document.getElementById('eng-hosted');
      return {
        text: (btn?.textContent || '').trim(),
        disabled: btn?.disabled === true,
        askLabel: (document.getElementById('change-engine')?.textContent || '').trim(),
        fine: (document.getElementById('ask-free-fine')?.textContent || '').trim(),
      };
    });
    assert.equal(optimistic.text, 'Hosted');
    assert.equal(optimistic.disabled, false, 'pre-auth optimistic Hosted stays');
    assert.equal(optimistic.askLabel, 'Hosted');
    assert.equal(optimistic.fine, '3 free / 10 min · then credits.');

    const restored = await page.evaluate(() => {
      window.__dashaAuthReady = true;
      hostedLive = true;
      $('engine').value = 'hosted';
      updateRun();
      paintAskEngine();
      paintAskFreeFine();
      const btn = document.getElementById('eng-hosted');
      return {
        text: (btn?.textContent || '').trim(),
        disabled: btn?.disabled === true,
        ariaDisabled: btn?.getAttribute('aria-disabled'),
        askLabel: (document.getElementById('change-engine')?.textContent || '').trim(),
        fine: (document.getElementById('ask-free-fine')?.textContent || '').trim(),
      };
    });
    assert.equal(restored.text, 'Hosted');
    assert.equal(restored.disabled, false);
    assert.equal(restored.ariaDisabled, null);
    assert.equal(restored.askLabel, 'Hosted');
    assert.equal(restored.fine, '3 free / 10 min · then credits.');

    const refresh = await page.evaluate(() => {
      window.__dashaAuthReady = true;
      hostedLive = false;
      tfStep = 'ask';
      $('engine').value = 'hosted';
      showTf('ask');
      if (tfStep === 'ask' || tfStep === 'how' || tfStep === 'model') updateRun();
      return {
        askLabel: (document.getElementById('change-engine')?.textContent || '').trim(),
        fine: (document.getElementById('ask-free-fine')?.textContent || '').trim(),
        howText: (document.getElementById('eng-hosted')?.textContent || '').trim(),
      };
    });
    assert.equal(refresh.askLabel, 'Hosted · —');
    assert.equal(refresh.fine, 'Hosted · unavailable · try Community.');
    assert.equal(refresh.howText, 'Hosted · —');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-hosted-ask-unavailable-honesty.test.mjs: PASS');
