#!/usr/bin/env node
/**
 * Growth / buy-surface gate for getdasha conversion work.
 * Matches culture-home + neutral desk + how-to-buy (no FOMO raid desk).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const read = (f) => readFileSync(join(__dirname, f), 'utf8');

// --- pure builders from desk app.js
const appSrc = read('dasha-desk/src/app.js');
const sandbox = { globalThis: {}, window: undefined, document: undefined, navigator: undefined, console, URL };
sandbox.globalThis = sandbox;
vm.runInNewContext(appSrc, sandbox, { filename: 'src/app.js' });
const DD = sandbox.globalThis.DDShare;
assert.ok(DD, 'DDShare export missing from desk app.js');
assert.equal(DD.CA, MINT);
assert.ok(DD.BUY.includes('jup.ag') && DD.BUY.includes(MINT), 'desk BUY is Jupiter + mint');
const share = DD.buildSharePack('share');
assert.ok(share.includes(MINT), 'share pack must include mint');
assert.ok(/getdasha\.com\/dasha/.test(share + DD.DESK), 'share recruits to first-party desk');
assert.ok(!/t\.me\/dashacommunity/.test(share), 'share must not claim disallowed telegram');
assert.ok(!/raid|fomo|referral/i.test(share), 'desk share stays neutral (no raid/fomo)');

// --- culture home convert surface
const landing = read('dasha-landing.html');
assert.ok(landing.includes(MINT), 'home surfaces mint');
assert.ok(landing.includes('jup.ag'), 'home surfaces Jupiter');
assert.ok(!/wrong one|never trust|fakes exist|old coin|not the dev/i.test(landing), 'home keeps coin copy affirmative');
assert.ok(!/buy-guide|self-custody wallet|Confirm the mint/.test(landing), 'home must not regrow a tutorial wall');
assert.ok(landing.includes('href="/how-to-buy"') && !landing.includes('href="/rally"'), 'home links the buy guide and keeps retired Rally absent');
assert.ok(landing.includes('/dasha') && landing.includes('/studio'), 'home loops desk + studio');
assert.ok(!landing.includes('t.me/dashacommunity'));
assert.ok(!/thesis card|conviction receipt/i.test(landing), 'home stays culture product');

// --- how-to-buy (primary conversion education surface)
const howto = read('dasha-how-to-buy.html');
assert.ok(howto.includes(MINT));
assert.ok(howto.includes('jup.ag/swap'));
for (const step of ['data-n="01"', 'data-n="02"', 'data-n="03"']) assert.ok(howto.includes(step), `missing buy step: ${step}`);
assert.ok(!/04 · Share|Copy share pack|Draft on X|buildSharePack/.test(howto), 'howto conversion ladder contains promotion');
assert.ok(!howto.includes('t.me/dashacommunity'));
for (const bad of ['official Dasha', 'safe token', 'verified mint', 'endorsed by']) {
  assert.ok(!howto.toLowerCase().includes(bad.toLowerCase()), `howto must not claim: ${bad}`);
}
const m = howto.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(m, 'howto script missing');
const box = {
  window: {},
  document: { getElementById: () => null, createElement: () => ({}), body: { appendChild() {}, removeChild() {} } },
  navigator: {},
  URL,
  console,
};
box.window = box;
vm.runInNewContext(m[1], box, { filename: 'how-to-buy.html' });
const H = box.window.DashaHowToBuy || box.DashaHowToBuy;
assert.ok(H, 'DashaHowToBuy export');
assert.equal(H.CA, MINT);
assert.ok(H.BUY.includes(MINT) && /jup\.ag/.test(H.BUY), 'howto buy route lost exact mint');

// desk body links the live buy guide + exact-mint Jupiter handoff
const body = read('dasha-desk/src/body.html');
assert.ok(body.includes('/how-to-buy'), 'desk links live How to buy guide');
assert.ok(/Match this full mint/i.test(body), 'desk mint card pushes full-mint verify');
assert.ok(body.includes('jup.ag/swap') && body.includes(MINT), 'desk has Jupiter buy with exact mint');

console.log('Dasha growth gate: PASS (neutral desk + culture home + howto convert)');
