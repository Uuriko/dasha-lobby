/**
 * Optional GitHub link for Dasha lobby / bounties — OAuth App.
 * Required to list/claim/pay on the bounty board. Chat still works without it.
 *
 * Secrets (wrangler secret put -c dasha-lobby-wrangler.jsonc):
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, LOBBY_SESSION_SECRET
 * Optional var: GITHUB_REDIRECT_URI
 *   default https://lobby.getdasha.com/oauth/github/callback
 *
 * GitHub OAuth App:
 *   Homepage URL: https://www.getdasha.com
 *   Authorization callback URL: https://lobby.getdasha.com/oauth/github/callback
 *   Suggested scope: read:user
 */
import {
  signPayload,
  verifyPayload,
  readCookie,
  SESSION_TTL_MS,
} from './dasha-lobby-x.mjs';

export const GH_COOKIE = '__Host-dasha_gh';
export const GH_OAUTH_COOKIE = '__Host-dasha_gh_oauth';
export const GH_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
export const DEFAULT_GH_REDIRECT = 'https://lobby.getdasha.com/oauth/github/callback';
export const GH_AUTHORIZE = 'https://github.com/login/oauth/authorize';
export const GH_TOKEN = 'https://github.com/login/oauth/access_token';
export const GH_USER = 'https://api.github.com/user';
export const GH_SCOPE = 'read:user';

export function githubConfigured(env) {
  return Boolean(env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET && env?.LOBBY_SESSION_SECRET);
}

export function githubRedirectUri(env) {
  return String(env?.GITHUB_REDIRECT_URI || DEFAULT_GH_REDIRECT).replace(/\/$/, '');
}

export function normalizeGithubLogin(raw) {
  const s = String(raw || '')
    .trim()
    .replace(/^@/, '');
  if (!GH_LOGIN_RE.test(s)) return null;
  return s;
}

export function githubOauthStateCookie(token = '') {
  return `${GH_OAUTH_COOKIE}=${token}; Path=/; Max-Age=${token ? 900 : 0}; HttpOnly; Secure; SameSite=Lax`;
}

export function githubCookieHeader(token, { maxAgeSec = SESSION_TTL_MS / 1000, clear = false } = {}) {
  if (clear) {
    return `${GH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
  }
  return `${GH_COOKIE}=${token}; Path=/; Max-Age=${Math.floor(maxAgeSec)}; HttpOnly; Secure; SameSite=Lax`;
}

export function githubAuthorizeUrl({ clientId, redirectUri, state, challenge, scope = GH_SCOPE }) {
  const u = new URL(GH_AUTHORIZE);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('scope', scope);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('allow_signup', 'true');
  return u.href;
}

export async function exchangeGithubCode(env, { code, verifier }) {
  const redirect = githubRedirectUri(env);
  const res = await fetch(GH_TOKEN, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'dasha-lobby',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      code_verifier: verifier,
      redirect_uri: redirect,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.access_token) {
    const err = new Error(data.error_description || data.error || 'github token exchange failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchGithubUser(accessToken) {
  const res = await fetch(GH_USER, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dasha-lobby',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || 'github user failed');
    err.status = res.status;
    throw err;
  }
  const login = normalizeGithubLogin(data.login);
  if (!data?.id || !login) throw new Error('invalid github user payload');
  return {
    ghId: String(data.id),
    login,
    name: typeof data.name === 'string' ? data.name.slice(0, 80) : '',
    avatar: typeof data.avatar_url === 'string' ? data.avatar_url.slice(0, 300) : null,
  };
}

export async function createGithubSessionToken(env, user) {
  const login = normalizeGithubLogin(user.login);
  if (!login) throw new Error('bad github login');
  const now = Date.now();
  return signPayload(env.LOBBY_SESSION_SECRET, {
    v: 1,
    kind: 'github',
    ghId: String(user.ghId),
    login,
    name: user.name || '',
    avatar: user.avatar || null,
    iat: now,
    exp: now + SESSION_TTL_MS,
  });
}

export async function githubSessionFromRequest(env, request) {
  if (!env?.LOBBY_SESSION_SECRET) return null;
  const raw = readCookie(request.headers.get('Cookie'), GH_COOKIE);
  if (!raw) return null;
  const payload = await verifyPayload(env.LOBBY_SESSION_SECRET, raw);
  if (payload?.v !== 1 || payload?.kind !== 'github' || !payload?.login || !payload?.ghId) return null;
  if (!Number.isFinite(payload.exp)) return null;
  const login = normalizeGithubLogin(payload.login);
  if (!login) return null;
  return {
    ghId: String(payload.ghId),
    login,
    name: payload.name || '',
    avatar: typeof payload.avatar === 'string' ? payload.avatar.slice(0, 300) : null,
    linked: true,
  };
}

export function publicGithubLink(link) {
  if (!link?.login) return null;
  const login = normalizeGithubLogin(link.login);
  if (!login) return null;
  return {
    login,
    handle: login,
    href: `https://github.com/${login}`,
    avatar: link.avatar || `https://github.com/${login}.png?size=80`,
  };
}
