#!/usr/bin/env node
/**
 * Leftover pretty path (Worker 3f2d0e6d-b1c8-4e12-b6bc-8fce4fb37301):
 * live /tokens (+slash / Title-case) html-404 → 308 home (peer of /token /mint).
 * /birdeye → /listings (peer of /cmc /coingecko /coinmarketcap).
 * /jupiter /raydium /pumpfun /pump-fun /pump_fun → /how-to-buy
 * (DEX peers of /buy /swap). NEVER plugin.jup.ag or external DEX hosts.
 * /socials /social → /lobby (community room). Keep /community → /compute.
 * /vision /tts /text-to-speech /text_to_speech (+ /compute/* tabs) → /compute/api
 * (peer of /embeddings).
 * Intentional skips stay null: /faq /waitlist /terms /blog /careers /hiring
 * /healthz /v1 /openai /discord /roadmap /whitepaper /tokenomics /x402
 * /openrouter /status /health.
 * Disk only. No Designer. Never plugin.jup.ag. PR-mirror only — no wrangler deploy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(workerSrc, /https:\/\/plugin\.jup\.ag/, 'worker must not contain https://plugin.jup.ag');
assert.match(workerSrc, /POTTER_HOME_308_PATHS/, 'home 308 set present');
assert.match(workerSrc, /POTTER_HOWTO_308_PATHS/, 'howto 308 set present');
assert.match(workerSrc, /POTTER_LISTINGS_308_PATHS/, 'listings 308 set present');
assert.match(workerSrc, /POTTER_LOBBY_DOOR_308_PATHS/, 'lobby-door 308 set present');
assert.match(workerSrc, /POTTER_COMPUTE_API_DOCS_308_PATHS/, 'api-docs 308 set present');

assert.match(
  workerSrc,
  /never Jupiter plugin host \/ external DEX hosts/,
  'howto leftover comment forbids external DEX hosts',
);
assert.match(
  workerSrc,
  /Leftover \/socials \/social/,
  'lobby leftover comment lists /socials /social',
);
assert.match(
  workerSrc,
  /Keep \/community → \/compute/,
  'lobby leftover comment keeps /community on /compute',
);
assert.match(
  workerSrc,
  /Leftover \/vision \/tts \/text-to-speech \/text_to_speech/,
  'api leftover comment lists vision/tts family',
);
assert.match(
  workerSrc,
  /Peer of \/embeddings/,
  'api leftover comment names /embeddings peer',
);

const homeSet = workerSrc.match(/const POTTER_HOME_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const howtoSet = workerSrc.match(/const POTTER_HOWTO_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const listingsSet = workerSrc.match(/const POTTER_LISTINGS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const lobbySet = workerSrc.match(/const POTTER_LOBBY_DOOR_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const apiDocs = workerSrc.match(/const POTTER_COMPUTE_API_DOCS_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];
const tab = workerSrc.match(/const POTTER_COMPUTE_TAB_308_PATHS = new Set\(\[[\s\S]*?\]\);/)[0];

for (const path of ['/token', '/mint', '/tokens']) {
  assert.match(homeSet, new RegExp(`'${path}["']`));
  assert.match(homeSet, new RegExp(`'${path}/["']`));
}
for (const path of ['/swap', '/jupiter', '/raydium', '/pumpfun', '/pump-fun', '/pump_fun']) {
  assert.match(howtoSet, new RegExp(`'${path}["']`));
  assert.match(howtoSet, new RegExp(`'${path}/["']`));
}
for (const path of ['/cmc', '/coingecko', '/coinmarketcap', '/birdeye']) {
  assert.match(listingsSet, new RegExp(`'${path}["']`));
  assert.match(listingsSet, new RegExp(`'${path}/["']`));
}
for (const path of ['/socials', '/social']) {
  assert.match(lobbySet, new RegExp(`'${path}["']`));
  assert.match(lobbySet, new RegExp(`'${path}/["']`));
}
const apiLeaves = [
  '/vision', '/tts', '/text-to-speech', '/text_to_speech', '/embeddings',
  '/compute/vision', '/compute/tts', '/compute/text-to-speech', '/compute/text_to_speech',
  '/compute/embeddings',
];
for (const path of apiLeaves) {
  assert.match(apiDocs, new RegExp(`'${path}["']`));
  assert.match(apiDocs, new RegExp(`'${path}/["']`));
}
assert.match(tab, /["']\/community'/);
assert.doesNotMatch(lobbySet, /['"]\/community['"]/, 'do not steal /community onto lobby-door');
assert.doesNotMatch(homeSet, /['"]\/tokenomics['"]/, 'do not invent /tokenomics on home');
assert.doesNotMatch(homeSet, /['"]\/roadmap['"]/, 'do not invent /roadmap on home');
assert.doesNotMatch(listingsSet, /['"]\/listings['"]/, 'exact /listings stays 200');
assert.doesNotMatch(howtoSet, /plugin\.jup\.ag/, 'howto set has no plugin.jup.ag');
assert.doesNotMatch(apiDocs, /['"]\/openai['"]/, 'do not fold /openai on api-docs');
assert.doesNotMatch(apiDocs, /['"]\/v1['"]/, 'do not fold /v1 on api-docs');
assert.doesNotMatch(apiDocs, /['"]\/openrouter['"]/, 'do not fold /openrouter on api-docs');
assert.doesNotMatch(apiDocs, /['"]\/x402['"]/, 'do not fold /x402 on api-docs');
assert.doesNotMatch(workerSrc, /https:\/\/plugin\.jup\.ag/, 'worker source has no https://plugin.jup.ag');

const WWW = 'https://www.getdasha.com';
const LOBBY_HOST = 'https://lobby.getdasha.com';
const HOME = `${WWW}/`;
const LISTINGS = `${WWW}/listings`;
const HOWTO = `${WWW}/how-to-buy`;
const LOBBY = `${WWW}/lobby`;
const COMPUTE = `${WWW}/compute`;
const API = `${WWW}/compute/api`;

const TO_HOME = [
  '/tokens', '/tokens/', '/Tokens', '/TOKENS', '/ToKeNs/',
  '/token', '/token/', '/Token', '/TOKEN', '/tOkEn/',
  '/mint', '/mint/', '/Mint', '/MINT', '/mInT/',
];
const TO_LISTINGS = [
  '/birdeye', '/birdeye/', '/Birdeye', '/BIRDEYE', '/BiRdEyE/',
  '/cmc', '/cmc/', '/Cmc', '/CMC', '/cMc/',
  '/coingecko', '/coingecko/', '/Coingecko', '/COINGECKO', '/CoinGecko/',
  '/coinmarketcap', '/coinmarketcap/', '/Coinmarketcap', '/COINMARKETCAP', '/CoinMarketCap/',
];
const TO_HOWTO = [
  '/jupiter', '/jupiter/', '/Jupiter', '/JUPITER', '/jUpItEr/',
  '/raydium', '/raydium/', '/Raydium', '/RAYDIUM', '/rAyDiUm/',
  '/pumpfun', '/pumpfun/', '/Pumpfun', '/PUMPFUN', '/pUmPfUn/',
  '/pump-fun', '/pump-fun/', '/Pump-fun', '/PUMP-FUN', '/Pump-Fun/',
  '/pump_fun', '/pump_fun/', '/Pump_fun', '/PUMP_FUN', '/Pump_Fun/',
  '/swap', '/swap/', '/Swap', '/SWAP', '/sWaP/',
  '/buy', '/buy/', '/Buy',
];
const TO_LOBBY = [
  '/socials', '/socials/', '/Socials', '/SOCIALS', '/sOcIaLs/',
  '/social', '/social/', '/Social', '/SOCIAL', '/sOcIaL/',
];
const TO_API = [
  '/vision', '/vision/', '/Vision', '/VISION', '/vIsIoN/',
  '/tts', '/tts/', '/Tts', '/TTS', '/tTs/',
  '/text-to-speech', '/text-to-speech/', '/Text-to-speech', '/TEXT-TO-SPEECH', '/Text-To-Speech/',
  '/text_to_speech', '/text_to_speech/', '/Text_to_speech', '/TEXT_TO_SPEECH', '/Text_To_Speech/',
  '/embeddings', '/embeddings/', '/Embeddings', '/EMBEDDINGS', '/eMbEdDiNgS/',
  '/compute/vision', '/compute/vision/', '/Compute/vision', '/COMPUTE/VISION', '/Compute/Vision/',
  '/compute/tts', '/compute/tts/', '/Compute/tts', '/COMPUTE/TTS', '/Compute/Tts/',
  '/compute/text-to-speech', '/compute/text-to-speech/', '/Compute/text-to-speech',
  '/COMPUTE/TEXT-TO-SPEECH', '/Compute/Text-To-Speech/',
  '/compute/text_to_speech', '/compute/text_to_speech/', '/Compute/text_to_speech',
  '/COMPUTE/TEXT_TO_SPEECH', '/Compute/Text_To_Speech/',
  '/compute/embeddings', '/compute/embeddings/', '/Compute/embeddings',
  '/COMPUTE/EMBEDDINGS', '/Compute/Embeddings/',
];
const STAY_NULL = [
  '/faq', '/faq/',
  '/waitlist', '/waitlist/',
  '/terms', '/terms/',
  '/blog', '/blog/',
  '/careers', '/careers/',
  '/hiring', '/hiring/',
  '/healthz', '/healthz/',
  '/v1', '/v1/',
  '/openai', '/openai/',
  '/discord', '/discord/',
  '/roadmap', '/roadmap/',
  '/whitepaper', '/whitepaper/',
  '/tokenomics', '/tokenomics/',
  '/x402', '/x402/',
  '/openrouter', '/openrouter/',
  '/status', '/status/',
  '/health', '/health/',
];

for (const path of TO_HOME) {
  assert.equal(potterHome308Dest(path), HOME, path);
}
for (const path of TO_LISTINGS) {
  assert.equal(potterHome308Dest(path), LISTINGS, path);
}
for (const path of TO_HOWTO) {
  assert.equal(potterHome308Dest(path), HOWTO, path);
  assert.doesNotMatch(potterHome308Dest(path), /plugin\.jup\.ag/, `${path} dest is not plugin.jup.ag`);
  assert.doesNotMatch(potterHome308Dest(path), /jup\.ag/, `${path} dest is not an external DEX host`);
  assert.doesNotMatch(potterHome308Dest(path), /raydium\.io/, `${path} dest is not raydium.io`);
  assert.doesNotMatch(potterHome308Dest(path), /pump\.fun/, `${path} dest is not pump.fun`);
}
for (const path of TO_LOBBY) {
  assert.equal(potterHome308Dest(path), LOBBY, path);
}
for (const path of TO_API) {
  assert.equal(potterHome308Dest(path), API, path);
  assert.notEqual(potterHome308Dest(path), COMPUTE, `${path} is not bare /compute`);
}
for (const path of STAY_NULL) {
  assert.equal(potterHome308Dest(path), null, `stay null ${path}`);
}
assert.equal(potterHome308Dest('/community'), COMPUTE, '/community stays /compute');
assert.equal(potterHome308Dest('/community/'), COMPUTE, '/community/ stays /compute');
assert.equal(potterHome308Dest('/Community'), COMPUTE, '/Community stays /compute');
assert.equal(potterHome308Dest('/studio'), HOME, '/studio still home');
assert.equal(potterHome308Dest('/listings'), null, '/listings stays 200');
assert.equal(potterHome308Dest('/how-to-buy'), null, '/how-to-buy stays 200');
assert.equal(potterHome308Dest('/lobby'), null, '/lobby stays 200');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');
assert.equal(potterHome308Dest('/compute/api'), null, '/compute/api stays 200');
assert.equal(potterHome308Dest('/play'), LOBBY, '/play still lobby');

function expectLoc(host, dest) {
  if (host !== 'lobby.getdasha.com') return dest;
  const u = new URL(dest);
  if (u.pathname === '/compute/api' || u.pathname.startsWith('/compute/api/')) {
    return LOBBY_HOST + u.pathname;
  }
  return dest;
}

const FETCH_SAMPLE = [
  ...['/tokens', '/Tokens/', '/mint', '/Token'].map((path) => [path, HOME]),
  ...['/birdeye', '/Birdeye/', '/cmc', '/CoinGecko'].map((path) => [path, LISTINGS]),
  ...['/jupiter', '/Raydium/', '/pumpfun', '/pump-fun', '/Pump_fun', '/swap'].map((path) => [path, HOWTO]),
  ...['/socials', '/Social/', '/social'].map((path) => [path, LOBBY]),
  ...['/vision', '/tts', '/text-to-speech', '/Text_to_speech/', '/compute/vision', '/Compute/embeddings'].map((path) => [path, API]),
];

const env = {
  LOBBY_SESSION_SECRET: 'tokens-birdeye-dex-socials-vision-pretty-path-secret',
  AI: { run: async () => ({ response: 'ok' }) },
};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const [path, dest] of FETCH_SAMPLE) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      assert.equal(res.headers.get('location'), expectLoc(host, dest), `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const path of STAY_NULL) {
    const dest = potterHome308Dest(path);
    assert.equal(dest, null, `${host} ${path} dest stays null`);
    const res = await edgeWorker.fetch(new Request(`https://${host}${path}`), env);
    assert.notEqual(res.headers.get('location'), HOME, `${host} ${path} not folded home`);
    assert.notEqual(res.headers.get('location'), LISTINGS, `${host} ${path} not folded listings`);
    assert.notEqual(res.headers.get('location'), HOWTO, `${host} ${path} not folded howto`);
    assert.notEqual(res.headers.get('location'), LOBBY, `${host} ${path} not folded lobby`);
    assert.notEqual(res.headers.get('location'), API, `${host} ${path} not folded api`);
    if (host === 'www.getdasha.com') {
      assert.equal(res.status, 404, `${host} ${path} stays 404`);
      assert.equal(res.headers.get('x-dasha-edge'), 'html-404', `${host} ${path} html-404`);
    }
  }
  const community = await edgeWorker.fetch(new Request(`https://${host}/community`), env);
  assert.equal(community.status, 308, `${host} /community still 308`);
  assert.equal(community.headers.get('location'), COMPUTE, `${host} /community stays /compute`);
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of [
  '/tokens', '/token', '/mint',
  '/birdeye', '/cmc', '/coingecko', '/coinmarketcap',
  '/jupiter', '/raydium', '/pumpfun', '/pump-fun', '/pump_fun', '/swap',
  '/socials', '/social',
  '/vision', '/tts', '/text-to-speech', '/text_to_speech', '/embeddings',
  '/faq', '/waitlist', '/terms', '/blog', '/careers', '/hiring',
  '/healthz', '/v1', '/openai', '/discord', '/roadmap', '/whitepaper',
  '/tokenomics', '/x402', '/openrouter', '/status', '/health',
]) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-tokens-birdeye-dex-socials-vision-pretty-path: PASS (/tokens+/token+/mint 308 /; /birdeye+/cmc+/coingecko+/coinmarketcap 308 /listings; /jupiter+/raydium+/pumpfun+/pump-fun+/pump_fun+/swap 308 /how-to-buy; /socials+/social 308 /lobby; /community stays /compute; /vision+/tts+/text-to-speech+/text_to_speech+/embeddings + /compute/* 308 /compute/api; Title-case+slash; www+lobby GET+HEAD sample; skips stay 404; no plugin.jup.ag)');
