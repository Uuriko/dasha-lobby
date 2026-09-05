#!/usr/bin/env node
/** P0 stab: chess API rewrite + www proxy, privacy 200, compute 200, dest-by-path 308s. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, {
  CHESS_API_HOST,
  CHESS_DOWN_MSG,
  CHESS_TABLE_MSG,
  chessApiErrorMessage,
  chessEmbedChrome,
  isChessApiPath,
  polishServedSlim,
  potterHome308Dest,
  potterHome308Response,
  rewriteChessApi,
} from './dasha-lobby-worker.mjs';
import { CHESS_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const chessPage = readFileSync(join(root, 'dasha-chess-page.html'), 'utf8');
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');

assert.equal(CHESS_API_HOST, 'https://lobby.getdasha.com');
assert.match(chessPage, /var API='https:\/\/lobby\.getdasha\.com'/);
assert.match(CHESS_PAGE_HTML, /var API='https:\/\/lobby\.getdasha\.com'/);
assert.doesNotMatch(chessPage, /error:'bad response'/);
assert.doesNotMatch(CHESS_PAGE_HTML, /error:'bad response'/);
assert.match(chessPage, /Chess is down\. Play locally\./);
assert.match(chessPage, /Table unavailable\. Try again\./);
assert.match(chessPage, /Network unavailable/);
assert.match(CHESS_PAGE_HTML, /Chess is down\. Play locally\./);

assert.equal(chessApiErrorMessage('/chess/me'), CHESS_DOWN_MSG);
assert.equal(chessApiErrorMessage('/chess/challenges'), CHESS_TABLE_MSG);
assert.equal(chessApiErrorMessage('/chess/challenge/abc'), CHESS_TABLE_MSG);
assert.equal(chessApiErrorMessage('/chess/queue'), CHESS_TABLE_MSG);
assert.equal(chessApiErrorMessage('/chess/me', { network: true }), 'Network unavailable');

assert.equal(isChessApiPath('/chess/me'), true);
assert.equal(isChessApiPath('/chess'), false);
assert.equal(isChessApiPath('/chess/'), false);

const empty = "var API='',LOBBY='https://lobby.getdasha.com'";
assert.match(rewriteChessApi(empty), /var API='https:\/\/lobby\.getdasha\.com'/);
const already = "var API='https://lobby.getdasha.com'";
assert.equal(rewriteChessApi(already), already);

const standalone = '<header class="dasha-slim">keep</header><script>var API=\'\';</script>';
const rewritten = rewriteChessApi(standalone);
assert.match(rewritten, /<header class="dasha-slim">keep<\/header>/);
assert.match(rewritten, /var API='https:\/\/lobby\.getdasha\.com'/);
const embed = chessEmbedChrome(standalone);
assert.doesNotMatch(embed, /<header/);
assert.match(embed, /var API='https:\/\/lobby\.getdasha\.com'/);

const slim = polishServedSlim('<footer><a href="/privacy">Privacy</a> · <a href="https://www.getdasha.com/privacy">Privacy</a></footer>');
assert.match(slim, /href="\/privacy"/);
assert.match(slim, /href="https:\/\/www\.getdasha\.com\/privacy"/);

assert.equal(potterHome308Dest('/privacy'), null);
assert.equal(potterHome308Dest('/studio'), 'https://www.getdasha.com/');
assert.equal(potterHome308Dest('/verse'), 'https://www.getdasha.com/');
assert.equal(potterHome308Dest('/learn'), 'https://www.getdasha.com/');
assert.equal(potterHome308Dest('/graph'), 'https://www.getdasha.com/');
assert.equal(potterHome308Dest('/index.html'), 'https://www.getdasha.com/');
assert.equal(potterHome308Dest('/dasha'), 'https://www.getdasha.com/how-to-buy');
assert.equal(potterHome308Dest('/desk'), 'https://www.getdasha.com/how-to-buy');
assert.equal(potterHome308Dest('/grok'), 'https://www.getdasha.com/login#grok');
assert.equal(potterHome308Dest('/grok/'), 'https://www.getdasha.com/login#grok');
assert.equal(potterHome308Dest('/siwg'), 'https://www.getdasha.com/login#grok');
assert.equal(potterHome308Dest('/siwg/'), 'https://www.getdasha.com/login#grok');
assert.equal(potterHome308Dest('/compute/night'), 'https://www.getdasha.com/compute');
assert.equal(potterHome308Dest('/compute'), null);
assert.equal(potterHome308Dest('/compute/api'), null);
assert.equal(potterHome308Response(new Request('https://www.getdasha.com/privacy'), new URL('https://www.getdasha.com/privacy')), null);
{
  const grok = potterHome308Response(new Request('https://www.getdasha.com/grok'), new URL('https://www.getdasha.com/grok'));
  assert.equal(grok.status, 308);
  assert.equal(grok.headers.get('location'), 'https://www.getdasha.com/login#grok');
}
{
  const siwg = potterHome308Response(new Request('https://www.getdasha.com/siwg'), new URL('https://www.getdasha.com/siwg'));
  assert.equal(siwg.status, 308);
  assert.equal(siwg.headers.get('location'), 'https://www.getdasha.com/login#grok');
}

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

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const page = await edgeWorker.fetch(new Request(`${origin}/chess`), env);
  assert.equal(page.status, 200, `${origin}/chess`);
  const html = await page.text();
  assert.match(html, /var API='https:\/\/lobby\.getdasha\.com'/);
  assert.doesNotMatch(html, /var API=''/);
  assert.match(html, /Chess is down\. Play locally\./);
  assert.match(html, /Table unavailable\. Try again\./);
  assert.doesNotMatch(html, /bad response/);

  const embedPage = await edgeWorker.fetch(new Request(`${origin}/chess?embed=1`), env);
  assert.equal(embedPage.status, 200, `${origin}/chess?embed=1`);
  const embedHtml = await embedPage.text();
  assert.match(embedHtml, /var API='https:\/\/lobby\.getdasha\.com'/);
}

{
  const me = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess/me', { headers: { Origin: 'https://www.getdasha.com' } }), env);
  assert.equal(me.status, 200, 'www /chess/me proxied JSON');
  assert.match(me.headers.get('content-type') || '', /json/);
  const data = await me.json();
  assert.equal(data.ok, true);
  assert.equal(data.linked, false);
  assert.doesNotMatch(JSON.stringify(data), /Not found|<!doctype/i);
}

{
  const me = await edgeWorker.fetch(new Request('https://lobby.getdasha.com/chess/me'), env);
  assert.equal(me.status, 200, 'lobby /chess/me JSON');
  const data = await me.json();
  assert.equal(data.ok, true);
  assert.equal(data.linked, false);
}

{
  const opt = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess/me', {
    method: 'OPTIONS',
    headers: { Origin: 'https://www.getdasha.com' },
  }), env);
  assert.equal(opt.status, 204);
  assert.equal(opt.headers.get('access-control-allow-origin'), 'https://www.getdasha.com');
}

{
  const down = await edgeWorker.fetch(new Request('https://www.getdasha.com/chess/me'), {});
  assert.equal(down.status, 503);
  const data = await down.json();
  assert.equal(data.error, CHESS_DOWN_MSG);
}

{
  const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
  assert.equal(privacy.status, 200);
  assert.equal(privacy.headers.get('x-dasha-edge'), 'privacy');
  const body = await privacy.text();
  assert.match(body, /<h1>Privacy<\/h1>/);
  assert.match(body, /<title>Dasha privacy<\/title>/);
  assert.match(body, /rel="canonical" href="https:\/\/www\.getdasha\.com\/privacy"/);
  assert.match(body, /Updated 4 September 2026/);
  assert.doesNotMatch(body, /Studio,/);
  assert.match(body, /Faucet claims need a linked X account/);
  assert.match(body, /Dasha never asks for wallet keys/);
  assert.match(body, /Logging in with X/);
  assert.match(body, /X OAuth/);
  assert.match(body, /wallet signature/);
  assert.match(body, /HttpOnly Secure cookies/);
  assert.match(body, /Wallet login stores the signed-in public address/);
  assert.match(body, /Dasha never collects/);
  assert.doesNotMatch(body, /disclaimer|not financial advice|NFA|dyor/i);
  const head = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy', { method: 'HEAD' }), {});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
}

{
  const compute = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
  assert.equal(compute.status, 200);
  assert.equal(compute.headers.get('x-dasha-edge'), 'compute');
  const body = await compute.text();
  assert.match(body, /Dasha Compute/);
  assert.match(body, />Start\.</);
  assert.match(body, />Ask</);
  assert.match(body, />Provide</);
  assert.match(body, /provide-prefer-mlx/);
  assert.match(body, /href=["']\/privacy["']/);
  assert.doesNotMatch(body, /Compute is gone/);
}

{
  const crew = await edgeWorker.fetch(new Request('https://www.getdasha.com/crew'), {});
  assert.equal(crew.status, 200);
  assert.equal(crew.headers.get('x-dasha-edge'), 'crew');
  const crewBody = await crew.text();
  assert.match(crewBody, /<h1>Dasha Crew<\/h1>/);
  assert.match(crewBody, /Five jobs\. You keep the keys\./);
}

{
  const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
  assert.equal(forum.status, 308);
  assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
}
{
  const chat = await edgeWorker.fetch(new Request('https://www.getdasha.com/chat'), {});
  assert.equal(chat.status, 308, '/chat is the same room');
  assert.equal(chat.headers.get('location'), 'https://www.getdasha.com/lobby');
}

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
assert.match(sitemapXml, /getdasha\.com\/privacy/);
assert.match(sitemapXml, /getdasha\.com\/crew</);
assert.match(sitemapXml, /getdasha\.com\/digest</);
assert.match(sitemapXml, /getdasha\.com\/compute</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/dasha</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/desk</);
assert.doesNotMatch(sitemapXml, /getdasha\.com\/studio</);
assert.doesNotMatch(sitemapXml, /lobby\?/);

{
  const start = await edgeWorker.fetch(new Request('https://www.getdasha.com/oauth/x/start'), {});
  assert.equal(start.status, 308, 'www /oauth/x/start');
  assert.equal(start.headers.get('location'), 'https://lobby.getdasha.com/oauth/x/start');
}


{
  const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
  assert.equal(home.status, 200, 'home 200');
  const html = await home.text();
  assert.doesNotMatch(html, /class=["'][^"']*\bdasha-root\b/, 'home leftover dasha-root class dropped');
  assert.doesNotMatch(html, /querySelector\(['"]footer['"]\)/, 'home leftover remount footer querySelector dropped');
  assert.doesNotMatch(html, /\bid=["']content["']/, 'home leftover id=content dropped');
  assert.match(html, /id=["']dasha-home["']/, 'home dasha-home id stays');
  assert.match(html, /johns-awesome/, 'home johns-awesome stays');
  assert.match(html, /id=["']chat-door["']/, 'home chat-door stays');
}

console.log('dasha-stab: PASS (chess API rewrite + www proxy, privacy 200, compute 200, crew 200, dest-by-path 308s incl /siwg, oauth start, sitemap no /dasha)');
