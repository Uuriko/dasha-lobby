#!/usr/bin/env node
/**
 * Immersity UX steal on /compute — Dasha tone only.
 * Audience triad · tech 2-up · client strip · richer Do. chips · FAQ · footer IA.
 * No purple #482bd9. No Nantes/Campton. First paint still Start.
 * Disk == embed == worker.fetch. /compute/faq 308→/compute. Bare /faq stays out.
 * No wrangler. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const WWW = 'https://www.getdasha.com';

assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker no plugin.jup.ag');

function gateSlice(html) {
  const start = html.indexOf('id="step-gate"');
  const end = html.indexOf('id="step-how"');
  assert.ok(start >= 0 && end > start, 'gate slice');
  return html.slice(start, end);
}

function assertImmersitySteal(html, label) {
  const gate = gateSlice(html);
  assert.match(gate, /<h1 class=["']tf-q["']>Start\.<\/h1>/, `${label} Start. first`);
  assert.match(gate, /id=["']pick-ask["'][^>]*>Do</, `${label} Do door`);
  assert.ok(gate.indexOf('Start.') < gate.indexOf('id="ux-triad"'), `${label} triad after Start.`);
  assert.match(gate, /id=["']ux-demo["']/, `${label} demo-before-login strip`);
  assert.match(gate, /Prompt<\/span> → <span>Receipt/, `${label} Prompt → Receipt`);
  assert.match(gate, /Hosted vs Community/, `${label} Hosted vs Community labels`);
  assert.match(gate, /Explain this\. → Hosted\./, `${label} static soft-guest example`);
  assert.match(html, /class=["']ux-reveal["']/, `${label} card hover reveal`);
  assert.doesNotMatch(html, /millions of users|1M\+|trusted by|social proof/i, `${label} no fake social proof`);

  assert.match(html, /id=["']ux-triad["']/, `${label} audience triad`);
  assert.match(html, /id=["']ux-card-ask["'][\s\S]*?>Ask</, `${label} Ask card`);
  assert.match(html, /id=["']ux-card-ask["'][\s\S]*?>Run work\.</, `${label} Ask one-liner`);
  assert.match(html, /id=["']ux-card-ask["'][\s\S]*?href=["']#ask["'][^>]*>Learn more</, `${label} Ask Learn more`);
  assert.match(html, /id=["']ux-card-provide["'][\s\S]*?>Provide</, `${label} Provide card`);
  assert.match(html, /id=["']ux-card-provide["'][\s\S]*?>Enroll a Mac\.</, `${label} Provide one-liner`);
  assert.match(html, /id=["']ux-card-provide["'][\s\S]*?href=["']#provide["'][^>]*>Learn more</, `${label} Provide Learn more`);
  assert.match(html, /id=["']ux-card-agents["'][\s\S]*?>Agents</, `${label} Agents card`);
  assert.match(html, /API · llms\.txt · skill\./, `${label} Agents one-liner`);
  assert.match(html, /href=["']\/compute\/llms\.txt["']/, `${label} llms.txt`);
  assert.match(html, /href=["']\/compute\/api["']/, `${label} /compute/api`);

  assert.match(html, /id=["']ux-card-community["'][\s\S]*?>Community Macs</, `${label} Community Macs`);
  assert.match(html, /Used when a Mac is advertising\./, `${label} Community honesty`);
  assert.match(html, /id=["']ux-card-hosted["'][\s\S]*?>Hosted floor</, `${label} Hosted floor`);
  assert.match(html, /Used when no Mac is online\./, `${label} Hosted honesty`);
  assert.doesNotMatch(html, /always-on community|Always-on Macs|N Macs online/i, `${label} no fake capacity`);

  assert.match(html, /id=["']ux-devices["']/, `${label} devices strip`);
  assert.match(html, /class=["']ux-device["'][^>]*>Cursor</, `${label} Cursor`);
  assert.match(html, /class=["']ux-device["'][^>]*>curl</, `${label} curl`);
  assert.match(html, /class=["']ux-device["'][^>]*>OpenAI clients</, `${label} OpenAI clients`);
  assert.match(html, /class=["']ux-device["'][^>]*>phone</, `${label} phone`);

  assert.match(html, /id=["']ask-starter-4["'][^>]*>Explain this</, `${label} Explain this`);
  assert.match(html, /id=["']ask-starter-5["'][^>]*>Summarize</, `${label} Summarize`);
  assert.match(html, /id=["']ask-starter-6["'][^>]*>Review a PR</, `${label} Review a PR`);
  assert.match(html, /data-prompt=["']Explain this like I'm new to it\.["']/, `${label} Explain prompt`);
  assert.match(html, /querySelectorAll\(['"]#ask-starters \[data-prompt\]['"]\)/, `${label} chip fill wiring`);

  assert.match(html, /id=["']compute-faq["']/, `${label} FAQ`);
  assert.match(html, /data-faq-area=["']ask["']/, `${label} FAQ Ask chip`);
  assert.match(html, /data-faq-area=["']provide["']/, `${label} FAQ Provide chip`);
  assert.match(html, /data-faq-area=["']pay["']/, `${label} FAQ Pay chip`);
  assert.match(html, /data-faq-area=["']api["']/, `${label} FAQ API chip`);
  assert.match(html, /How do I start\?/, `${label} FAQ start`);
  assert.match(html, /Hosted is still there\./, `${label} FAQ no-Mac`);
  assert.match(html, /Need Flash \/ bigger than a Mac\?/, `${label} FAQ Hosted Flash`);
  assert.match(html, /Hosted route when that SKU is offered/, `${label} FAQ Hosted Flash when offered`);
  assert.match(html, /Provide\. Name the Mac\. Kit\. Doctor\./, `${label} FAQ enroll`);
  assert.match(html, /Is hosting safe for my Mac\?/, `${label} FAQ host safe`);
  assert.match(html, /How fast is Provide\?/, `${label} FAQ provide speed`);
  assert.match(html, /measured_providers/, `${label} FAQ measured_providers`);
  assert.match(html, /Keychain/, `${label} FAQ Keychain`);
  assert.match(html, /Ollama/, `${label} FAQ Ollama`);
  assert.match(html, /No remote shell/, `${label} FAQ no remote shell`);
  assert.match(html, /Goes to credits\./, `${label} FAQ pay`);
  assert.match(html, /Prepaid\. Use on Ask\./, `${label} FAQ credits`);
  assert.match(html, /Change the base URL\./, `${label} FAQ API`);
  assert.match(html, /function paintFaq\(/, `${label} paintFaq`);
  assert.match(html, /id===['"]faq['"]/, `${label} #faq hash`);
  assert.doesNotMatch(gate, /disclaimer|not financial advice|dyor|\bnfa\b/i, `${label} gate no lecture`);

  assert.match(html, /<h2>Platform<\/h2>/, `${label} footer Platform`);
  assert.match(html, /<h2>Resources<\/h2>/, `${label} footer Resources`);
  assert.match(html, /<h2>Apps<\/h2>/, `${label} footer Apps`);
  assert.match(html, /<h2>Community<\/h2>/, `${label} footer Community`);
  assert.match(html, /href=["']\/lobby["']/, `${label} lobby`);
  assert.match(html, /href=["']\/bag["']/, `${label} bag`);
  assert.match(html, /href=["']\/bounties["']/, `${label} bounties`);
  assert.match(html, /href=["']\/privacy["']/, `${label} privacy`);
  assert.match(html, /href=["']#faq["']/, `${label} footer FAQ`);
  assert.match(html, /id=["']settled-24h["']/, `${label} settled stays`);
  assert.match(html, /jup\.ag\/tokens\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/, `${label} mint`);

  assert.doesNotMatch(html, /#482bd9|482bd9/i, `${label} no Immersity purple`);
  assert.doesNotMatch(html, /Nantes|Campton/i, `${label} no Immersity fonts`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
  assert.doesNotMatch(html, /\/room|Project Room/, `${label} Compute stays off Room`);
}

assertImmersitySteal(disk, 'disk');
assertImmersitySteal(COMPUTE_PAGE_HTML, 'embed');

assert.match(workerSrc, /["']\/compute\/faq["']/, 'worker lists /compute/faq');
assert.equal(potterHome308Dest('/compute/faq'), `${WWW}/compute`, '/compute/faq → /compute');
assert.equal(potterHome308Dest('/compute/faq/'), `${WWW}/compute`, '/compute/faq/ → /compute');
assert.equal(potterHome308Dest('/Compute/faq'), `${WWW}/compute`, 'Title-case /compute/faq');
assert.equal(potterHome308Dest('/faq'), null, 'bare /faq stays out');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute`);
  assertImmersitySteal(await compute.text(), `${host} /compute`);

  for (const method of ['GET', 'HEAD']) {
    const faq = await edgeWorker.fetch(new Request(`https://${host}/compute/faq`, { method }), env);
    assert.equal(faq.status, 308, `${host} /compute/faq ${method}`);
    assert.equal(faq.headers.get('location'), `${WWW}/compute`, `${host} /compute/faq loc`);
  }
}

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
  const paint = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
    const cs = getComputedStyle(document.body);
    const purple = [...document.querySelectorAll('*')].some((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor, s.borderColor].join(' ').includes('72, 43, 217');
    });
    return {
      step: document.body.dataset.step,
      gateQ: document.querySelector('#step-gate .tf-q')?.textContent || '',
      triad: vis(document.getElementById('ux-triad')),
      tech: vis(document.getElementById('ux-tech')),
      devices: vis(document.getElementById('ux-devices')),
      faq: vis(document.getElementById('compute-faq')),
      prompt: vis(document.getElementById('prompt')),
      askItems: [...document.querySelectorAll('#ux-faq-items [data-faq="ask"]')].filter((el) => vis(el)).length,
      payHidden: [...document.querySelectorAll('#ux-faq-items [data-faq="pay"]')].every((el) => !vis(el)),
      font: cs.fontFamily,
      purple,
    };
  });
  assert.equal(paint.step, 'gate', 'first paint gate');
  assert.equal(paint.gateQ, 'Start.');
  assert.equal(paint.triad, true, 'triad on gate');
  assert.equal(paint.tech, true, 'tech on gate');
  assert.equal(paint.devices, true, 'devices on gate');
  assert.equal(paint.faq, true, 'FAQ on gate');
  assert.equal(paint.prompt, false, 'prompt not on gate');
  assert.ok(paint.askItems >= 1, 'Ask FAQ visible default');
  assert.equal(paint.payHidden, true, 'Pay FAQ hidden default');
  assert.match(paint.font, /Arial/i, 'Dasha Arial');
  assert.equal(paint.purple, false, 'no Immersity purple paint');

  await page.click('#faq-areas [data-faq-area="provide"]');
  const after = await page.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
    const provideItems = [...document.querySelectorAll('#ux-faq-items [data-faq="provide"]')].filter((el) => vis(el));
    return {
      provide: provideItems.length,
      ask: [...document.querySelectorAll('#ux-faq-items [data-faq="ask"]')].some((el) => vis(el)),
      hostSecure: provideItems.some((el) => /Is hosting safe for my Mac\?/.test(el.textContent || '') && /Keychain/.test(el.textContent || '') && /Ollama/.test(el.textContent || '') && /No remote shell/.test(el.textContent || '')),
    };
  });
  assert.ok(after.provide >= 2, 'Provide FAQ after chip');
  assert.equal(after.ask, false, 'Ask FAQ hidden after Provide chip');
  assert.equal(after.hostSecure, true, 'host-secure FAQ visible on Provide');

  const demoVis = await page.evaluate(() => {
    const el = document.getElementById('ux-demo');
    return !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
  });
  assert.equal(demoVis, true, 'demo strip visible before login');

  await page.setViewport({ width: 1280, height: 800 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const collapsed = await page.$eval('#ux-card-ask .ux-reveal', (el) => getComputedStyle(el).maxHeight);
  assert.equal(collapsed, '0px', 'desktop reveal collapsed until focus');
  await page.$eval('#ux-card-ask', (el) => el.scrollIntoView({ block: 'center' }));
  await page.focus('#ux-card-ask a');
  const opened = await page.$eval('#ux-card-ask .ux-reveal', (el) => parseFloat(getComputedStyle(el).maxHeight));
  assert.ok(opened > 0, 'focus-within reveals card detail');

  await page.click('#pick-ask');
  assert.equal(await page.$eval('body', (n) => n.dataset.step), 'ask');
  await page.click('#ask-starter-4');
  const filled = await page.$eval('#prompt', (n) => n.value);
  assert.equal(filled, "Explain this like I'm new to it.");
  const afterChip = await page.evaluate(() => {
    const login = document.getElementById('login');
    return {
      login: !!(login && !login.hidden && login.offsetParent),
      loginText: (login?.textContent || '').trim(),
      prompt: document.getElementById('prompt')?.value || '',
    };
  });
  assert.equal(afterChip.prompt, "Explain this like I'm new to it.", 'chip fills without login');
  assert.equal(afterChip.login, true, 'guest Sign in stays after chip');
  assert.equal(afterChip.loginText, 'Sign in to run', 'filled chip names Sign in to run');
  await browser.close();
}

console.log('dasha-compute-immersity-ux: PASS (triad/tech/devices/chips/FAQ/footer; no Immersity purple; /compute/faq 308; Start. first)');
