#!/usr/bin/env node
/**
 * Hosted Flash as bigger-than-Mac option — copy only.
 * skill.md + llms.txt: Hosted Flash under Community/Hosted.
 * FAQ: Need Flash / bigger than a Mac? Hosted route when offered.
 * NON-claim: Community Macs do not run 763B / Engram / Flash-Next.
 * Not a live SKU. No GPU infra. No wrangler. No Room. No people-data.
 * Never plugin.jup.ag. No Designer.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import {
  COMPUTE_HOSTED_FLASH_TXT,
  COMPUTE_LLMS_TXT,
  COMPUTE_SKILL_MD,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

const COMMUNITY_BIG_CLAIM = /Community Macs? (?:run|runs|serve|serves|host|hosts).{0,40}(763B|Engram|Flash-Next)/i;
const BIG_ON_COMMUNITY = /(763B|Engram|Flash-Next).{0,40}on (?:a |the )?Community Mac/i;
const LIVE_FLASH = /Hosted Flash is live|Flash is live|now offering Flash|Flash model id/i;

function assertHostedFlashCopy(body, label) {
  assert.match(body, /^Hosted Flash: bigger-than-Mac \(Spark \/ Engram-class Flash when offered\)\. Never Community\. Same base_url\. Watch x-dasha-route\.$/m, `${label} Hosted Flash one-liner`);
  assert.match(body, /bigger-than-Mac/, `${label} bigger-than-Mac`);
  assert.match(body, /when offered/, `${label} when offered — not live`);
  assert.match(body, /Never Community/, `${label} never Community`);
  assert.match(body, /Same base_url/, `${label} same base_url`);
  assert.match(body, /x-dasha-route/, `${label} watch x-dasha-route`);
  assert.doesNotMatch(body, COMMUNITY_BIG_CLAIM, `${label} no Community 763B/Engram/Flash-Next`);
  assert.doesNotMatch(body, BIG_ON_COMMUNITY, `${label} no big SKU on Community Mac`);
  assert.doesNotMatch(body, LIVE_FLASH, `${label} no live-Flash claim`);
  assert.doesNotMatch(body, /763B/, `${label} no 763B`);
  assert.doesNotMatch(body, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(body, /people.?data|email|phone|seed phrase/i, `${label} no people-data`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(body, /project-room|guest-agent/i, `${label} no Room`);
}

assert.match(COMPUTE_HOSTED_FLASH_TXT, /^Hosted Flash:/, 'shared Hosted Flash');
assert.equal(COMPUTE_SKILL_MD.includes(COMPUTE_HOSTED_FLASH_TXT), true, 'skill embeds Hosted Flash');
assert.equal(COMPUTE_LLMS_TXT.includes(COMPUTE_HOSTED_FLASH_TXT), true, 'packet embeds Hosted Flash');
assert.ok(
  COMPUTE_SKILL_MD.indexOf('Hosted: still there when no Mac is online.')
    < COMPUTE_SKILL_MD.indexOf(COMPUTE_HOSTED_FLASH_TXT),
  'skill Hosted Flash sits under Community/Hosted',
);
assert.ok(
  COMPUTE_LLMS_TXT.indexOf('Hosted: still there when no Mac is online.')
    < COMPUTE_LLMS_TXT.indexOf(COMPUTE_HOSTED_FLASH_TXT),
  'packet Hosted Flash sits under Community/Hosted',
);
assertHostedFlashCopy(COMPUTE_HOSTED_FLASH_TXT, 'shared');
assertHostedFlashCopy(COMPUTE_SKILL_MD, 'skill.md');
assertHostedFlashCopy(COMPUTE_LLMS_TXT, 'llms.txt');

function faqBlock(html) {
  const start = html.indexOf('id="ux-faq-items"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, '#ux-faq-items bounds');
  return html.slice(start, end);
}

function assertFaqFlash(html, label) {
  const faq = faqBlock(html);
  const item = `<div class="ux-faq-item" data-faq="ask">
        <p class="ux-faq-q">Need Flash / bigger than a Mac?</p>
        <p class="ux-faq-a">Hosted route when that SKU is offered. Provide stays measured Mac tok/s.</p>
      </div>`;
  assert.ok(faq.includes(item), `${label} quiet Need Flash Q`);
  assert.equal((faq.match(/Need Flash \/ bigger than a Mac\?/g) || []).length, 1, `${label} Flash Q once`);
  assert.match(faq, /Hosted route when that SKU is offered/, `${label} Hosted route when offered`);
  assert.match(faq, /Provide stays measured Mac tok\/s/, `${label} Provide stays measured Mac`);
  assert.match(faq, /What if no Mac is online\?/, `${label} no-Mac Q stays`);
  assert.match(faq, /How fast is Provide\?/, `${label} Provide speed Q stays`);
  assert.doesNotMatch(faq, COMMUNITY_BIG_CLAIM, `${label} FAQ no Community 763B/Engram/Flash-Next`);
  assert.doesNotMatch(faq, LIVE_FLASH, `${label} FAQ no live-Flash claim`);
  assert.doesNotMatch(faq, /763B/, `${label} FAQ no 763B`);
  assert.doesNotMatch(faq, /\d+\s*tok\/s/, `${label} FAQ no invented tok/s`);
  assert.doesNotMatch(faq, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertFaqFlash(disk, 'disk');
assertFaqFlash(COMPUTE_PAGE_HTML, 'embed');

const ORIGINS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];
for (const origin of ORIGINS) {
  const skill = await edgeWorker.fetch(new Request(`${origin}/compute/skill.md`), {});
  assert.equal(skill.status, 200, `${origin}/compute/skill.md`);
  const skillBody = await skill.text();
  assert.equal(skillBody, COMPUTE_SKILL_MD);
  assertHostedFlashCopy(skillBody, `${origin}/compute/skill.md`);

  const packet = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`), {});
  assert.equal(packet.status, 200, `${origin}/compute/llms.txt`);
  const packetBody = await packet.text();
  assert.equal(packetBody, COMPUTE_LLMS_TXT);
  assertHostedFlashCopy(packetBody, `${origin}/compute/llms.txt`);

  const page = await edgeWorker.fetch(new Request(`${origin}/compute`), {});
  assert.equal(page.status, 200, `${origin}/compute`);
  assertFaqFlash(await page.text(), `${origin}/compute`);
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
    const first = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const items = [...document.querySelectorAll('#ux-faq-items [data-faq="ask"]')].filter((el) => vis(el));
      return {
        ask: items.length,
        flash: items.some((el) => /Need Flash \/ bigger than a Mac\?/.test(el.textContent || '') && /Hosted route when that SKU is offered/.test(el.textContent || '') && /Provide stays measured Mac tok\/s/.test(el.textContent || '')),
        noMac: items.some((el) => /What if no Mac is online\?/.test(el.textContent || '')),
        invented: items.some((el) => /763B|Community Macs? run|Flash is live|\d+\s*tok\/s/.test(el.textContent || '')),
      };
    });
    assert.ok(first.ask >= 3, 'Ask FAQ shows Flash item');
    assert.equal(first.flash, true, 'Need Flash / bigger than a Mac? visible on Ask');
    assert.equal(first.noMac, true, 'no-Mac Q stays visible');
    assert.equal(first.invented, false, 'no Community 763B / live Flash / invented tok/s');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-hosted-flash: PASS (Hosted Flash option + FAQ; no Community 763B/Engram/Flash-Next)');
