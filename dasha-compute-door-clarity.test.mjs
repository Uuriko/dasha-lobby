#!/usr/bin/env node
/**
 * Door clarity from live Worker 8a401bde (+ blank-Ask a53d54d6):
 * Start. hints Run a prompt. / Join a Mac. · Pay/Credits micro Top up / Balance.
 * Listings Mint/Pair titles + Buy $dasha → /how-to-buy.
 * Disk == embed. Served /compute + /listings. /ca stays /which.
 * GitHub-only. No wrangler. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const agent = readFileSync(join(root, 'dasha-compute-open-alpha/provider/agent.py'), 'utf8');
const WWW = 'https://www.getdasha.com';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function assertDoorClarity(html, label) {
  assert.match(html, /class=["']tf-door-hint["']>Run a prompt\.<\/p>/, `${label} Ask hint`);
  assert.match(html, /class=["']tf-door-hint["']>Join a Mac\.<\/p>/, `${label} Provide hint`);
  assert.match(html, /id=["']pick-ask["'][^>]*>Ask</, `${label} Ask button stays Ask`);
  assert.match(html, /id=["']pick-provide["'][^>]*>Provide</, `${label} Provide button stays Provide`);
  assert.match(html, /id=["']pick-pay["'][^>]*>Pay</, `${label} Pay button stays Pay`);
  assert.match(html, /id=["']pick-credits["'][^>]*>Credits</, `${label} Credits button stays Credits`);
  assert.match(html, /<span class=["']tf-micro["']>Top up<\/span>/, `${label} Pay micro`);
  assert.match(html, /<span class=["']tf-micro["']>Balance<\/span>/, `${label} Credits micro`);
  assert.match(html, /\.tf-door-hint\{/, `${label} door-hint CSS`);
  assert.match(html, /\.tf-micro\{/, `${label} micro CSS`);
  assert.match(html, /id=["']answer-retry["']/, `${label} Retry`);
  assert.match(html, /No reply\./, `${label} No reply. face`);
  assert.match(html, /__dashaEmptyRetryOnce/, `${label} one auto-retry`);
  assert.match(html, /empty completion/i, `${label} empty completion catch`);
  assert.match(html, /Waiting for a Mac…\|Waiting for Mac…\|Thinking…\|A Mac is generating…\|Queued/, `${label} cancel keeps partial`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/);
}

assertDoorClarity(disk, 'disk');
assertDoorClarity(COMPUTE_PAGE_HTML, 'embed');

assert.match(workerSrc, /const LISTINGS_HTML = `/);
assert.match(workerSrc, /title="token address"/, 'Mint title');
assert.match(workerSrc, /title="Raydium pool"/, 'Pair title');
assert.match(workerSrc, /href="\/how-to-buy">Buy \$dasha →/, 'listings Buy lock');
assert.doesNotMatch(workerSrc, /href="\/">Buy \$dasha →/, 'Buy does not go home');

assert.match(agent, /empty completion/, 'kit fails closed on empty');
assert.match(agent, /thinking/, 'kit thinking fallback');
assert.match(agent, /reasoning/, 'kit reasoning fallback');

assert.equal(potterHome308Dest('/ca'), `${WWW}/which`, '/ca stays /which');
assert.equal(potterHome308Dest('/listings'), null, '/listings stays 200');
assert.equal(potterHome308Dest('/compute'), null, '/compute stays 200');

const env = {};
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute`);
  if (host === 'www.getdasha.com') assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  const computeHtml = await compute.text();
  assertDoorClarity(computeHtml, `${host} /compute`);

  const listings = await edgeWorker.fetch(new Request(`https://${host}/listings`), env);
  assert.equal(listings.status, 200, `${host} /listings`);
  if (host === 'www.getdasha.com') assert.equal(listings.headers.get('x-dasha-edge'), 'listings');
  const listingsHtml = await listings.text();
  assert.match(listingsHtml, /title="token address"/, `${host} Mint title`);
  assert.match(listingsHtml, /title="Raydium pool"/, `${host} Pair title`);
  assert.match(listingsHtml, /href="\/how-to-buy">Buy \$dasha →/, `${host} Buy lock`);
  assert.match(listingsHtml, /53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
  assert.match(listingsHtml, /9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7/);
  assert.doesNotMatch(listingsHtml, /plugin\.jup\.ag/);

  const ca = await edgeWorker.fetch(new Request(`https://${host}/ca`), env);
  assert.equal(ca.status, 308, `${host} /ca`);
  assert.equal(ca.headers.get('location'), `${WWW}/which`, `${host} /ca → /which`);
}

console.log('dasha-compute-door-clarity: PASS (disk==embed, door hints, micro, listings titles + Buy lock, /compute+/listings 200, /ca→/which)');
