#!/usr/bin/env node
/**
 * Staleness-repair prep: the tape must show its work.
 * - Server section renders per-row <time datetime> "observed Xm ago".
 * - Section header carries "last refresh …" + a "stale" badge past 3h.
 * - Client remount threads `at`, renders .dd-when, and repaints .dd-fresh.
 * - /how-to-buy supply/top-10 pins are labeled as pinned snapshots with
 *   Solscan verify links (no bare "observed {date}" presented as current).
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT,
  TAPE_STALE_AFTER_MS,
  digestSectionHtml,
  newestItemAt,
  relAge,
} from "./dasha-digest.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const digestSrc = readFileSync(join(root, "dasha-digest.mjs"), "utf8");
const genSrc = readFileSync(join(root, "dasha-lobby-static-gen.mjs"), "utf8");

assert.doesNotMatch(digestSrc, /plugin\.jup\.ag/, "digest must not mention plugin.jup.ag");

// --- relAge unit behavior ---
assert.equal(relAge(new Date(Date.now() - 30_000).toISOString()), "just now");
assert.equal(relAge(new Date(Date.now() - 5 * 60_000).toISOString()), "5m ago");
assert.equal(relAge(new Date(Date.now() - 90 * 60_000).toISOString()), "1h ago");
assert.equal(relAge(new Date(Date.now() - 30 * 3_600_000).toISOString()), "30h ago");
assert.equal(relAge(new Date(Date.now() - 5 * 86_400_000).toISOString()), "5d ago");
assert.equal(relAge("not-a-date"), "");
assert.equal(relAge(""), "");

// --- newestItemAt picks the freshest ---
const fresh = new Date().toISOString();
assert.ok(newestItemAt([{ at: "2026-09-10T00:00:00Z" }, { at: fresh }]) > Date.parse("2026-09-20T00:00:00Z"));
assert.equal(newestItemAt([{ at: "junk" }, {}]), 0);

// --- server-rendered section shows its work ---
{
  const items = [
    { source: "Dexscreener", kind: "tape", title: "$dasha $0.0001911", href: "https://dexscreener.com/solana/x", at: fresh },
    { source: "CoinDesk", kind: "news", title: "Old item", href: "https://example.com/old", at: "2026-09-18T15:16:37Z" },
  ];
  const html = digestSectionHtml(items, {});
  assert.match(html, /<p class="dd-fresh">last refresh [^<]*<\/p>/, "header carries last-refresh line");
  assert.doesNotMatch(html, /<span class="dd-stale">/, "fresh tape earns no stale badge");
  assert.match(html, /<time datetime="[^"]+">observed (just now|\d+[mhd] ago)<\/time>/, "rows carry observed <time>");
  assert.equal((html.match(/class="dd-when"/g) || []).length, 2, "every row with `at` gets a when-span");
}
{
  const items = [
    { source: "CoinDesk", kind: "news", title: "Old item", href: "https://example.com/old", at: "2026-09-10T00:00:00Z" },
  ];
  const html = digestSectionHtml(items, {});
  assert.match(html, /<span class="dd-stale">stale<\/span>/, "old tape earns the stale badge");
  assert.match(html, /last refresh 11d ago/, "header age tracks the newest item");
}
{
  const html = digestSectionHtml([{ source: "X", kind: "news", title: "no at", href: "https://x.com/" }], {});
  assert.doesNotMatch(html, /<span class="dd-when">/, "items without `at` render no when-span");
  assert.doesNotMatch(html, /<p class="dd-fresh">/, "no newest timestamp means no fresh line");
}

// --- client remount preserves timestamps ---
assert.match(digestSrc, /function relAge\(iso\)/, "remount ships client relAge");
assert.match(digestSrc, /function paintFresh\(sec,list\)/, "remount repaints the fresh header");
assert.match(digestSrc, /className='dd-when'/, "remount renders dd-when spans");
assert.match(digestSrc, /out\.push\(\{source:src,title:title,href:href,at:String\(it\.at\|\|''\)\}\)/, "remount threads `at` from digest.json");
assert.match(digestSrc, /at:new Date\(\)\.toISOString\(\)/, "live /price tick gets an observation time");
assert.match(digestSrc, /\{source:r\.source,title:'\$dasha',href:r\.href,at:r\.at\}/, "stale-tick fallback keeps `at`");

// --- /how-to-buy pins are labeled snapshots, not current facts ---
assert.match(genSrc, /pinned 18 Aug 2026/, "how-to-buy labels the snapshot date");
assert.match(genSrc, /solscan\.io\/token\/53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump/, "how-to-buy links Solscan for live verification");
assert.match(genSrc, /#holders/, "how-to-buy links holders for the top-10 figure");
assert.doesNotMatch(genSrc, /999,831,949 · observed 18 Aug 2026/, "supply no longer reads as a current observation");
assert.doesNotMatch(genSrc, /<dt>Top 10 wallets<\/dt><dd>42\.5% of supply<\/dd>/, "top-10 no longer reads as a current fact");

assert.equal(TAPE_STALE_AFTER_MS, 3 * 60 * 60 * 1000, "stale threshold is 3h");

console.log("dasha-digest-tape-timestamps: PASS (observed-at renders server + client; how-to-buy pins labeled)");
