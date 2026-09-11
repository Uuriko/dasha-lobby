#!/usr/bin/env node
/**
 * Provide is fast — Darkbloom-energy without 176B-on-a-Mac.
 * /compute/skill.md + /compute/llms.txt: measured tok/s, keepalive, Hosted-only Flash.
 * Quiet FAQ: How fast is Provide? Network capacity / measured_providers. Honesty stays in tests.
 * Test-only. No wrangler. No Designer. No plugin.jup.ag. No Room. No people-data.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import {
  COMPUTE_LLMS_TXT,
  COMPUTE_PROVIDE_SPEED_TXT,
  COMPUTE_SKILL_MD,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function assertProvideSpeed(body, label) {
  assert.match(body, /## Provide speed/, `${label} Provide speed heading`);
  assert.match(body, /measured tok\/s/, `${label} measured tok/s`);
  assert.match(body, /network capacity/, `${label} network capacity`);
  assert.match(body, /measured_providers/, `${label} measured_providers`);
  assert.match(body, /Join a Mac at \/compute#provide/, `${label} Join a Mac door`);
  assert.match(body, /soft-doctor and enroll-code/, `${label} soft-doctor enroll-code`);
  assert.match(body, /OLLAMA_KEEP_ALIVE/, `${label} keepalive`);
  assert.match(body, /qwen3-4b/, `${label} qwen3-4b`);
  assert.match(body, /qwen3-8b/, `${label} qwen3-8b`);
  assert.match(body, /gemma3-12b/, `${label} gemma3-12b`);
  assert.match(body, /gemma3-27b/, `${label} gemma3-27b`);
  assert.match(body, /Send a recipe/, `${label} recipe invite`);
  assert.match(body, /MLX \/ Ollama \/ llama\.cpp Apple Silicon/, `${label} recipe stacks`);
  assert.match(body, /We pin winners/, `${label} pin winners`);
  assert.match(body, /Hosted-only when offered/, `${label} Hosted-only Flash non-claim`);
  assert.match(body, /Flash-class/, `${label} Flash-class`);
  assert.match(body, /DGX Spark/, `${label} DGX Spark`);
  assert.match(body, /Qwen 3\.8 Flash-Next/, `${label} Flash-Next`);
  assert.match(body, /Never a Community Mac/, `${label} never Community Mac`);
  assert.doesNotMatch(body, /176B/, `${label} no 176B-on-a-Mac`);
  assert.doesNotMatch(body, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(body, /people.?data|email|phone|seed phrase/i, `${label} no people-data`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(body, /project-room|guest-agent/i, `${label} no Room`);
}

assert.match(COMPUTE_PROVIDE_SPEED_TXT, /^## Provide speed$/m, 'shared block heading');
assert.equal(COMPUTE_SKILL_MD.includes(COMPUTE_PROVIDE_SPEED_TXT), true, 'skill embeds Provide speed');
assert.equal(COMPUTE_LLMS_TXT.includes(COMPUTE_PROVIDE_SPEED_TXT), true, 'packet embeds Provide speed');
assertProvideSpeed(COMPUTE_PROVIDE_SPEED_TXT, 'shared');
assertProvideSpeed(COMPUTE_SKILL_MD, 'skill.md');
assertProvideSpeed(COMPUTE_LLMS_TXT, 'llms.txt');

function faqBlock(html) {
  const start = html.indexOf('id="ux-faq-items"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, '#ux-faq-items bounds');
  return html.slice(start, end);
}

function assertFaqSpeed(html, label) {
  const faq = faqBlock(html);
  const item = `<div class="ux-faq-item" data-faq="provide" hidden>
        <p class="ux-faq-q">How fast is Provide?</p>
        <p class="ux-faq-a">Network capacity. Measured tok/s when measured_providers ≥ 1.</p>
      </div>`;
  assert.ok(faq.includes(item), `${label} quiet How fast is Provide?`);
  assert.equal((faq.match(/How fast is Provide\?/g) || []).length, 1, `${label} speed Q once`);
  assert.match(faq, /measured_providers/, `${label} FAQ measured_providers`);
  assert.doesNotMatch(faq, /\d+\s*tok\/s|176B/, `${label} FAQ no invented speed`);
  assert.doesNotMatch(faq, /Never invent/, `${label} FAQ no Never invent lecture`);
  assert.match(html, /id=["']provide-faq-speed["'][^>]*>How fast is Provide\? Network capacity · measured_providers\.</, `${label} Setup FAQ`);
  assert.doesNotMatch(faq, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertFaqSpeed(disk, 'disk');
assertFaqSpeed(COMPUTE_PAGE_HTML, 'embed');

const ORIGINS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];
for (const origin of ORIGINS) {
  const skill = await edgeWorker.fetch(new Request(`${origin}/compute/skill.md`), {});
  assert.equal(skill.status, 200, `${origin}/compute/skill.md`);
  const skillBody = await skill.text();
  assert.equal(skillBody, COMPUTE_SKILL_MD);
  assertProvideSpeed(skillBody, `${origin}/compute/skill.md`);

  const packet = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`), {});
  assert.equal(packet.status, 200, `${origin}/compute/llms.txt`);
  const packetBody = await packet.text();
  assert.equal(packetBody, COMPUTE_LLMS_TXT);
  assertProvideSpeed(packetBody, `${origin}/compute/llms.txt`);

  const page = await edgeWorker.fetch(new Request(`${origin}/compute`), {});
  assert.equal(page.status, 200, `${origin}/compute`);
  assertFaqSpeed(await page.text(), `${origin}/compute`);
}

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    await page.click('#faq-areas [data-faq-area="provide"]');
    const after = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const items = [...document.querySelectorAll('#ux-faq-items [data-faq="provide"]')].filter((el) => vis(el));
      return {
        provide: items.length,
        speed: items.some((el) => /How fast is Provide\?/.test(el.textContent || '') && /measured_providers/.test(el.textContent || '') && /Network capacity/.test(el.textContent || '')),
        invented: items.some((el) => /176B|\d+\s*tok\/s/.test(el.textContent || '')),
      };
    });
    assert.ok(after.provide >= 3, 'Provide FAQ shows speed item');
    assert.equal(after.speed, true, 'How fast is Provide? visible');
    assert.equal(after.invented, false, 'no invented tok/s on Provide FAQ');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-provide-speed: PASS (skill/llms Provide speed + keepalive + Hosted-only Flash; FAQ measured_providers)');
