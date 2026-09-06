#!/usr/bin/env node
/**
 * /llms.txt is the short index. /llms-full.txt is the 2026 markdown companion, not a URL list.
 * Both must carry the associated mint and never plugin.jup.ag. Telegram stays off these pages.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker from './dasha-lobby-worker.mjs';
import { ROBOTS_TXT, SITEMAP_XML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const worker = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
const diskRobots = readFileSync(join(root, 'dasha-robots.txt'), 'utf8');
const diskSitemap = readFileSync(join(root, 'dasha-sitemap.xml'), 'utf8');

const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
const OTHER = 'FQ1tyso61AH1tzodyJfSwmzsD3GToybbRNoZxUBz21p8';
const SITE = 'https://www.getdasha.com/';

function extractConst(name) {
  const re = new RegExp(`const ${name} = \`([\\s\\S]*?)\`;`);
  const m = worker.match(re);
  assert.ok(m, `${name} must be embedded in the worker`);
  return m[1];
}

const llms = extractConst('LLMS_TXT');
const full = extractConst('LLMS_FULL_TXT');
const ai = extractConst('AI_TXT');
const robots = extractConst('ROBOTS_TXT');
const sitemap = extractConst('SITEMAP_XML');

for (const [name, body] of [
  ['LLMS_TXT', llms],
  ['LLMS_FULL_TXT', full],
]) {
  assert.ok(body.includes(MINT), `${name} missing associated mint`);
  assert.ok(body.includes(PAIR), `${name} missing pair`);
  assert.ok(body.includes(OTHER), `${name} missing VVAIFU mint`);
  assert.ok(body.includes(SITE), `${name} missing site`);
  assert.ok(body.includes('dash_eats'), `${name} missing dash_eats`);
  assert.match(body, /jup\.ag\/tokens\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/, `${name} must use jup.ag with the exact mint`);
  assert.doesNotMatch(body, /plugin\.jup\.ag/, `${name} must not mention plugin.jup.ag`);
  assert.doesNotMatch(body, /t\.me/, `${name} must not invent Telegram`);
  assert.doesNotMatch(body, /disclaimer|not financial advice|dyor|nfa/i, `${name} must not lecture`);
}

assert.ok(full.length > llms.length, 'llms-full must be more complete than llms.txt');
assert.match(full, /^# \$dasha is dash_eats on Solana/m, 'llms-full starts with the required H1');
assert.match(full, /^> /m, 'llms-full has the 2026 blockquote summary');
assert.match(full, /^## Identity/m, 'llms-full is markdown sections, not a URL list');
assert.match(full, /^## Which \$dasha\?/m, 'llms-full inlines Which $dasha');
assert.match(full, /^## The bag/m, 'llms-full inlines The bag');
assert.ok(llms.includes('/bag'), 'llms.txt lists /bag');
assert.ok(llms.includes('/listings'), 'llms.txt lists /listings');
assert.ok(llms.includes('/listings.json'), 'llms.txt lists /listings.json');
assert.match(full, /^## Dasha List/m, 'llms-full inlines Dasha List');
for (const path of ['/login', '/contribute', '/bounties', '/crew', '/compute', '/listings']) {
  assert.ok(llms.includes(path), `llms.txt lists live 200 ${path}`);
  assert.ok(full.includes(`https://www.getdasha.com${path}`), `llms-full lists live 200 ${path}`);
}
assert.match(full, /Bounties: USDC on Solana\. We don’t hold it\./);
assert.doesNotMatch(full, /does not hold the funds/);
assert.doesNotMatch(full, /Simp Board:/);
assert.doesNotMatch(full, /Spotlight profile/);
assert.doesNotMatch(full, /add zero points/);
assert.doesNotMatch(full, /getdasha\.com\/simp/);
assert.match(full, /How to buy: SOL → mint → Buy\./);
assert.match(full, /Contribute: Build Dasha\. Open a pull request\./);
assert.doesNotMatch(llms + full, /indexnow/i, 'llms files must not mention IndexNow');
assert.doesNotMatch(llms, /designer/i, 'llms.txt must not name Designer');
assert.doesNotMatch(full, /designer/i, 'llms-full must not name Designer');
assert.ok((full.match(/^https:\/\/www\.getdasha\.com\/[a-z-]*$/gm) || []).length < 8, 'llms-full must not be a bare URL list');

assert.ok(robots.includes('/llms.txt'), 'robots must mention /llms.txt');
assert.ok(robots.includes('/llms-full.txt'), 'robots must mention /llms-full.txt');
assert.ok(ai.includes(MINT), 'AI_TXT missing associated mint');
assert.ok(ai.includes('/llms.txt') && ai.includes('/llms-full.txt'), 'AI_TXT must point at both llm files');
assert.doesNotMatch(ai, /plugin\.jup\.ag/, 'AI_TXT must not mention plugin.jup.ag');
assert.doesNotMatch(ai, /t\.me/, 'AI_TXT must not invent Telegram');
assert.doesNotMatch(ai, /disclaimer|not financial advice|dyor|nfa|privacy policy/i, 'AI_TXT must not lecture');
assert.ok(ai.length < llms.length, 'AI_TXT stays shorter than the index');

assert.ok(!/^Allow:\s*\/verse\s*$/m.test(robots), 'robots must not Allow retired /verse');
assert.ok(!/^Allow:\s*\/learn\s*$/m.test(robots), 'robots must not Allow retired /learn');
assert.ok(!/^Allow:\s*\/studio\s*$/m.test(robots), 'robots must not Allow killed /studio');
assert.ok(!/^Allow:\s*\/dasha\s*$/m.test(robots), 'robots must not Allow killed Desk');
assert.ok(robots.includes('/ai.txt'), 'robots mention /ai.txt');
assert.ok(robots.includes('/bag'), 'robots mention /bag');
assert.ok(robots.includes('/listings'), 'robots mention /listings');
assert.ok(robots.includes('/listings.json'), 'robots mention /listings.json');
assert.ok(!robots.includes('Disallow:'), 'retired routes stay fetchable');

assert.ok(sitemap.includes('<loc>https://www.getdasha.com/llms.txt</loc>'), 'worker sitemap lists /llms.txt');
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/llms-full.txt</loc>'), 'worker sitemap lists /llms-full.txt');
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/which</loc>'), 'worker sitemap lists /which');
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/bag</loc>'), 'worker sitemap lists /bag');
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/listings</loc>'), 'worker sitemap lists /listings');
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/listings.json</loc>'), 'worker sitemap lists /listings.json');
assert.ok(
  sitemap.includes('<loc>https://www.getdasha.com/listings</loc><lastmod>2026-09-06</lastmod>'),
  'sitemap lastmod 2026-09-06 for /listings',
);
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/crew</loc>'), 'worker sitemap lists /crew');
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/digest</loc>'), 'worker sitemap lists /digest');
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/compute</loc>'), 'worker sitemap lists /compute');
assert.match(worker, /Compute: Start\. \(Ask \/ Provide \/ Pay \/ Credits\)\. Pay → Top up USDC\/\$dasha \/ Sponsor\b/, 'llms-full gate-first Compute');
assert.doesNotMatch(worker, /Use \/ Provide \/ Night \/ Build \/ Sponsor/, 'no stale Use/Provide/Night/Sponsor blurb');
assert.match(extractConst('LLMS_FULL_TXT'), /Compute: Start\. \(Ask \/ Provide \/ Pay \/ Credits\)\. Pay → Top up USDC\/\$dasha \/ Sponsor\b/, 'LLMS_FULL gate-first');
assert.doesNotMatch(extractConst('LLMS_FULL_TXT'), /Use \/ Provide \/ Night \/ Build \/ Sponsor/, 'LLMS_FULL no stale Use/Provide');
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/contribute</loc>'), 'worker sitemap lists /contribute');
assert.ok(sitemap.includes('<loc>https://www.getdasha.com/bounties</loc>'), 'worker sitemap lists /bounties');
assert.ok(!sitemap.includes('<loc>https://www.getdasha.com/login</loc>'), 'worker sitemap must not list /login');
assert.ok(!sitemap.includes('<loc>https://www.getdasha.com/studio</loc>'), 'worker sitemap must not list /studio');
assert.ok(!sitemap.includes('<loc>https://www.getdasha.com/dasha</loc>'), 'worker sitemap must not list /dasha');
assert.ok(!sitemap.includes('<loc>https://www.getdasha.com/desk</loc>'), 'worker sitemap must not list /desk');
assert.doesNotMatch(full, /https:\/\/www\.getdasha\.com\/studio/, 'llms-full must not advertise /studio');
assert.doesNotMatch(full, /https:\/\/www\.getdasha\.com\/dasha(?![\w-])/, 'llms-full must not advertise Desk /dasha');
assert.doesNotMatch(full, /^Studio:/m, 'llms-full must not feature Studio as a room');
assert.doesNotMatch(full, /^Desk:/m, 'llms-full must not feature Desk as a room');
assert.doesNotMatch(llms, /\/studio|Studio:/, 'llms.txt must not name Studio as a room');
assert.doesNotMatch(ai, /\/studio|Studio:|Desk:/, 'ai.txt must not name Studio/Desk as rooms');
assert.ok(
  sitemap.includes('<loc>https://www.getdasha.com/</loc><lastmod>2026-09-01</lastmod>'),
  'sitemap lastmod 2026-09-01 for /',
);
for (const loc of [
  'https://www.getdasha.com/which',
  'https://www.getdasha.com/llms.txt',
  'https://www.getdasha.com/llms-full.txt',
  'https://www.getdasha.com/contribute',
  'https://www.getdasha.com/privacy',
  'https://www.getdasha.com/compute',
  'https://www.getdasha.com/bounties',
  'https://www.getdasha.com/bag',
  'https://www.getdasha.com/crew',
  'https://www.getdasha.com/digest',
  'https://www.getdasha.com/ai.txt',
  'https://www.getdasha.com/how-to-buy',
]) {
  assert.ok(
    sitemap.includes(`<loc>${loc}</loc><lastmod>2026-09-01</lastmod>`),
    `sitemap lastmod 2026-09-01 for ${loc}`,
  );
}
assert.ok(
  sitemap.includes('<loc>https://www.getdasha.com/forum</loc><lastmod>2026-09-01</lastmod>'),
  'forum stays lastmod 2026-09-01 (308, not indexable 200)',
);

assert.ok(diskRobots.includes('/llms.txt') && diskRobots.includes('/llms-full.txt') && diskRobots.includes('/ai.txt') && diskRobots.includes('/bag') && diskRobots.includes('/listings'), 'dasha-robots.txt mentions llm files, /ai.txt, /bag and /listings');
assert.ok(!/^Allow:\s*\/verse\s*$/m.test(diskRobots) && !/^Allow:\s*\/learn\s*$/m.test(diskRobots), 'disk robots keeps /verse /learn gone');
assert.ok(!/^Allow:\s*\/studio\s*$/m.test(diskRobots), 'disk robots must not Allow /studio');
assert.ok(diskSitemap.includes('/llms.txt') && diskSitemap.includes('/llms-full.txt') && diskSitemap.includes('/ai.txt') && diskSitemap.includes('/bag') && diskSitemap.includes('/listings'), 'dasha-sitemap.xml lists llm files, /ai.txt, /bag and /listings');
assert.ok(!diskSitemap.includes('getdasha.com/studio</loc>'), 'disk sitemap must not list /studio');
assert.ok(!diskSitemap.includes('getdasha.com/dasha</loc>'), 'disk sitemap must not list /dasha');
assert.ok(ROBOTS_TXT.includes('/llms.txt') && SITEMAP_XML.includes('/llms.txt'), 'static-gen robots/sitemap stay in sync');

const banned = /plugin\.jup\.ag|t\.me\/(?!\$)/;
assert.doesNotMatch(llms + full + ai + robots, banned, 'embedded SEO bodies must not grow plugin.jup.ag or Telegram');

for (const origin of ['https://www.getdasha.com', 'https://lobby.getdasha.com']) {
  const aiRes = await edgeWorker.fetch(new Request(`${origin}/ai.txt`), {});
  assert.equal(aiRes.status, 200, `${origin}/ai.txt`);
  assert.equal(aiRes.headers.get('x-dasha-edge'), 'ai');
  const aiBody = await aiRes.text();
  assert.ok(aiBody.includes(MINT), `${origin}/ai.txt missing mint`);
  assert.ok(aiBody.includes('/llms.txt') && aiBody.includes('/llms-full.txt'), `${origin}/ai.txt must point at llms`);
  assert.doesNotMatch(aiBody, /plugin\.jup\.ag/);
  assert.doesNotMatch(aiBody, /t\.me/);

  const llmsRes = await edgeWorker.fetch(new Request(`${origin}/llms.txt`), {});
  assert.equal(llmsRes.status, 200, `${origin}/llms.txt`);
  assert.equal(llmsRes.headers.get('x-dasha-edge'), 'llms');
  const llmsBody = await llmsRes.text();
  assert.ok(llmsBody.includes(MINT));
  assert.doesNotMatch(llmsBody, /plugin\.jup\.ag/);
  assert.doesNotMatch(llmsBody, /t\.me/);

  const fullRes = await edgeWorker.fetch(new Request(`${origin}/llms-full.txt`), {});
  assert.equal(fullRes.status, 200, `${origin}/llms-full.txt`);
  assert.equal(fullRes.headers.get('x-dasha-edge'), 'llms-full');
  assert.match(fullRes.headers.get('content-type') || '', /text\/plain/);
  const fullBody = await fullRes.text();
  assert.ok(fullBody.includes(MINT));
  assert.ok(fullBody.includes(PAIR));
  assert.ok(fullBody.includes(OTHER));
  assert.match(fullBody, /^# \$dasha is dash_eats on Solana/m);
  assert.ok(fullBody.length > llmsBody.length);
  assert.doesNotMatch(fullBody, /plugin\.jup\.ag/);
  assert.doesNotMatch(fullBody, /t\.me/);

  const head = await edgeWorker.fetch(new Request(`${origin}/llms-full.txt`, { method: 'HEAD' }), {});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');

  const which = await edgeWorker.fetch(new Request(`${origin}/which`), {});
  assert.equal(which.status, 200, `${origin}/which`);
  assert.equal(which.headers.get('x-dasha-edge'), 'which');
  const bag = await edgeWorker.fetch(new Request(`${origin}/bag`), {});
  assert.equal(bag.status, 200, `${origin}/bag`);
  assert.equal(bag.headers.get('x-dasha-edge'), 'bag');
  const bagBody = await bag.text();
  assert.ok(bagBody.includes(MINT));
  assert.ok(bagBody.includes(PAIR));
  assert.match(bagBody, /jup\.ag\/tokens\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/);
  assert.doesNotMatch(bagBody, /plugin\.jup\.ag/);
  assert.doesNotMatch(bagBody, /t\.me/);
  assert.doesNotMatch(bagBody, /\bstake\b|\btax\b/i);
  assert.match(which.headers.get('link') || '', /<\/llms\.txt>\s*;\s*rel="describedby"/, `${origin}/which advertises /llms.txt`);
  assert.match(which.headers.get('link') || '', /<\/llms-full\.txt>\s*;\s*rel="describedby"/, `${origin}/which advertises /llms-full.txt`);
  const whichBody = await which.text();
  assert.match(whichBody, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/, `${origin}/which HTML advertises /llms.txt`);
  assert.match(whichBody, /<link rel="describedby" href="\/llms-full\.txt" type="text\/plain">/, `${origin}/which HTML advertises /llms-full.txt`);

  const robotsRes = await edgeWorker.fetch(new Request(`${origin}/robots.txt`), {});
  assert.equal(robotsRes.status, 200, `${origin}/robots.txt`);
  const robotsBody = await robotsRes.text();
  assert.ok(robotsBody.includes('llms'), `${origin}/robots.txt must mention llms`);
  assert.ok(robotsBody.includes('/llms.txt'));
  assert.ok(robotsBody.includes('/llms-full.txt'));
  assert.ok(!/^Allow:\s*\/verse\s*$/m.test(robotsBody));
  assert.ok(!/^Allow:\s*\/learn\s*$/m.test(robotsBody));
  assert.ok(!/^Allow:\s*\/studio\s*$/m.test(robotsBody), `${origin} robots must not Allow /studio`);
  assert.ok(robotsBody.includes('/ai.txt'), `${origin} robots mention /ai.txt`);

  const map = await edgeWorker.fetch(new Request(`${origin}/sitemap.xml`), {});
  assert.equal(map.status, 200, `${origin}/sitemap.xml`);
  const mapBody = await map.text();
  assert.ok(mapBody.includes('https://www.getdasha.com/llms.txt'), `${origin} sitemap lists /llms.txt`);
  assert.ok(mapBody.includes('https://www.getdasha.com/llms-full.txt'), `${origin} sitemap lists /llms-full.txt`);
  assert.ok(mapBody.includes('https://www.getdasha.com/ai.txt'), `${origin} sitemap lists /ai.txt`);
  assert.ok(mapBody.includes('https://www.getdasha.com/forum'));
  assert.ok(mapBody.includes('https://www.getdasha.com/privacy'));
  assert.ok(mapBody.includes('https://www.getdasha.com/compute</loc>'), `${origin} sitemap lists /compute`);
  assert.ok(mapBody.includes('https://www.getdasha.com/crew</loc>'), `${origin} sitemap lists /crew`);
  assert.ok(mapBody.includes('https://www.getdasha.com/digest</loc>'), `${origin} sitemap lists /digest`);
  assert.ok(mapBody.includes('https://www.getdasha.com/which</loc>'));
  assert.ok(!mapBody.includes('<loc>https://www.getdasha.com/studio</loc>'), `${origin} sitemap must not list /studio`);
  assert.ok(!mapBody.includes('<loc>https://www.getdasha.com/dasha</loc>'), `${origin} sitemap must not list /dasha`);
  assert.ok(mapBody.includes('<lastmod>2026-09-01</lastmod>'), `${origin} sitemap has lastmod 2026-09-01`);
}

{
  const prev = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    '<!doctype html><html><head><title>$dasha — make the timeline stranger</title></head><body><h1>$dasha</h1><a href="https://jup.ag/tokens/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump">Buy</a></body></html>',
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
  try {
    const home = await edgeWorker.fetch(new Request('https://www.getdasha.com/'), {});
    assert.equal(home.status, 200);
    assert.match(home.headers.get('link') || '', /<\/llms\.txt>\s*;\s*rel="describedby"/, 'home Link advertises /llms.txt');
    const body = await home.text();
    assert.match(body, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/, 'home HTML advertises /llms.txt');
    assert.match(body, /<link rel="describedby" href="\/llms-full\.txt" type="text\/plain">/, 'home HTML advertises /llms-full.txt');
    assert.match(body, /<title>\$dasha<\/title>/, 'home title is $dasha');
    assert.doesNotMatch(body, /make the timeline stranger/, 'home title drops Webflow line');
    assert.doesNotMatch(body, /disclaimer|not financial advice|dyor|nfa/i);
    assert.doesNotMatch(body, /plugin\.jup\.ag/);
    assert.doesNotMatch(body, /t\.me/);
  } finally {
    globalThis.fetch = prev;
  }
}

{
  const { attachLlmsHtmlLinks } = await import('./dasha-lobby-worker.mjs');
  const injected = attachLlmsHtmlLinks('<html><head></head><body></body></html>');
  assert.match(injected, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/);
  assert.match(injected, /<link rel="describedby" href="\/llms-full\.txt" type="text\/plain">/);
  const again = attachLlmsHtmlLinks(injected);
  assert.equal((again.match(/href="\/llms\.txt"/g) || []).length, 1);
  assert.equal((again.match(/href="\/llms-full\.txt"/g) || []).length, 1);
}

{
  const prev = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } });
  try {
    const pages = ['/bag', '/lobby', '/compute', '/crew', '/digest', '/how-to-buy', '/privacy', '/faucet', '/login', '/contribute', '/bounties', '/chess'];
    for (const path of pages) {
      const res = await edgeWorker.fetch(new Request(`https://www.getdasha.com${path}`), {});
      assert.equal(res.status, 200, `${path} 200`);
      const link = res.headers.get('link') || '';
      assert.match(link, /<\/llms\.txt>\s*;\s*rel="describedby"/, `${path} HTTP Link describedby /llms.txt`);
      assert.match(link, /<\/llms-full\.txt>\s*;\s*rel="describedby"/, `${path} HTTP Link describedby /llms-full.txt`);
      const body = await res.text();
      assert.match(body, /<link rel="describedby" href="\/llms\.txt" type="text\/plain">/, `${path} HTML describedby /llms.txt`);
      assert.match(body, /<link rel="describedby" href="\/llms-full\.txt" type="text\/plain">/, `${path} HTML describedby /llms-full.txt`);
      assert.doesNotMatch(body, /plugin\.jup\.ag/, `${path} no plugin.jup.ag`);
      assert.doesNotMatch(body, /indexnow/i, `${path} no IndexNow`);
    }
    const bag = await edgeWorker.fetch(new Request('https://www.getdasha.com/bag'), {});
    assert.match(bag.headers.get('link') || '', /<\/llms\.txt>\s*;\s*rel="describedby"/, 'bag keeps HTTP Link describedby');
    assert.match(bag.headers.get('link') || '', /<\/llms-full\.txt>\s*;\s*rel="describedby"/, 'bag keeps HTTP Link llms-full');
    await bag.text();
    const privacy = await edgeWorker.fetch(new Request('https://www.getdasha.com/privacy'), {});
    const privacyBody = await privacy.text();
    assert.match(privacyBody, /<h1>Privacy<\/h1>/);
    assert.match(privacyBody, /Dasha never collects seed phrases, private keys, DMs, email, phone numbers, or payment cards\./);
  } finally {
    globalThis.fetch = prev;
  }
}

console.log('dasha-llms: PASS (ai.txt + llms + llms-full, HTML describedby on crawler 200s, mint, no plugin.jup.ag, no t.me, robots no studio, sitemap lastmod)');
