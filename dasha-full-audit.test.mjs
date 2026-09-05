#!/usr/bin/env node
/**
 * Full audit locks for getdasha.com.
 * (a) unit/transform + worker fetch — no network
 * (b) optional live canary: DASHA_AUDIT_LIVE=1 writes /workspace/dasha-audit/FULL-AUDIT-2026-08-26.md
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import edgeWorker, {
  stripRetiredProductDoors,
  polishHowtoHtml,
  stripDeadNav,
  hideHomeExtraChrome,
  unlockHomeMobileScroll,
  potterHome308Dest,
  potterHome308Response,
  forumToLobbyRedirect,
  rewriteLobbyForumChrome,
  asStandaloneLobbyPage,
  isQuietTapePath,
  SITE_MANIFEST,
  siteManifestJson,
} from './dasha-lobby-worker.mjs';
import { HOWTO_HTML, LOBBY_CLIENT_JS, LOBBY_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const TG = 'https://t.me/+xB7S8mIQaKFiZjRh';
const JUP = `https://jup.ag/swap?sell=So11111111111111111111111111111111111111112&buy=${MINT}`;

const leftoverChrome = `<!doctype html><html><head><title>old</title></head><body>
<header class="bar"><a class="word" href="/">$<b>dasha</b></a><a class="buy" href="${JUP.replace(/&/g, '&amp;')}">Buy</a></header>
<nav class="dasha-nav"><a href="/">$dasha</a><a href="/lobby">lobby</a><a href="/dasha" class="dasha-nav-link">desk</a><a href="/chess" class="dasha-nav-link">chess</a><a href="/studio">studio</a><a href="/verse">verse</a><a href="/learn">learn</a><a href="/graph">graph</a><a href="/compute">compute</a><a href="/studio#look=poster">studio hash</a></nav>
<footer><p><a href="/dasha">Desk</a> · <a href="/chess">Chess</a> · <a href="/desk">Desk2</a> · <a href="https://lobby.getdasha.com/chess">Chess lobby</a> · <a href="/verse">Verse</a></p></footer>
<section id="chess-door"><a href="/chess">Open chess →</a></section>
<section id="chat-door"></section>
<section id="grwm" aria-label="Get ready with me"></section>
</body></html>`;

const RETIRED_HOME_DOORS = ['/chess', '/desk', '/studio', '/dasha', '/compute', '/verse', '/learn', '/graph'];

function bodyWithoutChrome(html) {
  return String(html || '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
}

function leftoverDoorHrefs(html) {
  const body = bodyWithoutChrome(html);
  const hrefs = [...body.matchAll(/<a\b[^>]*\bhref=(["'])(.*?)\1/gi)].map((m) => m[2]);
  return hrefs.filter((h) => {
    const raw = String(h || '');
    const path = raw.replace(/^https?:\/\/(?:www\.|lobby\.)?getdasha\.com/i, '').split(/[?#]/)[0].replace(/\/$/, '') || '/';
    if (path === '/chess' && /[?&]embed=1(?:&|#|$)/i.test(raw.includes('?') ? raw.slice(raw.indexOf('?')) : '')) return false;
    return RETIRED_HOME_DOORS.includes(path);
  });
}

describe('retired product doors', () => {
  it('strips leftover chess/desk/studio hrefs and keeps embed', () => {
    const html = stripRetiredProductDoors(leftoverChrome + '<iframe src="/chess?embed=1"></iframe><a href="/chess?embed=1">Play</a>');
    assert.deepEqual(leftoverDoorHrefs(html), []);
    assert.match(html, /src="\/chess\?embed=1"/);
    assert.match(html, /href="\/chess\?embed=1"/);
    assert.match(html, />Buy</);
  });

  it('home transform drops leftover doors and unlocks mobile scroll', () => {
    const out = stripDeadNav(leftoverChrome);
    assert.deepEqual(leftoverDoorHrefs(out), []);
    for (const path of RETIRED_HOME_DOORS) {
      assert.doesNotMatch(bodyWithoutChrome(out), new RegExp(`<a\\b[^>]*href="${path}"`));
    }
    assert.match(out, /id="dasha-mobile-scroll"/);
    assert.match(out, /id="dasha-home-chrome-hide"/);
    const hide = (out.match(/<style\b[^>]*id=["']dasha-home-chrome-hide["'][^>]*>[\s\S]*?<\/style>/i) || [''])[0];
    assert.doesNotMatch(hide, /a\[href=["']\/chess/);
    assert.doesNotMatch(hide, /a\[href=["']\/verse/);
    assert.doesNotMatch(hide, /a\[href=["']\/studio/);
    assert.doesNotMatch(hide, /footer/);
    assert.doesNotMatch(hide, /\.dasha-nav/);
    assert.match(hide, /\.price/);
    assert.match(out, /Buy/);
    assert.match(out, /id="chat-door"/);
    assert.match(out, /id="grwm"/);
    assert.match(out, /id="dasha-home-faucet"/);
    assert.doesNotMatch(out, /id=["']chess-door["']/);
    assert.doesNotMatch(out, /<nav class="dasha-nav">/, 'drops leftover dasha-nav from the document');
  });

  it('served body has no retired nav/footer doors after transform', () => {
    const out = stripDeadNav(leftoverChrome + '<a href="/studio#look=ticket&amp;src=home">poster</a>');
    const body = bodyWithoutChrome(out);
    assert.doesNotMatch(body, /<a\b[^>]*href="\/chess"/);
    assert.doesNotMatch(body, /<a\b[^>]*href="\/desk"/);
    assert.doesNotMatch(body, /<a\b[^>]*href="\/studio"/);
    assert.doesNotMatch(body, /<a\b[^>]*href="\/dasha"/);
    assert.doesNotMatch(body, /<a\b[^>]*href="\/compute"/);
    assert.doesNotMatch(body, /<a\b[^>]*href="\/verse"/);
    assert.doesNotMatch(body, /<a\b[^>]*href="\/learn"/);
    assert.doesNotMatch(body, /<a\b[^>]*href="\/graph"/);
    assert.match(out, /href="\/lobby"/);
    assert.match(out, /Buy/);
    assert.match(out, /id="grwm"/);
  });

  it('howto polish drops Chess and Desk footer doors', () => {
    const polished = polishHowtoHtml(HOWTO_HTML);
    assert.doesNotMatch(polished, /href="\/chess"/);
    assert.doesNotMatch(polished, /href="\/dasha"/);
    assert.doesNotMatch(polished, />Desk</);
    assert.doesNotMatch(polished, />Chess</);
    assert.match(polished, /How to buy \$dasha/);
    assert.match(polished, new RegExp(MINT));
    assert.match(polished, /jup\.ag\/swap/);
    assert.doesNotMatch(polished, /plugin\.jup\.ag/);
  });
});

describe('route contract (worker, offline)', () => {
  const destHome = ['/studio', '/verse', '/learn', '/graph', '/index.html'];
  const destHowto = ['/dasha', '/desk'];

  it('dest-by-path 308s', () => {
    for (const path of destHome) {
      assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/');
      const res = potterHome308Response(new Request(`https://www.getdasha.com${path}`), new URL(`https://www.getdasha.com${path}`));
      assert.equal(res.status, 308);
      assert.equal(res.headers.get('location'), 'https://www.getdasha.com/');
    }
    for (const path of destHowto) {
      assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/how-to-buy');
    }
    for (const path of ['/grok', '/grok/', '/siwg', '/siwg/']) {
      assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/login#grok');
    }
    for (const path of ['/compute/night', '/compute/use']) {
      assert.equal(potterHome308Dest(path), 'https://www.getdasha.com/compute');
    }
    assert.equal(potterHome308Dest('/compute'), null);
    assert.equal(potterHome308Dest('/compute/api'), null);
    assert.equal(potterHome308Dest('/privacy'), null);
    assert.equal(potterHome308Dest('/login'), null);
  });

  it('worker fetch statuses', async () => {
    const cases = [
      ['/privacy', 200, 'privacy'],
      ['/compute', 200, 'compute'],
      ['/crew', 200, 'crew'],
      ['/bag', 200, 'bag'],
      ['/bounties', 200, 'bounties'],
      ['/contribute', 200, 'contribute'],
      ['/which', 200, 'which'],
      ['/login', 200, 'login'],
    ];
    for (const [path, status, edge] of cases) {
      const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
      assert.equal(res.status, status, path);
      if (edge) assert.equal(res.headers.get('x-dasha-edge'), edge, path);
    }
    const compute = await edgeWorker.fetch(new Request('https://www.getdasha.com/compute'), {});
    const computeBody = await compute.text();
    assert.match(computeBody, /Dasha Compute/);
    assert.match(computeBody, />Use</);
    assert.match(computeBody, /Night Shift/);
    assert.doesNotMatch(computeBody, /Compute is gone/);
    const crew = await edgeWorker.fetch(new Request('https://www.getdasha.com/crew'), {});
    const crewBody = await crew.text();
    assert.equal(crew.status, 200);
    assert.equal(crew.headers.get('x-dasha-edge'), 'crew');
    assert.match(crewBody, /<h1>Dasha Crew<\/h1>/);
    const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
    assert.equal(studio.status, 308);
    assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');
  });

  it('www oauth starts 308 to lobby', async () => {
    for (const kind of ['x', 'github']) {
      const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com/oauth/${kind}/start`), {});
      assert.equal(res.status, 308, kind);
      assert.equal(res.headers.get('location'), `https://lobby.getdasha.com/oauth/${kind}/start`);
    }
  });

  it('/forum and /chat 308 into the room', async () => {
    for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
      for (const path of ['/forum', '/chat']) {
        const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
        assert.equal(res.status, 308, `${origin}${path}`);
        assert.equal(res.headers.get('location'), 'https://www.getdasha.com/lobby');
      }
      const withT = await edgeWorker.fetch(new Request(`${origin}/forum?t=abc`), {});
      assert.equal(withT.status, 308);
      assert.match(withT.headers.get('location') || '', /[?&]t=abc/);
    }
    const chatT = forumToLobbyRedirect(new URL('https://www.getdasha.com/chat?t=abc'));
    assert.match(chatT.headers.get('location') || '', /[?&]t=abc/);
  });

  it('/how-to-buy served without leftover doors', async () => {
    const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/how-to-buy'), {});
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.doesNotMatch(body, /href="\/chess"/);
    assert.doesNotMatch(body, /href="\/dasha"/);
    assert.match(body, new RegExp(MINT));
    assert.match(body, /jup\.ag/);
    assert.doesNotMatch(body, /plugin\.jup\.ag/);
  });
});

describe('one-room + honesty + product mix', () => {
  it('lobby is one room', () => {
    const html = asStandaloneLobbyPage(LOBBY_PAGE_HTML);
    assert.match(html, /<h1>Lobby<\/h1>/);
    assert.doesNotMatch(html, /<h1>Forum<\/h1>/);
    assert.doesNotMatch(html, /Full table/);
    assert.doesNotMatch(html, /href="\/chess"/);
    assert.match(html, /<h2>Play<\/h2>/);
    assert.match(html, /id="threads-title">Threads<\/h2>/);
    assert.doesNotMatch(LOBBY_CLIENT_JS, /el\('h2','df-title','Forum'\)/);
  });

  it('rewrite leftover Forum chrome', () => {
    const leftover = '<h1>Forum</h1><a class="forum-play-full" href="/chess">Full table</a><footer><a href="/forum">Forum</a> · <a href="/chess">Chess</a></footer>';
    const out = rewriteLobbyForumChrome(leftover);
    assert.match(out, /<h1>Lobby<\/h1>/);
    assert.doesNotMatch(out, /Full table/);
    assert.doesNotMatch(out, /<a\b[^>]*href="\/chess"/);
  });

  it('no Demigod hire, no plugin.jup, official TG only, no honesty lectures in worker', () => {
    assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/);
    assert.doesNotMatch(workerSrc, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/);
    assert.doesNotMatch(workerSrc, /Hire an agent|pre-vetted|90-day|we hold (your )?funds/i);
    assert.match(workerSrc, /We don.t hold it/);
    assert.doesNotMatch(workerSrc, /Studio, quiz/);
    assert.doesNotMatch(workerSrc, /chess, Desk, and how to buy/);
  });

  it('bounties page is USDC + we do not hold it + GitHub contribute', async () => {
    const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/bounties'), {});
    const body = await res.text();
    assert.match(body, /USDC on Solana/);
    assert.match(body, /We don.t hold it/);
    assert.match(body, /github\.com\/Uuriko\/dasha-desk\/contribute/);
    assert.match(body, /oauth\/x|id=["']bb-x/, 'X optional via site-hunt detector');
    assert.doesNotMatch(body, /pre-vetted|90-day|airdrop lecture/i);
    assert.doesNotMatch(body, /Demigod|hire an agent/i);
  });

  it('privacy is 200 and does not advertise Studio', async () => {
    const res = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /<h1>Privacy<\/h1>/);
    assert.doesNotMatch(body, /Studio,/);
  });

  it('primary buttons are ink on acid', () => {
    assert.match(workerSrc, /background:var\(--acid,#dfff00\);color:var\(--ink,#070608\)/);
    assert.match(workerSrc, /\.cta\{[^}]*background:#dfff00;color:#070608/);
  });

  it('mobile unlock style exists', () => {
    const unlocked = unlockHomeMobileScroll('<html><head></head><body></body></html>');
    assert.match(unlocked, /id="dasha-mobile-scroll"/);
    assert.match(unlocked, /overflow:visible!important/);
    const hidden = hideHomeExtraChrome('<html><head></head><body></body></html>');
    assert.doesNotMatch(hidden, /a\[href=["']\/chess/);
    assert.doesNotMatch(hidden, /a\[href=/);
    assert.match(hidden, /id="dasha-home-chrome-hide"/);
    assert.doesNotMatch(hidden, /footer/);
    assert.match(hidden, /\.price/);
  });
});

describe('sitemap vs retired rooms', () => {
  it('sitemap has privacy/forum/bag and omits 308/410 rooms', () => {
    const sitemap = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
    const robots = workerSrc.match(/const ROBOTS_TXT = `([\s\S]*?)`;/)[1];
    for (const path of ['/forum', '/privacy', '/bag', '/which', '/crew', '/digest', '/compute']) {
      assert.ok(sitemap.includes(`https://www.getdasha.com${path}</loc>`), path);
    }
    for (const path of ['/studio', '/dasha', '/desk', '/login', '/verse', '/learn', '/graph']) {
      assert.ok(!sitemap.includes(`https://www.getdasha.com${path}</loc>`), `omit ${path}`);
    }
    assert.doesNotMatch(sitemap, /lobby\?/);
    assert.ok(!/^Allow:\s*\/compute\s*$/m.test(robots));
    assert.ok(!/^Allow:\s*\/studio\s*$/m.test(robots));
  });
});

describe('quiet tape + site manifest', () => {
  it('recognizes quiet tape paths without breaking /forum 308', () => {
    assert.equal(isQuietTapePath('/forum/tape'), true);
    assert.equal(isQuietTapePath('/lobby/tape'), true);
    assert.equal(isQuietTapePath('/forum/tape/'), true);
    assert.equal(isQuietTapePath('/forum'), false);
    assert.equal(isQuietTapePath('/forum/threads'), false);
    assert.equal(isQuietTapePath('/digest.json'), false);
  });

  it('site manifest has no Desk/Studio/chess product chrome', () => {
    const raw = siteManifestJson();
    const body = JSON.parse(raw);
    assert.equal(body.name, '$dasha');
    assert.equal(body.start_url, '/');
    assert.equal(body.description, 'Buy $dasha.');
    assert.doesNotMatch(raw, /make the timeline stranger/);
    assert.equal(SITE_MANIFEST.display, 'standalone');
    assert.doesNotMatch(raw, /"\/(desk|dasha|studio|chess)(?:\/|\?|"|#)/i);
    assert.doesNotMatch(raw, /\bDesk\b|\bStudio\b|checkout|paypal/i);
    assert.ok(!('redirects' in body));
    assert.ok(!('dynListPages' in body));
  });

  it('worker serves quiet /forum/tape and /lobby/tape JSON', async () => {
    for (const origin of ['https://lobby.getdasha.com', 'https://www.getdasha.com']) {
      for (const path of ['/forum/tape', '/lobby/tape']) {
        const res = await edgeWorker.fetch(new Request(`${origin}${path}`), {});
        assert.equal(res.status, 200, `${origin}${path}`);
        assert.equal(res.headers.get('x-dasha-edge'), 'forum-tape', path);
        assert.match(res.headers.get('content-type') || '', /application\/json/);
        const body = await res.json();
        assert.ok(Array.isArray(body.items));
        assert.ok(body.items.length >= 1);
        assert.ok(body.items.some((row) => row.kind === 'tape'));
      }
      const opt = await edgeWorker.fetch(new Request(`${origin}/forum/tape`, { method: 'OPTIONS' }), {});
      assert.equal(opt.status, 204);
      assert.equal(opt.headers.get('access-control-allow-origin'), '*');
    }
    // Exact /forum stays one-room 308
    const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
    assert.equal(forum.status, 308);
    assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');
  });

  it('worker rewrites /manifest.json without retired Desk/Studio/chess', async () => {
    for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
      const res = await edgeWorker.fetch(new Request(`${origin}/manifest.json`), {});
      assert.equal(res.status, 200, origin);
      assert.equal(res.headers.get('x-dasha-edge'), 'site-manifest');
      assert.match(res.headers.get('content-type') || '', /manifest\+json|application\/json/);
      const body = await res.json();
      assert.equal(body.name, '$dasha');
      assert.equal(body.start_url, '/');
      assert.equal(body.description, 'Buy $dasha.');
      const raw = JSON.stringify(body);
      assert.doesNotMatch(raw, /make the timeline stranger/);
      assert.doesNotMatch(raw, /"\/(desk|dasha|studio|chess)(?:\/|\?|"|#)/i);
      assert.doesNotMatch(raw, /\bDesk\b|\bStudio\b|checkout|paypal/i);
      assert.ok(!('redirects' in body));
    }
  });
});

describe('agents.md', () => {
  it('is the one rulebook and CLAUDE.md only points at it', () => {
    const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8').trim();
    assert.match(agents, /Worker-first/);
    assert.match(agents, /exclusive write/i);
    assert.match(agents, /\/lobby/);
    assert.match(agents, /\/forum/);
    assert.match(agents, /308/);
    assert.match(agents, /\/privacy/);
    assert.match(agents, /\/compute` 200/);
    assert.match(agents, /\/crew` 200/);
    assert.match(agents, /53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
    assert.match(agents, /Never `plugin\.jup\.ag`/);
    assert.match(agents, /dasha-lobby-wrangler\.deploy\.jsonc/);
    assert.match(agents, /Designer-publish/);
    assert.equal(claude, '@AGENTS.md');
  });
});
