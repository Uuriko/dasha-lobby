#!/usr/bin/env node
/**
 * Sep 15 live defect: Compare models expanded with headers but ZERO data rows
 * while the same page showed 1 online + four model chips - the table could sit
 * silently empty (models API hiccup) and contradict its own copy.
 * Pins: rows from /v1/models, fallback rows from /compute/api/network capacity
 * when the model list is empty or unreachable, honest named empty states,
 * filter behavior, and the page embed parity (disk == page.mjs).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const html = readFileSync(new URL('./dasha-compute.html', import.meta.url), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'disk == embedded page (page.mjs regenerated from dasha-compute.html)');

// Compile every inline script so a syntax slip fails here, not in the browser.
for (const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);

// Slice the market functions and exercise them against a minimal DOM.
const start = html.indexOf('let marketData=');
const end = html.indexOf("$('market-toggle').addEventListener(");
assert.ok(start > 0 && end > start, 'market block located');
const src = html.slice(start, end);

function el(tag) {
  return {
    tag, children: [], textContent: '', className: '', colSpan: 0, value: '', hidden: false,
    append(...kids) { this.children.push(...kids); },
    replaceChildren(...kids) { this.children = kids; },
    addEventListener() {}, setAttribute() {},
  };
}
function rowText(tr) { return tr.children.map((c) => c.textContent).join(' | '); }

async function runCase({ modelsRes, capacity, filter = '' }) {
  const byId = { 'market-rows': el('tbody'), 'market-filter': el('input'), 'model': null, 'market': null, 'prompt': null };
  byId['market-filter'].value = filter;
  const context = vm.createContext({
    document: { createElement: el },
    $: (id) => byId[id] || null,
    fetch: modelsRes,
    networkCapacity: capacity,
  });
  vm.runInContext(src + '\nthis.__load=loadMarket;this.__paint=paintMarket;', context);
  await vm.runInContext('this.__load()', context);
  return byId['market-rows'].children;
}

// 1. Happy path: models API paints real rows.
let rows = await runCase({
  modelsRes: async () => ({ ok: true, json: async () => ({ data: [
    { id: 'qwen3-4b', pricing: { request: '0.05' }, measured_tok_per_sec: 46.53, providers_online: 1 },
  ] }) }),
  capacity: [{ model: 'qwen3-4b', tokens_per_second: 46.53, providers: 1 }],
});
assert.equal(rows.length, 1, 'one row per model');
assert.match(rowText(rows[0]), /qwen3-4b \| \$0\.05 \| 46\.53 \| 1/, 'row carries model, price, tok/s, Macs');

// 2. Models API down + Macs advertising: fallback rows from network capacity.
rows = await runCase({
  modelsRes: async () => { throw new Error('net down'); },
  capacity: [
    { model: 'qwen3-4b', tokens_per_second: 46.53, providers: 1 },
    { model: 'gemma3-27b', tokens_per_second: 6.64, providers: 1 },
  ],
});
assert.equal(rows.length, 2, 'fallback paints capacity rows');
assert.match(rowText(rows[1]), /gemma3-27b \| - \| 6\.64 \| 1/, 'fallback row honest on unknown price');

// 3. Models API down + nothing online: named state, never silent blank.
rows = await runCase({ modelsRes: async () => { throw new Error('net down'); }, capacity: [] });
assert.equal(rows.length, 1, 'one state row');
assert.match(rowText(rows[0]), /Model list unreachable/, 'unreachable named, with retry hint');
assert.match(rowText(rows[0]), /reopen Compare models to retry/);

// 4. Models API empty + nothing online: the copy stays true.
rows = await runCase({ modelsRes: async () => ({ ok: true, json: async () => ({ data: [] }) }), capacity: [] });
assert.equal(rows.length, 1);
assert.match(rowText(rows[0]), /Nothing online right now\./);

// 5. Filter with no match: named state, not blank.
rows = await runCase({
  modelsRes: async () => ({ ok: true, json: async () => ({ data: [
    { id: 'qwen3-4b', pricing: { request: '0.05' }, measured_tok_per_sec: 46.53, providers: 1 },
  ] }) }),
  capacity: [{ model: 'qwen3-4b', tokens_per_second: 46.53, providers: 1 }],
  filter: 'zzz',
});
assert.equal(rows.length, 1);
assert.match(rowText(rows[0]), /No models match that filter\./);

// Static pins: the failure mode and its fix.
assert.match(html, /marketError/, 'error state tracked');
assert.match(html, /Fallback: model list empty\/unreachable/);
assert.match(html, /Live from \/compute\/api\/network \+ \/compute\/api\/v1\/models\. No rows means nothing online\./);

console.log('dasha-compute-market-table: ok');
