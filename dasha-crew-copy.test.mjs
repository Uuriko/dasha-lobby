import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREW_PAGE_HTML as EMBED } from './dasha-crew-page.mjs';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'dasha-crew.html'), 'utf8');
assert.equal(html, EMBED, 'embed must match dasha-crew.html');

const script = html.split('<script>')[1].split('</script>')[0];
assert.match(script, /function copyPrompt/);
assert.match(script, /execCommand\('copy'\)/);
assert.match(script, /Promise\.race/);
assert.match(script, /selectNodeContents/);
assert.match(script, /createElement\('textarea'\)/);
assert.match(script, /Copy prompt/);
assert.doesNotMatch(
  script,
  /writeText\(text\)\.then\(done\)\.catch\(\(\)=>\{button\.textContent='Select text'\}\)/,
  'clipboard fail must copy or select, not only relabel',
);

const promptText = 'You are Scout. $dasha tape only.';

function runCopy({ clipboard, execOk }) {
  const calls = { write: 0, exec: 0, select: 0, textarea: 0 };
  const prompt = {
    textContent: promptText,
    nodeType: 1,
  };
  const button = { textContent: 'Copy prompt' };
  const card = {
    querySelector(sel) {
      if (sel === '[data-prompt]') return prompt;
      return null;
    },
  };
  button.closest = () => card;

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
        remove() {},
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
  const navigator = clipboard
    ? {
        clipboard: {
          writeText(text) {
            calls.write += 1;
            assert.equal(text, promptText);
            return clipboard.writeText(text);
          },
        },
      }
    : {};

  const start = script.indexOf('function copyPrompt');
  const end = script.indexOf('document.querySelectorAll');
  const body = script.slice(start, end);
  const fn = new Function(
    'document',
    'navigator',
    'getSelection',
    'setTimeout',
    `${body}\nreturn copyPrompt;`,
  );
  const copyPrompt = fn(document, navigator, getSelection, () => {});
  copyPrompt(button);
  return { button, calls, created };
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
  let rejected = false;
  const { button, calls } = runCopy({
    clipboard: {
      writeText: () => {
        rejected = true;
        return Promise.reject(new Error('denied'));
      },
    },
    execOk: true,
  });
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(rejected, true);
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
  assert.match(button.textContent, /Select text|Selected/);
}

console.log('dasha-crew-copy: PASS (clipboard / execCommand / select fallback)');
