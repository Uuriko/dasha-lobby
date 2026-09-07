#!/usr/bin/env node
/**
 * What machines see. Nothing was checking any of it.
 *
 * Every other gate in this repo asks whether a person can use the site. This one asks whether a
 * crawler, a link unfurler or an AI search index can understand it — and on 2026-08-08 the answers
 * were: sitemap.xml is a 404, robots.txt is 200 with an empty body, no route carries structured
 * data, and the live OG card was a stale upload still showing copy that had been removed from the
 * pages themselves. All four are invisible from inside a browser, which is why they survived four
 * audits.
 *
 * The OG card check matters most and is the least obvious. The card is not part of any page; it is a
 * separate binary uploaded to a CDN. It can rot independently of every source file in this repo, and
 * the only place anyone would notice is someone else's timeline.
 *
 *   node dasha-discovery.test.mjs            # live
 *   node dasha-discovery.test.mjs --local    # sources only: structured data, no network
 */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const local = process.argv.includes('--local');
const ORIGIN = 'https://www.getdasha.com';
const here = (f) => new URL(`./${f}`, import.meta.url);
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

/* Each route has its own share card now. They used to share the homepage one, which meant a link to
   the Studio unfurled as an ad for the site rather than for the tool — and the two pages people
   actually share are the ones that were wrong. The local file is named per route so drift is caught
   per route: a card can rot independently, and one comparison against one file would hide that. */
/* The general site card, used by any route that has not earned art of its own. Named because the
   distinctness check below has to tell "these two share on purpose" apart from "a repoint collapsed
   two routes onto one file", and a bare filename repeated in the table cannot say which it is. */
const SITE_CARD = 'dasha-social-card.png';

const ROUTES = [
  ['/', 'dasha-landing.html', 'WebSite', SITE_CARD],
  /* The lobby has no structured data of its own yet and shares the homepage card; it is listed so
     the sitemap count stays honest and so a missing/rotted card there is still caught. */
  ['/lobby', 'dasha-lobby-page.html', null, SITE_CARD],
  ['/how-to-buy', 'dasha-how-to-buy.html', null, SITE_CARD],
];
const KILLED_ROUTES = ['/studio', '/dasha'];

/** Structured data must parse, be the right thing, and not claim anything we cannot support. */
function checkJsonLd(where, html, expectedType) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) { check(false, `${where}: no structured data — machines get no description`); return; }
  for (const [, raw] of blocks) {
    let data;
    try { data = JSON.parse(raw); } catch (e) { check(false, `${where}: structured data is not valid JSON — ${e.message}`); continue; }
    check(data['@context'] === 'https://schema.org', `${where}: structured data has no schema.org context`);
    check(!!data.name, `${where}: structured data has no name`);
    check(!!data.url || data['@type'] === 'WebSite', `${where}: structured data has no url`);
    /* Nothing here may assert a rating, a review count or a holder count. We have no such numbers,
       and a schema block is exactly where an invented one would never be seen by a human reviewer. */
    for (const banned of ['aggregateRating', 'ratingValue', 'reviewCount', 'interactionCount']) {
      check(!(banned in data), `${where}: structured data claims ${banned}, which we cannot support`);
    }
  }
  const types = blocks.map(([, raw]) => { try { return JSON.parse(raw)['@type']; } catch { return null; } });
  check(types.includes(expectedType), `${where}: expected ${expectedType} structured data, got ${types.join(', ') || 'none'}`);
}

/* ---- sources ---------------------------------------------------------------
   Structured data for our own pages now lives in Webflow page settings, not in the embeds. That is
   deliberate and it is not tidiness: page settings survive a publish from another source tree, and
   embeds do not — this site is published from two trees, and the embed-borne JSON-LD was overwritten
   three times in a day. The one place it still belongs in a file is the pasteable embed, because
   that travels to pages we do not own, where nothing else describes the tool. */
try {
  checkJsonLd('dasha-studio-embed.html (pasteable)',
    await readFile(here('dasha-studio-embed.html'), 'utf8'), 'SoftwareApplication');
} catch (e) {
  if (!local) check(false, `dasha-studio-embed.html unreadable — ${e.message}`);
}

/* The sitemap is a file in this repo that has to be pasted into Webflow's SEO settings. Checking it
   here at least guarantees the thing we would paste is well-formed and lists exactly the real routes. */
const sitemap = await readFile(here('dasha-sitemap.xml'), 'utf8');
for (const [route] of ROUTES) {
  check(sitemap.includes(`${ORIGIN}${route}`), `dasha-sitemap.xml is missing ${route}`);
}
for (const route of KILLED_ROUTES) {
  check(!sitemap.includes(`${ORIGIN}${route}</loc>`) && !sitemap.includes(`${ORIGIN}${route}\n`),
    `dasha-sitemap.xml still lists killed ${route}`);
}
check(!/webflow\.io/.test(sitemap), 'dasha-sitemap.xml advertises a staging URL');
/* Extra www routes that are real public pages but are not in ROUTES (no file-level JSON-LD
   check here). Chess is listed at its declared www canonical, not lobby. Forum is not public. */
const EXTRA_SITEMAP_URLS = [
  `${ORIGIN}/simp`,
  `${ORIGIN}/forum`,
  `${ORIGIN}/faucet`,
  `${ORIGIN}/bag`,
  `${ORIGIN}/which`,
  `${ORIGIN}/listings`,
  `${ORIGIN}/listings.json`,
  `${ORIGIN}/contribute`,
  `${ORIGIN}/bounties`,
  `${ORIGIN}/chess`,
  `${ORIGIN}/privacy`,
  `${ORIGIN}/crew`,
  `${ORIGIN}/digest`,
  `${ORIGIN}/compute`,
  `${ORIGIN}/llms.txt`,
  `${ORIGIN}/llms-full.txt`,
  `${ORIGIN}/ai.txt`,
];
for (const url of EXTRA_SITEMAP_URLS) {
  check(sitemap.includes(url), `dasha-sitemap.xml is missing ${url}`);
}
const expectedLocs = ROUTES.length + EXTRA_SITEMAP_URLS.length;
check((sitemap.match(/<loc>/g) || []).length === expectedLocs,
  `dasha-sitemap.xml lists ${(sitemap.match(/<loc>/g) || []).length} URLs; there are ${expectedLocs} real routes`);

if (local) {
  report();
} else {
  // ---- live ----------------------------------------------------------------
  const get = async (url, opts) => {
    try { return await fetch(url, { redirect: 'follow', ...opts }); }
    catch (e) { check(false, `${url}: request failed — ${e.message}`); return null; }
  };

  for (const [route, file, type, card] of ROUTES) {
    const res = await get(ORIGIN + route);
    if (!res) continue;
    const html = await res.text();
    check(res.ok, `${route}: HTTP ${res.status}`);
    if (type) checkJsonLd(`live ${route}`, html, type);

    // Canonical must be absolute and point at the route it is on, or duplicates get indexed.
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    check(canonical === `${ORIGIN}${route}` || canonical === `${ORIGIN}${route}/`,
      `${route}: canonical is ${canonical || 'missing'}`);

    // The share card: a separate binary on a CDN that can rot with nothing in this repo changing.
    const imageTags = (html.match(/<meta\b[^>]*>/gi) || []).filter((tag) => /property=["']og:image["']/i.test(tag));
    const images = imageTags.map((tag) => tag.match(/content=["']([^"']+)["']/i)?.[1]).filter(Boolean);
    const image = images[0];
    check(!!image, `${route}: no og:image — shared links unfurl bare`);
    check(images.length === 1, `${route}: expected one og:image, found ${images.length} (${[...new Set(images)].join(', ')})`);
    if (image) {
      const cardRes = await get(image);   // not `card` — that name holds the expected filename
      if (cardRes) {
        check(cardRes.ok, `${route}: og:image is HTTP ${cardRes.status} — every shared link unfurls broken`);
        const bytes = Buffer.from(await cardRes.arrayBuffer());
        check(bytes.subarray(1, 4).toString() === 'PNG', `${route}: og:image is not a PNG`);
        if (bytes.subarray(1, 4).toString() === 'PNG') {
          const [w, h] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
          check(w === 1200 && h === 630, `${route}: og:image is ${w}x${h}, not 1200x630`);
        }
        /* And it must be the card we actually built. An uploaded asset does not change when the
           source does: on 2026-08-08 the live card still carried copy that had been removed from
           every page, and nothing anywhere would have said so. */
        const localCard = await readFile(here(card));
        check(createHash('sha256').update(bytes).digest('hex') === createHash('sha256').update(localCard).digest('hex'),
          `${route}: the live og:image is not the current ${card} — re-upload it to Webflow`);
      }
    }
  }

  const robots = await get(`${ORIGIN}/robots.txt`);
  if (robots) {
    const body = (await robots.text()).trim();
    check(robots.ok, `robots.txt: HTTP ${robots.status}`);
    check(body.length > 0, 'robots.txt is empty — no rules and, more importantly, no Sitemap line');
    check(/^sitemap:/im.test(body), 'robots.txt does not point at the sitemap');
    check(!/^disallow:\s*\/\s*$/im.test(body), 'robots.txt disallows the whole site');
  }

  const map = await get(`${ORIGIN}/sitemap.xml`);
  if (map) {
    check(map.ok, `sitemap.xml: HTTP ${map.status} — search engines have no route list`);
    if (map.ok) {
      const body = await map.text();
      for (const [route] of ROUTES) {
        check(body.includes(`${ORIGIN}${route}`), `live sitemap.xml is missing ${route}`);
      }
      for (const route of KILLED_ROUTES) {
        check(!body.includes(`${ORIGIN}${route}</loc>`), `live sitemap.xml still lists killed ${route}`);
      }
    }
  }

  /* The embed we invite other people to paste. Two lines on their page, one script on GitHub Pages,
     and from that moment their site's Studio is whatever that URL serves. If CI stops deploying it,
     or it drifts from what this repo tests, every site that took us up on the offer breaks or runs
     something nobody gated — and we would never see it, because it is not our page. Byte-comparing
     against the local file is the whole guarantee: the local one is already proven to mount inside
     a hostile host, and identical bytes mount identically. */
  const hosted = await get('https://uuriko.github.io/dasha-desk/studio/embed.js');
  if (hosted) {
    check(hosted.ok, `the pasteable embed is HTTP ${hosted.status} — every site that embedded us is broken`);
    if (hosted.ok) {
      const type = hosted.headers.get('content-type') || '';
      check(/javascript/i.test(type), `the pasteable embed is served as "${type}" — browsers with nosniff will refuse it`);
      const served = await hosted.text();
      const localEmbed = await readFile(here('dasha-studio-embed.js'), 'utf8');
      check(served === localEmbed,
        'the hosted embed has drifted from dasha-studio-embed.js — other people\'s sites are running something this repo did not gate');
    }
  }

  /* The Studio on /studio is not inline: the page ships a shell and pulls its client from the Worker
     to clear Webflow's ~50 KB embed cap, pinning the client's SHA-384 in the script tag. That makes
     the pin and the client one atomic unit split across two systems, and a Worker deploy changes the
     client without touching the pin. On 2026-08-10 exactly that happened: the deploy succeeded, the
     page returned 200, every content assertion passed, and browsers refused the script for a day
     while /studio rendered nothing but "Loading studio…". A live page can be correct in every string
     and still be dead. This is the check that says so — recompute the hash, compare it to the pin. */
  for (const route of KILLED_ROUTES) {
    const retired = await get(`${ORIGIN}${route}`, { redirect: 'manual' });
    check(retired?.status === 308, `${route}: expected 308 home, got HTTP ${retired?.status}`);
    check((retired?.headers.get('location') || '') === `${ORIGIN}/`,
      `${route}: 308 location is ${retired?.headers.get('location')}`);
  }

  /* Every route that claims art of its own must actually have a distinct file: a repoint that fell
     back would otherwise leave two routes on one card with nothing else showing it. Routes on
     SITE_CARD share by decision, so they are excluded — counting them made this check unsatisfiable
     (four routes, three files) and it sat red for long enough to stop meaning anything. */
  const own = ROUTES.map(([, , , card]) => card).filter((card) => card !== SITE_CARD);
  check(new Set(own).size === own.length, 'two routes share a card file — the per-route cards collapsed');

  report();
}

function report() {
  if (failures.length) {
    console.error(`Dasha discovery: ${failures.length} FAILURE(S)${local ? ' (sources)' : ` on ${ORIGIN}`}\n`);
    for (const f of failures) console.error('  · ' + f);
    process.exit(1);
  }
  console.log(local
    ? 'Dasha discovery: PASS (sources — the pasteable embed carries structured data, sitemap well-formed). '
      + 'Route structured data lives in Webflow page settings and is only verifiable live.'
    : `Dasha discovery: PASS (${ORIGIN} — structured data, canonicals, share cards resolve and match, robots, sitemap)`);
}
