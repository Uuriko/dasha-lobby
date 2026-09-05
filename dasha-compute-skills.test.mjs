#!/usr/bin/env node
/**
 * Pasteable AI skills on /compute Typeform + /compute/skill/*.md Worker routes.
 * Gate-first cold boot; Copy AI skill on Ask + Provide steps.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { PROVIDE_SKILL_MD, USE_SKILL_MD, OCM_HOST_SKILL_MD } from './dasha-compute-skills.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

const provideDisk = readFileSync(join(root, 'dasha-compute-skills/PROVIDE.md'), 'utf8');
const useDisk = readFileSync(join(root, 'dasha-compute-skills/USE.md'), 'utf8');
const ocmHostDisk = readFileSync(join(root, 'dasha-compute-skills/OCM-HOST.md'), 'utf8');
assert.equal(PROVIDE_SKILL_MD, provideDisk);
assert.equal(USE_SKILL_MD, useDisk);
assert.equal(OCM_HOST_SKILL_MD, ocmHostDisk);
assert.match(PROVIDE_SKILL_MD, /Join Dasha Compute as a Provider/);
assert.match(PROVIDE_SKILL_MD, /Prefer MLX when you can/);
assert.match(USE_SKILL_MD, /Prefer MLX when you can \(providers\)/);
assert.match(USE_SKILL_MD, /Use Dasha Compute \(ask the network\)/);
assert.match(OCM_HOST_SKILL_MD, /Host on OCM/);

assert.match(html, /id=["']copy-skill-use["']/);
assert.match(html, /id=["']copy-skill-provide-reg["']/);
assert.match(html, /id=["']copy-skill-provide-done["']/);
assert.match(html, />Copy AI skill</);
assert.match(html, /const PROVIDE_SKILL=/);
assert.match(html, /const USE_SKILL=/);
{
  const m = html.match(/const USE_SKILL="((?:\\.|[^"\\])*)"/);
  assert.ok(m, 'USE_SKILL string present');
  const embed = JSON.parse('"' + m[1] + '"');
  assert.equal(embed, useDisk, 'Copy AI skill body matches USE.md');
  assert.match(embed, /help you ask /, 'Ask-first USE skill');
  assert.doesNotMatch(embed, /help you Use /, 'no leftover Use verb');
}
assert.match(html, /copy-skill-use.?\)\?\.addEventListener|copy\(USE_SKILL/);
assert.match(html, /copy\(PROVIDE_SKILL/);
assert.match(html, /function copy\(/);
assert.match(html, /Promise\.race/);
assert.doesNotMatch(html, /plugin\.jup\.ag/);

// Gate-first
assert.match(html, /data-step=["']gate["']/);
assert.match(html, /id=["']step-ask["'][^>]*hidden/);
assert.match(html, /Start\./);
assert.match(html, /id=["']ask-provide["']/);
assert.match(html, /id=["']ask-host["']/);
assert.match(html, /href=["']\/compute\/ocm\/provider["']/);

async function assertSkillRoute(host, path, body, edge) {
  const res = await worker.fetch(new Request(`https://${host}${path}`), {});
  assert.equal(res.status, 200, `${host}${path} status`);
  assert.equal(res.headers.get('x-dasha-edge'), edge, `${host}${path} edge`);
  assert.match(res.headers.get('content-type') || '', /text\/markdown/);
  assert.equal(await res.text(), body, `${host}${path} body`);
  const head = await worker.fetch(new Request(`https://${host}${path}`, { method: 'HEAD' }), {});
  assert.equal(head.status, 200, `${host}${path} HEAD`);
  assert.equal(head.headers.get('x-dasha-edge'), edge);
}

await assertSkillRoute('www.getdasha.com', '/compute/skill/provide.md', PROVIDE_SKILL_MD, 'compute-skill-provide');
await assertSkillRoute('www.getdasha.com', '/compute/skill/use.md', USE_SKILL_MD, 'compute-skill-use');
await assertSkillRoute('www.getdasha.com', '/compute/skill/ocm-host.md', OCM_HOST_SKILL_MD, 'compute-skill-ocm-host');
await assertSkillRoute('lobby.getdasha.com', '/compute/skill/provide.md', PROVIDE_SKILL_MD, 'compute-skill-provide');
await assertSkillRoute('lobby.getdasha.com', '/compute/skill/use.md', USE_SKILL_MD, 'compute-skill-use');
await assertSkillRoute('lobby.getdasha.com', '/compute/skill/ocm-host.md', OCM_HOST_SKILL_MD, 'compute-skill-ocm-host');

const page = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(page.status, 200);
assert.equal(page.headers.get('x-dasha-edge'), 'compute');
const served = await page.text();
assert.match(served, /id=["']copy-skill-use["']/);
assert.match(served, /id=["']copy-skill-provide-reg["']/);
assert.match(served, /Start\./);

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844 });
  const file = new URL('./dasha-compute.html', import.meta.url).href;
  await p.goto(file, { waitUntil: 'domcontentloaded' });
  const paint = await p.evaluate(() => {
    const vis = (el) => !!(el && !el.hidden && !el.closest('[hidden]') && el.offsetParent);
    return {
      step: document.body.dataset.step,
      skillUse: vis(document.getElementById('copy-skill-use')),
      skillProvide: vis(document.getElementById('copy-skill-provide-reg')),
      prompt: vis(document.getElementById('prompt')),
      ask: vis(document.getElementById('pick-ask')),
    };
  });
  assert.equal(paint.step, 'gate');
  assert.equal(paint.ask, true, 'Ask on gate first paint');
  assert.equal(paint.skillUse, false, 'Copy AI skill not on gate');
  assert.equal(paint.prompt, false);
  await p.click('#pick-ask');
  const ask = await p.evaluate(() => ({
    step: document.body.dataset.step,
    skill: !!(document.getElementById('copy-skill-use')?.offsetParent),
    label: document.getElementById('copy-skill-use')?.textContent || '',
    doors: !!(document.getElementById('ask-provide')?.offsetParent),
    starter: document.getElementById('ask-starter')?.textContent || '',
  }));
  assert.equal(ask.step, 'ask');
  assert.equal(ask.skill, true, 'Copy AI skill on Ask after gate');
  assert.equal(ask.label, 'Copy AI skill');
  assert.equal(ask.doors, true);
  assert.equal(ask.starter, 'Welcome note');
  await p.goto(file + '#provide', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.body.dataset.step === 'provide-name' || document.getElementById('step-provide-name')?.hidden === false);
  // ensure provide-name visible then next
  await p.evaluate(() => {
    if (typeof showTf === 'function') showTf('provide-name');
  });
  await p.click('#provide-next');
  const reg = await p.evaluate(() => ({
    step: document.body.dataset.step,
    skill: !!(document.getElementById('copy-skill-provide-reg')?.offsetParent),
    label: document.getElementById('copy-skill-provide-reg')?.textContent || '',
  }));
  assert.equal(reg.step, 'provide-reg');
  assert.equal(reg.skill, true);
  assert.equal(reg.label, 'Copy AI skill');
  await browser.close();
}

console.log('dasha-compute-skills: PASS');
