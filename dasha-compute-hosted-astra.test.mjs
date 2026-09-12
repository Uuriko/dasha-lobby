#!/usr/bin/env node
/**
 * Hosted Astra as Hosted-when-offered — copy only.
 * skill.md + llms.txt: Hosted Astra under Community/Hosted.
 * Official API model id gpt-6-astra when offered (Hosted).
 * FAQ: Need Astra / GPT-6? Hosted when offered; API peers use gpt-6-astra.
 * NON-claim: Community Macs do not run Astra / gpt-6-astra / GPT-6.
 * Not a live SKU. No GPU infra. No wrangler. No Room. No people-data.
 * Never plugin.jup.ag. No Designer. No OpenAI partnership / PH contest copy.
 * Do not regress deepseek-flash. Do not change gpt-oss-20b Hosted demo floor.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import {
  COMPUTE_HOSTED_ASTRA_TXT,
  COMPUTE_HOSTED_FLASH_TXT,
  COMPUTE_LLMS_TXT,
  COMPUTE_SKILL_MD,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

const COMMUNITY_ASTRA_CLAIM = /Community Macs? (?:run|runs|serve|serves|host|hosts).{0,40}(Astra|gpt-6-astra|GPT-6)/i;
const ASTRA_ON_COMMUNITY = /(Astra|gpt-6-astra|GPT-6).{0,40}on (?:a |the )?Community Mac/i;
const COMMUNITY_RUNS_ASTRA = /Community.{0,80}(?:run|runs|serve|serves|host|hosts).{0,40}(?:Astra|gpt-6-astra|GPT-6)/i;
const LIVE_ASTRA = /Hosted Astra is live|Astra is live|now offering Astra|Astra model id/i;
const PARTNERSHIP = /openai partner|partnership with openai|endorsed by openai|official partner|product hunt|producthunt|ph challenge|contest winner/i;
const INVENTED_PRICE = /\$10|\$50|per 1M|1M (?:in|out|tokens)|\$\/1M/i;
const HOSTED_ASTRA_LINE = /^Hosted Astra: GPT-6 when offered\. Model id `gpt-6-astra` \(Hosted\)\. Never Community\. Same base_url\. Watch x-dasha-route · x-dasha-model\.$/m;
const HOSTED_FLASH_LINE = /^Hosted Flash: bigger-than-Mac \(Spark \/ Engram-class Flash when offered\)\. Model id `deepseek-flash` \(Hosted\)\. Never Community\. Same base_url\. Watch x-dasha-route\.$/m;

function assertHostedAstraCopy(body, label) {
  assert.match(body, HOSTED_ASTRA_LINE, `${label} Hosted Astra one-liner`);
  assert.match(body, /GPT-6 when offered/, `${label} when offered — not live`);
  assert.match(body, /Model id `gpt-6-astra` \(Hosted\)/, `${label} gpt-6-astra Hosted-when-offered`);
  assert.match(body, /Never Community/, `${label} never Community`);
  assert.match(body, /Same base_url/, `${label} same base_url`);
  assert.match(body, /x-dasha-route/, `${label} watch x-dasha-route`);
  assert.match(body, /x-dasha-model/, `${label} watch x-dasha-model`);
  assert.match(body, /^Async tools \/ mid-turn steering \/ computer use stay Hosted-class only\.$/m, `${label} Hosted-class only`);
  assert.match(body, HOSTED_FLASH_LINE, `${label} deepseek-flash Hosted line stays`);
  assert.doesNotMatch(body, COMMUNITY_ASTRA_CLAIM, `${label} no Community Astra`);
  assert.doesNotMatch(body, ASTRA_ON_COMMUNITY, `${label} no Astra on Community Mac`);
  assert.doesNotMatch(body, COMMUNITY_RUNS_ASTRA, `${label} NON-claim Community runs Astra`);
  assert.doesNotMatch(body, LIVE_ASTRA, `${label} no live-Astra claim`);
  assert.doesNotMatch(body, PARTNERSHIP, `${label} no OpenAI partnership / PH contest`);
  assert.doesNotMatch(body, INVENTED_PRICE, `${label} no invented OpenAI/Dasha prices`);
  assert.doesNotMatch(body, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(body, /people.?data|email|phone|seed phrase/i, `${label} no people-data`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(body, /project-room|guest-agent/i, `${label} no Room`);
}

assert.match(COMPUTE_HOSTED_ASTRA_TXT, /^Hosted Astra:/, 'shared Hosted Astra');
assert.match(COMPUTE_HOSTED_FLASH_TXT, /^Hosted Flash:/, 'shared Hosted Flash stays');
assert.equal(COMPUTE_SKILL_MD.includes(COMPUTE_HOSTED_ASTRA_TXT), true, 'skill embeds Hosted Astra');
assert.equal(COMPUTE_LLMS_TXT.includes(COMPUTE_HOSTED_ASTRA_TXT), true, 'packet embeds Hosted Astra');
assert.equal(COMPUTE_SKILL_MD.includes(COMPUTE_HOSTED_FLASH_TXT), true, 'skill still embeds Hosted Flash');
assert.equal(COMPUTE_LLMS_TXT.includes(COMPUTE_HOSTED_FLASH_TXT), true, 'packet still embeds Hosted Flash');
assert.ok(
  COMPUTE_SKILL_MD.indexOf('Hosted: still there when no Mac is online.')
    < COMPUTE_SKILL_MD.indexOf(COMPUTE_HOSTED_ASTRA_TXT),
  'skill Hosted Astra sits under Community/Hosted',
);
assert.ok(
  COMPUTE_LLMS_TXT.indexOf('Hosted: still there when no Mac is online.')
    < COMPUTE_LLMS_TXT.indexOf(COMPUTE_HOSTED_ASTRA_TXT),
  'packet Hosted Astra sits under Community/Hosted',
);
assert.ok(
  COMPUTE_SKILL_MD.indexOf(COMPUTE_HOSTED_FLASH_TXT)
    < COMPUTE_SKILL_MD.indexOf(COMPUTE_HOSTED_ASTRA_TXT),
  'skill Astra follows Flash',
);
assert.ok(
  COMPUTE_LLMS_TXT.indexOf(COMPUTE_HOSTED_FLASH_TXT)
    < COMPUTE_LLMS_TXT.indexOf(COMPUTE_HOSTED_ASTRA_TXT),
  'packet Astra follows Flash',
);
assertHostedAstraCopy(COMPUTE_HOSTED_ASTRA_TXT + '\n' + COMPUTE_HOSTED_FLASH_TXT, 'shared');
assertHostedAstraCopy(COMPUTE_SKILL_MD, 'skill.md');
assertHostedAstraCopy(COMPUTE_LLMS_TXT, 'llms.txt');

function faqBlock(html) {
  const start = html.indexOf('id="ux-faq-items"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, '#ux-faq-items bounds');
  return html.slice(start, end);
}

function assertFaqAstra(html, label) {
  const faq = faqBlock(html);
  const item = `<div class="ux-faq-item" data-faq="ask">
        <p class="ux-faq-q">Need Astra / GPT-6?</p>
        <p class="ux-faq-a">Hosted when offered. API peers use gpt-6-astra. Provide stays measured Mac tok/s.</p>
      </div>`;
  assert.ok(faq.includes(item), `${label} quiet Need Astra Q`);
  assert.equal((faq.match(/Need Astra \/ GPT-6\?/g) || []).length, 1, `${label} Astra Q once`);
  assert.match(faq, /Need Flash \/ bigger than a Mac\?/, `${label} Flash Q stays`);
  assert.match(faq, /API peers use deepseek-flash/, `${label} FAQ API peers deepseek-flash stays`);
  assert.match(faq, /Hosted when offered/, `${label} Hosted when offered`);
  assert.match(faq, /API peers use gpt-6-astra/, `${label} FAQ API peers gpt-6-astra`);
  assert.match(faq, /Provide stays measured Mac tok\/s/, `${label} Provide stays measured Mac`);
  assert.match(faq, /What if no Mac is online\?/, `${label} no-Mac Q stays`);
  assert.match(faq, /How fast is Provide\?/, `${label} Provide speed Q stays`);
  assert.match(html, /Hosted model: gpt-oss-20b/, `${label} gpt-oss-20b Hosted demo floor stays`);
  assert.doesNotMatch(faq, COMMUNITY_ASTRA_CLAIM, `${label} FAQ no Community Astra`);
  assert.doesNotMatch(faq, COMMUNITY_RUNS_ASTRA, `${label} FAQ NON-claim Community runs Astra`);
  assert.doesNotMatch(faq, LIVE_ASTRA, `${label} FAQ no live-Astra claim`);
  assert.doesNotMatch(faq, PARTNERSHIP, `${label} FAQ no OpenAI partnership / PH contest`);
  assert.doesNotMatch(faq, INVENTED_PRICE, `${label} FAQ no invented prices`);
  assert.doesNotMatch(faq, /\d+\s*tok\/s/, `${label} FAQ no invented tok/s`);
  assert.doesNotMatch(faq, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} no lecture`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertFaqAstra(disk, 'disk');
assertFaqAstra(COMPUTE_PAGE_HTML, 'embed');

const ORIGINS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];
for (const origin of ORIGINS) {
  const skill = await edgeWorker.fetch(new Request(`${origin}/compute/skill.md`), {});
  assert.equal(skill.status, 200, `${origin}/compute/skill.md`);
  const skillBody = await skill.text();
  assert.equal(skillBody, COMPUTE_SKILL_MD);
  assertHostedAstraCopy(skillBody, `${origin}/compute/skill.md`);

  const packet = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`), {});
  assert.equal(packet.status, 200, `${origin}/compute/llms.txt`);
  const packetBody = await packet.text();
  assert.equal(packetBody, COMPUTE_LLMS_TXT);
  assertHostedAstraCopy(packetBody, `${origin}/compute/llms.txt`);

  const page = await edgeWorker.fetch(new Request(`${origin}/compute`), {});
  assert.equal(page.status, 200, `${origin}/compute`);
  assertFaqAstra(await page.text(), `${origin}/compute`);
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
        astra: items.some((el) => /Need Astra \/ GPT-6\?/.test(el.textContent || '') && /Hosted when offered/.test(el.textContent || '') && /API peers use gpt-6-astra/.test(el.textContent || '') && /Provide stays measured Mac tok\/s/.test(el.textContent || '')),
        flash: items.some((el) => /Need Flash \/ bigger than a Mac\?/.test(el.textContent || '') && /API peers use deepseek-flash/.test(el.textContent || '')),
        noMac: items.some((el) => /What if no Mac is online\?/.test(el.textContent || '')),
        invented: items.some((el) => /Community Macs? run|Astra is live|Product Hunt|\$10|\$50|\d+\s*tok\/s/.test(el.textContent || '')),
      };
    });
    assert.ok(first.ask >= 4, 'Ask FAQ shows Astra item');
    assert.equal(first.astra, true, 'Need Astra / GPT-6? visible on Ask');
    assert.equal(first.flash, true, 'Need Flash stays visible on Ask');
    assert.equal(first.noMac, true, 'no-Mac Q stays visible');
    assert.equal(first.invented, false, 'no Community Astra / live Astra / invented tok/s');

    await page.click('#faq-areas [data-faq-area="provide"]');
    const provide = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const items = [...document.querySelectorAll('#ux-faq-items [data-faq="provide"]')].filter((el) => vis(el));
      return {
        speed: items.some((el) => /How fast is Provide\?/.test(el.textContent || '') && /measured_providers/.test(el.textContent || '')),
        astra: items.some((el) => /Need Astra \/ GPT-6\?/.test(el.textContent || '')),
      };
    });
    assert.equal(provide.speed, true, 'Provide chip still shows measured tok/s');
    assert.equal(provide.astra, false, 'Astra Q hidden on Provide');

    await page.click('#faq-areas [data-faq-area="ask"]');
    const restored = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const items = [...document.querySelectorAll('#ux-faq-items [data-faq="ask"]')].filter((el) => vis(el));
      return items.some((el) => /Need Astra \/ GPT-6\?/.test(el.textContent || ''));
    });
    assert.equal(restored, true, 'Ask restores Astra');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-hosted-astra: PASS (Hosted Astra gpt-6-astra id + FAQ; no Community Astra; Flash stays)');
