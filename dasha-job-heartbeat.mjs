/**
 * Lobby alarm heartbeat. DashaLobby's 5-minute alarm is getdasha's only
 * scheduled job (history/mute pruning, chess clocks, compute job expiry and
 * Night Shift). It used to re-arm only on success: one throw and the chain could
 * stop silently. Now the alarm always re-arms and records lastSuccessAt /
 * lastError here; GET /compute/api/health/jobs reads it (no secrets).
 */
export const LOBBY_ALARM_HEARTBEAT_KEY = 'jobs:lobby-alarm:v1';
export const LOBBY_ALARM_PERIOD_SECONDS = 300;
export const JOB_STALE_PERIODS = 3;

export function isJobHealthPath(path) {
  return path === '/compute/api/health/jobs' || path === '/compute/api/health/jobs/';
}

export function redactJobError(value) {
  const text = String(value ?? 'unknown error')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\b(bearer|token|secret|password|authorization|key)(\s*[:=]?\s*)\S+/gi, '$1$2[redacted]')
    .replace(/(https?:\/\/[^\s?#]+)[?#]\S*/g, '$1')
    .replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, '[redacted]')
    .trim();
  return text.length > 240 ? `${text.slice(0, 239)}…` : text;
}

export function nextAlarmHeartbeat(previous, { ok, at, error = null, durationMs = null }) {
  const prior = previous && typeof previous === 'object' ? previous : {};
  return ok
    ? { ...prior, lastRunAt: at, lastSuccessAt: at, consecutiveFailures: 0, lastDurationMs: durationMs }
    : { ...prior, lastRunAt: at, lastErrorAt: at, lastError: redactJobError(error), consecutiveFailures: (prior.consecutiveFailures || 0) + 1, lastDurationMs: durationMs };
}

const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);

export function jobHealthBody(record, now = Date.now()) {
  const r = record && typeof record === 'object' ? record : {};
  const staleAfterSeconds = LOBBY_ALARM_PERIOD_SECONDS * JOB_STALE_PERIODS;
  const secondsSinceSuccess = Number.isFinite(r.lastSuccessAt) ? Math.max(0, Math.round((now - r.lastSuccessAt) / 1000)) : null;
  const stale = secondsSinceSuccess === null || secondsSinceSuccess > staleAfterSeconds;
  const failing = (r.consecutiveFailures || 0) > 0;
  const job = {
    name: 'lobby-alarm',
    periodSeconds: LOBBY_ALARM_PERIOD_SECONDS,
    staleAfterSeconds,
    lastRunAt: iso(r.lastRunAt),
    lastSuccessAt: iso(r.lastSuccessAt),
    secondsSinceSuccess,
    lastError: r.lastError || null,
    lastErrorAt: iso(r.lastErrorAt),
    consecutiveFailures: r.consecutiveFailures || 0,
    stale,
    status: stale ? 'stale' : failing ? 'failing' : 'ok',
  };
  return { schema: 'dasha.job-health/1', status: job.status, generatedAt: iso(now), staleAfterPeriods: JOB_STALE_PERIODS, jobs: [job] };
}
