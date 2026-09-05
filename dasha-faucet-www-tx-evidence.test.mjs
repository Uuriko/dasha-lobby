#!/usr/bin/env node
/**
 * www /faucet/tx/<sig> must resolve like lobby: it is the canonical donate/burn
 * evidence URL host (dasha-simp-score.mjs builds + validates
 * https://www.getdasha.com/faucet/tx/{sig}), but productEdge only forwards
 * /faucet/status + /faucet/me to the FAUCET DO, so every evidence link on www
 * falls through to the HTML site-404 while lobby returns the tx JSON.
 *
 * Fail-before on main: isFaucetPublicReadPath('/faucet/tx/<sig>') is false and
 * the www fetch returns the HTML 404 without touching the FAUCET DO.
 *
 * Disk only. No wrangler. No dasha-ship. No Designer-publish.
 */
import assert from 'node:assert/strict';
import edgeWorker from './dasha-lobby-worker.mjs';
import { isFaucetPublicReadPath } from './dasha-faucet.mjs';
import { isValidDonateEvidenceUrl, donateSigFromEvidenceUrl } from './dasha-simp-score.mjs';

const SIG = '5x7' + 'a'.repeat(61); // 64-char base58-shaped signature
const EVIDENCE = `https://www.getdasha.com/faucet/tx/${SIG}`;

// The evidence contract itself: simp score awards point at www.
assert.equal(isValidDonateEvidenceUrl(EVIDENCE), true, 'canonical evidence URL is www host');
assert.equal(donateSigFromEvidenceUrl(EVIDENCE), SIG, 'sig round-trips from evidence URL');

// Route gate: /faucet/tx/<sig> is public read on www + lobby like status/me.
assert.equal(isFaucetPublicReadPath(`/faucet/tx/${SIG}`), true, 'tx evidence path is public read');
assert.equal(isFaucetPublicReadPath(`/faucet/tx/${SIG}/`), true, 'trailing slash tolerated');
assert.equal(isFaucetPublicReadPath('/faucet/tx/'), false, 'bare prefix without sig is not');
assert.equal(isFaucetPublicReadPath('/faucet/claim'), false, 'claim stays lobby-only');

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
        if (url.pathname === `/faucet/tx/${SIG}`) {
          return new Response(JSON.stringify({ ok: true, signature: SIG, at: 1788000000000, dest: 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb' }), { status: 200, headers });
        }
        return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers });
      },
    };
  },
};
const env = { FAUCET: mockFaucet, ALLOWED_ORIGINS: 'https://www.getdasha.com,https://getdasha.com,https://lobby.getdasha.com' };

{
  const www = await edgeWorker.fetch(new Request(EVIDENCE), env);
  const lobby = await edgeWorker.fetch(new Request(`https://lobby.getdasha.com/faucet/tx/${SIG}`), env);
  assert.equal(www.status, 200, 'www tx evidence 200');
  assert.equal(lobby.status, 200, 'lobby tx evidence 200');
  assert.match(www.headers.get('content-type') || '', /json/, 'www tx is JSON, never the HTML 404 page');
  const wwwBody = await www.json();
  const lobbyBody = await lobby.json();
  assert.deepEqual(wwwBody, lobbyBody, 'www tx JSON equals lobby');
  assert.equal(wwwBody.signature, SIG);
  assert.doesNotMatch(JSON.stringify(wwwBody), /<!doctype/i, 'no HTML shell in evidence response');
  const wwwHits = faucetHits.filter((h) => h.path === `/faucet/tx/${SIG}` && h.host === 'www.getdasha.com');
  assert.ok(wwwHits.length > 0, 'www tx request reaches the FAUCET DO');
}

{
  const unknown = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/tx/' + '9'.repeat(64)), env);
  assert.equal(unknown.status, 404, 'unknown sig still 404');
  assert.match(unknown.headers.get('content-type') || '', /json/, 'unknown sig 404 is JSON, not the HTML page');
  const body = await unknown.json();
  assert.equal(body.error, 'not found');
}

{
  const opt = await edgeWorker.fetch(new Request(`https://www.getdasha.com/faucet/tx/${SIG}`, { method: 'OPTIONS' }), env);
  assert.equal(opt.status, 204, 'www OPTIONS tx evidence');
  assert.equal(opt.headers.get('access-control-allow-origin'), '*');
}

{
  const post = await edgeWorker.fetch(new Request(`https://www.getdasha.com/faucet/tx/${SIG}`, {
    method: 'POST',
    headers: { Origin: 'https://www.getdasha.com', 'Content-Type': 'application/json' },
    body: '{}',
  }), env);
  assert.equal(post.status, 405, 'tx evidence is read-only on www');
  const postHits = faucetHits.filter((h) => h.method === 'POST' && h.path.startsWith('/faucet/tx/') && h.host === 'www.getdasha.com');
  assert.equal(postHits.length, 0, 'POST never reaches the DO from www');
}

console.log('dasha-faucet-www-tx-evidence: PASS (www evidence URLs resolve, parity with lobby, read-only)');
