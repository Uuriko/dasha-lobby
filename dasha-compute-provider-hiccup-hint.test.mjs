#!/usr/bin/env node
/**
 * AX slice: a 502 from a failed provider job must not echo raw exception text
 * ("provider inference failed: RuntimeError") in the hint. The hint is the
 * agent-facing next step: retry, or pick another live model from /models.
 * error.message keeps the diagnostic detail. No wrangler. No plugin.jup.ag.
 * No people-data.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openaiErrorBody } from './dasha-compute-network.mjs';

const src = readFileSync(new URL('./dasha-compute-network.mjs', import.meta.url), 'utf8');
assert.match(src, /provider inference failed/i);
assert.match(src, /Provider hiccup; retry or pick another live model/);
assert.doesNotMatch(src, /plugin\.jup\.ag/);
assert.doesNotMatch(src, /potter[_-]?key|DASHA_POTTER|people-data/i);

const HINT = 'Provider hiccup; retry or pick another live model from /compute/api/v1/models.';

for (const raw of [
  'provider inference failed: RuntimeError',
  'provider inference failed: URLError: The operation couldn’t be completed.',
  'provider inference failed: stream ended before completion',
  'provider cut',
  'empty completion',
]) {
  const body = openaiErrorBody(raw, 502, 'server_error');
  assert.equal(body.error.message, raw, 'error.message keeps the diagnostic');
  assert.equal(body.error.type, 'server_error');
  assert.equal(body.status, 'failed');
  assert.equal(body.reason, raw === 'empty completion' ? 'empty_completion' : 'provider_failed');
  assert.equal(body.hint, HINT, 'hint is the next step, not the raw exception');
  assert.doesNotMatch(body.hint, /RuntimeError|URLError|provider inference failed|empty completion|provider cut/i);
  assert.equal(body.next[0].path, '/compute/api/v1/chat/completions', 'retry first');
  assert.equal(body.next[1].path, '/compute/api/v1/models', 'then live models');
}

console.log('dasha-compute-provider-hiccup-hint: PASS');
