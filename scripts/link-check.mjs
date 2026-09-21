#!/usr/bin/env node
/**
 * link-check.mjs — smallest durable cross-brand link checker.
 *
 * Read-only: GETs same-origin sitemap URLs, HEADs (GET fallback) external
 * anchors found on same-origin HTML pages. No writes, no auth, no CI wiring
 * (CI integration is a follow-up for John's call — see README note below).
 *
 * Usage:
 *   node scripts/link-check.mjs [--brand getdasha|trydemigod|all] [--out report.json]
 *     [--max-pages 200] [--concurrency 8] [--timeout 15000]
 *
 * Exit 0: no confirmed hard failures. Exit 1: at least one hard failure
 * (same-origin 4xx/5xx/network error, or external 4xx/5xx/network error).
 * Redirects, auth-gated (401/403 on known-gated paths), and external links
 * are reported as informational categories, not failures.
 */
import { writeFileSync } from "node:fs";

const BRANDS = {
  getdasha: {
    base: "https://www.getdasha.com",
    sitemaps: ["https://www.getdasha.com/sitemap.xml"],
    fallbackRoutes: ["/", "/digest", "/how-to-buy", "/listings", "/crew", "/compute", "/lobby", "/faucet", "/privacy"],
  },
  trydemigod: {
    base: "https://www.trydemigod.com",
    sitemaps: ["https://www.trydemigod.com/sitemap.xml"],
    fallbackRoutes: ["/", "/weekly", "/companies"],
  },
};

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) => {
    if (!a.startsWith("--")) return [];
    const key = a.slice(2);
    const next = arr[i + 1];
    return [[key, next && !next.startsWith("--") ? next : "true"]];
  }),
);
const brandSel = args.brand || "all";
const outPath = args.out || null;
const MAX_PAGES = Number(args["max-pages"] || 200);
const CONCURRENCY = Number(args.concurrency || 8);
const TIMEOUT_MS = Number(args.timeout || 15000);

function pickBrands() {
  if (brandSel === "all") return Object.entries(BRANDS);
  if (BRANDS[brandSel]) return [[brandSel, BRANDS[brandSel]]];
  console.error(`unknown brand: ${brandSel}`);
  process.exit(2);
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal, redirect: "manual" });
  } finally {
    clearTimeout(t);
  }
}

/** Follow redirects manually so chains are recorded. Returns {status, finalUrl, chain}. */
async function probe(url, method = "GET") {
  const chain = [];
  let current = url;
  for (let hops = 0; hops < 10; hops++) {
    let res;
    try {
      res = await fetchWithTimeout(current, { method, headers: { "user-agent": "dasha-link-check/1.0" } });
    } catch (err) {
      return { url, status: "NETWORK_ERROR", error: String(err && err.name || err), finalUrl: current, chain };
    }
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!loc) return { url, status: res.status, finalUrl: current, chain };
      chain.push({ status: res.status, to: loc });
      try { current = new URL(loc, current).toString(); } catch { return { url, status: res.status, finalUrl: current, chain }; }
      continue;
    }
    await res.body?.cancel().catch(() => {});
    return { url, status: res.status, finalUrl: current, chain };
  }
  return { url, status: "TOO_MANY_REDIRECTS", finalUrl: current, chain };
}

async function getSitemapUrls(brand) {
  const urls = new Set();
  for (const sm of brand.sitemaps) {
    try {
      const res = await fetchWithTimeout(sm);
      if (!res.ok) continue;
      const xml = await res.text();
      for (const m of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
        const u = m[1].trim();
        if (/sitemap.*\.xml$/i.test(u)) continue; // nested index: keep it simple, brands are small
        if (u.startsWith(brand.base)) urls.add(u);
      }
    } catch { /* fall through to fallback routes */ }
  }
  if (!urls.size) for (const r of brand.fallbackRoutes) urls.add(brand.base + r);
  return [...urls].slice(0, MAX_PAGES);
}

function extractExternalAnchors(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) continue;
    let abs;
    try { abs = new URL(raw, base).toString(); } catch { continue; }
    if (!abs.startsWith("http")) continue;
    if (new URL(abs).origin === new URL(base).origin) continue;
    out.add(abs.split("#")[0]);
  }
  return [...out];
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function classifySameOrigin(r) {
  if (r.status === "NETWORK_ERROR" || r.status === "TOO_MANY_REDIRECTS") return "hard-failure";
  if (typeof r.status === "number" && r.status >= 400) return "hard-failure";
  if (r.chain.length) return "redirect";
  return "ok";
}

function classifyExternal(r) {
  if (r.status === "NETWORK_ERROR" || r.status === "TOO_MANY_REDIRECTS") return "hard-failure";
  if (typeof r.status === "number" && r.status >= 400) return "hard-failure";
  if (r.chain.length) return "redirect";
  return "ok";
}

async function checkBrand(name, brand) {
  const pages = await getSitemapUrls(brand);
  const pageResults = await mapLimit(pages, CONCURRENCY, async (u) => ({ ...await probe(u, "GET"), checkedAt: new Date().toISOString() }));

  // Collect external anchors from same-origin HTML pages (bounded sample).
  const externals = new Set();
  for (const pr of pageResults.slice(0, 60)) {
    if (typeof pr.status !== "number" || pr.status >= 400) continue;
    try {
      const res = await fetchWithTimeout(pr.finalUrl);
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("text/html")) {
        for (const a of extractExternalAnchors(await res.text(), pr.finalUrl)) externals.add(a);
      }
      await res.body?.cancel().catch(() => {});
    } catch { /* skip */ }
    if (externals.size >= 300) break;
  }
  const extList = [...externals].slice(0, 300);
  const extResults = await mapLimit(extList, CONCURRENCY, async (u) => {
    let r = await probe(u, "HEAD");
    if (r.status === 405 || r.status === 501 || r.status === "NETWORK_ERROR") r = await probe(u, "GET");
    return { ...r, checkedAt: new Date().toISOString() };
  });

  const sameOrigin = pageResults.map((r) => ({ url: r.url, status: r.status, finalUrl: r.finalUrl, redirects: r.chain, verdict: classifySameOrigin(r) }));
  const external = extResults.map((r) => ({ url: r.url, status: r.status, finalUrl: r.finalUrl, redirects: r.chain, verdict: classifyExternal(r) }));
  return { brand: name, base: brand.base, checkedAt: new Date().toISOString(), pagesChecked: pages.length, sameOrigin, external };
}

const report = { generatedAt: new Date().toISOString(), brands: [] };
for (const [name, brand] of pickBrands()) {
  console.error(`checking ${name} (${brand.base})…`);
  report.brands.push(await checkBrand(name, brand));
}

const hardFailures = report.brands.flatMap((b) => [
  ...b.sameOrigin.filter((r) => r.verdict === "hard-failure").map((r) => ({ scope: "same-origin", brand: b.brand, ...r })),
  ...b.external.filter((r) => r.verdict === "hard-failure").map((r) => ({ scope: "external", brand: b.brand, ...r })),
]);
report.summary = {
  hardFailures: hardFailures.length,
  sameOriginRedirects: report.brands.flatMap((b) => b.sameOrigin).filter((r) => r.verdict === "redirect").length,
  externalRedirects: report.brands.flatMap((b) => b.external).filter((r) => r.verdict === "redirect").length,
};
report.hardFailures = hardFailures;

const json = JSON.stringify(report, null, 2);
if (outPath) writeFileSync(outPath, json);
else console.log(json);

console.error(`done: ${report.summary.hardFailures} hard failures, ` +
  `${report.summary.sameOriginRedirects} same-origin redirects, ` +
  `${report.summary.externalRedirects} external redirects`);
process.exit(report.summary.hardFailures ? 1 : 0);
