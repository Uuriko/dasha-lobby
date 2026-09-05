#!/usr/bin/env node
/** Lobby pin Copy must copy or select. Clipboard hang is not a dead button. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asStandaloneLobbyPage } from './dasha-lobby-worker.mjs';
import { LOBBY_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-lobby-page.html'), 'utf8');
const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';

function copyScript(src) {
  const m = String(src).match(/<script>\(function\(\)\{var mint='53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';[\s\S]*?<\/script>/);
  assert.ok(m, 'pin copy IIFE present');
  return m[0].slice('<script>'.length, -'</script>'.length);
}

function assertCopyShape(src, label) {
  const script = copyScript(src);
  assert.match(script, /getElementById\('forum-copy'\)/, `${label} binds #forum-copy`);
  assert.match(script, /execCommand\('copy'\)/, `${label} legacy copy`);
  assert.match(script, /Promise\.race/, `${label} clipboard timeout`);
  assert.match(script, /selectNodeContents/, `${label} select fallback`);
  assert.match(script, /createElement\('textarea'\)/, `${label} textarea fallback`);
  assert.doesNotMatch(
    script,
    /writeText\(mint\)\.then\(ok\)\.catch\(fallback\)/,
    `${label} clipboard fail must copy or select, not hang`,
  );
}

assertCopyShape(html, 'disk source');
assertCopyShape(LOBBY_PAGE_HTML, 'bundled');
assertCopyShape(asStandaloneLobbyPage(html), 'standalone source');
assertCopyShape(asStandaloneLobbyPage(LOBBY_PAGE_HTML), 'standalone bundled');

function runCopy({ clipboard, execOk, hang }) {
  const calls = { write: 0, exec: 0, select: 0, textarea: 0 };
  const ca = { textContent: '53ux…pump', nodeType: 1 };
  const button = { textContent: 'Copy', id: 'forum-copy' };
  const created = [];
  const document = {
    getElementById(id) {
      return id === 'forum-copy' ? button : null;
    },
    querySelector(sel) {
      return sel === '.forum-ca' ? ca : null;
    },
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
  const navigator = clipboard || hang
    ? {
        clipboard: {
          writeText(text) {
            calls.write += 1;
            assert.equal(text, MINT);
            if (hang) return new Promise(() => {});
            return clipboard.writeText(text);
          },
        },
      }
    : {};

  const listeners = [];
  button.addEventListener = (_ev, fn) => listeners.push(fn);
  const timers = [];
  const setTimeout = (fn, ms) => {
    timers.push({ fn, ms });
    if (ms === 600) fn();
    return timers.length;
  };

  const script = copyScript(html);
  const fn = new Function(
    'document',
    'navigator',
    'getSelection',
    'setTimeout',
    `${script}\nreturn true;`,
  );
  fn(document, navigator, getSelection, setTimeout);
  assert.equal(listeners.length, 1, 'click bound');
  listeners[0]();
  return { button, calls, created, timers };
}

{
  const { button, calls } = runCopy({
    clipboard: { writeText: async () => {} },
    execOk: false,
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(button.textContent, 'Copied');
  assert.equal(calls.write, 1);
}

{
  const { button, calls } = runCopy({
    clipboard: {
      writeText: () => Promise.reject(new Error('denied')),
    },
    execOk: true,
  });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.exec, 1);
  assert.equal(button.textContent, 'Copied');
}

{
  const { button, calls } = runCopy({
    clipboard: null,
    execOk: true,
  });
  assert.equal(calls.textarea, 1);
  assert.equal(calls.exec, 1);
  assert.equal(button.textContent, 'Copied');
}

{
  const { button, calls } = runCopy({
    clipboard: null,
    execOk: false,
  });
  assert.ok(calls.select >= 1);
  assert.match(button.textContent, /Select/);
}

{
  const { button, calls } = runCopy({
    hang: true,
    execOk: true,
  });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.write, 1);
  assert.equal(calls.exec, 1);
  assert.equal(button.textContent, 'Copied');
}

console.log('dasha-lobby-copy: PASS (clipboard / timeout / execCommand / select fallback)');
