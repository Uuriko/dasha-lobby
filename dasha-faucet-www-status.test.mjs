#!/usr/bin/env node
/**
 * www /faucet/status is public-read JSON, same as lobby.
 * /faucet HTML stays Typeform. Claim POST stays lobby.
 * Disk only. No wrangler. No dasha-ship. No Designer-publish.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  orderHomeLongPage,
  stripDeadNav,
  stripHomeOtherCoinWarning,
  mountHomeChessAndFaucet,
} from './dasha-lobby-worker.mjs';
import { isFaucetPublicReadPath } from './dasha-faucet.mjs';
import { createHash } from 'node:crypto';
import { FAUCET_PAGE_HTML, FAUCET_CLIENT_JS, FAUCET_CLIENT_SRI } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const pageSrc = readFileSync(join(root, 'dasha-faucet-page.html'), 'utf8');
const clientSrc = readFileSync(join(root, 'dasha-faucet-client.js'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

const STATUS = {
  funded: true,
  signer: true,
  amountUi: 100,
  balanceUi: 169000,
  solLamports: 154721149,
  autoPaused: false,
  dailyUsed: 0,
  error: null,
  mint: MINT,
};
const ME = { linked: false, claimed: false, dest: null, configured: true, x: null, signature: null };

assert.equal(isFaucetPublicReadPath('/faucet/status'), true);
assert.equal(isFaucetPublicReadPath('/faucet/me'), true);
assert.equal(isFaucetPublicReadPath('/faucet/status/'), true);
assert.equal(isFaucetPublicReadPath('/faucet/me/'), true);
assert.equal(isFaucetPublicReadPath('/faucet'), false);
assert.equal(isFaucetPublicReadPath('/faucet/'), false);
assert.equal(isFaucetPublicReadPath('/faucet/claim'), false);
assert.equal(isFaucetPublicReadPath('/faucet/dest-check'), false);
assert.equal(isFaucetPublicReadPath('/faucet/wallet/challenge'), false);
assert.equal(isFaucetPublicReadPath('/faucet/wallet/verify'), false);
assert.equal(isFaucetPublicReadPath('/faucet/tape'), false);
assert.equal(isFaucetPublicReadPath('/faucet/donate'), false);
assert.equal(isFaucetPublicReadPath('/faucet/fill/abc'), false);

assert.match(workerSrc, /isFaucetPublicReadPath/);
assert.match(workerSrc, /isProductHost/);
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
assert.match(workerSrc, new RegExp(MINT));

function firstPaint(html) {
  const at = String(html).indexOf('id="grwm"');
  return at >= 0 ? html.slice(0, at) : html;
}

function assertTypeformDoor(html, label) {
  assert.match(html, /id=["']dasha-faucet["']/, `${label} jar`);
  assert.match(html, /data-faucet-api="https:\/\/lobby\.getdasha\.com"/, `${label} claim API stays lobby`);
  assert.match(html, /<title>Fill the jar<\/title>/, `${label} title`);
  assert.match(html, /Once a day|dasha-faucet/, `${label} door`);
  assert.doesNotMatch(html, /"funded"\s*:/, `${label} HTML is not status JSON`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} no plugin.jup`);
  assert.match(html, new RegExp(MINT), `${label} mint`);
  assert.match(html, /jup\.ag/, `${label} jup.ag`);
}

assertTypeformDoor(pageSrc, 'disk /faucet');
assertTypeformDoor(FAUCET_PAGE_HTML, 'bundled /faucet');
assert.match(clientSrc, /Once a day/);
assert.match(clientSrc, /Get '\+amountUi/);
assert.match(clientSrc, /Link X/);
assert.match(clientSrc, /Prove wallet/);
assert.match(clientSrc, /tip me/);
assert.match(FAUCET_CLIENT_JS, /Once a day/);
assert.match(FAUCET_CLIENT_JS, /Get '\+amountUi/);
assert.match(FAUCET_CLIENT_JS, /Link X/);
assert.match(FAUCET_CLIENT_JS, /Prove wallet/);
assert.match(FAUCET_CLIENT_JS, /tip me/);

const faucetHits = [];
const mockFaucet = {
  idFromName() { return 'main'; },
  get() {
    return {
      async fetch(request) {
        const url = new URL(request.url);
        faucetHits.push({ method: request.method, path: url.pathname, host: url.host });
        const headers = {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
        };
        if (url.pathname === '/faucet/status' || url.pathname === '/faucet/status/') {
          return new Response(JSON.stringify(STATUS), { status: 200, headers });
        }
        if (url.pathname === '/faucet/me' || url.pathname === '/faucet/me/') {
          return new Response(JSON.stringify(ME), { status: 200, headers });
        }
        if (url.pathname === '/faucet/claim') {
          return new Response(JSON.stringify({ ok: true, signature: 'should-not-be-www' }), { status: 200, headers });
        }
        return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers });
      },
    };
  },
};
const env = { FAUCET: mockFaucet, ALLOWED_ORIGINS: 'https://www.getdasha.com,https://getdasha.com,https://lobby.getdasha.com' };

async function jsonPair(path) {
  const www = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), env);
  const lobby = await edgeWorker.fetch(new Request(`https://lobby.getdasha.com${path}`), env);
  return { www, lobby };
}

{
  const { www, lobby } = await jsonPair('/faucet/status');
  assert.equal(www.status, 200, 'www /faucet/status 200');
  assert.equal(lobby.status, 200, 'lobby /faucet/status 200');
  assert.match(www.headers.get('content-type') || '', /json/, 'www status JSON');
  assert.match(lobby.headers.get('content-type') || '', /json/, 'lobby status JSON');
  assert.equal(www.headers.get('access-control-allow-origin'), '*');
  assert.equal(lobby.headers.get('access-control-allow-origin'), '*');
  const wwwBody = await www.json();
  const lobbyBody = await lobby.json();
  assert.deepEqual(wwwBody, lobbyBody, 'www status JSON equals lobby');
  assert.equal(wwwBody.funded, true);
  assert.equal(wwwBody.signer, true);
  assert.equal(wwwBody.amountUi, 100);
  assert.equal(wwwBody.balanceUi, 169000);
  assert.doesNotMatch(JSON.stringify(wwwBody), /<!doctype/i);
}

{
  const { www, lobby } = await jsonPair('/faucet/me');
  assert.equal(www.status, 200, 'www /faucet/me 200');
  assert.equal(lobby.status, 200, 'lobby /faucet/me 200');
  assert.match(www.headers.get('content-type') || '', /json/);
  assert.equal(www.headers.get('access-control-allow-origin'), '*');
  const wwwBody = await www.json();
  const lobbyBody = await lobby.json();
  assert.deepEqual(wwwBody, lobbyBody, 'www /me JSON equals lobby');
  assert.equal(wwwBody.linked, false);
  assert.doesNotMatch(JSON.stringify(wwwBody), /<!doctype/i);
}

{
  const opt = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/status', { method: 'OPTIONS' }), env);
  assert.equal(opt.status, 204, 'www OPTIONS /faucet/status');
  assert.equal(opt.headers.get('access-control-allow-origin'), '*');
}

{
  const page = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet'), env);
  assert.equal(page.status, 200, 'www /faucet HTML 200');
  assert.equal(page.headers.get('x-dasha-edge'), 'faucet');
  assert.match(page.headers.get('content-type') || '', /html/);
  const html = await page.text();
  assertTypeformDoor(html, 'served www /faucet');
}

{
  const lobbyPage = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/faucet'), env);
  assert.equal(lobbyPage.status, 200);
  assert.match(lobbyPage.headers.get('content-type') || '', /html/);
  assertTypeformDoor(await lobbyPage.text(), 'served lobby /faucet');
}

{
  const before = faucetHits.length;
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('webflow', { status: 405, headers: { 'content-type': 'text/html' } });
  try {
    const claim = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/claim', {
      method: 'POST',
      headers: { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ dest: '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN' }),
    }), env);
    const claimHits = faucetHits.filter((h) => h.path === '/faucet/claim' && h.host === 'www.getdasha.com');
    assert.equal(claimHits.length, 0, 'www POST /faucet/claim does not hit faucet DO');
    assert.notEqual(claim.status, 200, 'www claim is not a funded tip JSON');
    if (claim.headers.get('content-type')?.includes('json')) {
      const body = await claim.json();
      assert.notEqual(body.signature, 'should-not-be-www');
    }
  } finally {
    globalThis.fetch = prevFetch;
  }
  assert.ok(faucetHits.length >= before, 'status/me still recorded');
}

{
  const fallback = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/status'), {});
  assert.equal(fallback.status, 200, 'www status without FAUCET still JSON');
  assert.match(fallback.headers.get('content-type') || '', /json/);
  assert.equal(fallback.headers.get('access-control-allow-origin'), '*');
  const body = await fallback.json();
  assert.equal(typeof body.funded, 'boolean');
  assert.equal(body.amountUi, 100);
  assert.equal(body.mint, MINT);
  assert.doesNotMatch(JSON.stringify(body), /<!doctype/i);
}

{
  const me = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/me'), {});
  assert.equal(me.status, 200, 'www /me without FAUCET still JSON');
  assert.match(me.headers.get('content-type') || '', /json/);
  const body = await me.json();
  assert.equal(body.linked, false);
}

{
  const home = `<!doctype html><html lang="en"><head><title>old</title></head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<section id="chat-door">Chat</section>
<section id="simp-door">Simp</section>
<section id="dasha-home-faucet"><div id="dasha-faucet"></div></section>
<section id="grwm">GRWM</section>
</body></html>`;
  const transformed = orderHomeLongPage(stripHomeOtherCoinWarning(stripDeadNav(home)));
  const paint = firstPaint(transformed);
  assert.match(paint, /\$<b>dasha<\/b>/, 'first paint $dasha');
  assert.match(paint, /Chat/, 'first paint Chat');
  assert.match(paint, /Buy/, 'first paint Buy');
  assert.doesNotMatch(paint, /Once a day/, 'first paint no Typeform dump');
  assert.doesNotMatch(paint, /Get 100/, 'first paint no Get 100');
  assert.doesNotMatch(paint, /plugin\.jup\.ag/);
  assert.match(transformed, new RegExp(MINT));
}


{
  const slash = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/faucet/'), env);
  assert.equal(slash.status, 200, 'lobby /faucet/ is Typeform HTML not DO 404');
  assert.match(slash.headers.get('content-type') || '', /html/, 'lobby /faucet/ HTML');
  assert.equal(slash.headers.get('x-dasha-edge'), 'faucet');
  const html = await slash.text();
  assertTypeformDoor(html, 'served lobby /faucet/');
  assert.doesNotMatch(html, /"error"\s*:\s*"not found"/, 'lobby /faucet/ is not DO JSON 404');
  const slashHits = faucetHits.filter((h) => h.path === '/faucet/' && h.host === 'lobby.getdasha.com');
  assert.equal(slashHits.length, 0, 'lobby /faucet/ does not hit faucet DO');
}


{
  const stale = 'sha384-KThkiVivLr+MO2K8pJPEjTNnsnKcz4JsbA7rafCwfQ75PfwmAUqhFCEOKs5BzlrG';
  const fileSri = 'sha384-' + createHash('sha384').update(readFileSync(join(root, 'dasha-faucet-client.js'))).digest('base64');
  assert.equal(fileSri, FAUCET_CLIENT_SRI, 'bundled faucet SRI is the bytes on disk');
  const shapes = [
    `<script src="https://lobby.getdasha.com/client/faucet.js" integrity="${stale}" crossorigin="anonymous" defer></script>`,
    `<script src="https://lobby.getdasha.com/client/faucet.js" integrity="${stale}" crossorigin="anonymous" defer>`,
    `<script type="text/javascript" src="https://lobby.getdasha.com/client/faucet.js" integrity="${stale}" defer></script>`,
  ];
  for (const tag of shapes) {
    const html = `<!doctype html><html><head></head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="chat" href="/lobby">Chat</a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<section id="grwm"></section>
${tag}
</body></html>`;
    const out = mountHomeChessAndFaucet(stripDeadNav(html));
    assert.match(out, new RegExp(fileSri.replace(/[+/]/g, '\\$&')), `home pins live faucet.js sri for ${tag.slice(0, 40)}`);
    assert.doesNotMatch(out, /KThkiViv/, `home drops stale Chrome sri for ${tag.slice(0, 40)}`);
    assert.equal((out.match(/client\/faucet\.js/g) || []).length, 1, 'home has one faucet.js');
    assert.match(out, /id=["']dasha-faucet["']/);
    const paint = firstPaint(out);
    assert.match(paint, /\$<b>dasha<\/b>/);
    assert.match(paint, /Chat/);
    assert.match(paint, /Buy/);
    assert.doesNotMatch(paint, /Once a day/);
    assert.doesNotMatch(paint, /Get 100/);
  }
}

console.log('dasha-faucet-www-status: PASS (www status = lobby JSON, /faucet HTML Typeform, claim stays lobby)');
