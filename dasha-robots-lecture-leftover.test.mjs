#!/usr/bin/env node
/**
 * Leftover after home chrome DRY.
 * Live /robots.txt 200 still serves a crawler-visible lecture above the rules:
 *   "paste this into Webflow SEO settings"
 *   "2026-08-08 outage"
 *   "2020 e-commerce template"
 *   Disallow history / CC0 essay
 * Crawlers read robots.txt comments. Identity one-liner + User-agent/Allow/Sitemap stay.
 * Disk dasha-robots.txt already short. static-gen left dirty on purpose (Worker is live SoR).
 * Disk only. No Designer. No static-gen. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { stripRobotsLecture } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const diskRobots = readFileSync(join(root, 'dasha-robots.txt'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.doesNotMatch(workerSrc, /t\.me\/(?!\+xB7S8mIQaKFiZjRh)/, 'worker must not invent Telegram');
assert.match(workerSrc, /export function stripRobotsLecture/);
assert.match(workerSrc, /null : stripRobotsLecture\(ROBOTS_TXT\)/);
assert.equal(
  (workerSrc.match(/null : stripRobotsLecture\(ROBOTS_TXT\)/g) || []).length,
  2,
  'both robots serve sites strip leftover lecture',
);

const LIVE = `# getdasha.com — public crawl rules (also served at lobby.getdasha.com/robots.txt)
#
# This file is the source for what the Worker serves at /robots.txt. It used to be a different
# document — a "paste this into Webflow SEO settings" draft still narrating a 2026-08-08 outage that
# had already been fixed — while the edge served these rules instead. Two copies, and the one nobody
# read was the one with the explanation in it. Kept in sync now.
#
# The Disallow lines that used to sit here were described as the part worth protecting, because they
# keep a 2020 e-commerce template out of a crypto domain's index. They did the opposite. All five
# paths already answer 404, and /checkout, /paypal-checkout and /order-confirmation also serve
# \`X-Robots-Tag: noindex, nofollow\`. A crawler that obeys a Disallow never fetches the URL, so it
# never sees the 404 and never sees the noindex — which is the one signal that would remove it.
# Blocked URLs can sit in an index indefinitely as URL-only entries. Letting crawlers fetch a 404 is
# what actually retires a page, so the Disallow lines are gone and the 404s do the work.
#
# Deliberately permissive otherwise. Everything here is public and CC0, there is nothing to hide from
# a crawler, and AI search indexes are a real discovery path for a site nobody links to yet.
#
# Machine-readable identity: /ai.txt, /llms.txt (index), and /llms-full.txt (full markdown).

User-agent: *
Allow: /
Allow: /chess
Allow: /faucet
Allow: /which
Allow: /forum
Allow: /bag
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /ai.txt

Sitemap: https://www.getdasha.com/sitemap.xml
Sitemap: https://lobby.getdasha.com/sitemap.xml
`;

assert.match(LIVE, /paste this into Webflow SEO settings/, 'fixture leftover Webflow SEO lecture');
assert.match(LIVE, /2026-08-08 outage/, 'fixture leftover outage lecture');
assert.match(LIVE, /2020 e-commerce template/, 'fixture leftover e-commerce lecture');
assert.match(LIVE, /there is nothing to hide from/, 'fixture leftover CC0 essay');
assert.match(LIVE, /The Disallow lines that used to sit here/, 'fixture leftover Disallow history');

const gone = stripRobotsLecture(LIVE);
assert.doesNotMatch(gone, /paste this into Webflow SEO settings/, 'drops leftover Webflow SEO lecture');
assert.doesNotMatch(gone, /2026-08-08 outage/, 'drops leftover outage lecture');
assert.doesNotMatch(gone, /e-commerce template/, 'drops leftover e-commerce lecture');
assert.doesNotMatch(gone, /nothing to hide from/, 'drops leftover CC0 essay');
assert.doesNotMatch(gone, /Disallow lines that used to sit here/, 'drops leftover Disallow history');
assert.doesNotMatch(gone, /nobody read was the one with the explanation/, 'drops leftover two-copies lecture');
assert.match(gone, /^User-agent: \*$/m, 'User-agent stays');
assert.match(gone, /^Allow: \/$/m, 'Allow / stays');
assert.match(gone, /^Allow: \/forum$/m, 'Allow /forum stays');
assert.match(gone, /^Allow: \/bag$/m, 'Allow /bag stays');
assert.match(gone, /^Allow: \/llms\.txt$/m, 'Allow /llms.txt stays');
assert.match(gone, /^Allow: \/llms-full\.txt$/m, 'Allow /llms-full.txt stays');
assert.match(gone, /^Allow: \/ai\.txt$/m, 'Allow /ai.txt stays');
assert.match(gone, /^Sitemap: https:\/\/www\.getdasha\.com\/sitemap\.xml$/m, 'www sitemap stays');
assert.match(gone, /^Sitemap: https:\/\/lobby\.getdasha\.com\/sitemap\.xml$/m, 'lobby sitemap stays');
assert.match(gone, /^# Machine-readable identity: \/ai\.txt, \/llms\.txt \(index\), and \/llms-full\.txt \(full markdown\)\.$/m, 'identity one-liner stays');
assert.match(gone, /^# getdasha\.com — public crawl rules/, 'title comment stays');
assert.doesNotMatch(gone, /plugin\.jup\.ag/, 'no plugin.jup.ag');
assert.doesNotMatch(gone, /t\.me/, 'no invented t.me');
assert.ok(gone.length < LIVE.length * 0.7, 'lecture drop is comments, not eat-the-rules');
assert.equal(stripRobotsLecture(gone), gone, 'strip is idempotent');

function extractConst(name) {
  const m = workerSrc.match(new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`));
  assert.ok(m, `${name} embedded`);
  return m[1];
}

const robotsConst = extractConst('ROBOTS_TXT');
assert.doesNotMatch(robotsConst, /paste this into Webflow SEO settings/, 'worker ROBOTS_TXT drops leftover lecture');
assert.doesNotMatch(robotsConst, /2026-08-08 outage/, 'worker ROBOTS_TXT no outage lecture');
assert.doesNotMatch(robotsConst, /e-commerce template/, 'worker ROBOTS_TXT no e-commerce lecture');
assert.match(robotsConst, /^User-agent: \*$/m);
assert.match(robotsConst, /^Allow: \/forum$/m);
assert.match(robotsConst, /Machine-readable identity/);
assert.doesNotMatch(stripRobotsLecture(robotsConst), /paste this into Webflow SEO settings/);

assert.doesNotMatch(diskRobots, /paste this into Webflow SEO settings/, 'disk robots already short');
assert.doesNotMatch(diskRobots, /2026-08-08 outage/, 'disk robots no outage lecture');
assert.match(diskRobots, /^User-agent: \*$/m, 'disk robots User-agent');

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const res = await edgeWorker.fetch(new Request(`${origin}/robots.txt`), {});
  assert.equal(res.status, 200, `${origin}/robots.txt`);
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
  const body = await res.text();
  assert.doesNotMatch(body, /paste this into Webflow SEO settings/, `${origin} no leftover Webflow SEO lecture`);
  assert.doesNotMatch(body, /2026-08-08 outage/, `${origin} no leftover outage lecture`);
  assert.doesNotMatch(body, /e-commerce template/, `${origin} no leftover e-commerce lecture`);
  assert.doesNotMatch(body, /nothing to hide from/, `${origin} no leftover CC0 essay`);
  assert.match(body, /^User-agent: \*$/m, `${origin} User-agent`);
  assert.match(body, /^Allow: \/$/m, `${origin} Allow /`);
  assert.match(body, /^Allow: \/forum$/m, `${origin} Allow /forum`);
  assert.match(body, /^Allow: \/bag$/m, `${origin} Allow /bag`);
  assert.match(body, /^Allow: \/llms\.txt$/m, `${origin} Allow /llms.txt`);
  assert.match(body, /^Sitemap: https:\/\/www\.getdasha\.com\/sitemap\.xml$/m, `${origin} www sitemap`);
  assert.match(body, /^Sitemap: https:\/\/lobby\.getdasha\.com\/sitemap\.xml$/m, `${origin} lobby sitemap`);
  assert.match(body, /Machine-readable identity/, `${origin} identity one-liner`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${origin} no plugin.jup.ag`);
  assert.doesNotMatch(body, /t\.me/, `${origin} no invented t.me`);
  assert.doesNotMatch(body, new RegExp(MINT), `${origin} robots stays rules, not a mint page`);
}

const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
assert.equal(home.status, 200);
const homeHtml = await home.text();
assert.match(homeHtml, /\$dasha/);
assert.match(homeHtml, /Chat/);
assert.match(homeHtml, /Buy/);
assert.doesNotMatch(homeHtml, /plugin\.jup\.ag/);

const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
assert.equal(privacy.status, 200);

const studio = await edgeWorker.fetch(new Request('https://www.getdasha.com/studio'), {});
assert.equal(studio.status, 308);
assert.equal(studio.headers.get('location'), 'https://www.getdasha.com/');

const forum = await edgeWorker.fetch(new Request('https://www.getdasha.com/forum'), {});
assert.equal(forum.status, 308);
assert.equal(forum.headers.get('location'), 'https://www.getdasha.com/lobby');

console.log('dasha-robots-lecture-leftover: PASS (lecture gone, rules + identity stay, no plugin.jup.ag)');
