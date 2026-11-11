/**
 * Tiny QR Code generator — byte mode, ECC level M, versions 1–10.
 *
 * No dependencies, works in the Cloudflare Worker (pure JS, no DOM).
 * Byte-mode payloads up to ~213 bytes (v10-M). Used for the cross-device
 * handoff QR: the encoded payload is an approve URL + single-use token
 * (a grant id, never credential material).
 *
 * API:
 *   encodeQrMatrix(text) -> { version, size, modules: Uint8Array } (row-major, 1 = dark)
 *   qrSvg(text, { scale, margin, dark, light } = {}) -> svg string
 */

/* ---- GF(256) arithmetic (poly 0x11D) ---- */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/* ---- Reed-Solomon generator: returns ec codewords for one block ---- */
function rsRemainder(data, ecLen) {
  const gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gfMul(gen[j], EXP[i]);
      next[j + 1] ^= gen[j];
    }
    for (let j = 0; j < next.length; j++) gen[j] = next[j];
  }
  const res = new Array(ecLen).fill(0); // res[j] = coeff of x^(ecLen-1-j)
  for (const d of data) {
    const factor = d ^ res.shift();
    res.push(0);
    // subtract factor * g(x); gen[k] is the coeff of x^k, so x^j's coeff is gen[ecLen-1-j]
    for (let j = 0; j < ecLen; j++) res[j] ^= gfMul(gen[ecLen - 1 - j], factor);
  }
  return res;
}

/* ---- ECC block layout, level M, versions 1..10 ----
 * groups: [{ count, total, data }] ; ec = ec codewords per block */
const ECC_BLOCKS_M = {
  1: { ec: 10, groups: [{ count: 1, total: 26, data: 16 }] },
  2: { ec: 16, groups: [{ count: 1, total: 44, data: 28 }] },
  3: { ec: 26, groups: [{ count: 1, total: 70, data: 44 }] },
  4: { ec: 18, groups: [{ count: 2, total: 50, data: 32 }] },
  5: { ec: 24, groups: [{ count: 2, total: 67, data: 43 }] },
  6: { ec: 16, groups: [{ count: 4, total: 43, data: 27 }] },
  7: { ec: 18, groups: [{ count: 4, total: 49, data: 31 }] },
  8: { ec: 22, groups: [{ count: 2, total: 60, data: 38 }, { count: 2, total: 61, data: 39 }] },
  9: { ec: 22, groups: [{ count: 3, total: 58, data: 36 }, { count: 2, total: 59, data: 37 }] },
  10: { ec: 26, groups: [{ count: 4, total: 69, data: 43 }, { count: 1, total: 70, data: 44 }] },
};
const TOTAL_CODEWORDS = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346 };
const REMAINDER_BITS = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 3 };
const ALIGN_POS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

function dataCapacityBytes(version) {
  const { groups } = ECC_BLOCKS_M[version];
  const dataCw = groups.reduce((s, g) => s + g.count * g.data, 0);
  const countBits = version <= 9 ? 8 : 16;
  // mode(4) + count + terminator(<=4) rounded up to whole codewords
  return Math.floor((dataCw * 8 - 4 - countBits - 4) / 8);
}

/** Smallest version (1..10) whose byte-mode capacity fits `bytes.length`. */
export function qrVersionFor(byteLen) {
  for (let v = 1; v <= 10; v++) {
    if (dataCapacityBytes(v) >= byteLen) return v;
  }
  return 0; // too long
}

function buildCodewords(bytes, version) {
  const { ec, groups } = ECC_BLOCKS_M[version];
  const totalData = groups.reduce((s, g) => s + g.count * g.data, 0);
  const countBits = version <= 9 ? 8 : 16;
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4); // byte mode
  push(bytes.length, countBits);
  for (const b of bytes) push(b, 8);
  const cap = totalData * 8;
  const term = Math.min(4, cap - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  for (let pad = 0xEC; data.length < totalData; pad = pad === 0xEC ? 0x11 : 0xEC) data.push(pad);
  // split into blocks, RS-encode each, interleave
  const blocks = [];
  let off = 0;
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      const d = data.slice(off, off + g.data);
      off += g.data;
      blocks.push({ data: d, ec: rsRemainder(d, ec) });
    }
  }
  const out = [];
  const maxData = Math.max(...groups.map((g) => g.data));
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < ec; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

/* ---- matrix construction ---- */
function buildMatrix(version, codewords) {
  const size = version * 4 + 17;
  const m = new Int8Array(size * size).fill(-1); // -1 = unset
  const fixed = new Uint8Array(size * size); // 1 = function pattern (no mask)
  const put = (x, y, v) => { m[y * size + x] = v; fixed[y * size + x] = 1; };

  // finder patterns (+ separators via white ring drawn explicitly)
  const corners = [[0, 0], [size - 7, 0], [0, size - 7]];
  for (const [cx, cy] of corners) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        put(x, y, 0);
      }
    }
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const edge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        put(cx + dx, cy + dy, edge || core ? 1 : 0);
      }
    }
  }

  // timing patterns
  for (let i = 8; i < size - 8; i++) {
    put(i, 6, i % 2 === 0 ? 1 : 0);
    put(6, i, i % 2 === 0 ? 1 : 0);
  }

  // alignment patterns (drawn over timing modules; only finder corners are omitted)
  const ap = ALIGN_POS[version];
  for (const ay of ap) {
    for (const ax of ap) {
      if ((ax < 9 && ay < 9) || (ax >= size - 8 && ay < 9) || (ax < 9 && ay >= size - 8)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const edge = Math.abs(dx) === 2 || Math.abs(dy) === 2;
          const core = dx === 0 && dy === 0;
          put(ax + dx, ay + dy, edge || core ? 1 : 0);
        }
      }
    }
  }

  // dark module (column 8, row 4V+9) + reserve format info areas (exact footprint)
  put(8, 4 * version + 9, 1);
  const reserve = (x, y) => { if (m[y * size + x] === -1) { m[y * size + x] = 0; fixed[y * size + x] = 1; } };
  for (let i = 0; i <= 5; i++) { reserve(8, i); reserve(i, 8); } // strips near top-left
  reserve(8, 7); reserve(8, 8); reserve(7, 8);
  for (let j = 0; j <= 6; j++) reserve(8, size - 7 + j); // second copy: (8, n-7..n-1)
  for (let j = 0; j <= 7; j++) reserve(size - 1 - j, 8); // second copy: (n-8..n-1, 8)

  // version info (v7+)
  if (version >= 7) {
    const bits = versionInfoBits(version);
    for (let i = 0; i < 18; i++) {
      const b = (bits >>> i) & 1;
      const x = i % 3, y = Math.floor(i / 3);
      put(size - 11 + x, y, b);
      put(y, size - 11 + x, b);
    }
  }

  // data placement (zigzag, skipping function modules)
  const totalBits = TOTAL_CODEWORDS[version] * 8;
  let bitIdx = 0;
  const bit = (i) => (i < totalBits ? (codewords[i >>> 3] >>> (7 - (i & 7))) & 1 : 0);
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let i = 0; i < size; i++) {
      const y = upward ? size - 1 - i : i;
      for (let dx = 0; dx < 2; dx++) {
        const x = col - dx;
        if (m[y * size + x] !== -1) continue;
        m[y * size + x] = bit(bitIdx++);
      }
    }
    upward = !upward;
  }
  const rem = REMAINDER_BITS[version];
  // remainder bits stay 0 (already zero-filled? m has -1 unset) — fill remaining -1 with 0
  for (let i = 0; i < m.length; i++) if (m[i] === -1) m[i] = 0;

  // choose best mask
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const trial = applyMask(m, fixed, size, mask);
    const score = penalty(trial, size);
    if (!best || score < best.score) best = { mask, score, m: trial };
  }

  // format info with chosen mask
  const fmt = formatInfoBits(maskOf(best), 0b00); // ec level M = 00
  drawFormatInfo(best.m, fixed, size, fmt);
  return { version, size, mask: maskOf(best), modules: Uint8Array.from(best.m) };
}
function maskOf(b) { return b.mask; }

function applyMask(m, fixed, size, mask) {
  const out = Int8Array.from(m);
  const cond = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ][mask];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!fixed[y * size + x] && cond(x, y)) out[y * size + x] ^= 1;
    }
  }
  return out;
}

function penalty(m, size) {
  let score = 0;
  // N1: runs of 5+ same color
  const runScore = (line) => {
    let run = 1, s = 0;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) run++;
      else { if (run >= 5) s += 3 + (run - 5); run = 1; }
    }
    return s;
  };
  for (let y = 0; y < size; y++) {
    const row = []; for (let x = 0; x < size; x++) row.push(m[y * size + x]);
    score += runScore(row);
    const col = []; for (let x = 0; x < size; x++) col.push(m[x * size + y]);
    score += runScore(col);
  }
  // N2: 2x2 blocks
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = m[y * size + x];
      if (m[y * size + x + 1] === v && m[(y + 1) * size + x] === v && m[(y + 1) * size + x + 1] === v) score += 3;
    }
  }
  // N3: finder-like patterns 10111010000 / 00001011101
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matchAt = (line, i, pat) => { for (let k = 0; k < 11; k++) if (line[i + k] !== pat[k]) return false; return true; };
  for (let y = 0; y < size; y++) {
    const row = []; for (let x = 0; x < size; x++) row.push(m[y * size + x]);
    const col = []; for (let x = 0; x < size; x++) col.push(m[x * size + y]);
    for (const line of [row, col]) {
      for (let i = 0; i <= size - 11; i++) {
        if (matchAt(line, i, pat1) || matchAt(line, i, pat2)) score += 40;
      }
    }
  }
  // N4: dark ratio
  let dark = 0;
  for (const v of m) dark += v;
  const pct = (dark * 100) / (size * size);
  const prev = Math.floor(pct / 5) * 5, next = Math.ceil(pct / 5) * 5;
  score += Math.min(Math.abs(prev - 50) / 5, Math.abs(next - 50) / 5) * 10;
  return score;
}

function bchDigit(n) {
  let d = 0;
  while (n > 0) { d++; n >>>= 1; }
  return d;
}

/** BCH remainder of (data << shift) divided by poly, XOR mask. */
function bch(data, shift, poly, mask) {
  const polyDeg = bchDigit(poly) - 1;
  let d = data << shift;
  while (bchDigit(d) - 1 >= polyDeg) {
    d ^= poly << (bchDigit(d) - 1 - polyDeg);
  }
  return ((data << shift) | d) ^ mask;
}

export function formatInfoBits(mask, ecLevel) {
  const data = (ecLevel << 3) | mask; // 5 bits
  return bch(data, 10, 0x537, 0x5412) & 0x7fff; // 15 bits
}

export function versionInfoBits(version) {
  return bch(version, 12, 0x1f25, 0) & 0x3ffff; // 18 bits
}

function drawFormatInfo(m, fixed, size, fmt) {
  const put = (x, y, v) => { m[y * size + x] = v; fixed[y * size + x] = 1; };
  // 15 bits, LSB first; column-8 strip + row-8 strip (two copies)
  for (let i = 0; i < 15; i++) {
    const b = (fmt >>> i) & 1;
    if (i < 6) put(8, i, b);
    else if (i < 8) put(8, i + 1, b);
    else put(8, size - 15 + i, b);
    if (i < 8) put(size - 1 - i, 8, b);
    else if (i < 9) put(7, 8, b);
    else put(14 - i, 8, b);
  }
}

/** Raw final codeword stream (data + EC, interleaved) — exposed for tests. */
export function qrCodewords(text) {
  const bytes = new TextEncoder().encode(text);
  const version = qrVersionFor(bytes.length);
  if (!version) throw new Error('qr payload too long (max ~213 bytes at v10-M)');
  return { version, codewords: buildCodewords(bytes, version) };
}

/**
 * Encode text (UTF-8, byte mode) as a QR matrix.
 * Throws if the payload exceeds v10-M capacity (~213 bytes).
 */
export function encodeQrMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  const version = qrVersionFor(bytes.length);
  if (!version) throw new Error('qr payload too long (max ~213 bytes at v10-M)');
  const codewords = buildCodewords(bytes, version);
  return buildMatrix(version, codewords);
}

const escXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Render a QR matrix as a compact SVG (one <path>, quiet zone included).
 * options: { module = 4 (px per module), margin = 4 (modules), dark, light, title }
 */
export function qrSvg(text, { module = 4, margin = 4, dark = '#111111', light = '#ffffff', title = 'QR code' } = {}) {
  const { size, modules } = encodeQrMatrix(text);
  const total = size + margin * 2;
  const px = (n) => n * module;
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y * size + x]) d += `M${px(x + margin)} ${px(y + margin)}h${module}v${module}h-${module}Z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${px(total)} ${px(total)}" width="${px(total)}" height="${px(total)}" role="img" aria-label="${escXml(title)}"><title>${escXml(title)}</title><rect width="${px(total)}" height="${px(total)}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
