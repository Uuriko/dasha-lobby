#!/usr/bin/env node
/**
 * Build on Dasha packet — mint + run factory so other UIs skip the Worker fork.
 * Shared constant in /compute/skill.md + /compute/llms.txt.
 * Quiet FAQ on /compute: Can I build my own UI? Yes. skill · mcp · mint.
 * Provide/Hosted honesty unchanged. Test-only. No wrangler. No Designer.
 * NON: no Lighter, no plugin.jup.ag, no people-data, no Room Phase 0.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import {
  COMPUTE_API_BASE,
  COMPUTE_BUILD_ON_DASHA_TXT,
  COMPUTE_LLMS_TXT,
  COMPUTE_MCP_JSON_URL,
  COMPUTE_SKILL_MD,
  COMPUTE_SKILL_URL,
  DASHA_ASSOCIATED_MINT,
  DASHA_BUY_URL,
  DASHA_JUP_TOKEN_URL,
} from './dasha-compute-agent.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const ORIGINS = ['https://www.getdasha.com', 'https://lobby.getdasha.com'];
const FAQ_ITEM = `<div class="ux-faq-item" data-faq="api" hidden>
        <p class="ux-faq-q">Can I build my own UI?</p>
        <p class="ux-faq-a">Yes. skill · mcp · mint. UI is yours.</p>
      </div>`;

const NON_LIGHTER = /lighter|perp|perps/i;
const NON_ROOM = /phase\s*0|project.?room|\/room|guest-agent/i;
const NON_PEOPLE = /people.?data|email|phone|seed phrase/i;
const NON_PLUGIN = /plugin\.jup\.ag/;
const NON_LECTURE = /disclaimer|not financial advice|dyor|\bnfa\b/i;

function assertBuildOnDasha(body, label) {
  assert.match(body, /^## Build on Dasha$/m, `${label} Build on Dasha heading`);
  assert.match(body, new RegExp(`^mint ${MINT}$`, 'm'), `${label} exact mint`);
  assert.match(body, /^Buy via site Buy — /m, `${label} Buy via site Buy`);
  assert.match(body, /https:\/\/www\.getdasha\.com\/how-to-buy/, `${label} site Buy`);
  assert.match(body, new RegExp(`https://jup\\.ag/tokens/${MINT}`), `${label} exact-mint Jupiter`);
  assert.match(body, new RegExp(`^base_url ${COMPUTE_API_BASE.replace(/\./g, '\\.')}$`, 'm'), `${label} OpenAI-compat base_url`);
  assert.match(body, /^guest-keys POST \/compute\/api\/guest-keys$/m, `${label} guest-keys`);
  assert.match(body, new RegExp(`^mcp ${COMPUTE_MCP_JSON_URL.replace(/\./g, '\\.')}$`, 'm'), `${label} mcp.json`);
  assert.match(body, new RegExp(`^skill ${COMPUTE_SKILL_URL.replace(/\./g, '\\.')}$`, 'm'), `${label} skill`);
  assert.match(body, /^UI is yours; we expose mint \+ run factory\.$/m, `${label} UI is yours`);
  assert.doesNotMatch(body, NON_LIGHTER, `${label} no Lighter`);
  assert.doesNotMatch(body, NON_PLUGIN, `${label} no plugin.jup.ag`);
  assert.doesNotMatch(body, NON_PEOPLE, `${label} no people-data`);
  assert.doesNotMatch(body, NON_ROOM, `${label} no Room Phase 0`);
  assert.doesNotMatch(body, NON_LECTURE, `${label} no lecture`);
}

assert.equal(DASHA_ASSOCIATED_MINT, MINT, 'shared mint');
assert.equal(DASHA_BUY_URL, 'https://www.getdasha.com/how-to-buy');
assert.equal(DASHA_JUP_TOKEN_URL, `https://jup.ag/tokens/${MINT}`);
assert.match(COMPUTE_BUILD_ON_DASHA_TXT, /^## Build on Dasha$/m, 'shared block heading');
assert.equal(COMPUTE_SKILL_MD.includes(COMPUTE_BUILD_ON_DASHA_TXT), true, 'skill embeds Build on Dasha');
assert.equal(COMPUTE_LLMS_TXT.includes(COMPUTE_BUILD_ON_DASHA_TXT), true, 'packet embeds Build on Dasha');
assertBuildOnDasha(COMPUTE_BUILD_ON_DASHA_TXT, 'shared');
assertBuildOnDasha(COMPUTE_SKILL_MD, 'skill.md');
assertBuildOnDasha(COMPUTE_LLMS_TXT, 'llms.txt');

function faqBlock(html) {
  const start = html.indexOf('id="ux-faq-items"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, '#ux-faq-items bounds');
  return html.slice(start, end);
}

function assertFaqBuild(html, label) {
  const faq = faqBlock(html);
  assert.ok(faq.includes(FAQ_ITEM), `${label} quiet Can I build my own UI?`);
  assert.equal((faq.match(/Can I build my own UI\?/g) || []).length, 1, `${label} build Q once`);
  assert.match(faq, /Yes\. skill · mcp · mint\. UI is yours\./, `${label} skill/mcp/mint`);
  assert.match(faq, /What if no Mac is online\?/, `${label} Hosted honesty stays`);
  assert.match(faq, /Hosted is still there\./, `${label} Hosted answer stays`);
  assert.match(faq, /How do I enroll\?/, `${label} Provide enroll stays`);
  assert.match(faq, /How fast is Provide\?/, `${label} Provide speed stays`);
  assert.match(faq, /Provide stays measured Mac tok\/s/, `${label} Provide measured stays`);
  assert.doesNotMatch(faq, NON_LIGHTER, `${label} FAQ no Lighter`);
  assert.doesNotMatch(faq, NON_PLUGIN, `${label} FAQ no plugin`);
  assert.doesNotMatch(faq, NON_PEOPLE, `${label} FAQ no people-data`);
  assert.doesNotMatch(faq, NON_ROOM, `${label} FAQ no Room Phase 0`);
  assert.doesNotMatch(faq, NON_LECTURE, `${label} FAQ no lecture`);
  assert.doesNotMatch(html, NON_PLUGIN, `${label} page no plugin`);
}

assertFaqBuild(disk, 'disk');
assertFaqBuild(COMPUTE_PAGE_HTML, 'embed');

for (const origin of ORIGINS) {
  const skill = await edgeWorker.fetch(new Request(`${origin}/compute/skill.md`), {});
  assert.equal(skill.status, 200, `${origin}/compute/skill.md`);
  const skillBody = await skill.text();
  assert.equal(skillBody, COMPUTE_SKILL_MD);
  assertBuildOnDasha(skillBody, `${origin}/compute/skill.md`);

  const packet = await edgeWorker.fetch(new Request(`${origin}/compute/llms.txt`), {});
  assert.equal(packet.status, 200, `${origin}/compute/llms.txt`);
  const packetBody = await packet.text();
  assert.equal(packetBody, COMPUTE_LLMS_TXT);
  assertBuildOnDasha(packetBody, `${origin}/compute/llms.txt`);

  const page = await edgeWorker.fetch(new Request(`${origin}/compute`), {});
  assert.equal(page.status, 200, `${origin}/compute`);
  assertFaqBuild(await page.text(), `${origin}/compute`);
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
      const ask = [...document.querySelectorAll('#ux-faq-items [data-faq="ask"]')].filter((el) => vis(el));
      const api = [...document.querySelectorAll('#ux-faq-items [data-faq="api"]')].filter((el) => vis(el));
      return {
        hosted: ask.some((el) => /What if no Mac is online\?/.test(el.textContent || '') && /Hosted is still there/.test(el.textContent || '')),
        buildVisible: api.some((el) => /Can I build my own UI\?/.test(el.textContent || '')),
      };
    });
    assert.equal(first.hosted, true, 'Hosted honesty stays on Ask FAQ');
    assert.equal(first.buildVisible, false, 'build Q hidden until API');

    await page.click('#faq-areas [data-faq-area="api"]');
    const after = await page.evaluate(() => {
      const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
      const items = [...document.querySelectorAll('#ux-faq-items [data-faq="api"]')].filter((el) => vis(el));
      return {
        api: items.length,
        build: items.some((el) => /Can I build my own UI\?/.test(el.textContent || '') && /Yes\. skill · mcp · mint/.test(el.textContent || '') && /UI is yours/.test(el.textContent || '')),
        call: items.some((el) => /How do I call it\?/.test(el.textContent || '')),
        lighter: items.some((el) => /lighter|perp/i.test(el.textContent || '')),
      };
    });
    assert.ok(after.api >= 2, 'API FAQ shows build item');
    assert.equal(after.build, true, 'Can I build my own UI? visible');
    assert.equal(after.call, true, 'How do I call it? stays');
    assert.equal(after.lighter, false, 'no Lighter on API FAQ');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-build-on-dasha: PASS (skill/llms Build on Dasha + FAQ skill/mcp/mint; no Lighter / plugin.jup.ag / people-data / Room Phase 0)');
