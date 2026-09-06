#!/usr/bin/env node
/**
 * Compute honesty panel — post-Start live /network + /factory strip.
 * Honest zeros; no fake Macs; Prefer MLX stays on Provide only.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPUTE_PAGE_HTML } from './dasha-compute-page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, 'dasha-compute.html'), 'utf8');
assert.equal(html, COMPUTE_PAGE_HTML, 'html ↔ page.mjs sync');

assert.match(html, /id=["']honesty-panel["']/);
assert.match(html, /id=["']honesty-hosted["'][^>]*>Hosted · live</);
assert.match(html, /id=["']honesty-macs["'][^>]*>No Mac online</);
assert.match(html, /id=["']honesty-settled["'][^>]*>0 tok · 24h</);
assert.match(html, /data-honesty=["']live["']/);
assert.match(html, /aria-live=["']polite["']/);
assert.match(html, /id=["']honesty-panel["'][^>]*\bhidden\b/);

const gate = html.slice(html.indexOf('id="step-gate"'), html.indexOf('id="step-how"'));
assert.match(gate, /Start\./);
assert.doesNotMatch(gate, /honesty-panel|honesty-macs|Hosted · live/);

assert.match(html, /\/compute\/api\/network/);
assert.match(html, /\/compute\/api\/factory/);
assert.match(html, /function paintHonestyPanel\(/);
assert.match(html, /function refreshHonesty\(/);
assert.match(html, /startHonestyPoll/);
assert.match(html, /api\(['"]\/compute\/api\/network['"]\)/);
assert.match(html, /api\(['"]\/compute\/api\/factory['"]\)/);

assert.match(html, /No Mac online/);
assert.match(html, /n\+' online'/);
assert.match(html, /online · ~'\+tpsLabel\+' tok\/s/);
assert.match(html, /measured_providers/);
assert.match(html, /mp>=1&&Number\.isFinite\(tps\)&&tps>0/);
assert.match(html, /never invent\/pad/);
assert.match(html, /Hosted · live/);
assert.match(html, /Hosted · —/);
assert.match(html, /0 tok · 24h/);
assert.match(html, /tok\/s measured/);

assert.match(html, /if\(step===['"]gate['"]\)\{clearHonestyPoll\(\);paintHonestyPanel\(\)\}/);
assert.match(html, /else\{paintHonestyPanel\(\);startHonestyPoll\(\)\}/);

const panelStart = html.indexOf('id="honesty-panel"');
const panel = html.slice(panelStart, html.indexOf('</aside>', panelStart) + 8);
assert.doesNotMatch(panel, /Prefer MLX|provide-prefer-mlx/);
assert.match(html, /id=["']provide-prefer-mlx["'][^>]*>Prefer MLX when you can/);

assert.doesNotMatch(html, /~12 Macs|12 Macs online|fake sparkline|plugin\.jup\.ag/i);
assert.doesNotMatch(html, /network warming up|join our waitlist|alpha may be empty/i);

assert.match(html, /id=["']settled-24h["']/);
assert.match(html, /id=["']night-q["'][^>]*>No Mac online\.</);
assert.match(html, /paintSettled24h[\s\S]*?paintHonestyPanel\(\)/);

console.log('dasha-compute-honesty-panel: PASS');
