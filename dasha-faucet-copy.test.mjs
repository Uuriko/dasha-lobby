#!/usr/bin/env node
/** Faucet Copy address must not hang on writeText. Race + execCommand + select. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAUCET_CLIENT_JS } from './dasha-lobby-static-gen.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const file = readFileSync(join(root, 'dasha-faucet-client.js'), 'utf8');
assert.equal(FAUCET_CLIENT_JS, file, 'bundled faucet client matches disk');

assert.match(file, /function copyTreasury/);
assert.match(file, /execCommand\('copy'\)/);
assert.match(file, /Promise\.race/);
assert.match(file, /selectNodeContents/);
assert.match(file, /createElement\('textarea'\)/);
assert.doesNotMatch(
  file,
  /writeText\(text\)\.then\(ok\)\.catch\(fallback\)/,
  'clipboard hang must race, not wait forever',
);

const TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';

function copyFn() {
  const start = file.indexOf('function copyTreasury');
  const end = file.indexOf('function destShapeError');
  assert.ok(start >= 0 && end > start, 'copyTreasury present');
  return file.slice(start, end);
}

function runCopy({ clipboard, execOk, hang }) {
  const calls = { write: 0, exec: 0, select: 0, textarea: 0 };
  const ca = { textContent: TREASURY, nodeType: 1, className: 'faucet-ca' };
  const button = { textContent: 'Copy address' };
  const document = {
    querySelector(sel) {
      return sel === '.faucet-ca' ? ca : null;
    },
    createElement(tag) {
      calls.textarea += 1;
      return {
        tagName: tag,
        value: '',
        style: { cssText: '' },
        setAttribute() {},
        select() { calls.select += 1; },
        setSelectionRange() {},
        parentNode: null,
      };
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
      appendChild(el) { el.parentNode = this; },
      removeChild(el) { el.parentNode = null; },
    },
    documentElement: {},
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
            assert.equal(text, TREASURY);
            if (hang) return new Promise(() => {});
            return clipboard.writeText(text);
          },
        },
      }
    : {};
  const setTimeout = (fn, ms) => {
    if (ms === 600) fn();
    return 1;
  };
  const fn = new Function(
    'document',
    'navigator',
    'getSelection',
    'setTimeout',
    'TREASURY',
    `${copyFn()}\nreturn copyTreasury;`,
  );
  const copyTreasury = fn(document, navigator, getSelection, setTimeout, TREASURY);
  copyTreasury(button);
  return { button, calls };
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
    clipboard: { writeText: () => Promise.reject(new Error('denied')) },
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

console.log('dasha-faucet-copy: PASS (clipboard / timeout / execCommand / select fallback)');
