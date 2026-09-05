import assert from 'node:assert/strict';
import worker from './dasha-lobby-worker.mjs';
import { CREW_BUY, CREW_MINT, resetCrewCache, runCrewOnce } from './dasha-crew.mjs';
import { CREW_PAGE_HTML as EMBED } from './dasha-crew-page.mjs';

assert.match(EMBED, /<h1>Dasha Crew<\/h1>/);
assert.match(EMBED, /Five jobs\. You keep the keys\./);
assert.match(EMBED, /property="og:title" content="Dasha Crew"/);
assert.match(EMBED, /property="og:description" content="Five jobs\. You keep the keys\."/);
assert.match(EMBED, /property="og:url" content="https:\/\/www\.getdasha\.com\/crew"/);
assert.match(EMBED, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/);
assert.match(EMBED, /name="twitter:card" content="summary_large_image"/);
assert.match(EMBED, /Copy prompt/);
assert.match(EMBED, /You are Scout\. \$dasha tape only\./);
assert.match(EMBED, /Scout/);
assert.match(EMBED, /Trace/);
assert.match(EMBED, /Vibe/);
assert.match(EMBED, /Clock/);
assert.match(EMBED, /Kill/);
assert.match(EMBED, /53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
assert.match(EMBED, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112/);
assert.doesNotMatch(EMBED, /plugin\.jup\.ag/);
assert.doesNotMatch(EMBED, /<footer>[\s\S]*href=["']\/simp/);
assert.doesNotMatch(EMBED, /hamburger/i);
assert.doesNotMatch(EMBED, /studio/i);
assert.doesNotMatch(EMBED, /chess/i);
assert.doesNotMatch(EMBED, /equity curve/i);
assert.doesNotMatch(EMBED, /balance \$/);
assert.doesNotMatch(EMBED, /No fake P&(?:amp;)?L/, 'crew meta drops leftover P&L lecture');
assert.doesNotMatch(EMBED, /fake P/i, 'crew html drops leftover fake-P lecture');
assert.match(EMBED, /execCommand\('copy'\)/);
assert.match(EMBED, /Promise\.race/);
assert.match(EMBED, /selectNodeContents/);
assert.match(EMBED, /createElement\('textarea'\)/);
assert.doesNotMatch(EMBED, /writeText\(text\)\.then\(done\)\.catch\(\(\)=>\{button\.textContent='Select text'\}\)/);

resetCrewCache();

const crew = await worker.fetch(new Request('https://www.getdasha.com/crew'), {});
assert.equal(crew.status, 200);
assert.equal(crew.headers.get('x-dasha-edge'), 'crew');
const body = await crew.text();
assert.match(body, /<h1>Dasha Crew<\/h1>/);
assert.match(body, /Five jobs\. You keep the keys\./);
assert.match(body, /property="og:title" content="Dasha Crew"/);
assert.match(body, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/);
assert.match(body, /Copy prompt/);
assert.match(body, /Scout/);
assert.match(body, /You are Scout\. \$dasha tape only\./);
assert.match(body, /jup\.ag\/swap\?sell=So11111111111111111111111111111111111111112&amp;buy=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
assert.doesNotMatch(body, /plugin\.jup\.ag/);
{
  const foots = [...body.matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi)].map((m) => m[0]);
  assert.ok(!foots.some((f) => /href=(["'])(?:https?:\/\/(?:www\.)?getdasha\.com)?\/simp/.test(f)), 'crew footer has no Simp');
}
assert.match(body, /Lobby \/ @dash_eats\./, 'Vibe job is Lobby / @dash_eats');
assert.doesNotMatch(body, /\/ simp \//, 'crew has no / simp / product list');

const scoutOg = await worker.fetch(new Request('https://www.getdasha.com/crew?job=scout'), {});
assert.equal(scoutOg.status, 200);
const scoutBody = await scoutOg.text();
assert.match(scoutBody, /property="og:title" content="Scout · Dasha Crew"/);
assert.match(scoutBody, /property="og:description" content="\$dasha tape only\."/);
assert.match(scoutBody, /og:image" content="https:\/\/lobby\.getdasha\.com\/og\/dasha-social-card\.png"/);
assert.match(scoutBody, /Copy prompt/);

const slash = await worker.fetch(new Request('https://www.getdasha.com/crew/'), {});
assert.equal(slash.status, 200);
assert.equal(slash.headers.get('x-dasha-edge'), 'crew');
const head = await worker.fetch(new Request('https://www.getdasha.com/crew', { method: 'HEAD' }), {});
assert.equal(head.status, 200);
assert.equal(head.headers.get('x-dasha-edge'), 'crew');
assert.equal(await head.text(), '');

const kit = await worker.fetch(new Request('https://www.getdasha.com/dasha-crew.tar.gz'), {
  ASSETS: { fetch: async () => new Response('crew-kit', { status: 200 }) },
});
assert.equal(kit.status, 200);
assert.equal(await kit.text(), 'crew-kit');

const studio = await worker.fetch(new Request('https://www.getdasha.com/studio'), {});
assert.equal(studio.status, 308);
assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');

const compute = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(compute.status, 200);
assert.equal(compute.headers.get('x-dasha-edge'), 'compute');

const privacy = await worker.fetch(new Request('https://www.getdasha.com/privacy'), {});
assert.equal(privacy.status, 200);

const boom = async () => { throw new Error('offline'); };
const sit = await runCrewOnce({}, boom);
assert.equal(sit.verdict, 'sit');
assert.equal(sit.mint, CREW_MINT);
assert.equal(sit.buy, CREW_BUY);
assert.ok(!sit.buy.includes('plugin.jup.ag'));
assert.equal(sit.agents.find((a) => a.id === 'kill').vote, 'no');
assert.ok(sit.agents.every((a) => a.id === 'kill' || a.vote === 'sit'));

const mock = async (url, opts = {}) => {
  const href = String(url);
  if (href.includes('dexscreener')) {
    return new Response(JSON.stringify({
      pair: {
        pairAddress: '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7',
        baseToken: { address: CREW_MINT },
        priceUsd: '0.0000123',
        liquidity: { usd: 12000 },
        volume: { h24: 4000 },
        priceChange: { h1: 1.2, h24: -3.4 },
        txns: { h24: { buys: 9, sells: 7 } },
      },
    }), { status: 200 });
  }
  if (href.includes('/lobby') || href.includes('/simp') || href.includes('t.me')) {
    return new Response(null, { status: 200 });
  }
  if (opts.method === 'POST') {
    return new Response(JSON.stringify({ result: { value: [{}, {}, {}] } }), { status: 200 });
  }
  return new Response('no', { status: 404 });
};
const card = await runCrewOnce({}, mock);
assert.equal(card.verdict, 'yes');
assert.equal(card.agents.find((a) => a.id === 'kill').vote, 'no');
assert.equal(card.buy, CREW_BUY);

const dumpMock = async (url, opts = {}) => {
  const href = String(url);
  if (href.includes('dexscreener')) {
    return new Response(JSON.stringify({
      pair: {
        pairAddress: '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7',
        baseToken: { address: CREW_MINT },
        priceUsd: '0.00001',
        liquidity: { usd: 1000 },
        volume: { h24: 10 },
        priceChange: { h1: -12, h24: -30 },
        txns: { h24: { buys: 1, sells: 8 } },
      },
    }), { status: 200 });
  }
  if (href.includes('/lobby') || href.includes('/simp')) return new Response(null, { status: 200 });
  return new Response(null, { status: 404 });
};
const dumped = await runCrewOnce({}, dumpMock);
assert.equal(dumped.verdict, 'sit');
assert.equal(dumped.agents.find((a) => a.id === 'clock').vote, 'sit');

const once = await worker.fetch(new Request('https://www.getdasha.com/crew/api/once'), {});
assert.equal(once.status, 200);
assert.equal(once.headers.get('access-control-allow-origin'), '*');
const json = await once.json();
assert.ok(['yes', 'no', 'sit'].includes(json.verdict));
assert.equal(json.mint, CREW_MINT);
assert.equal(json.buy, CREW_BUY);
assert.equal(json.agents.length, 5);

const opt = await worker.fetch(new Request('https://www.getdasha.com/crew/api/once', { method: 'OPTIONS' }), {});
assert.equal(opt.status, 204);
assert.equal(opt.headers.get('access-control-allow-origin'), '*');

const log = await worker.fetch(new Request('https://www.getdasha.com/crew/api/log'), {});
assert.equal(log.status, 200);
assert.equal(log.headers.get('access-control-allow-origin'), '*');
const logged = await log.json();
assert.ok(Array.isArray(logged.cards));

console.log('dasha-crew-route: PASS (/crew 200 og+copy, vibe no / simp /, job=scout OG, kit, studio 308, compute 200, mint-only buy, fail→sit, footer no /simp)');
