#!/usr/bin/env node
/** /bag on-record lookup. Mocked Ansem. Hers never hits the ledger. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import {
  ANSEM_TIMEOUT_MS,
  HERS_BUY,
  HERS_LP,
  HERS_MINT,
  HERS_PAIR,
  OTHER_MINT,
  ansemCoinPage,
  ansemCoinUrl,
  bagRecordApi,
  isBagRecordPath,
  lookupRecord,
  normalizeMint,
} from './dasha-bag-record.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const ANSEM_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump';
const NEITHER_MINT = 'So11111111111111111111111111111111111111112';

assert.equal(ANSEM_TIMEOUT_MS, 2500);
assert.equal(isBagRecordPath('/bag/api/record'), true);
assert.equal(isBagRecordPath('/bag/api/record/'), true);
assert.equal(isBagRecordPath('/bag'), false);
assert.equal(isBagRecordPath('/bag/'), false);
assert.equal(isBagRecordPath('/which'), false);
assert.equal(normalizeMint(HERS_MINT), HERS_MINT);
assert.equal(normalizeMint(`  ${HERS_MINT}  `), HERS_MINT);
assert.equal(normalizeMint('nope'), '');
assert.equal(normalizeMint(''), '');
assert.equal(normalizeMint('https://ansem.io/api/coins/' + HERS_MINT), '');

function extractConst(name) {
  const m = workerSrc.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(m, `${name} embedded`);
  return m[1];
}

const bag = extractConst('BAG_HTML');
assert.match(bag, /<h1>The bag<\/h1>/);
assert.match(bag, /Mint-dead/);
assert.match(bag, /Freeze-dead/);
assert.match(bag, /Burned Raydium LP/);
assert.match(bag, new RegExp(HERS_MINT));
assert.match(bag, new RegExp(HERS_PAIR));
assert.match(bag, new RegExp(HERS_LP));
assert.match(bag, /jup\.ag\/tokens\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
assert.match(bag, /<form id="record" action="\/bag\/api\/record" method="get">/);
assert.match(bag, /<input id="mint" name="mint"/);
assert.match(bag, /<button type="submit">Look<\/button>/);
assert.match(bag, /fetch\('\/bag\/api\/record\?mint=' /);
assert.doesNotMatch(bag, /ansem\.io\/api/);
assert.doesNotMatch(bag, /plugin\.jup\.ag/);
assert.doesNotMatch(bag, /VVAIFU/);
assert.doesNotMatch(bag, /t\.me/);
assert.equal((bag.match(/<input\b/g) || []).length, 1);
assert.equal((bag.match(/<button\b/g) || []).length, 1);

const which = extractConst('WHICH_HTML');
assert.doesNotMatch(which, /<form\b/);
assert.doesNotMatch(which, /<input\b/);
assert.match(which, /Which \$dasha\?/);

const boom = async () => {
  throw new Error('ansem must not be called');
};

const hers = await lookupRecord(HERS_MINT, boom);
assert.equal(hers.status, 200);
assert.equal(hers.body.verdict, 'hers');
assert.equal(hers.body.mint, HERS_MINT);
assert.equal(hers.body.pair, HERS_PAIR);
assert.equal(hers.body.lp, HERS_LP);
assert.equal(hers.body.mintDead, true);
assert.equal(hers.body.freezeDead, true);
assert.equal(hers.body.burnedLp, true);
assert.equal(hers.body.buy, HERS_BUY);
assert.ok(hers.body.buy.startsWith('https://jup.ag/tokens/'));
assert.ok(!hers.body.buy.includes('plugin.jup.ag'));

const vvaifu = await lookupRecord(OTHER_MINT, boom);
assert.equal(vvaifu.status, 200);
assert.equal(vvaifu.body.verdict, 'other-dasha');
assert.equal(vvaifu.body.note, 'VVAIFU. Not this.');
assert.equal(vvaifu.body.buy, undefined);

const ANSEM_FIXTURE = {
  coin: {
    tier: 'free',
    status: 'live',
    airdropTotal: 12345,
    airdropPct: 3,
    name: 'Ansem',
    ticker: 'ANSEM',
    slug: 'ansem',
    mint: ANSEM_MINT,
  },
};

let seen = [];
const onRecordFetch = async (url) => {
  seen.push(String(url));
  assert.equal(String(url), ansemCoinUrl(ANSEM_MINT));
  return new Response(JSON.stringify(ANSEM_FIXTURE), { status: 200 });
};
const onRecord = await lookupRecord(ANSEM_MINT, onRecordFetch);
assert.equal(onRecord.status, 200);
assert.equal(onRecord.body.verdict, 'on-record');
assert.equal(onRecord.body.name, 'Ansem');
assert.equal(onRecord.body.ticker, 'ANSEM');
assert.equal(onRecord.body.tier, 'free');
assert.equal(onRecord.body.status, 'live');
assert.equal(onRecord.body.airdropTotal, 12345);
assert.equal(onRecord.body.airdropPct, 3);
assert.equal(onRecord.body.href, ansemCoinPage(ANSEM_MINT));
assert.equal(onRecord.body.buy, undefined);
assert.deepEqual(seen, [ansemCoinUrl(ANSEM_MINT)]);

seen = [];
const neitherFetch = async (url) => {
  seen.push(String(url));
  return new Response(JSON.stringify({ error: 'COIN_NOT_FOUND' }), { status: 404 });
};
const neither = await lookupRecord(NEITHER_MINT, neitherFetch);
assert.equal(neither.status, 200);
assert.equal(neither.body.verdict, 'neither');
assert.equal(neither.body.note, 'Not hers. Not on that ledger.');
assert.equal(neither.body.tier, undefined);
assert.deepEqual(seen, [ansemCoinUrl(NEITHER_MINT)]);

const bad = await lookupRecord('not-a-mint', boom);
assert.equal(bad.status, 400);
assert.equal(bad.body.error, 'bad mint');
assert.equal(bad.body.verdict, undefined);

const hang = () => new Promise(() => {});
const timed = await lookupRecord(ANSEM_MINT, hang, 20);
assert.equal(timed.status, 200);
assert.equal(timed.body.verdict, 'unknown');
assert.equal(timed.body.error, 'Ledger quiet.');
assert.equal(timed.body.tier, undefined);

const down = await lookupRecord(ANSEM_MINT, async () => new Response('no', { status: 503 }));
assert.equal(down.body.verdict, 'unknown');
assert.equal(down.body.tier, undefined);

async function call(url, init = {}, fetchImpl) {
  return bagRecordApi(new Request(url, init), {}, fetchImpl);
}

const hersGet = await call(`https://www.getdasha.com/bag/api/record?mint=${HERS_MINT}`, {}, boom);
assert.equal(hersGet.status, 200);
assert.equal(hersGet.headers.get('access-control-allow-origin'), '*');
assert.equal(hersGet.headers.get('x-dasha-edge'), 'bag-record');
assert.equal((await hersGet.json()).verdict, 'hers');

const hersPost = await call('https://www.getdasha.com/bag/api/record', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mint: HERS_MINT }),
}, boom);
assert.equal(hersPost.status, 200);
assert.equal((await hersPost.json()).verdict, 'hers');

const otherPost = await call('https://www.getdasha.com/bag/api/record', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ mint: OTHER_MINT }),
}, boom);
assert.equal((await otherPost.json()).verdict, 'other-dasha');

const opt = await call('https://www.getdasha.com/bag/api/record', { method: 'OPTIONS' }, boom);
assert.equal(opt.status, 204);
assert.equal(opt.headers.get('access-control-allow-origin'), '*');

const missingSlash = await call('https://www.getdasha.com/bag/api/record/', {}, boom);
assert.equal(missingSlash.status, 400);
assert.equal((await missingSlash.json()).error, 'bad mint');

const missing = await call('https://www.getdasha.com/bag/api/record', {}, boom);
assert.equal(missing.status, 400);
assert.equal((await missing.json()).error, 'bad mint');

const put = await call('https://www.getdasha.com/bag/api/record', { method: 'PUT' }, boom);
assert.equal(put.status, 405);

const boomEnv = { fetch: boom };
for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const page = await edgeWorker.fetch(new Request(`${origin}/bag`), boomEnv);
  assert.equal(page.status, 200, `${origin}/bag`);
  assert.equal(page.headers.get('x-dasha-edge'), 'bag');
  const html = await page.text();
  assert.match(html, /Mint-dead/);
  assert.match(html, /<form id="record"/);
  assert.doesNotMatch(html, /VVAIFU/);
  assert.doesNotMatch(html, /ansem\.io\/api/);

  const rec = await edgeWorker.fetch(new Request(`${origin}/bag/api/record?mint=${HERS_MINT}`), boomEnv);
  assert.equal(rec.status, 200, `${origin}/bag/api/record hers`);
  assert.equal(rec.headers.get('access-control-allow-origin'), '*');
  assert.equal(rec.headers.get('x-dasha-edge'), 'bag-record');
  const body = await rec.json();
  assert.equal(body.verdict, 'hers');
  assert.equal(body.buy, HERS_BUY);

  const other = await edgeWorker.fetch(new Request(`${origin}/bag/api/record?mint=${OTHER_MINT}`), boomEnv);
  assert.equal((await other.json()).verdict, 'other-dasha');

  const nope = await edgeWorker.fetch(new Request(`${origin}/bag/api/record?mint=bad`), boomEnv);
  assert.equal(nope.status, 400);

  const listed = await edgeWorker.fetch(new Request(`${origin}/bag/api/record?mint=${ANSEM_MINT}`), {
    fetch: onRecordFetch,
  });
  const listedBody = await listed.json();
  assert.equal(listed.status, 200);
  assert.equal(listedBody.verdict, 'on-record');
  assert.equal(listedBody.href, ansemCoinPage(ANSEM_MINT));
  assert.equal(listedBody.buy, undefined);
}

const whichPage = await edgeWorker.fetch(new Request('https://www.getdasha.com/which'), {});
assert.equal(whichPage.status, 200);
const whichHtml = await whichPage.text();
assert.doesNotMatch(whichHtml, /<form\b/);
assert.doesNotMatch(whichHtml, /\/bag\/api\/record/);

console.log('dasha-bag-record: PASS (hers / VVAIFU / on-record / neither / bad mint / timeout, no Ansem from page)');
