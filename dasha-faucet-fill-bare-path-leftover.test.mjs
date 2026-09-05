#!/usr/bin/env node
/**
 * Leftover: live GET /faucet/fill (no sig) → 404 html-404.
 * /faucet/fill/ → 301 → bare → 404. Valid /faucet/fill/:sig works;
 * bad/missing sig already 308→/faucet via fillShareApi. Bare path has no
 * sig so isFaucetFillPath returns null and fell through to 404.
 * Quiet side door: Fill the jar lives on /faucet; bare /faucet/fill must
 * 308 → https://www.getdasha.com/faucet (same as unknown sig), not 404.
 * Disk + Worker serve. Never plugin.jup.ag. Never Designer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { DashaFaucet } from './dasha-lobby-worker.mjs';
import {
  createTape,
  fillShareApi,
  isBareFaucetFillPath,
  isFaucetFillPath,
  isFaucetTapePath,
} from './dasha-faucet-tape.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const tapeSrc = readFileSync(join(root, 'dasha-faucet-tape.mjs'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const GOOD_SIG = '1'.repeat(64);
const PAYER = 'So11111111111111111111111111111111111111112';

assert.doesNotMatch(tapeSrc, /plugin\.jup\.ag/, 'tape must not mention plugin.jup.ag');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(tapeSrc, /export function isBareFaucetFillPath/, 'bare helper exported');
assert.match(workerSrc, /isBareFaucetFillPath\(url\.pathname\) \|\| isFaucetFillPath\(url\.pathname\)/);
assert.match(workerSrc, /isBareFaucetFillPath\(path\) \|\| isFaucetFillPath\(path\)/);
assert.equal(
  (workerSrc.match(/isBareFaucetFillPath\(/g) || []).length,
  3,
  'www edge + DO stub + lobby edge all gate bare fill',
);

assert.equal(isBareFaucetFillPath('/faucet/fill'), true);
assert.equal(isBareFaucetFillPath('/faucet/fill/'), true);
assert.equal(isBareFaucetFillPath('/faucet/fills'), false, '/faucet/fills stays tape alias');
assert.equal(isBareFaucetFillPath(`/faucet/fill/${GOOD_SIG}`), false);
assert.equal(isFaucetFillPath('/faucet/fill'), null, 'live needle: bare has no sig');
assert.equal(isFaucetFillPath('/faucet/fill/'), null);
assert.equal(isFaucetTapePath('/faucet/fills'), true);

{
  const res = await fillShareApi(new Request('https://www.getdasha.com/faucet/fill'));
  assert.equal(res.status, 308, 'helper bare 308');
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/faucet');
  assert.equal(res.headers.get('x-dasha-edge'), 'faucet-fill');
}
{
  const res = await fillShareApi(new Request('https://www.getdasha.com/faucet/fill/'));
  assert.equal(res.status, 308, 'helper bare slash 308');
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/faucet');
  assert.equal(res.headers.get('x-dasha-edge'), 'faucet-fill');
}

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  for (const path of ['/faucet/fill', '/faucet/fill/']) {
    const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
    assert.equal(res.status, 308, `${origin}${path} serve 308`);
    assert.equal(res.headers.get('location'), 'https://www.getdasha.com/faucet', `${origin}${path} Location`);
    assert.equal(res.headers.get('x-dasha-edge'), 'faucet-fill', `${origin}${path} edge`);
  }
}

{
  const faucet = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet'), {});
  assert.equal(faucet.status, 200);
  assert.equal(faucet.headers.get('x-dasha-edge'), 'faucet');
}

{
  const miss = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/fill/not-a-sig'), {});
  assert.equal(miss.status, 308, 'nonsense sig still 308');
  assert.equal(miss.headers.get('location'), 'https://www.getdasha.com/faucet');
}

{
  const tape = createTape();
  tape.append({ sig: GOOD_SIG, amountUi: 1000, at: Date.now(), from: PAYER });
  const seeded = await fillShareApi(
    new Request(`https://www.getdasha.com/faucet/fill/${GOOD_SIG}`),
    tape.raw,
  );
  assert.equal(seeded.status, 200, 'sig page stays 200');
  assert.equal(seeded.headers.get('x-dasha-edge'), 'faucet-fill');
  const html = await seeded.text();
  assert.match(html, /<h1>1000<\/h1>/);
  assert.match(html, /href="\/faucet">Get 100</);
  assert.match(html, new RegExp(`jup\\.ag/tokens/${MINT}`));
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
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
  faucet.faucetTape = [];
  const bare = await faucet.fetch(new Request('https://www.getdasha.com/faucet/fill'));
  assert.equal(bare.status, 308, 'DO bare 308');
  assert.equal(bare.headers.get('location'), 'https://www.getdasha.com/faucet');
  assert.equal(bare.headers.get('x-dasha-edge'), 'faucet-fill');
}

console.log('dasha-faucet-fill-bare-path-leftover: PASS (bare /faucet/fill 308→/faucet; sig pages stay; no plugin.jup.ag)');
