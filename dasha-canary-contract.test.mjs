#!/usr/bin/env node
/**
 * 2026-08-26 5:50 PM PT canary contract.
 * Encodes the rollback that landed live (dasha-2 overwrite):
 *   home chess-door + VVAIFU/CoinGecko, no chat-door
 *   /privacy 308 home
 *   /dasha /desk 308 /
 *   /graph 404
 *   /oauth/x/start 404
 *   www /chess/me HTML 404
 *   sitemap /dasha + lobby?
 * These asserts fail on that worker and pass on ship-src.
 * Disk only. No wrangler. No dasha-ship. No Designer-publish.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  applyDigestTape,
  orderHomeLongPage,
  potterHome308Dest,
  potterHome308Response,
  stripDeadNav,
  stripHomeOtherCoinWarning,
  stripRetiredProductDoors,
} from './dasha-lobby-worker.mjs';
import { DEFAULT, TG as DIGEST_TG, homeTapeItems } from './dasha-digest.mjs';
import { SITEMAP_XML as GEN_SITEMAP } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const loginSrc = readFileSync(join(root, 'dasha-login-page.html'), 'utf8');
const latest = JSON.parse(readFileSync('/workspace/dasha-digest-latest.json', 'utf8'));
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const TG = 'https://t.me/+xB7S8mIQaKFiZjRh';

const BROKEN_LIVE_HOME = `<!doctype html><html lang="en"><head>
<title>old home</title>
<meta name="description" content="Not CoinGecko's Dasha (VVAIFU).">
</head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="buy" href="https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&amp;buy=${MINT}">Buy</a></header>
<nav class="dasha-nav"><a href="/chess">chess</a><a href="/dasha">desk</a><a href="/studio">studio</a></nav>
<nav class="nav wrap" aria-label="Main navigation"><a class="brand" href="#top">$<span>DASHA</span></a><div class="navlinks"><a href="/lobby">Lobby</a><a href="/faucet">Faucet</a><a href="/how-to-buy">How to buy</a><a href="/login">Log in</a></div></nav>
<style id="dasha-home-compute">#compute-door{display:block!important}</style>
<section id="compute-door" aria-labelledby="compute-title"><h2 id="compute-title">Compute</h2><a href="/compute">Try the console</a></section>
<section id="chess-door" aria-labelledby="chess-title"><h2 id="chess-title">Play chess.</h2><a href="/chess">Open chess →</a></section>
<p class="mint-lede">Not CoinGecko's Dasha (VVAIFU). <a href="/which">Which $dasha?</a></p>
<section id="simp-door"><h2>Simp Quiz.</h2></section>
<section id="dasha-home-faucet"><div id="dasha-faucet"></div></section>
<section id="grwm" aria-label="Get ready with me"><p>GRWM</p></section>
<footer><a href="/chess">Chess</a> · <a href="/dasha">Desk</a> · <a href="/studio">Studio</a></footer>
</body></html>`;

function firstPaint(html) {
  const at = String(html).indexOf('id="grwm"');
  return at >= 0 ? html.slice(0, at) : html;
}

/** which-door first-paint copy names VVAIFU on purpose ("This mint. Not VVAIFU."). */
function withoutWhichDoor(html) {
  return String(html).replace(/<section\b[^>]*\bid=["']which-door["'][^>]*>[\s\S]*?<\/section>/i, '');
}

function assertHomeContract(html, label) {
  assert.match(html, /id=["']chat-door["']/, `${label} chat-door`);
  assert.match(html, /id=["']simp-door["']/, `${label} simp`);
  assert.match(html, /id=["']dasha-home-faucet["']|id=["']dasha-faucet["']/, `${label} faucet`);
  assert.match(html, /id=["']grwm["']/, `${label} grwm`);
  assert.doesNotMatch(html, /id=["']chess-door["']/, `${label} no chess-door`);
  assert.doesNotMatch(html, /id=["']compute-door["']/, `${label} no compute-door`);
  assert.doesNotMatch(html, /id=["']dasha-home-compute["']/, `${label} no force-show compute CSS`);
  assert.doesNotMatch(html, /Try the console/, `${label} no Try the console`);
  assert.doesNotMatch(html, /<nav class="dasha-nav">/, `${label} no leftover dasha-nav`);
  assert.doesNotMatch(html, /<nav class="nav wrap"/, `${label} no leftover wrap nav`);
  const paint = firstPaint(html);
  assert.match(paint, /id=["']chat-door["']/, `${label} chat on first paint`);
  assert.doesNotMatch(paint, /id=["']chess-door["']/, `${label} no chess on first paint`);
  assert.doesNotMatch(withoutWhichDoor(paint), /VVAIFU|Not CoinGecko/i, `${label} no other-coin lecture on first paint`);
  const grokAt = html.indexOf('id="grok-door"');
  const grwmAt = html.indexOf('id="grwm"');
  assert.ok(grokAt > grwmAt, `${label} grok-door AFTER grwm`);
}

// --- failing fixture: the 5:50 PM PT live rollback ---
assert.match(BROKEN_LIVE_HOME, /id=["']chess-door["']/, 'rollback fixture has chess-door');
assert.doesNotMatch(BROKEN_LIVE_HOME, /id=["']chat-door["']/, 'rollback fixture has no chat-door');
assert.match(BROKEN_LIVE_HOME, /VVAIFU/, 'rollback fixture lectures VVAIFU');
assert.match(BROKEN_LIVE_HOME, /Not CoinGecko/, 'rollback fixture lectures CoinGecko');
assert.throws(() => assertHomeContract(BROKEN_LIVE_HOME, 'broken-live'), /chat-door|chess-door|VVAIFU|CoinGecko|grok-door/, 'untransformed home fails the canary');

// --- passing: ship-src transforms ---
const keptEmbed = stripRetiredProductDoors('<a href="/chess">Open chess</a><a href="/chess?embed=1">embed</a><a href="/dasha">Desk</a><a href="/desk">Desk2</a><a href="/studio">Studio</a>');
assert.match(keptEmbed, /href="\/chess\?embed=1"/);
assert.doesNotMatch(keptEmbed, /href="\/chess"/);
assert.doesNotMatch(keptEmbed, /\/dasha|\/desk|\/studio/);

const transformed = stripHomeOtherCoinWarning(stripDeadNav(BROKEN_LIVE_HOME));
assertHomeContract(transformed, 'stripDeadNav+other-coin');

const ordered = orderHomeLongPage('<main><header id="content">hero</header><section id="grwm">GRWM</section></main>');
assertHomeContract(ordered, 'orderHomeLongPage');

const taped = applyDigestTape(transformed, homeTapeItems(DEFAULT.items));
assert.match(taped, /id=["']dasha-digest["']/, 'home tape lands');
assert.ok(taped.indexOf('id="dasha-digest"') > taped.indexOf('id="grwm"'), 'tape AFTER grwm');
assert.ok(taped.indexOf('id="dasha-digest"') > taped.indexOf('id="grok-door"'), 'tape AFTER grok-door');
assert.doesNotMatch(firstPaint(taped), /id=["']dasha-digest["']/, 'first paint no tape');
assert.doesNotMatch(withoutWhichDoor(firstPaint(taped)), /VVAIFU/, 'first paint still no VVAIFU outside which-door');
assert.match(firstPaint(taped), /id=["']chat-door["']/, 'first paint still chat-door');
assert.equal((taped.match(/<li>/g) || []).length, 5, 'home tape cap 5');

// --- dest-by-path: privacy is NOT in the 308-home list ---
assert.equal(potterHome308Dest('/privacy'), null);
assert.equal(potterHome308Dest('/privacy/'), null);
assert.equal(potterHome308Response(new Request('https://www.getdasha.com/privacy'), new URL('https://www.getdasha.com/privacy')), null);
for (const path of ['/studio', '/verse', '/learn', '/graph', '/index.html']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/', path);
}
for (const path of ['/dasha', '/desk']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/how-to-buy', path);
}
for (const path of ['/grok', '/grok/', '/siwg', '/siwg/']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/login#grok', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/login#grok', path);
}
for (const path of ['/compute/use', '/compute/provide', '/compute/night', '/compute/build', '/compute/sponsor', '/compute/night/', '/compute/ask', '/compute/pay', '/compute/credits', '/compute/host', '/compute/marketplace', '/compute/you', '/compute/Ask', '/compute/Credits']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/compute', path);
}
assert.equal(potterHome308Dest('/compute'), null);
assert.equal(potterHome308Dest('/compute/'), 'https://www.getdasha.com/compute');
assert.equal(potterHome308Dest('/compute/api'), null);
assert.equal(potterHome308Dest('/compute/api/healthz'), null);
assert.equal(potterHome308Dest('/faucet'), null);
assert.equal(potterHome308Dest('/faucet/'), null);
for (const path of ['/fill-the-jar', '/fill-the-jar/', '/Fill-the-jar', '/FILL-THE-JAR', '/faucet/fill-the-jar', '/faucet/fill_the_jar', '/Faucet/fill-the-jar', '/FAUCET/FILL_THE_JAR']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/faucet', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/faucet', path);
}
for (const path of ['/bounty', '/bounty/', '/Bounty', '/BOUNTY']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/bounties', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/bounties', path);
}
for (const path of ['/how-tobuy', '/how-tobuy/', '/howto_buy', '/Howto_buy']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/how-to-buy', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/how-to-buy', path);
}
for (const path of ['/provide', '/Provide', '/start', '/Start', '/sponsor', '/sponsors', '/Sponsors', '/ask', '/Ask', '/pay', '/Pay', '/credits', '/Credits', '/host', '/Host', '/use', '/night', '/marketplace', '/market', '/you', '/build', '/ocm', '/Ocm']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/compute', path);
}
for (const path of ['/tip', '/tip/', '/tip-me', '/Tip-me', '/TIP-ME', '/tips', '/tips/', '/compute/tips']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/faucet', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/faucet', path);
}
for (const path of ['/hosts', '/Hosts', '/compute/hosts', '/me', '/usage', '/mac-kit', '/inference', '/gpu']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
}
for (const path of ['/fleet', '/Fleet', '/compute/fleet', '/rent', '/Rent', '/compute/rent', '/capacity', '/workers', '/dashboard', '/apple-silicon', '/setup', '/hello']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
}
for (const path of ['/donate', '/donate/', '/Donate']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/faucet', path);
}
for (const path of ['/settlement', '/Settlement', '/compute/invoice', '/credit', '/kits', '/try', '/getting-started', '/mac_kit']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
}
for (const path of ['/plan', '/Plans', '/prices', '/payout', '/agents', '/mcp', '/tools', '/compute/price', '/earn', '/mac', '/kit']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
}
assert.equal(potterHome308Dest('/price'), null, 'bare /price stays token-price API');
assert.equal(potterHome308Dest('/price/'), null, 'bare /price/ stays token-price API');
for (const path of ['/endpoint', '/endpoints', '/sdk', '/cli', '/compute/sdk']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute/api', path);
}
for (const path of ['/purchase', '/Purchase']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/how-to-buy', path);
}
for (const path of ['/once-a-day', '/once_a_day', '/Once-a-day']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/faucet', path);
}
for (const path of ['/job', '/compute/job', '/api/job']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute/api/jobs', path);
}
for (const path of ['/receipt', '/receipts', '/compute/receipts', '/api/receipts']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute/api/receipts', path);
}
assert.equal(potterHome308Dest('/api/keys'), 'https://www.getdasha.com/compute/api/keys');
assert.equal(potterHome308Dest('/faucet/me'), null);
for (const path of ['/help', '/Help', '/guide', '/support', '/contact', '/free-credits']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
}
for (const path of ['/app', '/App', '/application', '/Application', '/compute/app', '/compute/application']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
}
for (const path of ['/provider-kit', '/Provider-kit', '/compute/provider-kit', '/provide-kit', '/host-kit', '/compute-kit', '/provider_kit']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
}
for (const path of ['/llm', '/Llm', '/onboarding', '/macbook', '/factory', '/Factory', '/beta', '/providerkit', '/early-access', '/compute/llm']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
}
for (const path of ['/answer', '/answer/', '/Answer', '/compute/answer', '/compute/answer/', '/compute/Ask']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
}
assert.equal(potterHome308Dest('/compute/v1'), 'https://www.getdasha.com/compute/api/v1');
assert.equal(potterHome308Dest('/compute/v1/'), 'https://www.getdasha.com/compute/api/v1');
assert.equal(potterHome308Dest('/Compute/v1/models'), 'https://www.getdasha.com/compute/api/v1/models');
assert.equal(potterHome308Dest('/compute/v1/models'), 'https://www.getdasha.com/compute/api/v1/models');
assert.equal(potterHome308Dest('/v1'), null, 'bare /v1 stays 404');
assert.equal(potterHome308Dest('/v1/models'), null, 'bare /v1/models stays 404');
assert.equal(potterHome308Dest('/compute/api/v1'), null, 'exact /compute/api/v1 stays handler');
assert.equal(potterHome308Dest('/compute/api/v1/models'), null, 'exact /compute/api/v1/models stays handler');
assert.equal(potterHome308Dest('/docs'), 'https://www.getdasha.com/compute/api', '/docs stays /compute/api');
for (const path of ['/openai', '/openai-api', '/v1', '/resend', '/email', '/health', '/status', '/healthz', '/connect', '/arcade', '/games', '/room', '/admin', '/blog', '/news', '/faq', '/waitlist', '/join', '/oauth', '/tos', '/terms', '/legal']) {
  assert.equal(potterHome308Dest(path), null, path);
}
for (const path of ['/Faucet', '/Faucet/', '/FAUCET']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/faucet', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/faucet', path);
}
for (const path of ['/Compute', '/Compute/', '/COMPUTE']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/compute', path);
}
for (const [path, want] of [
  ['/Lobby', 'https://www.getdasha.com/lobby'],
  ['/Chess', 'https://www.getdasha.com/chess'],
  ['/Bag', 'https://www.getdasha.com/bag'],
  ['/Simp', 'https://www.getdasha.com/simp'],
  ['/Crew', 'https://www.getdasha.com/crew'],
  ['/Contribute', 'https://www.getdasha.com/contribute'],
  ['/Privacy', 'https://www.getdasha.com/privacy'],
  ['/Which', 'https://www.getdasha.com/which'],
  ['/Bounties', 'https://www.getdasha.com/bounties'],
  ['/Login', 'https://www.getdasha.com/login'],
  ['/How-to-buy', 'https://www.getdasha.com/how-to-buy'],
  ['/HOW-TO-BUY', 'https://www.getdasha.com/how-to-buy'],
]) {
  assert.equal(potterHome308Dest(path), want, path);
}
assert.equal(potterHome308Dest('/lobby'), null);
assert.equal(potterHome308Dest('/chess'), null);
assert.equal(potterHome308Dest('/privacy'), null);
assert.equal(potterHome308Dest('/how-to-buy'), null);
for (const path of ['/verify', '/verify/', '/ca', '/ca/', '/CA', '/Ca']) {
  assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/which', path);
  const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
  assert.equal(res.status, 308, path);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/which', path);
}
assert.equal(potterHome308Dest('/auth/grok/verify'), null);

const mockLobby = {
  idFromName() { return 'public'; },
  get() {
    return {
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/chess/me') {
          return new Response(JSON.stringify({ ok: true, linked: false, enrolled: false, holder: false, x: null, rating: null, queued: false, game: null }), {
            status: 200,
            headers: {
              'content-type': 'application/json; charset=utf-8',
              'access-control-allow-origin': 'https://www.getdasha.com',
              'access-control-allow-credentials': 'true',
            },
          });
        }
        return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
      },
    };
  },
};
const env = { LOBBY: mockLobby, ALLOWED_ORIGINS: 'https://www.getdasha.com,https://getdasha.com,https://lobby.getdasha.com' };

{
  const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(privacy.status, 200, '/privacy 200 not 308');
  assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  const body = await privacy.text();
  assert.match(body, /<h1>Privacy<\/h1>/);
  assert.match(body, /<title>Dasha privacy<\/title>/);
  assert.match(body, /X OAuth/);
  assert.match(body, /wallet signature/);
  assert.match(body, /HttpOnly Secure cookies/);
  assert.match(body, /never collects/);
  assert.doesNotMatch(body, /Studio,/);
}

for (const path of ['/studio', '/verse', '/learn', '/graph']) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 308, `${path} 308 not 404`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/', path);
}

for (const path of ['/dasha', '/desk']) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 308, `${path} 308`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/how-to-buy', `${path} dest how-to-buy not /`);
}
for (const path of ['/grok', '/grok/', '/siwg', '/siwg/']) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 308, `${path} 308 not 404`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/login#grok', `${path} dest login#grok`);
}
for (const path of ['/compute/night', '/compute/use', '/compute/provide', '/compute/build', '/compute/sponsor']) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 308, `${path} 308 not 404`);
  assert.equal(res.headers.get('location'), 'https://www.getdasha.com/compute', `${path} dest /compute no hash`);
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}

{
  const start = await edgeWorker.fetch(new Request('https://www.getdasha.com/oauth/x/start'), {});
  assert.equal(start.status, 308, 'www /oauth/x/start 308 not 404');
  assert.equal(start.headers.get('location'), 'https://lobby.getdasha.com/oauth/x/start');
}

{
  const me = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess/me', { headers: { Origin: 'https://www.getdasha.com' } }), env);
  assert.equal(me.status, 200, 'www /chess/me JSON 200 not HTML 404');
  assert.match(me.headers.get('content-type') || '', /json/);
  const data = await me.json();
  assert.equal(data.ok, true);
  assert.doesNotMatch(JSON.stringify(data), /Not found|<!doctype/i);
}

{
  const lobbyMe = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/chess/me'), env);
  assert.equal(lobbyMe.status, 200);
  assert.match(lobbyMe.headers.get('content-type') || '', /json/);
}

for (const [path, edge] of [['/compute', 'compute'], ['/crew', 'crew']]) {
  const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
  assert.equal(res.status, 200, path);
  assert.equal(res.headers.get('x-dasha-edge'), edge, path);
}

{
  const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
  assert.equal(studio.status, 308);
  assert.doesNotMatch(await studio.text(), /Dasha Studio/);
}

// --- sitemap ---
const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.equal(sitemapXml.trim(), GEN_SITEMAP.trim(), 'worker and static-gen sitemaps agree');
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/privacy<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/which<\/loc>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/which<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/bag<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/llms\.txt<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/llms-full\.txt<\/loc><lastmod>2026-09-01<\/lastmod>/);
for (const path of ['/crew', '/digest', '/compute', '/which', '/contribute', '/bounties']) {
  assert.ok(sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap has ${path}`);
}
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/crew<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/digest<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.match(sitemapXml, /https:\/\/www\.getdasha\.com\/compute<\/loc><lastmod>2026-09-01<\/lastmod>/);
assert.doesNotMatch(sitemapXml, /lobby\?/);
for (const path of ['/dasha', '/desk', '/studio', '/graph', '/verse', '/learn', '/login']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits ${path}`);
}

// --- SIWG stays ---
assert.match(loginSrc, /data-grok-login/);
assert.match(loginSrc, /Sign in with Grok Bot/);
const methods = loginSrc.split('data-login-methods')[1] || '';
assert.ok(methods.indexOf('data-grok-login') < methods.indexOf('data-x-login'), 'SIWG first button');
assert.match(workerSrc, /id=["']grok-door["']/);
assert.match(workerSrc, /\/auth\/grok\/start/);
assert.match(workerSrc, /\.well-known\/grok-bot\.json/);
{
  const well = await edgeWorker.fetch(new Request('https://www.getdasha.com/.well-known/grok-bot.json'), {});
  assert.equal(well.status, 200);
  const body = await well.json();
  assert.equal(body.compatible, true);
  assert.match(body.sign_in.start, /\/auth\/grok\/start/);
  const apex = await edgeWorker.fetch(new Request('https://getdasha.com/.well-known/grok-bot.json'), {});
  assert.equal(apex.status, 200, 'apex well-known handler (route is path-only; Webflow keeps /)');
  assert.equal(apex.headers.get('x-dasha-edge'), 'grok-bot');
  assert.deepEqual(await apex.json(), body);
}
{
  const login = await edgeWorker.fetch(new Request('https://www.getdasha.com/login'), {});
  assert.equal(login.status, 200);
  const body = await login.text();
  assert.match(body, /data-grok-login/);
  assert.ok(body.indexOf('data-grok-login') < body.indexOf('data-x-login'), 'served login SIWG first');
}

// --- digest seed is tonight's file, no invented items ---
{
  const digest = await edgeWorker.fetch(new Request('https://www.getdasha.com/digest'), {});
  assert.equal(digest.status, 200, '/digest 200');
  assert.equal(digest.headers.get('x-dasha-edge'), 'digest');
}
assert.equal(DEFAULT.at, latest.at);
assert.equal(DEFAULT.items.length, latest.items.length);
assert.deepEqual(DEFAULT.items, latest.items);
assert.match(DEFAULT.items[0].title, /\$dasha \$\S+ · [+-]?\d+\.\d+% 24h/);
assert.doesNotMatch(JSON.stringify(DEFAULT), /plugin\.jup\.ag/);

// --- /bag on-record + jar tape (must ride the same ship) ---
assert.match(workerSrc, /isBagRecordPath/);
assert.match(workerSrc, /isFaucetTapePath/);
assert.match(workerSrc, /tapeApi/);
{
  const bag = await edgeWorker.fetch(new Request('https://www.getdasha.com/bag'), {});
  assert.equal(bag.status, 200, '/bag 200');
  const bagHtml = await bag.text();
  assert.match(bagHtml, /The bag/);
  assert.match(bagHtml, /id=["']record["']/);
  assert.match(bagHtml, /Mint-dead/);
  const paint = bagHtml.split('id="record"')[0] || bagHtml;
  assert.doesNotMatch(paint, /VVAIFU/, '/bag first paint no VVAIFU');
}
{
  const rec = await edgeWorker.fetch(new Request('https://www.getdasha.com/bag/api/record?mint=' + MINT), {});
  assert.equal(rec.status, 200, '/bag/api/record hers');
  assert.equal(rec.headers.get('x-dasha-edge'), 'bag-record');
  assert.equal(rec.headers.get('access-control-allow-origin'), '*');
  const data = await rec.json();
  assert.equal(data.verdict, 'hers');
  assert.equal(data.mint, MINT);
  assert.match(data.buy, /jup\.ag\/tokens\//);
  assert.doesNotMatch(data.buy || '', /plugin\.jup\.ag/);
}
{
  const tape = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/tape'), {});
  assert.equal(tape.status, 200, '/faucet/tape 200');
  assert.equal(tape.headers.get('x-dasha-edge'), 'faucet-tape');
  assert.equal(tape.headers.get('access-control-allow-origin'), '*');
  const data = await tape.json();
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.fills), 'empty tape is honest');
}
{
  const fills = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/fills'), {});
  assert.equal(fills.status, 200, '/faucet/fills alias');
}
assert.match(workerSrc, /isFaucetPublicReadPath/);
{
  const status = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet/status'), {});
  assert.equal(status.status, 200, 'www /faucet/status JSON 200 not HTML 404');
  assert.match(status.headers.get('content-type') || '', /json/);
  assert.equal(status.headers.get('access-control-allow-origin'), '*');
  const data = await status.json();
  assert.equal(typeof data.funded, 'boolean');
  assert.equal(data.amountUi, 100);
  assert.doesNotMatch(JSON.stringify(data), /<!doctype/i);
}
{
  const page = await edgeWorker.fetch(new Request('https://www.getdasha.com/faucet'), {});
  assert.equal(page.status, 200, '/faucet HTML stays Typeform');
  assert.match(page.headers.get('content-type') || '', /html/);
  assert.equal(page.headers.get('x-dasha-edge'), 'faucet');
}

// --- product locks ---
assert.match(workerSrc, new RegExp(MINT));
assert.match(workerSrc, /jup\.ag\/swap/);
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
assert.match(workerSrc, /export function stripHomeLeftoverDashaRootClass/);
assert.match(workerSrc, /out = stripHomeLeftoverDashaRootClass\(out\);/);
assert.equal(DIGEST_TG, TG);
assert.doesNotMatch(workerSrc, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);

console.log('dasha-canary-contract: PASS (rollback fixture fails, ship-src home/routes/sitemap/SIWG/digest pass)');
