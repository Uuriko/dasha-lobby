#!/usr/bin/env node
/**
 * llms.txt sig-encoding drift fix (Sep 29 2026): the live chain encodes
 * receipt/head/checkpoint sigs base64 (88-char padded, verified live), not
 * hex. The spec text must say so - both packet copies in dasha-compute-agent,
 * the proof.json descriptor in dasha-compute-network, and the heads comment.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const agent = readFileSync(join(root, 'dasha-compute-agent.mjs'), 'utf8');
const network = readFileSync(join(root, 'dasha-compute-network.mjs'), 'utf8');
const heads = readFileSync(join(root, 'dasha-compute-heads.mjs'), 'utf8');

const verifyLine = "receipt.sig = base64 ed25519 signature over the UTF-8 bytes of that hex string";
assert.equal(agent.split(verifyLine).length - 1, 2, 'both packet copies state base64 receipt sig');
assert.ok(agent.includes('sig = base64 ed25519 signature over the note text'), 'checkpoint line states base64');
assert.ok(!agent.includes('receipt.sig = ed25519 over'), 'old hex-ambiguous wording gone');
assert.ok(network.includes('checkpoint.sig = base64 ed25519 signature over the UTF-8 bytes of checkpoint.text'), 'proof.json descriptor states base64');
assert.ok(heads.includes('wire-encoded base64'), 'heads comment notes wire encoding');

console.log('dasha-compute-llms-sig-encoding: PASS (receipt + checkpoint + descriptor + comment all state base64 wire encoding)');
