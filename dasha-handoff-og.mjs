/**
 * Tiny pure-JS OG cards for Studio handoffs and Simp member pages (no deps).
 * 600×314 RGB PNG: ink field, acid bar and large text.
 */
import { quizTitle } from './dasha-simp-score.mjs';

/* Half-res card keeps pure store-deflate under ~600KB while staying OG-legible. */
const W = 600;
const H = 314;

// 5×7 uppercase-ish glyphs (bits row-major). Space + A–Z + 0–9 + $ + a few.
const FONT = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
  J: [0x01, 0x01, 0x01, 0x01, 0x11, 0x11, 0x0e],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  0: [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  1: [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  2: [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  3: [0x1f, 0x01, 0x02, 0x06, 0x01, 0x11, 0x0e],
  4: [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  5: [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  6: [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  7: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  8: [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  9: [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '@': [0x0e, 0x11, 0x17, 0x15, 0x17, 0x10, 0x0e],
  '#': [0x0a, 0x1f, 0x0a, 0x0a, 0x1f, 0x0a, 0x00],
  _: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ',': [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04],
  "'": [0x0c, 0x0c, 0x08, 0x00, 0x00, 0x00, 0x00],
  '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '·': [0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00],
};

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}
const CRC_TABLE = crcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = data.length;
  const out = new Uint8Array(8 + len + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, len);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  const crcBuf = out.subarray(4, 8 + len);
  view.setUint32(8 + len, crc32(crcBuf));
  return out;
}
function deflateStore(raw) {
  // zlib wrapper + stored deflate blocks (no compression)
  const blocks = [];
  let offset = 0;
  while (offset < raw.length) {
    const size = Math.min(65535, raw.length - offset);
    const last = offset + size >= raw.length ? 1 : 0;
    const block = new Uint8Array(5 + size);
    block[0] = last;
    block[1] = size & 0xff;
    block[2] = (size >> 8) & 0xff;
    block[3] = ~size & 0xff;
    block[4] = (~size >> 8) & 0xff;
    block.set(raw.subarray(offset, offset + size), 5);
    blocks.push(block);
    offset += size;
  }
  const bodyLen = blocks.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(2 + bodyLen + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let p = 2;
  for (const b of blocks) {
    out.set(b, p);
    p += b.length;
  }
  // Adler-32 of raw
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < raw.length; i++) {
    s1 = (s1 + raw[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = ((s2 << 16) | s1) >>> 0;
  const view = new DataView(out.buffer);
  view.setUint32(out.length - 4, adler);
  return out;
}

function fillRect(px, x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h && y < H; y++) {
    if (y < 0) continue;
    for (let x = x0; x < x0 + w && x < W; x++) {
      if (x < 0) continue;
      const i = (y * W + x) * 3;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
    }
  }
}

function drawChar(px, ch, x, y, scale, r, g, b) {
  const glyph = FONT[ch] || FONT[ch.toUpperCase()] || FONT['?'];
  for (let row = 0; row < 7; row++) {
    const bits = glyph[row];
    for (let col = 0; col < 5; col++) {
      if (bits & (0x10 >> col)) {
        fillRect(px, x + col * scale, y + row * scale, scale, scale, r, g, b);
      }
    }
  }
}

function drawText(px, text, x, y, scale, r, g, b, maxWidth) {
  let cx = x;
  const step = 6 * scale;
  for (const ch of text) {
    if (maxWidth && cx + step > x + maxWidth) break;
    drawChar(px, ch, cx, y, scale, r, g, b);
    cx += step;
  }
  return cx;
}

function wrapWords(text, maxChars) {
  const words = String(text || '')
    .toUpperCase()
    .replace(/[^\w$.,!?' ·-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    /* Hard-split very long tokens so a single word cannot blank the card. */
    const chunks = w.length > maxChars
      ? w.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [w.slice(0, maxChars)]
      : [w];
    for (const piece of chunks) {
      const next = cur ? `${cur} ${piece}` : piece;
      if (next.length > maxChars && cur) {
        lines.push(cur);
        cur = piece;
      } else cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 5);
}

export async function handoffOgPng(state = {}) {
  const px = new Uint8Array(W * H * 3);
  // ink background
  fillRect(px, 0, 0, W, H, 7, 6, 8);
  // violet / hot glows (in-bounds for 600×314)
  fillRect(px, 380, 0, 220, 160, 40, 25, 70);
  fillRect(px, 0, 170, 260, 120, 55, 20, 40);
  // acid frame + bottom bar for scannable brand
  fillRect(px, 0, 0, W, 6, 223, 255, 0);
  fillRect(px, 0, H - 44, W, 44, 223, 255, 0);
  // kicker
  drawText(px, 'YOUR TURN  ·  $DASHA', 24, 20, 3, 223, 255, 0, 560);
  const look = String(state.look || 'poster').toUpperCase();
  const format = String(state.format || 'square').toUpperCase();
  const sticker = state.sticker && state.sticker !== 'None' ? ` · ${String(state.sticker)}` : '';
  drawText(px, `${look} · ${format}${sticker}`.slice(0, 42), 24, 54, 2, 230, 220, 196, 560);
  // line — prefer fewer, larger rows for X/Discord unfurl legibility
  const lines = wrapWords(state.line || 'MAKE ONE', 18);
  const bodyScale = lines.length > 3 ? 4 : 5;
  let ly = 92;
  for (const line of lines) {
    drawText(px, line, 24, ly, bodyScale, 244, 237, 219, 560);
    ly += bodyScale * 8 + 6;
  }
  // footer on acid bar
  drawText(px, 'GETDASHA.COM  ·  OPEN STUDIO  ·  CHANGE ONE THING', 20, H - 30, 2, 7, 6, 8, 560);

  return encodeRgbPng(px);
}

export async function simpMemberOgPng({ handle, rank, total, holder, quiz } = {}) {
  const clean = String(handle || '').replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{1,15}$/.test(clean)) throw new Error('bad member handle');
  if (!Number.isInteger(rank) || rank < 2) throw new Error('bad member rank');
  if (!Number.isInteger(total) || total < 0) throw new Error('bad member total');
  const quizCorrect = Number(quiz?.correct);
  const quizTotal = Number(quiz?.total);
  const earnedTitle = Number.isInteger(quizCorrect) && Number.isInteger(quizTotal) && quizTotal > 0 && quizCorrect >= 0 && quizCorrect <= quizTotal
    ? quizTitle(quizCorrect, quizTotal)
    : '';
  const px = new Uint8Array(W * H * 3);
  fillRect(px, 0, 0, W, H, 7, 6, 8);
  fillRect(px, 390, 0, 210, 180, 40, 25, 70);
  fillRect(px, 0, 190, 280, 80, 55, 20, 40);
  fillRect(px, 0, 0, W, 6, 223, 255, 0);
  fillRect(px, 0, H - 44, W, 44, 223, 255, 0);
  drawText(px, '$DASHA SIMP BOARD', 24, 20, 3, 223, 255, 0, 552);
  drawText(px, `@${clean}`.toUpperCase(), 24, 60, 4, 244, 237, 219, 552);
  drawText(px, `#${rank}`, 24, 112, 8, 244, 237, 219, 552);
  if (earnedTitle) {
    drawText(px, earnedTitle.toUpperCase(), 300, 116, 2, 244, 237, 219, 276);
    drawText(px, `${quizCorrect}/${quizTotal} QUIZ`, 300, 142, 2, 223, 255, 0, 276);
  }
  drawText(px, `${total} SIMP POINTS`, 24, 198, 4, 223, 255, 0, 552);
  if (holder === true) drawText(px, 'HOLDER CHECK CURRENT', 330, 238, 2, 244, 237, 219, 240);
  drawText(px, 'GETDASHA.COM  ·  SEE THE BOARD', 20, H - 30, 2, 7, 6, 8, 560);
  return encodeRgbPng(px);
}

export async function forumThreadOgPng({ title, handle, replies = 0, reactions = 0 } = {}) {
  const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!cleanTitle) throw new Error('bad forum title');
  const cleanHandle = String(handle || '').replace(/^@/, '');
  const replyCount = Number.isInteger(replies) && replies >= 0 ? Math.min(replies, 999) : 0;
  const reactionCount = Number.isInteger(reactions) && reactions >= 0 ? Math.min(reactions, 2500) : 0;
  const px = new Uint8Array(W * H * 3);
  fillRect(px, 0, 0, W, H, 7, 6, 8);
  fillRect(px, 390, 0, 210, 180, 40, 25, 70);
  fillRect(px, 0, 190, 280, 80, 55, 20, 40);
  fillRect(px, 0, 0, W, 6, 223, 255, 0);
  fillRect(px, 0, H - 44, W, 44, 223, 255, 0);
  drawText(px, '$DASHA FORUM', 24, 20, 3, 223, 255, 0, 552);
  const lines = wrapWords(cleanTitle, 20);
  if (!lines.length) lines.push('OPEN THE THREAD');
  const scale = lines.length > 3 ? 4 : 5;
  let y = 64;
  for (const line of lines.slice(0, 4)) {
    drawText(px, line, 24, y, scale, 244, 237, 219, 552);
    y += scale * 8 + 5;
  }
  const author = /^[A-Za-z0-9_]{1,15}$/.test(cleanHandle) ? `@${cleanHandle}` : '$DASHA COMMUNITY';
  const engagement = `${replyCount} ${replyCount === 1 ? 'REPLY' : 'REPLIES'}${reactionCount ? ` · ${reactionCount} ${reactionCount === 1 ? 'HEART' : 'HEARTS'}` : ''}`;
  drawText(px, `${author} · ${engagement}`.toUpperCase(), 24, 236, 2, 230, 220, 196, 552);
  drawText(px, 'GETDASHA.COM  ·  JOIN THE THREAD', 20, H - 30, 2, 7, 6, 8, 560);
  return encodeRgbPng(px);
}


const OG_W = 1200;
const OG_H = 630;

function fillRectAt(px, width, height, x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h && y < height; y++) {
    if (y < 0) continue;
    for (let x = x0; x < x0 + w && x < width; x++) {
      if (x < 0) continue;
      const i = (y * width + x) * 3;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
    }
  }
}

function drawCharAt(px, width, height, ch, x, y, scale, r, g, b) {
  const glyph = FONT[ch] || FONT[ch.toUpperCase()] || FONT['?'];
  for (let row = 0; row < 7; row++) {
    const bits = glyph[row];
    for (let col = 0; col < 5; col++) {
      if (bits & (0x10 >> col)) {
        fillRectAt(px, width, height, x + col * scale, y + row * scale, scale, scale, r, g, b);
      }
    }
  }
}

function drawTextAt(px, width, height, text, x, y, scale, r, g, b, maxWidth) {
  let cx = x;
  const step = 6 * scale;
  for (const ch of text) {
    if (maxWidth && cx + step > x + maxWidth) break;
    drawCharAt(px, width, height, ch, cx, y, scale, r, g, b);
    cx += step;
  }
  return cx;
}

function paintSimpCard(px, { kicker, headline, score, footer }) {
  fillRectAt(px, OG_W, OG_H, 0, 0, OG_W, OG_H, 7, 6, 8);
  fillRectAt(px, OG_W, OG_H, 780, 0, 420, 280, 40, 25, 70);
  fillRectAt(px, OG_W, OG_H, 0, 360, 520, 180, 55, 20, 40);
  fillRectAt(px, OG_W, OG_H, 0, 0, OG_W, 12, 223, 255, 0);
  fillRectAt(px, OG_W, OG_H, 0, OG_H - 72, OG_W, 72, 223, 255, 0);
  drawTextAt(px, OG_W, OG_H, String(kicker || '$DASHA').toUpperCase(), 48, 40, 5, 223, 255, 0, 1100);
  const lines = wrapWords(headline || 'BEAT THIS', 16);
  const scale = lines.length > 2 ? 7 : 9;
  let y = 140;
  for (const line of lines.slice(0, 3)) {
    drawTextAt(px, OG_W, OG_H, line, 48, y, scale, 244, 237, 219, 1100);
    y += scale * 8 + 10;
  }
  if (score) drawTextAt(px, OG_W, OG_H, String(score).toUpperCase(), 48, 430, 8, 223, 255, 0, 1100);
  drawTextAt(px, OG_W, OG_H, String(footer || 'GETDASHA.COM').toUpperCase(), 40, OG_H - 48, 3, 7, 6, 8, 1120);
}

/** 1200×630 acid/paper/ink card for /simp and /simp/r/:id unfurls. */
export async function simpBoardOgPng() {
  const px = new Uint8Array(OG_W * OG_H * 3);
  paintSimpCard(px, {
    kicker: '$DASHA SIMP',
    headline: 'Beat this',
    score: 'TAKE THE QUIZ',
    footer: 'GETDASHA.COM  ·  $DASHA',
  });
  return encodeRgbPng(px, OG_W, OG_H);
}

export async function simpQuizOgPng({ title, correct, total } = {}) {
  const quizCorrect = Number(correct);
  const quizTotal = Number(total);
  const score = Number.isInteger(quizCorrect) && Number.isInteger(quizTotal) && quizTotal > 0
    ? `${quizCorrect}/${quizTotal}`
    : '';
  const earned = String(title || '').trim() || (score ? quizTitle(quizCorrect, quizTotal) : 'Beat this');
  const px = new Uint8Array(OG_W * OG_H * 3);
  paintSimpCard(px, {
    kicker: '$DASHA SIMP',
    headline: score ? `Beat my Simp — ${score}` : earned,
    score: score ? earned : '$DASHA',
    footer: 'GETDASHA.COM  ·  $DASHA',
  });
  return encodeRgbPng(px, OG_W, OG_H);
}

export const SIMP_OG_WIDTH = OG_W;
export const SIMP_OG_HEIGHT = OG_H;

async function encodeRgbPng(px, width = W, height = H) {
  // PNG scanlines: filter 0 + RGB
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    raw.set(px.subarray(y * width * 3, (y + 1) * width * 3), row + 1);
  }
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const compressed = await zlibDeflate(raw);
  const parts = [signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', new Uint8Array(0))];
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function zlibDeflate(raw) {
  if (typeof CompressionStream === 'function') {
    try {
      const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch { /* fall through */ }
  }
  return deflateStore(raw);
}

export const HANDOFF_OG_WIDTH = W;
export const HANDOFF_OG_HEIGHT = H;
