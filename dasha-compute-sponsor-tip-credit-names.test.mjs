#!/usr/bin/env node
/**
 * Live Worker 414dc48b: quiet named tip credits on Sponsor board.
 * #sponsor-credit under $N raised; paints board.credit only when named
 * tips exist (up to 6 · name|@handle · $N). Hidden when empty.
 * Anonymous stays nameless. Wallet tip path unchanged.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';
import { ComputeNetwork, sponsorBoard } from './dasha-compute-network.mjs';
import { COOKIE, createSessionToken } from './dasha-lobby-x.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function assertCreditMarkup(html, label) {
  assert.match(
    html,
    /id=["']sponsor-raised["'][^>]*>\$0 raised<\/p>\s*<p class=["']fine["'] id=["']sponsor-credit["'] hidden><\/p>/,
    `${label} #sponsor-credit under $N raised, hidden`,
  );
  assert.match(html, /function paintSponsorCredit\(/, `${label} paintSponsorCredit`);
  assert.match(html, /paintSponsorCredit\(data\)/, `${label} raised paints credit`);
  assert.match(html, /data&&data\.credit/, `${label} reads board.credit`);
  assert.match(html, /rows\.slice\(0,6\)/, `${label} up to 6`);
  assert.match(html, /label\+' · '\+formatCredits\(r\.cents\)/, `${label} name|@handle · $N`);
  assert.match(html, /if\(!rows\.length\)\{el\.textContent='';el\.hidden=true;return\}/, `${label} hidden when empty`);
  assert.match(html, /anonymous tips stay nameless/, `${label} anonymous nameless`);
  assert.match(html, /if\(usdc\)usdc\.hidden=false/, `${label} wallet USDC stays`);
  assert.match(html, /if\(dasha\)dasha\.hidden=false/, `${label} wallet \$dasha stays`);
  assert.match(html, /wallet OK without login/, `${label} wallet tip path`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin`);
}

assertCreditMarkup(disk, 'disk');
assertCreditMarkup(COMPUTE_PAGE_HTML, 'embed');

const res = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(res.status, 200);
assertCreditMarkup(await res.text(), 'worker.fetch');

const empty = sponsorBoard([]);
assert.equal(empty.credit.length, 0);
assert.equal(empty.raised_cents, 0);

const mixed = sponsorBoard([], [
  { id: 'spr_named', machine: 'network', name: 'alice', handle: 'alice', cents: 500, status: 'funded', createdAt: 3, method: 'usdc' },
  { id: 'spr_anon', machine: 'network', name: null, handle: null, cents: 2000, status: 'funded', createdAt: 2, method: 'usdc', anonymous: true },
  { id: 'spr_name_only', machine: 'mini-m4', name: 'bob', handle: null, cents: 2000, status: 'funded', createdAt: 1, method: 'dasha' },
]);
assert.equal(mixed.raised_cents, 4500, 'named + anonymous both raise');
assert.equal(mixed.credit.length, 2, 'anonymous stays off credit');
assert.deepEqual(mixed.credit.map((c) => ({ name: c.name, handle: c.handle, cents: c.cents })), [
  { name: 'alice', handle: 'alice', cents: 500 },
  { name: 'bob', handle: null, cents: 2000 },
]);
assert.ok(!mixed.credit.some((c) => !c.name));

const many = sponsorBoard([], Array.from({ length: 8 }, (_, i) => ({
  id: `spr_${i}`, machine: 'network', name: `n${i}`, handle: `h${i}`, cents: 500, status: 'funded', createdAt: 20 - i,
})));
assert.equal(many.credit.length, 8, 'API credit slice stays 24; UI caps at 6');
assert.equal(many.credit.slice(0, 6).length, 6);

const env = {
  AI: { run: async () => ({ response: 'ok' }) },
  ALLOWED_ORIGINS: 'https://www.getdasha.com',
  LOBBY_SESSION_SECRET: 'sponsor-tip-credit-names-secret',
};
const rows = new Map();
const storage = {
  async get(key) { return rows.get(key); },
  async put(key, value) {
    if (typeof key === 'object') for (const [name, item] of Object.entries(key)) rows.set(name, item);
    else rows.set(key, value);
  },
  async delete(key) { rows.delete(key); },
  async list({ prefix = '' } = {}) { return new Map([...rows].filter(([k]) => k.startsWith(prefix))); },
};
const network = new ComputeNetwork({ storage }, env);
const origin = 'https://www.getdasha.com';
const guestHeaders = { Origin: origin, 'Content-Type': 'application/json' };

const guest = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/orders', {
  method: 'POST', headers: guestHeaders, body: JSON.stringify({ pack: '5', method: 'usdc' }),
}), origin);
assert.equal(guest.status, 201);
const guestOrder = await guest.json();
assert.equal(guestOrder.anonymous, true);
assert.equal(guestOrder.name, null);

const session = await createSessionToken(env, { xId: 'credit-names', handle: 'named_tip' });
const cookie = { Cookie: `${COOKIE}=${session}`, Origin: origin, 'Content-Type': 'application/json' };
const named = await network.fetch(new Request('https://lobby.getdasha.com/compute/api/sponsors/orders', {
  method: 'POST', headers: cookie, body: JSON.stringify({ pack: '5', method: 'usdc' }),
}), origin);
assert.equal(named.status, 201);
const namedOrder = await named.json();
assert.equal(namedOrder.anonymous, false);
assert.equal(namedOrder.name, 'named_tip');

const chrome = process.env.CHROME_BIN || '/usr/bin/google-chrome';
let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; } catch {}
if (puppeteer && existsSync(chrome)) {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(new URL('./dasha-compute.html', import.meta.url).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__dashaAuthReady === true, { timeout: 8000 }).catch(() => {});
    const painted = await page.evaluate(() => {
      const credit = document.getElementById('sponsor-credit');
      const afterRaised = document.getElementById('sponsor-raised')?.nextElementSibling?.id;
      paintSponsorRaised({ raised_cents: 0, credit: [] });
      const empty = { hidden: !!credit?.hidden, text: (credit?.textContent || '').trim() };
      paintSponsorRaised({
        raised_cents: 500,
        credit: [{ name: 'alice', handle: 'alice', cents: 500 }],
      });
      const handled = { hidden: !!credit?.hidden, text: (credit?.textContent || '').trim(), raised: (document.getElementById('sponsor-raised')?.textContent || '').trim() };
      paintSponsorRaised({
        raised_cents: 2000,
        credit: [{ name: 'bob', handle: null, cents: 2000 }],
      });
      const namedOnly = { hidden: !!credit?.hidden, text: (credit?.textContent || '').trim() };
      paintSponsorRaised({
        raised_cents: 2500,
        credit: [
          { name: null, handle: null, cents: 2000 },
          { name: '', handle: 'ghost', cents: 500 },
        ],
      });
      const anon = { hidden: !!credit?.hidden, text: (credit?.textContent || '').trim() };
      const seven = Array.from({ length: 7 }, (_, i) => ({ name: `n${i}`, handle: `h${i}`, cents: 500 }));
      paintSponsorRaised({ raised_cents: 3500, credit: seven });
      const capped = { hidden: !!credit?.hidden, text: (credit?.textContent || '').trim(), parts: (credit?.textContent || '').split(' · ').filter((_, i) => i % 2 === 0) };
      loggedIn = false;
      paintSponsorBuy();
      return {
        afterRaised,
        empty,
        handled,
        namedOnly,
        anon,
        capped,
        usdc: !document.getElementById('sponsor-usdc')?.hidden,
        dasha: !document.getElementById('sponsor-dasha')?.hidden,
        login: (document.getElementById('sponsor-method-login')?.textContent || '').trim(),
      };
    });
    assert.equal(painted.afterRaised, 'sponsor-credit');
    assert.equal(painted.empty.hidden, true);
    assert.equal(painted.empty.text, '');
    assert.equal(painted.handled.hidden, false);
    assert.equal(painted.handled.text, '@alice · $5');
    assert.equal(painted.handled.raised, '$5 raised');
    assert.equal(painted.namedOnly.hidden, false);
    assert.equal(painted.namedOnly.text, 'bob · $20');
    assert.equal(painted.anon.hidden, true);
    assert.equal(painted.anon.text, '');
    assert.equal(painted.capped.hidden, false);
    assert.equal(painted.capped.parts.length, 6, 'UI caps at 6 names');
    assert.equal(painted.capped.text, '@h0 · $5 · @h1 · $5 · @h2 · $5 · @h3 · $5 · @h4 · $5 · @h5 · $5');
    assert.equal(painted.usdc, true, 'wallet USDC still shown');
    assert.equal(painted.dasha, true, 'wallet $dasha still shown');
    assert.equal(painted.login, 'Sign in for name');
  } finally {
    await browser.close();
  }
}

console.log('dasha-compute-sponsor-tip-credit-names: PASS');
