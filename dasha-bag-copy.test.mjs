#!/usr/bin/env node
/** /bag Copy link must not hang on writeText. Race + execCommand + select. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'dasha-lobby-worker.mjs'), 'utf8');
const start = src.indexOf('const BAG_HTML = `');
assert.ok(start >= 0, 'BAG_HTML present');
const html = src.slice(start, src.indexOf('`;', start) + 2);

assert.match(html, /data-copy>Copy link/);
assert.match(html, /execCommand\('copy'\)/);
assert.match(html, /Promise\.race/);
assert.match(html, /selectNodeContents/);
assert.match(html, /createElement\('textarea'\)/);
assert.doesNotMatch(
  html,
  /writeText\(href\)\.then\(done\);/,
  'Copy link must not be writeText-only',
);

const HREF = 'https://www.getdasha.com/bag?mint=53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

function clickScript() {
  const i = html.indexOf('out.addEventListener(\'click\'');
  const j = html.indexOf('if (out.getAttribute(\'data-painted\')', i);
  assert.ok(i >= 0 && j > i, 'copy click handler');
  return html.slice(i, j);
}

function runCopy({ clipboard, execOk, hang, share }) {
  const calls = { write: 0, exec: 0, select: 0, textarea: 0, share: 0 };
  const a = {
    textContent: 'Copy link',
    getAttribute(name) { return name === 'href' ? HREF : null; },
  };
  const out = {
    addEventListener(_ev, fn) { this.fn = fn; },
  };
  const created = [];
  const document = {
    createElement(tag) {
      calls.textarea += 1;
      const el = {
        tagName: tag,
        value: '',
        style: { cssText: '' },
        setAttribute() {},
        select() { calls.select += 1; },
      };
      created.push(el);
      return el;
    },
    createRange() {
      return {
        selectNodeContents(node) {
          calls.select += 1;
          this.node = node;
        },
      };
    },
    body: {
      appendChild() {},
      removeChild() {},
    },
    execCommand(cmd) {
      calls.exec += 1;
      assert.equal(cmd, 'copy');
      return execOk;
    },
  };
  const getSelection = () => ({
    removeAllRanges() {},
    addRange() {},
  });
  const navigator = {
    clipboard: clipboard || hang
      ? {
          writeText(text) {
            calls.write += 1;
            assert.equal(text, HREF);
            if (hang) return new Promise(() => {});
            return clipboard.writeText(text);
          },
        }
      : undefined,
  };
  if (share) {
    navigator.share = () => {
      calls.share += 1;
      return Promise.reject(new Error('share-miss'));
    };
  }
  const setTimeout = (fn, ms) => {
    if (ms === 600) fn();
    return 1;
  };
  const fn = new Function(
    'out',
    'document',
    'navigator',
    'getSelection',
    'setTimeout',
    `${clickScript()}\nreturn out.fn;`,
  );
  const handler = fn(out, document, navigator, getSelection, setTimeout);
  handler({
    target: { closest() { return a; } },
    preventDefault() {},
  });
  return { a, calls };
}

{
  const { a, calls } = runCopy({
    clipboard: { writeText: async () => {} },
    execOk: false,
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(a.textContent, 'Copied');
  assert.equal(calls.write, 1);
}

{
  const { a, calls } = runCopy({
    clipboard: { writeText: () => Promise.reject(new Error('denied')) },
    execOk: true,
  });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.exec, 1);
  assert.equal(a.textContent, 'Copied');
}

{
  const { a, calls } = runCopy({
    clipboard: null,
    execOk: true,
  });
  assert.equal(calls.textarea, 1);
  assert.equal(calls.exec, 1);
  assert.equal(a.textContent, 'Copied');
}

{
  const { a, calls } = runCopy({
    clipboard: null,
    execOk: false,
  });
  assert.ok(calls.select >= 1);
  assert.match(a.textContent, /Select/);
}

{
  const { a, calls } = runCopy({
    hang: true,
    execOk: true,
  });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.write, 1);
  assert.equal(calls.exec, 1);
  assert.equal(a.textContent, 'Copied');
}

console.log('dasha-bag-copy: PASS (clipboard / timeout / execCommand / select fallback)');
