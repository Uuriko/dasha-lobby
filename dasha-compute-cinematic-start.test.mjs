#!/usr/bin/env node
/**
 * Compute first-paint cinematic Start depth — CSS only.
 * Soft vignette, acid rim on Do, lift on Do/Provide/Pay/Credits,
 * quiet honest proof chip. No Three.js. No hamburger. No sage SaaS.
 * Disk == embed == worker.fetch. No wrangler. No Designer. Never plugin.jup.ag.
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

function rgbOf(color) {
  const m = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function isInk(rgb) {
  return rgb && rgb[0] <= 40 && rgb[1] <= 40 && rgb[2] <= 40;
}
function isAcid(rgb) {
  return rgb && rgb[0] >= 180 && rgb[1] >= 220 && rgb[2] <= 80;
}

function gateSlice(html) {
  const start = html.indexOf('id="step-gate"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, 'gate slice');
  return html.slice(start, end);
}

function assertCinematicStart(html, label) {
  const gate = gateSlice(html);
  assert.match(html, /data-step=["']gate["']/, `${label} body starts on gate`);
  assert.match(gate, /<h1 class=["']tf-q["']>Start\.<\/h1>/, `${label} Start. first`);
  assert.ok(gate.indexOf('Start.') < gate.indexOf('id="pick-ask"'), `${label} Start. before Do`);
  assert.match(html, /class=["']tf-step gate-cinematic["'] id=["']step-gate["']/, `${label} gate-cinematic class`);
  assert.match(html, /#step-gate\.gate-cinematic::before/, `${label} radial environment light`);
  assert.match(html, /#step-gate\.gate-cinematic::after/, `${label} soft vignette`);
  assert.match(html, /class=["']tf-choice primary tf-acid-rim tf-lift["'] id=["']pick-ask["']/, `${label} Ask acid rim + lift`);
  assert.match(html, /class=["']tf-choice secondary tf-lift["'] id=["']pick-provide["']/, `${label} Provide lift class`);
  assert.match(html, /class=["']tf-quiet tf-lift["'] id=["']pick-pay["']/, `${label} Pay lift class`);
  assert.match(html, /class=["']tf-quiet tf-lift["'] id=["']pick-credits["']/, `${label} Credits lift class`);
  assert.match(html, /@keyframes gate-acid-glow/, `${label} acid glow keyframes`);
  assert.match(html, /@keyframes gate-lift/, `${label} lift keyframes`);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)\{#step-gate \.tf-lift,#pick-ask\.tf-acid-rim/, `${label} reduced-motion kills float/glow`);
  assert.match(html, /#pick-ask\.tf-acid-rim\{background:var\(--acid\);border-color:var\(--acid\);color:var\(--ink\)/, `${label} acid rim stays ink on acid`);
  assert.match(gate, /id=["']gate-proof["'][^>]*>Measured Mac speed via network capacity\.</, `${label} honest proof chip`);
  assert.match(html, /function paintGateProof\(/, `${label} paintGateProof`);
  assert.match(html, /function winningMeasuredCapacity\(/, `${label} winning measured capacity`);
  assert.match(html, /n>=1&&win/, `${label} live tok\/s only when measured`);
  assert.match(html, /never invent teams/, `${label} no fake teams`);
  assert.match(html, /id=["']ux-triad["']/, `${label} Immersity triad stays`);
  assert.ok(gate.indexOf('Start.') < gate.indexOf('id="ux-triad"'), `${label} triad after Start.`);
  assert.doesNotMatch(html, /three\.js|from ['"]three['"]|WebGLRenderer|\bTHREE\./i, `${label} no three.js`);
  assert.doesNotMatch(html, /<canvas|webgl|WebGL/i, `${label} no WebGL mesh`);
  assert.doesNotMatch(html, /hamburger/i, `${label} no hamburger`);
  assert.doesNotMatch(html, /#84a98c|#cad2c5|#52796f|sage green/i, `${label} no generic sage`);
  assert.doesNotMatch(html, /\+10k teams|trusted by|social proof/i, `${label} no fake social proof`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(gate, /\/room|Project Room|Phase 0/i, `${label} no Room Phase 0`);
  assert.doesNotMatch(gate, /disclaimer|not financial advice|\bdyor\b|\bnfa\b/i, `${label} no lecture`);
}

assertCinematicStart(disk, 'disk');
assertCinematicStart(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
assertCinematicStart(await served.text(), 'worker.fetch');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });

    const first = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const ask = document.getElementById('pick-ask');
      const cs = ask ? getComputedStyle(ask) : null;
      const gate = document.getElementById('step-gate');
      const before = gate ? getComputedStyle(gate, '::before') : null;
      return {
        step: document.body.dataset.step,
        gateQ: document.querySelector('#step-gate .tf-q')?.textContent || '',
        cinematic: gate?.classList.contains('gate-cinematic') || false,
        askClass: ask?.className || '',
        provideClass: document.getElementById('pick-provide')?.className || '',
        payClass: document.getElementById('pick-pay')?.className || '',
        creditsClass: document.getElementById('pick-credits')?.className || '',
        proof: vis(document.getElementById('gate-proof')),
        proofText: (document.getElementById('gate-proof')?.textContent || '').trim(),
        triad: vis(document.getElementById('ux-triad')),
        hamburger: !!document.querySelector('[class*=hamburger], [id*=hamburger]'),
        canvas: !!document.querySelector('canvas'),
        color: cs?.color || '',
        bg: cs?.backgroundColor || '',
        askAnim: cs?.animationName || '',
        beforeContent: before?.content || '',
        beforeDisplay: before?.display || '',
      };
    });
    assert.equal(first.step, 'gate', 'cold first paint Start.');
    assert.equal(first.gateQ, 'Start.');
    assert.equal(first.cinematic, true, 'gate-cinematic on first paint');
    assert.match(first.askClass, /tf-acid-rim/, 'Ask acid rim class live');
    assert.match(first.askClass, /tf-lift/, 'Ask lift class live');
    assert.match(first.provideClass, /tf-lift/, 'Provide lift class live');
    assert.match(first.payClass, /tf-lift/, 'Pay lift class live');
    assert.match(first.creditsClass, /tf-lift/, 'Credits lift class live');
    assert.equal(first.proof, true, 'proof chip on Start.');
    assert.equal(first.proofText, 'Measured Mac speed via network capacity.', 'honest static first paint');
    assert.equal(first.triad, true, 'triad still on gate');
    assert.equal(first.hamburger, false, 'no hamburger');
    assert.equal(first.canvas, false, 'no canvas / WebGL mesh');
    assert.ok(isInk(rgbOf(first.color)), 'Ask primary text is ink');
    assert.ok(isAcid(rgbOf(first.bg)), 'Ask primary fill is acid');
    assert.match(first.askAnim, /gate-acid-glow/, 'Ask glow animation');
    assert.match(first.askAnim, /gate-lift/, 'Ask lift animation');
    assert.notEqual(first.beforeDisplay, 'none', 'environment light paints');

    const liveProof = await page.evaluate(() => {
      providersOnline = 2;
      networkCapacity = [{ model: 'qwen3-8b', tokens_per_second: 38, measured_providers: 1 }];
      paintGateProof();
      const zero = (() => {
        providersOnline = 0;
        networkCapacity = [];
        paintGateProof();
        return (document.getElementById('gate-proof')?.textContent || '').trim();
      })();
      providersOnline = 2;
      networkCapacity = [{ model: 'qwen3-8b', tokens_per_second: 38, measured_providers: 1 }];
      paintGateProof();
      return {
        live: (document.getElementById('gate-proof')?.textContent || '').trim(),
        zero,
      };
    });
    assert.equal(liveProof.live, '2 Macs · qwen3-8b ~38 tok/s', 'measured providers + tok/s');
    assert.equal(liveProof.zero, 'Measured Mac speed via network capacity.', 'zero fleet stays honest');

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const reduced = await page.evaluate(() => {
      const ask = getComputedStyle(document.getElementById('pick-ask'));
      const provide = getComputedStyle(document.getElementById('pick-provide'));
      return {
        askAnim: ask.animationName,
        askTransform: ask.transform,
        provideAnim: provide.animationName,
        color: ask.color,
        bg: ask.backgroundColor,
      };
    });
    assert.ok(!/gate-acid-glow|gate-lift/.test(reduced.askAnim) || reduced.askAnim === 'none', 'reduced-motion kills Ask glow/float');
    assert.ok(!/gate-lift/.test(reduced.provideAnim) || reduced.provideAnim === 'none', 'reduced-motion kills Provide float');
    assert.ok(isInk(rgbOf(reduced.color)), 'reduced-motion Ask text still ink');
    assert.ok(isAcid(rgbOf(reduced.bg)), 'reduced-motion Ask fill still acid');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-cinematic-start: PASS (vignette/acid-rim/lift/proof; reduced-motion; no three.js; ink on acid)');
