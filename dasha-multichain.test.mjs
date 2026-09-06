import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { multichainResponse, addMultichainHowtoLink } from './dasha-multichain.mjs';
import { CHAIN_REGISTRY, SOURCE_NETWORKS, ARRIVAL_ASSETS, buildAcquisitionRoute } from './dasha-multichain-policy.mjs';
import { MINT } from './dasha-lobby-mod.mjs';

test('every starting network keeps the exact Solana destination and separates bridging from swapping', () => {
  for (const from of Object.keys(SOURCE_NETWORKS)) {
    for (const via of Object.keys(ARRIVAL_ASSETS)) {
      const route = buildAcquisitionRoute(from, via);
      const url = new URL(route.swapUrl);
      assert.equal(url.origin, 'https://jup.ag');
      assert.equal(url.searchParams.get('buy'), MINT);
      assert.equal(url.searchParams.get('sell'), ARRIVAL_ASSETS[via].address);
      assert.deepEqual([...url.searchParams.keys()], ['sell', 'buy']);
      assert.equal(route.kind, from === 'solana' ? 'solana-swap' : 'bridge-then-swap');
      assert.equal(route.bridgeUrl, from === 'solana' ? null : 'https://jup.ag/deposit/bridge');
      assert.equal(route.status, 'instructions-only');
    }
  }
  assert.throws(() => buildAcquisitionRoute('unlisted', 'sol'));
  assert.throws(() => buildAcquisitionRoute('base', 'unlisted'));
});

test('the real Worker serves routes, assets, and registry without network access or a wallet', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network access'); });
  for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
    for (const [path, mime] of [['/multichain', 'text/html'], ['/multichain/style.css', 'text/css'], ['/.well-known/dasha-chains.json', 'application/json']]) {
      const res = await worker.fetch(new Request('https://' + host + path), {});
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get('Content-Type'), new RegExp(mime));
      assert.equal(res.headers.get('X-Dasha-Edge'), 'multichain');
      assert.ok((await res.text()).length > 0);
      const head = await worker.fetch(new Request('https://' + host + path, { method: 'HEAD' }), {});
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
      assert.equal(head.headers.get('Content-Type'), res.headers.get('Content-Type'));
    }
  }
});

test('the served GET form works without JavaScript and reflects selected source and arrival asset', async () => {
  const res = await worker.fetch(new Request('https://www.getdasha.com/multichain?from=ethereum&via=usdc'), {});
  const html = await res.text();
  assert.match(html, /<form action="\/multichain" method="get">/);
  assert.match(html, /value="ethereum" selected/);
  assert.match(html, /value="usdc" selected/);
  assert.match(html, /Ethereum → Solana → \$dasha/);
  assert.match(html, /This step receives USDC/);
  assert.match(html, /After arrival, swap for \$dasha/);
  assert.match(html, new RegExp(MINT));
  assert.doesNotMatch(html, /<script|iframe|onchange=/);
  assert.match(res.headers.get('Content-Security-Policy'), /form-action 'self'/);
  const direct = await worker.fetch(new Request('https://www.getdasha.com/multichain?from=solana&via=sol'), {});
  const directHtml = await direct.text();
  assert.doesNotMatch(directHtml, /Open Jupiter bridge|Two separate steps/);
  assert.match(directHtml, /Already on Solana/);
});

test('invalid and repeated route choices show an error instead of choosing another asset', async () => {
  for (const search of ['?from=unlisted', '?from=', '?via=unlisted', '?from=base&from=solana', '?via=sol&via=usdc']) {
    const res = multichainResponse(new Request('https://www.getdasha.com/multichain' + search));
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    const html = await res.text();
    assert.match(html, /role="alert"/);
    assert.doesNotMatch(html, /https:\/\/jup.ag\/swap/);
  }
  // Unrecognized optional fields cannot retarget the destination or introduce a recipient.
  const res = multichainResponse(new Request('https://www.getdasha.com/multichain?from=base&buy=unlisted&recipient=unlisted'));
  const html = await res.text();
  assert.doesNotMatch(html, /buy=unlisted|recipient=unlisted/);
  assert.match(html, new RegExp('buy=' + MINT));
});

test('registry is explicit about the sole configured token, external handoff, and unobserved settlement', async () => {
  const res = await worker.fetch(new Request('https://www.getdasha.com/.well-known/dasha-chains.json'), {});
  const registry = await res.json();
  assert.deepEqual(registry, CHAIN_REGISTRY);
  assert.equal(registry.canonical.mint, MINT);
  assert.deepEqual(registry.representations, []);
  assert.equal(registry.acquisition.exactMintDirectCrossChain, false);
  assert.equal(registry.acquisition.settlementObservedByDasha, false);
});

test('methods, slash redirects, and unrelated paths retain their expected behavior', async () => {
  const base = 'https://www.getdasha.com';
  const slash = await worker.fetch(new Request(base + '/multichain/?from=base&via=usdc'), {});
  assert.equal(slash.status, 308);
  assert.equal(slash.headers.get('Location'), '/multichain?from=base&via=usdc');
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const res = await worker.fetch(new Request(base + '/multichain', { method }), {});
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('Allow'), 'GET, HEAD');
  }
  const insecure = await worker.fetch(new Request('http://www.getdasha.com/multichain'), {});
  assert.equal(insecure.status, 308);
  assert.equal(insecure.headers.get('Location'), base + '/multichain');
  for (const path of ['/how-to-buy', '/oauth/x/start', '/multichain/unknown']) {
    assert.equal(multichainResponse(new Request(base + path)), null);
  }
});

test('the actual How to Buy page gains one link and preserves its exact-mint buy action', async () => {
  const res = await worker.fetch(new Request('https://www.getdasha.com/how-to-buy'), {});
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.equal((html.match(/href="\/multichain"/g) ?? []).length, 1);
  assert.match(html, /Buy on Jupiter/);
  assert.match(html, new RegExp(MINT));
  assert.equal(addMultichainHowtoLink(html), html);
  const other = '<h1>Lobby</h1><p class="lede">Join the room.</p>';
  assert.equal(addMultichainHowtoLink(other), other);
});
