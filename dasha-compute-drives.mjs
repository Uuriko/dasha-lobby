/**
 * Compute Drives — the Files layer.
 * R2 workspaces for agent files and memory. Same bearer as Compute (dsk_ or guest dgk_).
 * Works with providers_online=0. Never reports Mac capacity.
 *
 * Binding: DRIVES
 * Bucket: dasha-compute-drives
 * Wrangler: r2_buckets in dasha-lobby-wrangler.jsonc and dasha-lobby-wrangler.deploy.jsonc
 *
 * v0: 8 MiB per object, 1 GiB soft quota per key owner. Unbound R2 fails loud drives_unavailable.
 * Chat jobs do not write here. Put bytes on the Drives API. Snapshots are metadata only.
 */

import { randomUrlToken } from './dasha-lobby-x.mjs';

export const DRIVES_BINDING = 'DRIVES';
export const DRIVES_BUCKET = 'dasha-compute-drives';
export const DRIVE_OBJECT_MAX_BYTES = 8 * 1024 * 1024;
export const DRIVE_QUOTA_BYTES = 1024 * 1024 * 1024;
export const DRIVE_PREFIX = '/compute/api/v1/drives';

const DRIVE_ID_RE = /^drv_[A-Za-z0-9_-]{12}$/;
const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const PATH_SEG_RE = /^[A-Za-z0-9._~-]{1,128}$/;

const SECURITY = {
  'Cache-Control': 'no-store',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function isDriveApiPath(pathname) {
  const path = String(pathname || '');
  return path === DRIVE_PREFIX || path === `${DRIVE_PREFIX}/` || path.startsWith(`${DRIVE_PREFIX}/`);
}

export function r2Ready(bucket) {
  return Boolean(
    bucket
    && typeof bucket.put === 'function'
    && typeof bucket.get === 'function'
    && typeof bucket.delete === 'function'
    && typeof bucket.list === 'function',
  );
}

export function normalizeDriveName(raw) {
  const name = String(raw ?? '').trim().toLowerCase();
  if (!NAME_RE.test(name)) return null;
  return name;
}

/** Relative object path. Rejects empty, traversal, and non-ascii. */
export function normalizeObjectPath(raw) {
  let path = String(raw ?? '');
  try { path = decodeURIComponent(path); } catch { return null; }
  path = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!path || path.length > 512) return null;
  if (path.includes('\\') || path.includes('\0')) return null;
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..' || !PATH_SEG_RE.test(part))) return null;
  return parts.join('/');
}

/** Empty prefix lists the drive. A trailing slash is kept as a directory prefix. */
export function normalizePrefix(raw) {
  if (raw == null || raw === '') return '';
  const prefix = String(raw);
  if (prefix.length > 512 || prefix.includes('\\') || prefix.includes('\0')) return null;
  const stripped = prefix.replace(/\/+$/, '');
  if (!stripped) return null;
  const norm = normalizeObjectPath(stripped);
  if (!norm) return null;
  return prefix.endsWith('/') ? `${norm}/` : norm;
}

export function driveErrorBody(message, httpStatus, reason, hint, next) {
  const type = httpStatus === 401
    ? 'authentication_error'
    : httpStatus >= 500
      ? 'server_error'
      : 'invalid_request_error';
  return {
    error: {
      message,
      type,
      code: reason === 'drives_unavailable' ? 'drives_unavailable' : null,
    },
    status: httpStatus >= 500 ? 'failed' : 'action_required',
    reason,
    hint,
    next,
  };
}

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY, 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

function fail(message, httpStatus, reason, hint, next) {
  return json(driveErrorBody(message, httpStatus, reason, hint, next), httpStatus);
}

function unavailable() {
  return fail(
    'Drives storage is not bound.',
    503,
    'drives_unavailable',
    'Bind R2 as DRIVES. Drives do not need a Mac.',
    [
      { path: '/compute/api/v1/drives' },
      { path: '/compute/skill.md' },
      { command: 'r2_buckets binding DRIVES bucket dasha-compute-drives' },
    ],
  );
}

export function publicDrive(row) {
  return {
    object: 'drive',
    id: row.id,
    name: row.name,
    bytes: Math.max(0, Math.floor(Number(row.bytes) || 0)),
    quota_bytes: DRIVE_QUOTA_BYTES,
    object_max_bytes: DRIVE_OBJECT_MAX_BYTES,
    created_at: row.createdAt,
    updated_at: row.updatedAt || row.createdAt,
    binding: DRIVES_BINDING,
  };
}

function r2ObjectKey(driveId, objectPath) {
  return `v0/${driveId}/${objectPath}`;
}

function parseRoute(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  if (path === DRIVE_PREFIX) return { kind: 'collection' };
  if (!path.startsWith(`${DRIVE_PREFIX}/`)) return { kind: 'bad-tail' };
  const rest = path.slice(`${DRIVE_PREFIX}/`.length);
  const slash = rest.indexOf('/');
  const id = slash === -1 ? rest : rest.slice(0, slash);
  const tail = slash === -1 ? '' : rest.slice(slash + 1);
  if (!DRIVE_ID_RE.test(id)) return { kind: 'bad-id' };
  if (!tail) return { kind: 'drive', id };
  if (tail === 'snapshot') return { kind: 'snapshot', id };
  if (tail === 'objects') return { kind: 'list', id };
  if (tail.startsWith('objects/')) return { kind: 'object', id, objectPath: tail.slice('objects/'.length) };
  return { kind: 'bad-tail' };
}

async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > 8192) return { error: 'body too large' };
  const text = await request.text().catch(() => '');
  if (text.length > 8192) return { error: 'body too large' };
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: 'invalid json' }; }
}

async function ownerBytes(storage, owner, skipId, replacement) {
  const listed = await storage.list({ prefix: 'compute:drive:' });
  let sum = 0;
  for (const row of listed.values()) {
    if (!row || typeof row !== 'object' || row.owner !== owner || !row.id) continue;
    if (row.id === skipId) sum += replacement;
    else sum += Math.max(0, Math.floor(Number(row.bytes) || 0));
  }
  return sum;
}

async function loadDrive(storage, id, owner) {
  const row = await storage.get(`compute:drive:${id}`);
  if (!row || row.owner !== owner) return null;
  return row;
}

async function objectByteLength(bucket, key) {
  if (typeof bucket.head === 'function') {
    const head = await bucket.head(key);
    if (!head) return null;
    return Math.max(0, Math.floor(Number(head.size) || 0));
  }
  const got = await bucket.get(key);
  if (!got) return null;
  if (typeof got.size === 'number') return Math.max(0, Math.floor(got.size));
  const buf = await got.arrayBuffer();
  return buf.byteLength;
}

function contentTypeOf(request) {
  let contentType = String(request.headers.get('Content-Type') || 'application/octet-stream').split(';')[0].trim().slice(0, 128);
  if (!contentType || /[\r\n]/.test(contentType)) contentType = 'application/octet-stream';
  return contentType;
}

/**
 * @returns {Promise<Response|null>} null when the path is not Drives.
 * Auth is the Compute bearer (dsk_ / dgk_). Guest scope stays chat+models for inference;
 * Drives accept dgk_ on purpose — Files work without a Mac.
 */
export async function handleComputeDrives(request, { path, storage, bucket, apiKey, now = Date.now(), unauthorized }) {
  if (!isDriveApiPath(path)) return null;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: SECURITY });
  }
  const key = await apiKey();
  if (!key?.owner) return unauthorized();
  if (!r2Ready(bucket)) return unavailable();

  const route = parseRoute(path);
  const owner = key.owner;
  try {
    if (route.kind === 'bad-id' || route.kind === 'bad-tail') {
      return fail(
        'Drive not found.',
        404,
        'drive_not_found',
        'GET /compute/api/v1/drives for yours.',
        [{ path: '/compute/api/v1/drives' }, { path: '/compute/skill.md' }],
      );
    }

    if (route.kind === 'collection') {
      if (request.method === 'GET' || request.method === 'HEAD') {
        const listed = await storage.list({ prefix: 'compute:drive:' });
        const data = [...listed.values()]
          .filter((row) => row && typeof row === 'object' && row.owner === owner && row.id)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .map(publicDrive);
        const res = json({ object: 'list', data, quota_bytes: DRIVE_QUOTA_BYTES }, 200);
        return request.method === 'HEAD' ? new Response(null, { status: 200, headers: res.headers }) : res;
      }
      if (request.method === 'POST') {
        const input = await readJson(request);
        const name = input && !input.error ? normalizeDriveName(input.name) : null;
        if (!name) {
          return fail(
            'Drive name is invalid.',
            400,
            'invalid_drive_name',
            'Use 1–64 chars: lowercase, digits, dot, underscore, hyphen.',
            [{ path: '/compute/api/v1/drives' }],
          );
        }
        const nameKey = `compute:drive-name:${owner}:${name}`;
        const existingId = await storage.get(nameKey);
        if (typeof existingId === 'string') {
          const existing = await loadDrive(storage, existingId, owner);
          if (existing) return json({ ...publicDrive(existing), created: false }, 200);
        }
        const id = `drv_${randomUrlToken(9)}`;
        const row = { id, owner, keyId: key.id, name, bytes: 0, createdAt: now, updatedAt: now };
        await storage.put(`compute:drive:${id}`, row);
        await storage.put(nameKey, id);
        return json({ ...publicDrive(row), created: true }, 201);
      }
      return fail(
        'method not allowed',
        405,
        'method_not_allowed',
        'GET or POST /compute/api/v1/drives.',
        [{ path: '/compute/api/v1/drives' }],
      );
    }

    const drive = await loadDrive(storage, route.id, owner);
    if (!drive) {
      return fail(
        'Drive not found.',
        404,
        'drive_not_found',
        'POST /compute/api/v1/drives to get or create one.',
        [{ path: '/compute/api/v1/drives' }],
      );
    }

    if (route.kind === 'drive') {
      if (request.method === 'GET' || request.method === 'HEAD') {
        const res = json(publicDrive(drive), 200);
        return request.method === 'HEAD' ? new Response(null, { status: 200, headers: res.headers }) : res;
      }
      return fail(
        'method not allowed',
        405,
        'method_not_allowed',
        'GET this drive. PUT objects under /objects/.',
        [{ path: `/compute/api/v1/drives/${drive.id}` }],
      );
    }

    if (route.kind === 'snapshot') {
      if (request.method !== 'POST') {
        return fail(
          'method not allowed',
          405,
          'method_not_allowed',
          'POST a metadata snapshot.',
          [{ path: `/compute/api/v1/drives/${drive.id}/snapshot` }],
        );
      }
      const id = `snap_${randomUrlToken(9)}`;
      const snap = {
        object: 'drive.snapshot',
        id,
        drive_id: drive.id,
        name: drive.name,
        bytes: Math.max(0, Math.floor(Number(drive.bytes) || 0)),
        created_at: now,
        note: 'metadata only',
      };
      await storage.put(`compute:drive-snap:${id}`, { ...snap, owner });
      return json(snap, 201);
    }

    if (route.kind === 'list') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return fail(
          'method not allowed',
          405,
          'method_not_allowed',
          'GET lists by prefix. PUT a path to write.',
          [{ path: `/compute/api/v1/drives/${drive.id}/objects` }],
        );
      }
      const prefix = normalizePrefix(new URL(request.url).searchParams.get('prefix'));
      if (prefix == null) {
        return fail(
          'Prefix is invalid.',
          400,
          'invalid_object_prefix',
          'Prefix is a relative path. No ..',
          [{ path: `/compute/api/v1/drives/${drive.id}/objects` }],
        );
      }
      const listed = await bucket.list({ prefix: `v0/${drive.id}/${prefix}`, limit: 1000 });
      const base = `v0/${drive.id}/`;
      const data = (listed?.objects || []).map((obj) => ({
        path: String(obj.key || '').startsWith(base) ? String(obj.key).slice(base.length) : String(obj.key || ''),
        bytes: Math.max(0, Math.floor(Number(obj.size) || 0)),
      }));
      const res = json({
        object: 'list',
        drive_id: drive.id,
        prefix,
        data,
        truncated: Boolean(listed?.truncated),
      }, 200);
      return request.method === 'HEAD' ? new Response(null, { status: 200, headers: res.headers }) : res;
    }

    const objectPath = normalizeObjectPath(route.objectPath);
    if (!objectPath) {
      return fail(
        'Object path is invalid.',
        400,
        'invalid_object_path',
        'Relative path. No .. . 512 chars.',
        [{ path: `/compute/api/v1/drives/${drive.id}/objects` }],
      );
    }
    const r2Key = r2ObjectKey(drive.id, objectPath);

    if (request.method === 'GET' || request.method === 'HEAD') {
      const got = await bucket.get(r2Key);
      if (!got) {
        return fail(
          'Object not found.',
          404,
          'object_not_found',
          'PUT the path first.',
          [{ path: `/compute/api/v1/drives/${drive.id}/objects/${objectPath}` }],
        );
      }
      const contentType = got.httpMetadata?.contentType || 'application/octet-stream';
      const headers = { ...SECURITY, 'Content-Type': contentType, 'X-Dasha-Drive': drive.id };
      if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
      const bytes = got.body instanceof Uint8Array ? got.body : new Uint8Array(await got.arrayBuffer());
      return new Response(bytes, { status: 200, headers });
    }

    if (request.method === 'PUT') {
      const declared = Number(request.headers.get('Content-Length') || 0);
      if (declared > DRIVE_OBJECT_MAX_BYTES) {
        return fail(
          'Object is over 8 MiB.',
          413,
          'object_too_large',
          'v0 cap is 8 MiB per object.',
          [{ path: `/compute/api/v1/drives/${drive.id}/objects` }],
        );
      }
      const raw = new Uint8Array(await request.arrayBuffer());
      if (raw.byteLength > DRIVE_OBJECT_MAX_BYTES) {
        return fail(
          'Object is over 8 MiB.',
          413,
          'object_too_large',
          'v0 cap is 8 MiB per object.',
          [{ path: `/compute/api/v1/drives/${drive.id}/objects` }],
        );
      }
      const prior = await objectByteLength(bucket, r2Key);
      const priorBytes = prior == null ? 0 : prior;
      const nextDriveBytes = Math.max(0, Math.floor(Number(drive.bytes) || 0) - priorBytes + raw.byteLength);
      const usage = await ownerBytes(storage, owner, drive.id, nextDriveBytes);
      if (usage > DRIVE_QUOTA_BYTES) {
        return fail(
          'Drive quota exceeded.',
          413,
          'drive_quota',
          'Soft quota is 1 GiB per key owner.',
          [{ path: `/compute/api/v1/drives/${drive.id}` }],
        );
      }
      const contentType = contentTypeOf(request);
      await bucket.put(r2Key, raw, {
        httpMetadata: { contentType },
        customMetadata: { bytes: String(raw.byteLength) },
      });
      const updated = { ...drive, bytes: nextDriveBytes, updatedAt: now };
      await storage.put(`compute:drive:${drive.id}`, updated);
      return json({
        object: 'drive.object',
        drive_id: drive.id,
        path: objectPath,
        bytes: raw.byteLength,
        content_type: contentType,
        updated_at: now,
      }, prior == null ? 201 : 200);
    }

    if (request.method === 'DELETE') {
      const prior = await objectByteLength(bucket, r2Key);
      if (prior == null) {
        return fail(
          'Object not found.',
          404,
          'object_not_found',
          'Nothing stored at that path.',
          [{ path: `/compute/api/v1/drives/${drive.id}/objects` }],
        );
      }
      await bucket.delete(r2Key);
      const updated = {
        ...drive,
        bytes: Math.max(0, Math.floor(Number(drive.bytes) || 0) - prior),
        updatedAt: now,
      };
      await storage.put(`compute:drive:${drive.id}`, updated);
      return json({ object: 'drive.object', drive_id: drive.id, path: objectPath, deleted: true }, 200);
    }

    return fail(
      'method not allowed',
      405,
      'method_not_allowed',
      'GET, PUT, or DELETE this object.',
      [{ path: `/compute/api/v1/drives/${drive.id}/objects/${objectPath}` }],
    );
  } catch {
    return fail(
      'Drives storage failed.',
      502,
      'drives_failed',
      'R2 call failed. Retry. A Mac is not required.',
      [{ path: '/compute/api/v1/drives' }],
    );
  }
}
