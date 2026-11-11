#!/usr/bin/env node
/** dasha-qr: dependency-free QR encoder (byte mode, EC level M). */
import assert from 'node:assert/strict';
import {
  encodeQrMatrix,
  formatInfoBits,
  qrCodewords,
  qrSvg,
  qrVersionFor,
  versionInfoBits,
} from './dasha-qr.mjs';

// version selection: smallest version whose byte-mode capacity fits
assert.equal(qrVersionFor(0), 1);
assert.equal(qrVersionFor(14), 1);
assert.equal(qrVersionFor(15), 2);
assert.equal(qrVersionFor(62), 4);
assert.equal(qrVersionFor(63), 5);
assert.equal(qrVersionFor(213), 10);
assert.equal(qrVersionFor(214), 0);
assert.throws(() => encodeQrMatrix('x'.repeat(214)), /too long/);

// format info: (15,5) BCH, well-known vectors (EC level M = 0b00)
assert.equal(formatInfoBits(0, 0b00), 0x5412); // M, mask 0
assert.equal(formatInfoBits(7, 0b00).toString(2).padStart(15, '0'), '100101010100000'); // M, mask 7

// version info: (18,6) BCH, well-known vectors
assert.equal(versionInfoBits(7), 0x07c94);
assert.equal(versionInfoBits(10).toString(2).padStart(18, '0'), '001010010011010011');

// data codewords for 'Hello, world!' at v1-M (byte mode, verified vs reference impl)
// mode(0100) + count(13) + data, then terminator/pad; last 10 are Reed-Solomon EC
const { version, codewords } = qrCodewords('Hello, world!');
assert.equal(version, 1);
assert.equal(codewords.length, 26); // 16 data + 10 EC at v1-M
assert.deepEqual(Array.from(codewords.slice(0, 6)), [64, 212, 134, 86, 198, 198]);
assert.equal(codewords[14], 0x10); // tail of data + pad
assert.equal(codewords[15], 0xec); // first pad byte

// matrix geometry + finder pattern + dark module
const m = encodeQrMatrix('Hi');
assert.equal(m.size, 21);
assert.equal(m.modules.length, 21 * 21);
const finder = ['1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111'];
for (let y = 0; y < 7; y++) {
  let row = '';
  for (let x = 0; x < 7; x++) row += m.modules[y * m.size + x];
  assert.equal(row, finder[y], `finder row ${y}`);
}
// dark module: column 8, row 4V+9
assert.equal(m.modules[13 * m.size + 8], 1);
// timing pattern intact on row 6 / column 6 outside finders (alternates, dark at even i)
assert.equal(m.modules[6 * m.size + 8], 1);
assert.equal(m.modules[6 * m.size + 9], 0);

// SVG: quiet zone 4 modules, single path, correct viewBox
const svg = qrSvg('Hi', { module: 4 });
assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 116 116"/);
assert.match(svg, /<path d="M16 16h4v4h-4Z/); // first dark run (finder corner, quiet zone offset)
assert.match(svg, /fill="#111111"/);
assert.ok(!svg.includes('<circle'), 'single path, no per-module shapes');
const svg2 = qrSvg('Hi', { module: 2, margin: 2 });
assert.match(svg2, /viewBox="0 0 50 50"/);

// UTF-8 multibyte payload encodes in byte mode
const uni = encodeQrMatrix('héllo ✓');
assert.ok(uni.size >= 21);
assert.ok(uni.modules.every((v) => v === 0 || v === 1));

console.log('dasha-qr: all assertions passed');
