/**
 * Forum threads and replies: the long-form door onto the same room the chat already guards.
 *
 * Every rule here is the chat's rule. validateMessage is imported rather than reimplemented,
 * because a second copy of the automod is a second thing to keep in sync, and the moment the two
 * disagree the forum becomes the way around the chat — post the scam link through the door that
 * forgot to check. The only thing this file changes is the length cap: the forum exists to be
 * long-form, so it raises maxText and leaves the scam patterns, the caps rule and the link
 * allowlist exactly where they are.
 *
 * Identity is never read from the request body. The worker owns sessions; these functions take a
 * handle that the worker has already proven and refuse anything without one.
 *
 * Pure logic: no storage, no network. The worker persists what these return.
 */
import { MAX_TEXT, validateMessage } from './dasha-lobby-mod.mjs';

export const MAX_TITLE = 80;
/* Long-form, but still one screen of reading. The test asserts this exceeds chat's cap — if it
   ever stops doing so the forum has no reason to exist as a separate surface. */
export const MAX_POST = 2000;
/* A Durable Object storage value caps at 128 KiB, and a thread is stored as one value. At the
   2000-character post cap a post serialises to roughly 2.2 KB once handle, avatar URL and JSON
   overhead are counted, so 50 is the largest round number that still fits a thread of entirely
   maximum-length posts inside one key with headroom. THREAD_BYTES_MAX below enforces it for real
   rather than trusting this arithmetic. */
export const MAX_POSTS = 50;
/* Refuse a write before it reaches storage. The per-post cap bounds text but not handle or avatar
   length, so the arithmetic above is a design target, not a guarantee. */
export const THREAD_BYTES_MAX = 120 * 1024;
export const MAX_THREADS = 100;
/* Six months. Thirty days would drop the room's memory while people still cite a thread. */
export const THREAD_TTL_MS = 180 * 24 * 60 * 60 * 1000;
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const REPORT_REASONS = ['scam', 'spam', 'harassment', 'off-topic'];
/* In-thread quote, not a nested tree. A snippet is enough to show what was answered. */
export const QUOTE_SNIP = 140;
/* Bounded opener preview kept on the index so the thread list and search can see a little body
   without turning search into a per-thread storage scan. Never the full post. */
export const SNIPPET_MAX = 180;
/* ponytail: keep one bounded reactor list on each post; move reactions to their own storage key if
   a real post reaches 50 distinct linked accounts. */
export const MAX_REACTORS = 50;
export const MUTED_ERROR = 'this X session is muted — not the person';

/** Chat's limits, surfaced so the relationship between the two surfaces is assertable. */
export const FORUM_LIMITS = { CHAT_MAX_TEXT: MAX_TEXT, FORUM_MAX_TEXT: MAX_POST, MAX_TITLE };

/**
 * A title is one line. Newlines are collapsed before validation, not rejected: a thread list shows
 * one row per thread, so a title carrying a newline would render its first line and silently hide
 * the rest — which is a way to make a row read as something it is not.
 */
export function validateTitle(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'title required' };
  const flat = raw.replace(/\s+/g, ' ').trim();
  if (!flat) return { ok: false, error: 'title required' };
  const checked = validateMessage(flat, { maxText: MAX_TITLE });
  if (!checked.ok) return checked;
  return { ok: true, title: checked.text };
}

/** A post body. Same automod as chat, longer cap. */
export function validateBody(raw) {
  const checked = validateMessage(raw, { maxText: MAX_POST });
  if (!checked.ok) return checked;
  return { ok: true, text: checked.text };
}

/** Refuse anything the worker could not attribute to a linked session. */
function requireAuthor(handle) {
  return String(handle || '').trim() ? null : { ok: false, error: 'link X to post' };
}

export function newThread({ title, text, handle, avatar = null, holder = false, now, id }) {
  const anon = requireAuthor(handle);
  if (anon) return anon;
  const t = validateTitle(title);
  if (!t.ok) return t;
  const b = validateBody(text);
  if (!b.ok) return b;

  const opener = { id: `${id}-0`, handle, avatar, text: b.text, ts: now };
  if (holder) opener.holder = true;
  const summary = { id, title: t.title, handle, avatar, ts: now, lastTs: now, replies: 0, reactions: 0, snippet: b.text.slice(0, SNIPPET_MAX) };
  if (holder) summary.holder = true;
  return {
    ok: true,
    summary,
    posts: [opener],
  };
}

export function attachQuote(posts, quoteId) {
  if (quoteId == null || quoteId === '') return { ok: true, quote: null };
  const id = String(quoteId).slice(0, 48);
  const src = (Array.isArray(posts) ? posts : []).find((p) => p && p.id === id);
  if (!src || src.deleted) return { ok: false, error: 'quote not found' };
  return {
    ok: true,
    quote: { id: src.id, handle: src.handle, text: String(src.text || '').slice(0, QUOTE_SNIP) },
  };
}

export function addReply(posts, { text, handle, avatar = null, holder = false, now, id, quoteId }) {
  const anon = requireAuthor(handle);
  if (anon) return anon;
  if (!Array.isArray(posts) || !posts.length) return { ok: false, error: 'thread not found' };
  /* Refuse rather than drop the oldest. A thread is a record of what was said; silently evicting
     the opening post would leave replies answering something no longer there. */
  if (posts.length >= MAX_POSTS) return { ok: false, error: 'thread is full' };
  const b = validateBody(text);
  if (!b.ok) return b;
  const quoted = attachQuote(posts, quoteId);
  if (!quoted.ok) return quoted;
  const post = { id, handle, avatar, text: b.text, ts: now };
  if (holder) post.holder = true;
  if (quoted.quote) post.quote = quoted.quote;
  /* Measured, not assumed. A thread is one storage value with a hard 128 KiB ceiling, and a write
     that crosses it fails at the platform — which would lose the post and leave the reply count
     disagreeing with the posts. Refusing here keeps the thread consistent. */
  if (threadBytes([...posts, post]) > THREAD_BYTES_MAX) return { ok: false, error: 'thread is full' };
  return { ok: true, post };
}

/** Title + handle + the bounded opener snippet. Bodies stay out of the index beyond SNIPPET_MAX
    so search stays an index scan, not a 100-thread storage scan. */
export function searchThreads(index, q) {
  const needle = String(q || '').trim().toLowerCase();
  const list = Array.isArray(index) ? index : [];
  if (!needle) return list;
  return list.filter((t) => {
    if (!t) return false;
    const title = String(t.title || '');
    const handle = String(t.handle || '');
    const snippet = String(t.snippet || '');
    if (!`${title} ${handle} ${snippet}`.toLowerCase().includes(needle)) return false;
    return validateMessage(title, { maxText: MAX_TITLE }).ok;
  });
}

export function assertWritable(summary) {
  if (!summary) return { ok: false, error: 'thread not found' };
  if (summary.locked) return { ok: false, error: 'thread is locked' };
  return { ok: true };
}

export function lockThread(summary, { locked }) {
  if (!summary) return { ok: false, error: 'thread not found' };
  return { ok: true, summary: { ...summary, locked: Boolean(locked) } };
}

export function editPost(posts, { id, text, handle, now }) {
  const anon = requireAuthor(handle);
  if (anon) return anon;
  if (!Array.isArray(posts)) return { ok: false, error: 'thread not found' };
  const i = posts.findIndex((p) => p && p.id === id);
  if (i < 0) return { ok: false, error: 'post not found' };
  const post = posts[i];
  if (post.deleted) return { ok: false, error: 'post is gone' };
  if (post.handle !== handle) return { ok: false, error: 'not your post' };
  if (Number(now) - Number(post.ts) > EDIT_WINDOW_MS) return { ok: false, error: 'edit window closed' };
  const b = validateBody(text);
  if (!b.ok) return b;
  const next = { ...post, text: b.text, editedAt: now };
  const copy = posts.slice();
  copy[i] = next;
  if (threadBytes(copy) > THREAD_BYTES_MAX) return { ok: false, error: 'thread is full' };
  return { ok: true, post: next, posts: copy };
}

/** Tombstone a reply. The opener stays — deleting it would leave replies answering nothing. */
export function deletePost(posts, { id, handle }) {
  const anon = requireAuthor(handle);
  if (anon) return anon;
  if (!Array.isArray(posts) || !posts.length) return { ok: false, error: 'thread not found' };
  const i = posts.findIndex((p) => p && p.id === id);
  if (i < 0) return { ok: false, error: 'post not found' };
  const post = posts[i];
  if (post.handle !== handle) return { ok: false, error: 'not your post' };
  if (post.deleted) return { ok: false, error: 'post is gone' };
  if (i === 0) return { ok: false, error: 'cannot delete the opening post' };
  const { reactors: _reactors, ...kept } = post;
  const next = { ...kept, text: '', deleted: true };
  const copy = posts.slice();
  copy[i] = next;
  return { ok: true, post: next, posts: copy };
}

/** One score-neutral heart per linked X account. Reactor identities stay out of publicPost. */
export function toggleReaction(posts, { id, xId, active }) {
  const subject = String(xId || '');
  if (!subject || subject.length > 64) return { ok: false, error: 'link X to react' };
  if (!Array.isArray(posts)) return { ok: false, error: 'thread not found' };
  const i = posts.findIndex((p) => p && p.id === id);
  if (i < 0) return { ok: false, error: 'post not found' };
  const post = posts[i];
  if (post.deleted) return { ok: false, error: 'post is gone' };
  const reactors = [...new Set((Array.isArray(post.reactors) ? post.reactors : [])
    .filter((value) => typeof value === 'string' && value.length <= 64))].slice(0, MAX_REACTORS);
  const had = reactors.includes(subject);
  if (active !== false && !had) {
    if (reactors.length >= MAX_REACTORS) return { ok: false, error: 'reaction limit reached' };
    reactors.push(subject);
  } else if (active === false && had) reactors.splice(reactors.indexOf(subject), 1);
  const { reactors: _old, ...kept } = post;
  const next = reactors.length ? { ...kept, reactors } : kept;
  const copy = posts.slice();
  copy[i] = next;
  if (threadBytes(copy) > THREAD_BYTES_MAX) return { ok: false, error: 'thread is full' };
  return { ok: true, posts: copy, reactionCount: reactors.length, reacted: reactors.includes(subject) };
}

export function validateReport(reason) {
  const r = String(reason || '').trim();
  if (!REPORT_REASONS.includes(r)) return { ok: false, error: 'bad report reason' };
  return { ok: true, reason: r };
}

/** Serialised size of a thread's posts, as storage will see it. */
export function threadBytes(posts) {
  return new TextEncoder().encode(JSON.stringify(posts)).length;
}

/** Newest activity first, stale threads dropped, length bounded. */
export function pruneIndex(index, now) {
  return (Array.isArray(index) ? index : [])
    .filter((t) => t && Number(now) - Number(t.lastTs ?? t.ts) <= THREAD_TTL_MS)
    .sort((a, b) => Number(b.lastTs ?? b.ts) - Number(a.lastTs ?? a.ts))
    .slice(0, MAX_THREADS);
}

/** Keyset pagination over the already-newest-first index. The cursor is the id of the last row the
    caller saw; the next page starts just after it. No offset, so a reply written between pages can't
    push a row into or out of view the way a naive offset page would. */
export function paginateIndex(index, { cursor = '', limit = 50 } = {}) {
  const list = Array.isArray(index) ? index : [];
  const lim = Math.max(1, Math.min(50, Number(limit) || 50));
  let start = 0;
  if (cursor) {
    const i = list.findIndex((t) => t && t.id === cursor);
    if (i >= 0) start = i + 1;
  }
  const threads = list.slice(start, start + lim);
  const next = start + lim < list.length ? (threads[threads.length - 1]?.id ?? null) : null;
  return { threads, next };
}

/** Replies visible to a reader: tombstones keep their slot but are not replies anyone can read.
    The opener is never deleted, so subtract it once and clamp — the count on the thread list must
    match the posts the thread view actually renders. */
export function visibleReplies(posts) {
  const list = Array.isArray(posts) ? posts : [];
  return Math.max(0, list.filter((p) => p && !p.deleted).length - 1);
}

/** Exact public heart total for one bounded thread; deleted posts contribute zero. */
export function threadReactionCount(posts) {
  return (Array.isArray(posts) ? posts : []).reduce((total, post) => total + (post ? publicPost(post).reactionCount : 0), 0);
}

/* Explicit field lists, not a delete-the-secrets pass. Whatever the worker starts storing
   alongside a thread — an IP, a session id, a moderation note — stays server-side by default
   instead of shipping the first time someone adds a field. */
export function publicThread(t) {
  const reactions = Number(t.reactions);
  return {
    id: t.id, title: t.title, handle: t.handle, avatar: t.avatar ?? null,
    ts: t.ts, lastTs: t.lastTs, replies: t.replies ?? 0, locked: Boolean(t.locked),
    reactions: Number.isInteger(reactions) && reactions >= 0 && reactions <= MAX_POSTS * MAX_REACTORS ? reactions : 0,
    snippet: t.snippet ?? null, holder: Boolean(t.holder),
  };
}

export function publicPost(p, xId = '') {
  const reactors = [...new Set((Array.isArray(p.reactors) ? p.reactors : [])
    .filter((value) => typeof value === 'string' && value.length <= 64))].slice(0, MAX_REACTORS);
  const out = {
    id: p.id, handle: p.handle, avatar: p.avatar ?? null,
    text: p.deleted ? '' : p.text, ts: p.ts, holder: Boolean(p.holder),
    reactionCount: p.deleted ? 0 : reactors.length,
    reacted: !p.deleted && Boolean(xId) && reactors.includes(String(xId)),
  };
  if (p.editedAt) out.editedAt = p.editedAt;
  if (p.deleted) out.deleted = true;
  if (!p.deleted && p.quote && p.quote.id) {
    out.quote = {
      id: p.quote.id,
      handle: p.quote.handle,
      text: String(p.quote.text || '').slice(0, QUOTE_SNIP),
    };
  }
  return out;
}
