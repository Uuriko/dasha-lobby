/**
 * Compute agent AEO — shared packet for /compute/llms.txt,
 * /compute/skill.md, and /.well-known/agent.json +
 * /compute/.well-known/agent.json.
 * Run factory, not a ledger. No secrets. No people-data.
 */

export const COMPUTE_API_BASE = 'https://lobby.getdasha.com/compute/api/v1';
export const COMPUTE_API_BASE_WWW = 'https://www.getdasha.com/compute/api/v1';
export const COMPUTE_HEALTHZ = 'https://lobby.getdasha.com/compute/api/healthz';
export const COMPUTE_NETWORK = `${COMPUTE_API_BASE}/network`;
export const COMPUTE_LLMS_URL = 'https://www.getdasha.com/compute/llms.txt';
export const COMPUTE_SKILL_URL = 'https://www.getdasha.com/compute/skill.md';
export const COMPUTE_AGENT_JSON_URL = 'https://www.getdasha.com/.well-known/agent.json';
export const COMPUTE_LLMS_DESCRIBEDBY = '</compute/llms.txt>; rel="describedby"';

/** Copy-paste first call. Shared by /compute/llms.txt and site /llms-full.txt. */
export const COMPUTE_FIRST_CALL_TXT = `## First call

base ${COMPUTE_API_BASE}
www ${COMPUTE_API_BASE_WWW}

curl -sS ${COMPUTE_HEALTHZ}
curl -sS ${COMPUTE_NETWORK}
curl -sS ${COMPUTE_API_BASE}/models

curl -sS ${COMPUTE_API_BASE}/chat/completions \\
  -H "Authorization: Bearer $DASHA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gemma3-27b","messages":[{"role":"user","content":"hi"}]}'

from openai import OpenAI
OpenAI(base_url="${COMPUTE_API_BASE}", api_key=os.environ["DASHA_API_KEY"])

new OpenAI({ baseURL: "${COMPUTE_API_BASE}", apiKey: process.env.DASHA_API_KEY })
`;

/** Cursor/Claude-style skill. Stable GET /compute/skill.md. */
export const COMPUTE_SKILL_MD = `---
name: dasha-compute
description: First call on Dasha Compute. OpenAI-compatible chat on community Macs (Hosted when none are online). Use when probing healthz/network/models or posting chat/completions.
---

# Dasha Compute

OpenAI-compatible inference. A run factory, not a ledger.

## When to use

You want a Mac to run a prompt — or Hosted when no Mac is online. Not a ledger. Not Room.

## Create a key

Sign in at https://www.getdasha.com/compute#build

${COMPUTE_FIRST_CALL_TXT}
Pick \`model\` from the models list.

## Receipts / Community / Hosted

Receipts: signed, chained. GET https://www.getdasha.com/compute/api/receipts · verify https://www.getdasha.com/verify
Community: a peer Mac runs the job.
Hosted: still there when no Mac is online.

## More

packet ${COMPUTE_LLMS_URL}
agent.json ${COMPUTE_AGENT_JSON_URL}
`;

export const COMPUTE_LLMS_TXT = `# Dasha Compute

Mac Ask / Provide / OpenAI-compatible API. A run factory, not a ledger.

base ${COMPUTE_API_BASE}
www ${COMPUTE_API_BASE_WWW}
healthz ${COMPUTE_HEALTHZ}
network ${COMPUTE_NETWORK}
auth Bearer API key
no key needed for healthz + network + models; key needed for chat

First path: Sign in, create a key, change the base URL.

${COMPUTE_FIRST_CALL_TXT}
Community: a peer Mac runs the job.
Hosted: still there when no Mac is online.

compute https://www.getdasha.com/compute
Use a Mac https://www.getdasha.com/compute#ask
Join a Mac https://www.getdasha.com/compute#provide
agent.json ${COMPUTE_AGENT_JSON_URL}
skill ${COMPUTE_SKILL_URL}

site https://www.getdasha.com/llms.txt
full https://www.getdasha.com/llms-full.txt
`;

export const COMPUTE_AGENT_JSON = {
  name: 'Dasha Compute',
  description: 'OpenAI-compatible inference marketplace. Mac run factory — not a ledger.',
  url: 'https://www.getdasha.com/compute',
  base_url: COMPUTE_API_BASE,
  base_url_www: COMPUTE_API_BASE_WWW,
  auth: {
    type: 'api_key',
    in: 'header',
    header: 'Authorization',
    scheme: 'Bearer',
    public_reads: ['healthz', 'network', 'models'],
    chat: 'bearer',
  },
  endpoints: {
    chat_completions: `${COMPUTE_API_BASE}/chat/completions`,
    models: `${COMPUTE_API_BASE}/models`,
    healthz: COMPUTE_HEALTHZ,
    network: COMPUTE_NETWORK,
  },
  docs: {
    llms: COMPUTE_LLMS_URL,
    skill: COMPUTE_SKILL_URL,
    site_llms: 'https://www.getdasha.com/llms.txt',
    site_llms_full: 'https://www.getdasha.com/llms-full.txt',
  },
};

export function isComputeLlmsPath(pathname) {
  return pathname === '/compute/llms.txt' || pathname === '/compute/llms.txt/';
}

export function isComputeSkillFacePath(pathname) {
  return pathname === '/compute/skill.md';
}

export function isComputeAgentJsonPath(pathname) {
  return pathname === '/.well-known/agent.json' || pathname === '/compute/.well-known/agent.json';
}

export function computeSkillFaceResponse(request) {
  return new Response(request.method === 'HEAD' ? null : COMPUTE_SKILL_MD, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'X-Dasha-Edge': 'compute-skill-face',
    },
  });
}

export function computeLlmsResponse(request) {
  return new Response(request.method === 'HEAD' ? null : COMPUTE_LLMS_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'X-Dasha-Edge': 'compute-llms',
    },
  });
}

export function computeAgentJsonResponse(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(COMPUTE_AGENT_JSON), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'X-Dasha-Edge': 'compute-agent',
    },
  });
}

/** Shared door for agent.json, /compute/llms.txt, and /compute/skill.md. */
export function computeAgentAeoResponse(request) {
  const path = new URL(request.url).pathname;
  const method = request.method;
  if (isComputeLlmsPath(path) && (method === 'GET' || method === 'HEAD')) {
    return computeLlmsResponse(request);
  }
  if (isComputeSkillFacePath(path) && (method === 'GET' || method === 'HEAD')) {
    return computeSkillFaceResponse(request);
  }
  if (isComputeAgentJsonPath(path) && (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')) {
    return computeAgentJsonResponse(request);
  }
  return null;
}

/** Quiet HTML describedby so crawlers that only parse the document find /compute/llms.txt. */
export function attachComputeLlmsHtmlLinks(html) {
  const src = String(html || '');
  if (src.includes('href="/compute/llms.txt"') && /rel=["']describedby["']/i.test(src)) return src;
  const tag = '<link rel="describedby" href="/compute/llms.txt" type="text/plain">';
  return /<\/head>/i.test(src) ? src.replace(/<\/head>/i, `${tag}</head>`) : tag + src;
}
