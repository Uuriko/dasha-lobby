/**
 * Dasha lobby — pure moderation + protocol helpers (no IO).
 * One public room. No DMs. Anon nick. Short messages. Allowlisted links only.
 */

export const MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const PAIR = '9KkDpvUQRqXjiuyMFcy1CwqrxLwDcGGUR2Cap2Qt7bU7';
export const WSOL = 'So11111111111111111111111111111111111111112';
export const MAX_NICK = 18;
export const MAX_TEXT = 200;
export const MAX_HISTORY = 40;
/** Hard concurrent presence cap for the single public room (one DO). */
export const MAX_SOCKETS = 80;
export const MAX_PER_IP = 4;
export const IP_JOIN_MAX = 10;
export const IP_JOIN_WINDOW_MS = 10 * 60 * 1000;
export const RATE_MS = 2500;
export const MAX_PER_MIN = 12;
export const HISTORY_TTL_MS = 30 * 60 * 1000;
export const REPEAT_WINDOW_MS = 45_000;
/** Twitch-style auto slow when the room gets busy. */
export const SLOW_MODE_AT = 30;
export const SLOW_MODE_RATE_MS = 5000;
export const SLOW_MODE_PER_MIN = 8;

/** Anon cannot use these as nicks (impersonation / brand confusion). */
export const RESERVED_NICKS = new Set(
  [
    'admin',
    'mod',
    'moderator',
    'system',
    'dasha',
    'official',
    'support',
    'dash_eats',
    'dasheats',
    'dash-eats',
    'dash.eats',
    'dasha_eats',
    'dasha.eats',
    'officialdasha',
    'official_dasha',
    'realdasha',
    'dashaofficial',
    'potterlab',
    'getdasha',
    'trygetdasha',
    'lobby',
    'dasha_lobby',
    'dasha-lobby',
    'dashaeat',
    'dash_eat',
    'notthedev',
    'dasha_support',
    'dashasupport',
    'dashahelp',
  ].map(s => s.toLowerCase()),
);

/** Idle sockets get closed after this (client + server). */
export const IDLE_MS = 20 * 60 * 1000;
/** First chat after join (seconds of calm for bots/raids). */
export const JOIN_COOLDOWN_MS = 12_000;
/** Auto-shield: N automod hits in WINDOW → shield for DURATION. */
export const SPAM_SPIKE_HITS = 12;
export const SPAM_SPIKE_WINDOW_MS = 60_000;
export const AUTO_SHIELD_MS = 10 * 60 * 1000;

/** Collapse lookalike separators for reserved-nick matching. */
export function nickLookalikeKey(nick) {
  return nickKey(nick).replace(/[._\-\s]+/g, '');
}

export function isReservedNick(nick) {
  const k = nickKey(nick);
  if (RESERVED_NICKS.has(k)) return true;
  const flat = nickLookalikeKey(nick);
  for (const r of RESERVED_NICKS) {
    if (nickLookalikeKey(r) === flat) return true;
  }
  return false;
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;
const NICK_RE = /^[A-Za-z0-9_ .-]{2,18}$/;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const SCAM =
  /\b(air\s*-?\s*drop|airdrop|claim\s*(now|tokens?|here|reward)|free\s*sol|seed\s*phrase|secret\s*phrase|recovery\s*phrase|private\s*key|connect\s*(your\s*)?wallet|send\s*\d+\s*sol|double\s*your|guaranteed\s*(profit|returns?)|dm\s*me\s*for|whatsapp|telegram\.me|t\.me\/|discord\.gg)\b/i;

/** Hosts allowed inside messages (exact hostname match). */
export const LINK_ALLOW = new Set([
  'www.getdasha.com',
  'getdasha.com',
  'lobby.getdasha.com',
  'x.com',
  'twitter.com',
  'jup.ag',
  'pump.fun',
  'www.pump.fun',
  'phantom.com',
  'www.phantom.com',
  'raydium.io',
  'www.raydium.io',
  'dexscreener.com',
  'www.geckoterminal.com',
  'solscan.io',
  'rugcheck.xyz',
  'github.com',
  'www.github.com',
]);

export const PIN = Object.freeze({
  type: 'pin',
  text: 'Public lobby.',
  mint: MINT,
});

export function cleanText(raw, max) {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\r\n?/g, '\n').normalize('NFC').replace(CONTROL, '').trim();
  if (!t) return null;
  if ([...t].length > max) return null;
  return t;
}

export function nickKey(nick) {
  return String(nick || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
}

export function validateNick(raw, { allowAtHandle = false, linkedHandle = null } = {}) {
  // X-linked display form @handle (1–15 alnum/underscore after @)
  if (allowAtHandle && typeof raw === 'string' && raw.startsWith('@')) {
    const h = raw.slice(1).toLowerCase();
    if (!/^[a-z0-9_]{1,15}$/.test(h)) return { ok: false, error: 'invalid X handle' };
    // Linked user may only use their own handle
    if (linkedHandle && h !== String(linkedHandle).toLowerCase()) {
      return { ok: false, error: 'nick must match linked X handle' };
    }
    return { ok: true, nick: `@${h}`, handle: h };
  }
  const nick = cleanText(raw, MAX_NICK);
  if (!nick || !NICK_RE.test(nick)) return { ok: false, error: 'nick must be 2–18 letters, numbers, space, . _ -' };
  if (nick.startsWith('@')) return { ok: false, error: 'link X to use @handle' };
  if (isReservedNick(nick)) return { ok: false, error: 'nick reserved' };
  return { ok: true, nick };
}

/**
 * Sliding join budget per IP. Mutates `state` = { times: number[] }.
 */
export function checkIpJoin(state, now = Date.now(), { max = IP_JOIN_MAX, windowMs = IP_JOIN_WINDOW_MS } = {}) {
  if (!state || typeof state !== 'object') return { ok: false, error: 'ip state missing' };
  const times = Array.isArray(state.times) ? state.times : (state.times = []);
  const start = now - windowMs;
  while (times.length && times[0] < start) times.shift();
  if (times.length >= max) {
    return { ok: false, error: 'too many joins from this network', waitMs: Math.max(0, times[0] + windowMs - now) };
  }
  times.push(now);
  return { ok: true };
}

/** Room-wide rate override when busy (Twitch-style slow mode). */
export function roomSlowLimits(count, base) {
  if (count < SLOW_MODE_AT) return base;
  return {
    ...base,
    rateMs: Math.max(base.rateMs, SLOW_MODE_RATE_MS),
    maxPerMin: Math.min(base.maxPerMin, SLOW_MODE_PER_MIN),
    slow: true,
  };
}

export function studioRemixHref(line, { look = 'ticket', format = 'story' } = {}) {
  const text = String(line || '').trim().slice(0, 120);
  if (!text) return '/studio';
  const L = ['ticket', 'poster', 'marquee', 'print', 'signal'].includes(look) ? look : 'ticket';
  const F = ['story', 'square', 'banner'].includes(format) ? format : 'story';
  return `/studio#look=${L}&format=${F}&line=${encodeURIComponent(text)}`;
}

/**
 * Sliding spam counter. Mutates state = { times: number[] }.
 * Returns { spike: boolean } when threshold crossed.
 */
export function noteSpamHit(state, now = Date.now()) {
  if (!state || typeof state !== 'object') return { spike: false };
  const times = Array.isArray(state.times) ? state.times : (state.times = []);
  times.push(now);
  const start = now - SPAM_SPIKE_WINDOW_MS;
  while (times.length && times[0] < start) times.shift();
  return { spike: times.length >= SPAM_SPIKE_HITS, hits: times.length };
}

export function urlsIn(text) {
  return [...String(text).matchAll(URL_RE)].map(m => m[0]);
}

export function linkOk(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (!LINK_ALLOW.has(host)) return false;
    const path = u.pathname.replace(/\/$/, '');
    const exactParams = expected => Object.keys(expected).length === [...u.searchParams.keys()].length && Object.entries(expected).every(([key, value]) => u.searchParams.getAll(key).length === 1 && u.searchParams.get(key) === value);
    if (host === 'jup.ag') return path === '/swap' && exactParams({ sell: WSOL, buy: MINT });
    if (host === 'pump.fun' || host === 'www.pump.fun') return !u.search && path === `/coin/${MINT}`;
    if (host === 'phantom.com' || host === 'www.phantom.com') return !u.search && path === `/tokens/solana/${MINT}`;
    if (host === 'raydium.io' || host === 'www.raydium.io') return path === '/swap' && exactParams({ inputMint: 'sol', outputMint: MINT });
    if (host === 'dexscreener.com') return !u.search && path.toLowerCase() === `/solana/${PAIR}`.toLowerCase();
    if (host === 'www.geckoterminal.com') return !u.search && path.toLowerCase() === `/solana/pools/${PAIR}`.toLowerCase();
    if (host === 'solscan.io') return !u.search && path === `/token/${MINT}`;
    if (host === 'rugcheck.xyz') return !u.search && path === `/tokens/${MINT}`;
    return true;
  } catch {
    return false;
  }
}

export function isCapsSpam(text) {
  const letters = [...text].filter(ch => /\p{L}/u.test(ch));
  if (letters.length < 12) return false;
  const upper = letters.filter(ch => ch === ch.toUpperCase() && ch !== ch.toLowerCase()).length;
  return upper / letters.length >= 0.72;
}

export function validateMessage(raw, { maxText = MAX_TEXT } = {}) {
  const text = cleanText(raw, maxText);
  if (!text) return { ok: false, error: `message empty or too long (max ${maxText})` };
  if (SCAM.test(text)) return { ok: false, error: 'message blocked by automod' };
  if (isCapsSpam(text)) return { ok: false, error: 'ease up on the caps' };
  for (const url of urlsIn(text)) {
    if (!linkOk(url)) return { ok: false, error: 'only allowlisted exact-mint https links' };
  }
  if (/\b(t\.me\/|discord\.gg\/|discord\.com\/invite)/i.test(text)) {
    return { ok: false, error: 'message blocked by automod' };
  }
  return { ok: true, text };
}

/**
 * Sliding-window rate check. Mutates `state` = { lastMs, times: number[], lastText?, lastTextMs? }.
 * Optional overrides for X-linked privileges.
 */
export function checkRate(state, now = Date.now(), { rateMs = RATE_MS, maxPerMin = MAX_PER_MIN } = {}) {
  if (!state || typeof state !== 'object') return { ok: false, error: 'rate state missing' };
  const times = Array.isArray(state.times) ? state.times : (state.times = []);
  const last = Number(state.lastMs) || 0;
  if (now - last < rateMs) {
    return { ok: false, error: 'slow down', waitMs: rateMs - (now - last) };
  }
  const windowStart = now - 60_000;
  while (times.length && times[0] < windowStart) times.shift();
  if (times.length >= maxPerMin) {
    return { ok: false, error: 'rate limit', waitMs: Math.max(0, times[0] + 60_000 - now) };
  }
  state.lastMs = now;
  times.push(now);
  return { ok: true };
}

/** Reject identical message repeated inside REPEAT_WINDOW_MS. Call after checkRate. */
export function checkRepeat(state, text, now = Date.now()) {
  if (!state || typeof state !== 'object') return { ok: false, error: 'rate state missing' };
  const prev = typeof state.lastText === 'string' ? state.lastText : '';
  const prevMs = Number(state.lastTextMs) || 0;
  if (prev && prev === text && now - prevMs < REPEAT_WINDOW_MS) {
    return { ok: false, error: 'duplicate message', waitMs: REPEAT_WINDOW_MS - (now - prevMs) };
  }
  state.lastText = text;
  state.lastTextMs = now;
  return { ok: true };
}

export function nickTaken(nicksMap, nick, selfId) {
  const want = String(nick).toLowerCase();
  for (const [id, n] of nicksMap) {
    if (id === selfId) continue;
    if (String(n).toLowerCase() === want) return true;
  }
  return false;
}

export function pruneHistory(list, now = Date.now()) {
  const cutoff = now - HISTORY_TTL_MS;
  let out = (list || []).filter(m => m && typeof m.ts === 'number' && m.ts >= cutoff);
  if (out.length > MAX_HISTORY) out = out.slice(-MAX_HISTORY);
  return out;
}

/** Avatar URLs accepted in public chat (X CDN only). */
export function avatarOk(url) {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:' || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    return h === 'pbs.twimg.com' || h.endsWith('.twimg.com');
  } catch {
    return false;
  }
}

export function publicMessage({ id, nick, text, ts, linked, handle, avatar, holder }) {
  const base = { type: 'chat', id, nick, text, ts };
  if (linked && handle) {
    base.linked = true;
    base.handle = handle;
    if (avatar && avatarOk(avatar)) base.avatar = String(avatar).slice(0, 300);
    if (holder) base.holder = true;
  }
  return Object.freeze(base);
}

export function parseClientFrame(raw, { maxText = MAX_TEXT, linked = false, forceNick = null } = {}) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return { ok: false, error: 'invalid json' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'invalid frame' };
  const type = data.type;
  if (type === 'hello') {
    if (forceNick) {
      const nick = validateNick(forceNick, { allowAtHandle: true });
      if (!nick.ok) return nick;
      return { ok: true, type: 'hello', nick: nick.nick, linked: true };
    }
    const nick = validateNick(data.nick, { allowAtHandle: false });
    if (!nick.ok) return nick;
    return { ok: true, type: 'hello', nick: nick.nick, linked: false };
  }
  if (type === 'chat') {
    const msg = validateMessage(data.text, { maxText });
    if (!msg.ok) return msg;
    return { ok: true, type: 'chat', text: msg.text };
  }
  if (type === 'ping') return { ok: true, type: 'ping' };
  return { ok: false, error: 'unknown type' };
}

export function originAllowed(origin, allowedCsv) {
  if (!allowedCsv) return false;
  if (!origin) return false;
  const set = new Set(String(allowedCsv).split(',').map(s => s.trim()).filter(Boolean));
  return set.has(origin);
}

/** Split text into plain + allowlisted link segments for safe client render. */
export function linkifySegments(text) {
  const s = String(text || '');
  const out = [];
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    const url = m[0];
    const i = m.index ?? 0;
    if (i > last) out.push({ type: 'text', value: s.slice(last, i) });
    if (linkOk(url)) out.push({ type: 'link', value: url });
    else out.push({ type: 'text', value: url });
    last = i + url.length;
  }
  if (last < s.length) out.push({ type: 'text', value: s.slice(last) });
  if (!out.length) out.push({ type: 'text', value: s });
  return out;
}
