#!/usr/bin/env node
/**
 * T041 — Ask markdown render regression (fences, lists, links).
 * Source already has renderAskMarkdown / askBlockMd / askInlineBits
 * (bold + inline code). No [text](url) renderer — lock escape-only so
 * we do not invent <a>. Additive file; does not edit Quill HTML.
 *
 * Prefer worker source on main, not live HTML. Live /compute is still
 * Typeform until Instinct wrangler of dasha-lobby tip (#246/#249/#255).
 * Set LIVE_ASK_CANARY=1 to fail honestly on that Typeform gap.
 *
 * Disk == embed == worker.fetch. No wrangler. No Designer. No Quill
 * dasha-compute.html edit (#260 owns HTML). Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import worker from './dasha-lobby-worker.mjs';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const disk = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(disk, COMPUTE_PAGE_HTML, 'embed matches dasha-compute.html');

function extractFn(html, name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name}(`);
  let i = html.indexOf('{', start);
  assert.ok(i > start, `${name} body`);
  let depth = 0;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  assert.fail(`${name} unclosed`);
}

function hasAskMarkdown(html) {
  return (
    /function renderAskMarkdown\(/.test(html) &&
    /function askBlockMd\(/.test(html) &&
    /function askInlineBits\(/.test(html) &&
    /function escapeAskHtml\(/.test(html) &&
    /function fillAskSaid\(/.test(html)
  );
}

function assertAskMarkdownPath(html, label) {
  assert.ok(hasAskMarkdown(html), `${label} T041 Ask markdown helpers present`);
  assert.match(html, /function escapeAskHtml\(/, `${label} T041 escapeAskHtml`);
  assert.match(html, /function askInlineBits\(/, `${label} T041 askInlineBits`);
  assert.match(html, /function askBlockMd\(/, `${label} T041 askBlockMd`);
  assert.match(html, /function renderAskMarkdown\(/, `${label} T041 renderAskMarkdown`);
  assert.match(html, /function fillAskSaid\(/, `${label} T041 fillAskSaid`);
  assert.match(html, /said\.innerHTML=renderAskMarkdown\(/, `${label} T041 replies use renderAskMarkdown`);
  assert.match(html, /data-open=['"]1['"]/, `${label} T041 stream-safe open fence`);
  assert.match(html, /\.ask-said\.ask-md pre/, `${label} T041 fence CSS`);
  assert.match(html, /\.ask-said\.ask-md ul/, `${label} T041 list CSS`);
  assert.doesNotMatch(html, /plugin\.jup\.ag/, `${label} T041 no plugin`);
}

function loadAskMarkdownHelpers(html) {
  const names = ['escapeAskHtml', 'askInlineBits', 'askBlockMd', 'renderAskMarkdown'];
  const src = names.map((name) => extractFn(html, name)).join('\n');
  const ctx = {};
  vm.runInNewContext(`${src}\nthis.escapeAskHtml=escapeAskHtml;this.askInlineBits=askInlineBits;this.askBlockMd=askBlockMd;this.renderAskMarkdown=renderAskMarkdown;`, ctx);
  return ctx;
}

function assertAskMarkdownRender(html, label) {
  const { renderAskMarkdown, askInlineBits, escapeAskHtml } = loadAskMarkdownHelpers(html);

  const closed = renderAskMarkdown('**bold**\n\n- one\n- two\n\n```js\nconst x=1\n```', false);
  assert.match(closed, /<strong>bold<\/strong>/, `${label} T041 bold`);
  assert.match(closed, /<ul><li>one<\/li><li>two<\/li><\/ul>/, `${label} T041 ul`);
  assert.match(closed, /<pre><code class="language-js">const x=1\n<\/code><\/pre>/, `${label} T041 closed fence`);

  const ol = renderAskMarkdown('1. alpha\n2. **beta**', false);
  assert.match(ol, /<ol><li>alpha<\/li><li><strong>beta<\/strong><\/li><\/ol>/, `${label} T041 ol + bold`);

  const star = renderAskMarkdown('* star\n* `code`', false);
  assert.match(star, /<ul><li>star<\/li><li><code>code<\/code><\/li><\/ul>/, `${label} T041 star list + inline code`);

  const open = renderAskMarkdown('intro\n```py\nprint(1)', true);
  assert.match(open, /<p>intro<\/p>/, `${label} T041 stream preface`);
  assert.match(open, /data-open="1"/, `${label} T041 incomplete fence buffered`);
  assert.match(open, /print\(1\)/, `${label} T041 open fence keeps code`);
  assert.doesNotMatch(open, /```/, `${label} T041 does not leak raw fence`);

  const closedOpen = renderAskMarkdown('intro\n```py\nprint(1)', false);
  assert.doesNotMatch(closedOpen, /data-open="1"/, `${label} T041 idle open fence is not stream-marked`);

  const xss = renderAskMarkdown('<script>alert(1)</script>\n```html\n<a onclick="x">y</a>\n```', false);
  assert.doesNotMatch(xss, /<script>/, `${label} T041 script escaped`);
  assert.match(xss, /&lt;script&gt;/, `${label} T041 script entities`);
  assert.match(xss, /&lt;a onclick=&quot;x&quot;&gt;y&lt;\/a&gt;/, `${label} T041 fence HTML escaped`);

  const mdLink = renderAskMarkdown('See [docs](https://jup.ag/tokens/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump) please.', false);
  assert.match(mdLink, /<p>See \[docs\]\(https:\/\/jup\.ag\/tokens\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump\) please\.<\/p>/, `${label} T041 markdown link stays text`);
  assert.doesNotMatch(mdLink, /<a\b/, `${label} T041 no invented <a> — source has no link renderer`);
  assert.doesNotMatch(mdLink, /plugin\.jup\.ag/, `${label} T041 no plugin.jup.ag`);

  const rawUrl = renderAskMarkdown('https://example.com/path?q=1', false);
  assert.match(rawUrl, /<p>https:\/\/example\.com\/path\?q=1<\/p>/, `${label} T041 raw URL stays text`);
  assert.doesNotMatch(rawUrl, /<a\b/, `${label} T041 raw URL is not autolinked`);

  assert.equal(askInlineBits('**x** and `y`'), '<strong>x</strong> and <code>y</code>', `${label} T041 inline bits`);
  assert.equal(escapeAskHtml('<a href="x">'), '&lt;a href=&quot;x&quot;&gt;', `${label} T041 escapeAskHtml`);
}

assertAskMarkdownPath(disk, 'disk');
assertAskMarkdownPath(COMPUTE_PAGE_HTML, 'embed');
assertAskMarkdownRender(disk, 'disk');
assertAskMarkdownRender(COMPUTE_PAGE_HTML, 'embed');

const served = await worker.fetch(new Request('https://www.getdasha.com/compute'), {});
assert.equal(served.status, 200);
assert.equal(served.headers.get('x-dasha-edge'), 'compute');
const servedHtml = await served.text();
assertAskMarkdownPath(servedHtml, 'worker.fetch');
assertAskMarkdownRender(servedHtml, 'worker.fetch');

const liveCanary = process.env.LIVE_ASK_CANARY === '1';
if (liveCanary) {
  const live = await fetch('https://lobby.getdasha.com/compute', {
    redirect: 'manual',
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'dasha-compute-ask-markdown-render-canary.test', Accept: 'text/html' },
  });
  assert.equal(live.status, 200, 'LIVE_ASK_CANARY live /compute 200');
  const liveHtml = await live.text();
  if (!hasAskMarkdown(liveHtml)) {
    assert.fail(
      'LIVE_ASK_CANARY: live /compute is still Typeform (no renderAskMarkdown). Instinct wrangler of Uuriko/dasha-lobby tip still outstanding — source canaries on COMPUTE_PAGE_HTML already hold.',
    );
  }
  assertAskMarkdownPath(liveHtml, 'live');
  assertAskMarkdownRender(liveHtml, 'live');
  console.log('dasha-compute-ask-markdown-render-canary: PASS (T041 fences/lists/links; live Ask shell too)');
} else {
  console.log('dasha-compute-ask-markdown-render-canary: PASS (T041 fences + lists + escape-only links; source only — live Typeform until tip)');
}
