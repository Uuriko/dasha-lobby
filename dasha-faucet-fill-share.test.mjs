#!/usr/bin/env node
/** Jar-fill share pages. Seed tape only. Do not hit chain. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DashaFaucet } from './dasha-lobby-worker.mjs';
import edgeWorker from './dasha-lobby-worker.mjs';
import {
  createTape,
  fillShareApi,
  fillShareHeadline,
  fillShareHtml,
  fillShareUrl,
  isBareFaucetFillPath,
  isFaucetFillPath,
  tapeApi,
} from './dasha-faucet-tape.mjs';

const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAYER = 'So11111111111111111111111111111111111111112';
const GOOD_SIG = '1'.repeat(64);
const page = readFileSync(new URL('./dasha-faucet-page.html', import.meta.url), 'utf8');
const workerSrc = readFileSync(new URL('./dasha-lobby-worker.mjs', import.meta.url), 'utf8');
const genSrc = readFileSync(new URL('./dasha-lobby-static-gen.mjs', import.meta.url), 'utf8');

assert.equal(isFaucetFillPath('/faucet/fill/not-a-sig')?.sig, 'not-a-sig');
assert.equal(isFaucetFillPath(`/faucet/fills/${GOOD_SIG}`)?.sig, GOOD_SIG);
assert.equal(isFaucetFillPath('/faucet/fills'), null);
assert.equal(isFaucetFillPath('/faucet/tape'), null);
assert.equal(isFaucetFillPath('/faucet'), null);
assert.equal(isFaucetFillPath('/faucet/fill'), null);
assert.equal(isBareFaucetFillPath('/faucet/fill'), true);
assert.equal(isBareFaucetFillPath('/faucet/fill/'), true);
assert.equal(isBareFaucetFillPath('/faucet/fills'), false);
assert.equal(fillShareUrl(GOOD_SIG), `https://www.getdasha.com/faucet/fill/${GOOD_SIG}`);
assert.equal(fillShareHeadline({ amountUi: 100000 }), '100000');
assert.equal(fillShareHeadline({ amountUi: 1000 }), '1000');
assert.equal(fillShareHeadline({}), 'in.');
{
  const bare = fillShareHtml({ sig: GOOD_SIG });
  assert.match(bare, /<title>in\.<\/title>/);
  assert.match(bare, /<h1>in\.<\/h1>/);
  assert.match(bare, /href="\/faucet">Get 100</);
}

assert.match(page, /\/faucet\/fill\/'\+row\.sig/);
assert.match(genSrc, /\/faucet\/fill\/'\+row\.sig/);
assert.doesNotMatch(page, /solscan\.io\/tx\/'\+row\.sig/);
assert.doesNotMatch(page, /slice\(0,4\)/);
assert.match(page, /from '\+from/);
assert.match(workerSrc, /share: `https:\/\/www\.getdasha\.com\/faucet\/fill\/\$\{sig\}`/);
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);

{
  const res = await fillShareApi(new Request('https://www.getdasha.com/faucet/fill/not-a-sig'));
  assert.equal(res.status, 308, 'helper unknown 308');
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/faucet');
  assert.equal(res.headers.get('x-dasha-edge'), 'faucet-fill');
}
{
  for (const path of ['/faucet/fill', '/faucet/fill/']) {
    const res = await fillShareApi(new Request(`https://www.getdasha.com${path}`));
    assert.equal(res.status, 308, `helper bare ${path} 308`);
    assert.equal(res.headers.get('location'), 'https://www.getdasha.com/faucet');
    assert.equal(res.headers.get('x-dasha-edge'), 'faucet-fill');
  }
}

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const res = await edgeWorker.fetch(new Request(`${origin}/faucet/fill/not-a-sig`), {});
  assert.equal(res.status, 308, `${origin} unknown 308`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/faucet', origin);
}

{
  const tape = createTape();
  assert.deepEqual(tape.list(), []);
  const now = Date.now();
  assert.equal(tape.append({ sig: GOOD_SIG, amountUi: 1000, at: now, from: PAYER }).ok, true);
  const row = tape.list()[0];
  const html = fillShareHtml(row);
  assert.match(html, /<title>1000<\/title>/);
  assert.match(html, /<h1>1000<\/h1>/);
  assert.match(html, /property="og:title" content="1000"/);
  assert.match(html, /property="og:description" content="Claim\. Fill\. Buy\."/);
  assert.match(html, /name="twitter:title" content="1000"/);
  assert.match(html, /name="twitter:description" content="Claim\. Fill\. Buy\."/);
  assert.match(html, new RegExp(`og:url" content="https://www.getdasha.com/faucet/fill/${GOOD_SIG}"`));
  assert.match(html, new RegExp(`rel="canonical" href="https://www.getdasha.com/faucet/fill/${GOOD_SIG}"`));
  assert.match(html, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/);
  assert.match(html, new RegExp(`jup\\.ag/tokens/${MINT}`));
  assert.match(html, /href="\/faucet">Get 100</);
  assert.equal([...html.matchAll(/class="go"/g)].length, 1, 'one acid page action');
  assert.match(html, />Buy</);
  assert.match(html, new RegExp(`solscan\\.io/tx/${GOOD_SIG}`));
  assert.match(html, /1111…1111/);
  assert.doesNotMatch(html, /Filled the jar|Fill the jar|Copy link|plugin\.jup\.ag|not an airdrop|disclaimer|airdrop|from So11|t\.me/i);
  assert.doesNotMatch(html, /<script/i);

  const seeded = await fillShareApi(
    new Request(`https://www.getdasha.com/faucet/fill/${GOOD_SIG}`),
    tape.raw,
  );
  assert.equal(seeded.status, 200);
  assert.equal(seeded.headers.get('x-dasha-edge'), 'faucet-fill');
  const body = await seeded.text();
  assert.match(body, new RegExp(`og:url" content="https://www.getdasha.com/faucet/fill/${GOOD_SIG}"`));
  assert.match(body, new RegExp(`jup\\.ag/tokens/${MINT}`));
  assert.match(body, /href="\/faucet">Get 100</);
  assert.match(body, /<h1>1000<\/h1>/);
  assert.doesNotMatch(body, /plugin\.jup\.ag|Copy link|Filled the jar/i);

  const alias = await fillShareApi(
    new Request(`https://www.getdasha.com/faucet/fills/${GOOD_SIG}`),
    tape.raw,
  );
  assert.equal(alias.status, 200);

  const miss = await fillShareApi(
    new Request(`https://www.getdasha.com/faucet/fill/${'2'.repeat(64)}`),
    tape.raw,
  );
  assert.equal(miss.status, 308);
  assert.equal(miss.headers.get('location'), 'https://www.getdasha.com/faucet');
}

{
  function mockState() {
    const store = new Map();
    return {
      blockConcurrencyWhile: async (fn) => fn(),
      storage: {
        get: async (key) => store.get(key),
        put: async (key, value) => {
          if (key && typeof key === 'object' && !Array.isArray(key)) {
            for (const [k, v] of Object.entries(key)) store.set(k, v);
            return;
          }
          store.set(key, value);
        },
      },
    };
  }
  const faucet = new DashaFaucet(mockState(), {
    LOBBY_SESSION_SECRET: 'lobby-session-secret-for-tests',
    FAUCET_TREASURY: 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb',
    MINT,
    ALLOW_ANY_ORIGIN: '1',
    ALLOWED_ORIGINS: 'https://www.getdasha.com,https://lobby.getdasha.com',
  });
  const tape = createTape();
  tape.append({ sig: GOOD_SIG, amountUi: 50, at: Date.now(), from: PAYER });
  faucet.faucetTape = tape.raw;
  const res = await faucet.fetch(new Request(`https://www.getdasha.com/faucet/fill/${GOOD_SIG}`));
  assert.equal(res.status, 200, 'DO seeded fill 200');
  assert.equal(res.headers.get('x-dasha-edge'), 'faucet-fill');
  const html = await res.text();
  assert.match(html, /<title>50<\/title>/);
  assert.match(html, /<h1>50<\/h1>/);
  assert.match(html, /href="\/faucet">Get 100</);
  assert.match(html, new RegExp(`og:url" content="https://www.getdasha.com/faucet/fill/${GOOD_SIG}"`));
  assert.match(html, new RegExp(`jup\\.ag/tokens/${MINT}`));
  assert.match(html, /Claim\. Fill\. Buy\./);
  assert.doesNotMatch(html, /plugin\.jup\.ag|Copy link|Filled the jar/i);

  const dead = await faucet.fetch(new Request('https://www.getdasha.com/faucet/fill/not-a-sig'));
  assert.equal(dead.status, 308);
  assert.equal(dead.headers.get('location'), 'https://www.getdasha.com/faucet');
}

{
  const empty = await tapeApi(new Request('https://www.getdasha.com/faucet/tape'), []);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { ok: true, fills: [] });
  assert.equal(empty.headers.get('x-dasha-edge'), 'faucet-tape');
}

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const res = await edgeWorker.fetch(new Request(`${origin}/faucet/tape`), {});
  assert.equal(res.status, 200, `${origin}/faucet/tape`);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.fills, []);
}

console.log('dasha-faucet-fill-share: PASS (unknown 308 / amount + Get 100 / OG Claim. Fill. Buy. / quiet Solscan / empty tape honest)');
