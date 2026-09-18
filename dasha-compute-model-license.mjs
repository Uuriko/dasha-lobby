/**
 * Compute model license ladder — advertise only after commercial-serve is clear.
 *
 * Bench → license clear → Provide advertise → Ask route.
 * Held / unknown never enter models_available, /v1/models, or Provide allow-lists.
 * Fail closed: missing row is unknown, not cleared.
 *
 * Do not invent Darkbloom / Qwen 3.8 agreement outcomes. Held means hold.
 */
export const LICENSE_CLEARED = 'cleared';
export const LICENSE_HELD = 'held';
export const LICENSE_UNKNOWN = 'unknown';

/** Community MLX/Qwen 3.8-class ids that stay off Ask/Provide until a commercial-serve grant is explicit. */
export const HELD_COMMUNITY_MODELS = Object.freeze(['qwen3.8-flash', 'qwen3-8-flash', 'Qwen3.8-Flash']);

/**
 * Live catalog commercial-serve status. Existing getdasha.com/compute ids stay cleared
 * (already advertised). New community weights start held/unknown until a human marks cleared.
 */
export const MODEL_LICENSE = Object.freeze({
  'qwen3-4b': { status: LICENSE_CLEARED, license: 'Apache-2.0', note: 'Alibaba Qwen3 Apache-2.0' },
  'qwen3-8b': { status: LICENSE_CLEARED, license: 'Apache-2.0', note: 'Alibaba Qwen3 Apache-2.0' },
  'qwen3-30b-a3b': { status: LICENSE_CLEARED, license: 'Apache-2.0', note: 'Alibaba Qwen3 Apache-2.0' },
  'gemma3-12b': { status: LICENSE_CLEARED, license: 'Gemma', note: 'Gemma Terms — serving allowed with use-policy' },
  'gemma3-27b': { status: LICENSE_CLEARED, license: 'Gemma', note: 'Gemma Terms — serving allowed with use-policy' },
  'gpt-oss-20b': { status: LICENSE_CLEARED, license: 'Apache-2.0', note: 'OpenAI gpt-oss Apache-2.0' },
  'gpt-oss-120b': { status: LICENSE_CLEARED, license: 'Apache-2.0', note: 'OpenAI gpt-oss Apache-2.0' },
  'ternary-bonsai-2-27b': { status: LICENSE_CLEARED, license: 'community', note: 'Already on the live catalog; hold only if a later grant is withdrawn' },
  'qwen3.8-flash': { status: LICENSE_HELD, license: 'commercial-serve pending', note: 'Community bench only until a commercial-serve agreement is explicit' },
  'qwen3-8-flash': { status: LICENSE_HELD, license: 'commercial-serve pending', note: 'Alias of qwen3.8-flash — held' },
  'Qwen3.8-Flash': { status: LICENSE_HELD, license: 'commercial-serve pending', note: 'Display alias — held' },
});

export function normalizeModelId(id) {
  return String(id || '').trim();
}

export function modelLicenseStatus(id) {
  const key = normalizeModelId(id);
  if (!key) return LICENSE_UNKNOWN;
  if (HELD_COMMUNITY_MODELS.includes(key)) return LICENSE_HELD;
  const row = MODEL_LICENSE[key];
  if (!row) return LICENSE_UNKNOWN;
  if (row.status === LICENSE_CLEARED || row.status === LICENSE_HELD) return row.status;
  return LICENSE_UNKNOWN;
}

/** Public Ask / Provide / network advertise. Unknown and held stay off. */
export function canAdvertiseModel(id) {
  return modelLicenseStatus(id) === LICENSE_CLEARED;
}

export function filterAdvertisableModels(ids = []) {
  return [...new Set((Array.isArray(ids) ? ids : []).map(normalizeModelId).filter(Boolean))].filter(canAdvertiseModel);
}
