import test from 'node:test';
import assert from 'node:assert/strict';
import { LOGIN_PAGE_HTML } from './dasha-lobby-static-gen.mjs';

function regexFrom(marker) {
  const line = LOGIN_PAGE_HTML.split('\n').find((l) => l.includes(marker));
  assert.ok(line, 'line with ' + marker);
  const m = line.match(/!(\/\^.*\$\/)\.test/);
  assert.ok(m, 'regex literal in ' + line);
  return new Function('return ' + m[1])();
}

test('served login email check accepts normal addresses incl. the letter s', () => {
  const re = regexFrom('Enter a valid email address');
  assert.ok(re.test('sam@example.com'));
  assert.ok(re.test('jonathan.potter@gmail.com'));
  assert.ok(!re.test('not an email'));
  assert.ok(!re.test('a@b'));
});

test('served login code check accepts 6 digits only', () => {
  const re = regexFrom('Enter the 6-digit code');
  assert.ok(re.test('123456'));
  assert.ok(!re.test('dddddd'));
  assert.ok(!re.test('12345'));
});
