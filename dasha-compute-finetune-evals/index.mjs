/**
 * dasha-compute-finetune-evals/ — pluggable evaluation definitions.
 *
 * Each eval is { id, description, prompts: [{ id, prompt, judge }] } where
 * judge is { type: 'exact', answers: [...] } or { type: 'regex', pattern }.
 *
 * Design notes (from the academic survey):
 * - Retention probes are GENERATIVE (open-ended), not multiple-choice —
 *   multiple-choice alone misses LoRA "intruder dimension" breakage
 *   (Shuttleworth et al., arXiv:2410.21228).
 * - These definitions ship to providers in the kit release; the provider
 *   runs base-vs-adapter on the prompts and reports
 *   { id, base_score, adapter_score, items }. The coordinator validates the
 *   id against this registry and applies the gate in
 *   dasha-compute-finetune-data.mjs (task A/B > retention > perplexity
 *   guardrail > judge advisory).
 * - To add an eval: create a module exporting the def shape, register it in
 *   index.mjs. Judges stay exact/regex — no model calls, no network.
 */
import { retentionGk } from './retention-gk.mjs';
import { taskConciseness } from './task-conciseness.mjs';

export const EVAL_REGISTRY = [retentionGk, taskConciseness];

export function getEval(id) {
  return EVAL_REGISTRY.find((e) => e.id === id) || null;
}

export function listEvals() {
  return EVAL_REGISTRY.map((e) => ({ id: e.id, description: e.description, prompts: e.prompts.length }));
}

export { retentionGk, taskConciseness };
