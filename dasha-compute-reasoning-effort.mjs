/**
 * Compute chat reasoning_effort (alias effort).
 * Steal SWE-2 *behavior*, not weights: accept low|medium|high,
 * honor Hosted (Workers AI knob), Community/Ollama may ignore — honesty, no fake think.
 * OpenAI-compat extras live on `dasha` / receipt / X-Dasha-Effort*.
 */

export const REASONING_EFFORTS = Object.freeze(['low', 'medium', 'high']);
export const REASONING_EFFORT_ERROR = 'effort must be low, medium, or high';
export const REASONING_EFFORT_CONFLICT = 'effort conflict';

export const HOSTED_EFFORT_NOTE = 'Hosted applied effort.';
export const COMMUNITY_EFFORT_NOTE = 'Community ignored effort.';

/** OpenAI-style names that already map onto low|medium|high. */
const EFFORT_ALIASES = Object.freeze({
  low: 'low',
  medium: 'medium',
  high: 'high',
});

export function canonicalizeReasoningEffort(raw) {
  if (raw == null) return { present: false, effort: null };
  if (typeof raw === 'object') return { present: true, effort: null, error: REASONING_EFFORT_ERROR };
  const key = String(raw).trim().toLowerCase();
  if (!key) return { present: true, effort: null, error: REASONING_EFFORT_ERROR };
  const effort = EFFORT_ALIASES[key];
  if (!effort) return { present: true, effort: null, error: REASONING_EFFORT_ERROR };
  return { present: true, effort };
}

function collectEffortSources(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [];
  const sources = [];
  if (Object.prototype.hasOwnProperty.call(input, 'reasoning_effort')) {
    sources.push(canonicalizeReasoningEffort(input.reasoning_effort));
  }
  if (Object.prototype.hasOwnProperty.call(input, 'effort')) {
    sources.push(canonicalizeReasoningEffort(input.effort));
  }
  const nested = input.reasoning;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)
      && Object.prototype.hasOwnProperty.call(nested, 'effort')) {
    sources.push(canonicalizeReasoningEffort(nested.effort));
  }
  return sources;
}

/** Parse body. Missing → null. Bad value / conflict → short 400. */
export function parseReasoningEffort(input) {
  const sources = collectEffortSources(input).filter((row) => row.present);
  if (!sources.length) return { ok: true, effort: null };
  for (const row of sources) {
    if (row.error) return { ok: false, error: row.error };
  }
  const unique = [...new Set(sources.map((row) => row.effort))];
  if (unique.length !== 1) return { ok: false, error: REASONING_EFFORT_CONFLICT };
  return { ok: true, effort: unique[0] };
}

export function isCommunityEffortRoute(route) {
  const r = String(route || '').trim().toLowerCase();
  return r === 'community' || r === 'mixture' || r === 'self';
}

/** Hosted honors the knob. Community/Mac/Ollama ignore — never fake longer thinking. */
export function effortHonesty({ effort, route } = {}) {
  if (!REASONING_EFFORTS.includes(effort)) return null;
  if (isCommunityEffortRoute(route)) {
    return { effort, effort_applied: false, note: COMMUNITY_EFFORT_NOTE };
  }
  return { effort, effort_applied: true, note: HOSTED_EFFORT_NOTE };
}

export function effortHonestyFromJob(job) {
  const effort = String(job?.effort || '').trim();
  if (!REASONING_EFFORTS.includes(effort)) return null;
  const route = String(job?.route || '').trim();
  const engine = String(job?.engine || '').trim();
  if (engine === 'hosted' && !isCommunityEffortRoute(route)) {
    return effortHonesty({ effort, route: 'hosted' });
  }
  return effortHonesty({ effort, route: route || 'community' });
}

/** Non-breaking OpenAI extension. Unknown fields stay off the OpenAI core object. */
export function dashaEffortExtension(honesty) {
  if (!honesty) return {};
  return {
    dasha: {
      effort: honesty.effort,
      effort_applied: honesty.effort_applied,
      note: honesty.note,
    },
  };
}

export function attachEffortToReceipt(receipt, honesty) {
  if (!receipt || !honesty) return receipt;
  return {
    ...receipt,
    effort: honesty.effort,
    effort_applied: honesty.effort_applied,
    note: honesty.note,
  };
}

/** Workers AI gpt-oss-20b already takes reasoning_effort on inputs. */
export function hostedReasoningEffortInput(effort) {
  if (!REASONING_EFFORTS.includes(effort)) return {};
  return { reasoning_effort: effort };
}

export function effortResponseHeaders(honesty) {
  if (!honesty) return {};
  return {
    'X-Dasha-Effort': honesty.effort,
    'X-Dasha-Effort-Applied': honesty.effort_applied ? '1' : '0',
  };
}

export function hostedEffortFace(honesty) {
  if (!honesty) return {};
  return {
    effort: honesty.effort,
    effort_applied: honesty.effort_applied,
    note: honesty.note,
  };
}
