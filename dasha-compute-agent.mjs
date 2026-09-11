/**
 * Compute agent AEO — shared packet for /compute/llms.txt,
 * /compute/llms-full.txt, /compute/skill.md + Cursor
 * /compute/skills/dasha-compute/SKILL.md alias (same bytes),
 * /agents.txt + /agents.json (+ /compute/agents.txt + /compute/agents.json), and
 * /.well-known/agent.json + /compute/.well-known/agent.json +
 * /compute/agent.json (alias for agents that skip .well-known).
 * MCP catalog: /compute/mcp.json + /.well-known/mcp.json
 * (+ /compute/.well-known/mcp.json). Static tool list — not streamable HTTP.
 * Leftover /mcp|/compute/mcp stay 308 /compute.
 * Exact agents faces match before leftover /agents fold.
 * Run factory, not a ledger. No secrets. No people-data.
 * Build on Dasha: mint + run factory. UI is yours.
 */

export const COMPUTE_API_BASE = 'https://lobby.getdasha.com/compute/api/v1';
export const COMPUTE_API_BASE_WWW = 'https://www.getdasha.com/compute/api/v1';
export const OCM_API_BASE = 'https://www.getdasha.com/compute/ocm/v1';
export const COMPUTE_HEALTHZ = 'https://lobby.getdasha.com/compute/api/healthz';
export const COMPUTE_NETWORK = `${COMPUTE_API_BASE}/network`;
export const COMPUTE_GUEST_KEYS_URL = 'https://lobby.getdasha.com/compute/api/guest-keys';
export const COMPUTE_LLMS_URL = 'https://www.getdasha.com/compute/llms.txt';
export const COMPUTE_SKILL_URL = 'https://www.getdasha.com/compute/skill.md';
export const COMPUTE_SKILL_URL_LOBBY = 'https://lobby.getdasha.com/compute/skill.md';
export const COMPUTE_SKILL_CURSOR_URL = 'https://www.getdasha.com/compute/skills/dasha-compute/SKILL.md';
export const COMPUTE_AGENT_JSON_URL = 'https://www.getdasha.com/.well-known/agent.json';
export const COMPUTE_AGENT_JSON_ALIAS_URL = 'https://www.getdasha.com/compute/agent.json';
export const COMPUTE_MCP_JSON_URL = 'https://www.getdasha.com/compute/mcp.json';
export const COMPUTE_MCP_WELLKNOWN_URL = 'https://www.getdasha.com/.well-known/mcp.json';
export const COMPUTE_MCP_WELLKNOWN_COMPUTE_URL = 'https://www.getdasha.com/compute/.well-known/mcp.json';
export const COMPUTE_LLMS_FULL_URL = 'https://www.getdasha.com/compute/llms-full.txt';
export const COMPUTE_LLMS_DESCRIBEDBY = '</compute/llms.txt>; rel="describedby"';
export const AGENTS_TXT_URL = 'https://www.getdasha.com/agents.txt';
export const AGENTS_JSON_URL = 'https://www.getdasha.com/agents.json';
export const COMPUTE_AGENTS_TXT_URL = 'https://www.getdasha.com/compute/agents.txt';
export const COMPUTE_AGENTS_JSON_URL = 'https://www.getdasha.com/compute/agents.json';

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

/** Point coding agents at Compute. Shared by skill.md + /compute/llms.txt. */
export const COMPUTE_AGENTS_BASE = 'https://lobby.getdasha.com/compute/api/v1';
export const COMPUTE_WHICH_KEY_TXT = `## Which key / which base

Compute: ${COMPUTE_API_BASE} · dsk_ or guest dgk_ (POST /compute/api/guest-keys)
OCM: ${OCM_API_BASE} · ocm_live_
Never swap keys. Compute X session is not an OCM session.
`;
export const COMPUTE_AGENTS_TXT = `## Agents

base_url ${COMPUTE_AGENTS_BASE}
OpenAI-compatible. OpenAI SDK, Aider, Goose, OpenHands (BYOK).
Mint: POST /compute/api/guest-keys
reasoning_effort low|medium|high (alias effort). Hosted applies it. Community may ignore — honesty on dasha.

${COMPUTE_WHICH_KEY_TXT}`;

/** agents.txt (CC0 vibe: https://agents-txt.com). Short. Skills → skill.md. */
export const AGENTS_TXT = `# agents.txt
# Standard: https://agents-txt.com
# JSON: ${AGENTS_JSON_URL}

Skills: ${COMPUTE_SKILL_URL}
Skills: ${COMPUTE_SKILL_URL_LOBBY}

# OpenAI-compat base_url ${COMPUTE_AGENTS_BASE}
# Guest mint POST /compute/api/guest-keys
# Compute key dsk_ or dgk_ on ${COMPUTE_AGENTS_BASE}
# OCM key ocm_live_ on ${OCM_API_BASE}
# Never swap keys
`;

export const AGENTS_JSON = {
  $schema: 'https://agents-txt.com/schema/agents-json/v1.0.json',
  version: '1.0',
  standard: 'https://agents-txt.com',
  site: {
    name: 'Dasha',
    url: 'https://www.getdasha.com/',
    description: `OpenAI-compat base_url ${COMPUTE_AGENTS_BASE} (dsk_/dgk_). OCM base_url ${OCM_API_BASE} (ocm_live_). Never swap keys. Guest mint POST /compute/api/guest-keys.`,
  },
  skills: [
    { url: COMPUTE_SKILL_URL, description: 'First call on Dasha Compute.' },
    { url: COMPUTE_SKILL_URL_LOBBY, description: 'Same skill on lobby.' },
  ],
};

/** Hosted Flash option. Shared by skill.md + llms.txt. Official API id deepseek-flash when offered. Never Community. Not a live SKU. */
export const COMPUTE_HOSTED_FLASH_TXT = `Hosted Flash: bigger-than-Mac (Spark / Engram-class Flash when offered). Model id \`deepseek-flash\` (Hosted). Never Community. Same base_url. Watch x-dasha-route.
Engram/SSD-stream local recipes stay Hosted/Provide-Max — not Air kit.`;

/** Provide speed honesty. Shared by /compute/skill.md + /compute/llms.txt. */
export const COMPUTE_PROVIDE_SPEED_TXT = `## Provide speed

Community Macs publish measured tok/s via network capacity (measured_providers). Never invent.
Join a Mac at /compute#provide — kit soft-doctor and enroll-code live there.
Kit uses OLLAMA_KEEP_ALIVE (launch agent / service — a shell export is not enough).
Smaller is faster: qwen3-4b · qwen3-8b · gemma3-12b · gemma3-27b.
Send a recipe — MLX / Ollama / llama.cpp Apple Silicon. We pin winners.
Hosted-only when offered: Flash-class · DGX Spark · Qwen 3.8 Flash-Next. Never a Community Mac.
`;

export const DASHA_ASSOCIATED_MINT = '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump';
export const DASHA_BUY_URL = 'https://www.getdasha.com/how-to-buy';
export const DASHA_JUP_TOKEN_URL = `https://jup.ag/tokens/${DASHA_ASSOCIATED_MINT}`;

/** Build on Dasha — mint + run factory. Shared by skill.md + /compute/llms.txt. UI is yours. */
export const COMPUTE_BUILD_ON_DASHA_TXT = `## Build on Dasha

mint ${DASHA_ASSOCIATED_MINT}
Buy via site Buy — ${DASHA_BUY_URL} · ${DASHA_JUP_TOKEN_URL}
base_url ${COMPUTE_API_BASE}
guest-keys POST /compute/api/guest-keys
mcp ${COMPUTE_MCP_JSON_URL}
skill ${COMPUTE_SKILL_URL}
UI is yours; we expose mint + run factory.
`;

/** Cursor/Claude-style skill. Stable GET /compute/skill.md. */
export const COMPUTE_SKILL_MD = `---
name: dasha-compute
description: First call on Dasha Compute. OpenAI-compatible chat on community Macs (Hosted when none are online). Use when probing healthz/network/models or posting chat/completions.
---

# Dasha Compute

OpenAI-compatible inference. A run factory, not a ledger.

${COMPUTE_BUILD_ON_DASHA_TXT}
## When to use

You want a Mac to run a prompt — or Hosted when no Mac is online. Not a ledger. Not Room.

${COMPUTE_AGENTS_TXT}
## Create a key

Guest key: POST /compute/api/guest-keys — 24h chat+models, 3/hour/IP. Copy once.

curl -sS -X POST https://lobby.getdasha.com/compute/api/guest-keys -H 'Content-Type: application/json' -d '{}'

Or sign in at https://www.getdasha.com/compute#build for lasting dsk_.

${COMPUTE_FIRST_CALL_TXT}
Pick \`model\` from the models list.

## Receipts / Community / Hosted

Receipts: signed, chained. GET https://www.getdasha.com/compute/api/receipts · verify https://www.getdasha.com/verify
Job receipts include \`route\` (\`community\`|\`hosted\`, same as x-dasha-route). \`turns\` only when already counted — never invented.
Verify a receipt without trusting this site: GET /compute/api/chain (receipts) + /keys.json (signer key). Rebuild the signed body as {"job_id":...,"engine":...,"tokens":...,"cents":...,"at":...,"prev_hash":...} - exactly those keys in that order (job_id string|null, engine string, tokens/cents non-negative integers, at unix-ms integer|null, prev_hash = previous receipt hash or "GENESIS"). receipt.hash = sha256(JSON.stringify(body)) hex; receipt.sig = ed25519 over the UTF-8 bytes of that hex string, verified with the signer's spki_pem; signer = first 16 hex chars of sha256(spki_pem). Chain continuity: each prev_hash equals the previous hash. Find your own receipt by the request_id you sent on chat/completions (echoed as receipt.request_id) or by job_id from the completion response. Machine verdict: GET /compute/api/verify?hash=<hash|job_id|request_id> - the 64-hex chain hash, the job_ id, or your request_id; the rcp_ receipt id is not a lookup key.
Community: a peer Mac runs the job.
Hosted: still there when no Mac is online.
${COMPUTE_HOSTED_FLASH_TXT}
Spend: read \`x-dasha-route\` (\`community\`|\`hosted\`) and \`x-dasha-model\` on chat/completions. \`x-dasha-spend-usd\` only when cost is known — Community omits USD when unknown.

${COMPUTE_PROVIDE_SPEED_TXT}
## More

packet ${COMPUTE_LLMS_URL}
agent.json ${COMPUTE_AGENT_JSON_URL}
MCP: ${COMPUTE_MCP_JSON_URL}
`;

export const COMPUTE_LLMS_TXT = `# Dasha Compute

Mac Ask / Provide / OpenAI-compatible API. A run factory, not a ledger.

${COMPUTE_BUILD_ON_DASHA_TXT}
base ${COMPUTE_API_BASE}
www ${COMPUTE_API_BASE_WWW}
healthz ${COMPUTE_HEALTHZ}
network ${COMPUTE_NETWORK}
auth Bearer API key
no key needed for healthz + network + models; key needed for chat
live 24h counters GET /compute/api/factory settled_24h — tokens/jobs/cents, no key needed
guest key POST /compute/api/guest-keys — 24h chat+models, 3/hour/IP
curl -sS -X POST https://lobby.getdasha.com/compute/api/guest-keys -H 'Content-Type: application/json' -d '{}'

${COMPUTE_AGENTS_TXT}
First path: POST /compute/api/guest-keys. Or sign in at /compute#build for dsk_.

${COMPUTE_FIRST_CALL_TXT}
Community: a peer Mac runs the job.
Hosted: still there when no Mac is online.
${COMPUTE_HOSTED_FLASH_TXT}
spend headers x-dasha-route · x-dasha-model · x-dasha-spend-usd when known (Community omits unknown USD)
receipts include route community|hosted (same as x-dasha-route); turns only when counted — never invented
Verify a receipt without trusting this site: GET /compute/api/chain (receipts) + /keys.json (signer key). Rebuild the signed body as {"job_id":...,"engine":...,"tokens":...,"cents":...,"at":...,"prev_hash":...} - exactly those keys in that order (job_id string|null, engine string, tokens/cents non-negative integers, at unix-ms integer|null, prev_hash = previous receipt hash or "GENESIS"). receipt.hash = sha256(JSON.stringify(body)) hex; receipt.sig = ed25519 over the UTF-8 bytes of that hex string, verified with the signer's spki_pem; signer = first 16 hex chars of sha256(spki_pem). Chain continuity: each prev_hash equals the previous hash. Find your own receipt by the request_id you sent on chat/completions (echoed as receipt.request_id) or by job_id from the completion response. Machine verdict: GET /compute/api/verify?hash=<hash|job_id|request_id> - the 64-hex chain hash, the job_ id, or your request_id; the rcp_ receipt id is not a lookup key.

${COMPUTE_PROVIDE_SPEED_TXT}
compute https://www.getdasha.com/compute
Use a Mac https://www.getdasha.com/compute#ask
Join a Mac https://www.getdasha.com/compute#provide
agent.json ${COMPUTE_AGENT_JSON_URL}
skill ${COMPUTE_SKILL_URL}
skills ${COMPUTE_SKILL_CURSOR_URL}
mcp ${COMPUTE_MCP_JSON_URL}

site https://www.getdasha.com/llms.txt
full https://www.getdasha.com/llms-full.txt
`;

/** Longer agent-oriented Compute packet. Site /llms-full.txt stays the site companion. */
export const COMPUTE_LLMS_FULL_TXT = `${COMPUTE_LLMS_TXT}
## Discovery

GET ${COMPUTE_AGENT_JSON_URL}
GET https://www.getdasha.com/compute/.well-known/agent.json
GET ${COMPUTE_AGENT_JSON_ALIAS_URL}
GET ${COMPUTE_LLMS_URL}
GET ${COMPUTE_LLMS_FULL_URL}
GET ${COMPUTE_SKILL_URL}
GET ${COMPUTE_MCP_JSON_URL}
GET ${COMPUTE_MCP_WELLKNOWN_URL}

## Skill

${COMPUTE_SKILL_MD}
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
    guest_key: {
      method: 'POST',
      path: '/compute/api/guest-keys',
      ttl_seconds: 86_400,
      scopes: ['chat', 'models'],
      rate: '3/hour/IP',
      curl: "curl -sS -X POST https://lobby.getdasha.com/compute/api/guest-keys -H 'Content-Type: application/json' -d '{}'",
    },
  },
  endpoints: {
    chat_completions: `${COMPUTE_API_BASE}/chat/completions`,
    models: `${COMPUTE_API_BASE}/models`,
    healthz: COMPUTE_HEALTHZ,
    network: COMPUTE_NETWORK,
    guest_keys: COMPUTE_GUEST_KEYS_URL,
    ocm_v1: OCM_API_BASE,
  },
  ocm: {
    base_url: OCM_API_BASE,
    key: 'ocm_live_',
    note: 'Separate product. Never send dsk_/dgk_ to OCM or ocm_live_ to Compute.',
  },
  docs: {
    llms: COMPUTE_LLMS_URL,
    skill: COMPUTE_SKILL_URL,
    mcp: COMPUTE_MCP_JSON_URL,
    site_llms: 'https://www.getdasha.com/llms.txt',
    site_llms_full: 'https://www.getdasha.com/llms-full.txt',
  },
};

/** Static MCP catalog. Points at existing HTTP tools — not a second chat protocol. */
export const COMPUTE_MCP_JSON = {
  name: 'Dasha Compute',
  description: 'OpenAI-compatible inference. A run factory, not a ledger. Not Room.',
  url: 'https://www.getdasha.com/compute',
  skill: COMPUTE_SKILL_URL,
  protocol: 'catalog',
  transport: 'http',
  note: 'Static MCP catalog. Call the existing HTTP tools or the OpenAI-compatible base_url. Chat needs Bearer. Not a streamable MCP session.',
  base_url: COMPUTE_API_BASE,
  base_url_www: COMPUTE_API_BASE_WWW,
  auth: {
    type: 'api_key',
    in: 'header',
    header: 'Authorization',
    scheme: 'Bearer',
    public_reads: ['healthz', 'network', 'models'],
    chat: 'bearer',
    guest_key: {
      method: 'POST',
      path: '/compute/api/guest-keys',
      ttl_seconds: 86_400,
      scopes: ['chat', 'models'],
      rate: '3/hour/IP',
    },
  },
  tools: [
    {
      name: 'healthz',
      method: 'GET',
      url: COMPUTE_HEALTHZ,
      auth: 'none',
      description: 'Coordinator health.',
    },
    {
      name: 'models',
      method: 'GET',
      url: `${COMPUTE_API_BASE}/models`,
      auth: 'none',
      description: 'OpenAI-compatible model list.',
    },
    {
      name: 'network',
      method: 'GET',
      url: COMPUTE_NETWORK,
      auth: 'none',
      description: 'Community Macs advertising.',
    },
    {
      name: 'guest-keys',
      method: 'POST',
      url: COMPUTE_GUEST_KEYS_URL,
      auth: 'none',
      rate: '3/hour/IP',
      ttl_seconds: 86_400,
      scopes: ['chat', 'models'],
      description: 'Mint a 24h guest key. Copy once. Rate-limited.',
    },
    {
      name: 'chat.completions',
      method: 'POST',
      url: `${COMPUTE_API_BASE}/chat/completions`,
      auth: 'bearer',
      description: 'OpenAI-compatible chat. Use base_url with the OpenAI SDK. Bearer required.',
    },
  ],
};

export function isComputeLlmsPath(pathname) {
  return pathname === '/compute/llms.txt' || pathname === '/compute/llms.txt/';
}

export function isComputeLlmsFullPath(pathname) {
  return pathname === '/compute/llms-full.txt' || pathname === '/compute/llms-full.txt/';
}

export function isComputeSkillFacePath(pathname) {
  if (pathname === '/compute/skill.md') return true;
  const p = String(pathname || '').toLowerCase();
  return (
    p === '/compute/skills/dasha-compute' ||
    p === '/compute/skills/dasha-compute/' ||
    p === '/compute/skills/dasha-compute/skill.md' ||
    p === '/compute/skills/dasha-compute/skill.md/'
  );
}

export function isComputeAgentJsonPath(pathname) {
  return (
    pathname === '/.well-known/agent.json' ||
    pathname === '/compute/.well-known/agent.json' ||
    pathname === '/compute/agent.json'
  );
}

export function isComputeMcpJsonPath(pathname) {
  return (
    pathname === '/compute/mcp.json' ||
    pathname === '/.well-known/mcp.json' ||
    pathname === '/compute/.well-known/mcp.json'
  );
}

/** Exact faces only. Leftover /agents|/compute/agents must not match *.txt/*.json. */
export function isAgentsTxtPath(pathname) {
  return pathname === '/agents.txt' || pathname === '/compute/agents.txt';
}

export function isAgentsJsonPath(pathname) {
  return pathname === '/agents.json' || pathname === '/compute/agents.json';
}

export function isAgentsDiscoveryPath(pathname) {
  return isAgentsTxtPath(pathname) || isAgentsJsonPath(pathname);
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

export function computeLlmsFullResponse(request) {
  return new Response(request.method === 'HEAD' ? null : COMPUTE_LLMS_FULL_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'X-Dasha-Edge': 'compute-llms-full',
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

export function computeMcpJsonResponse(request) {
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
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(COMPUTE_MCP_JSON), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'X-Dasha-Edge': 'compute-mcp',
    },
  });
}

export function agentsTxtResponse(request) {
  return new Response(request.method === 'HEAD' ? null : AGENTS_TXT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'X-Dasha-Edge': 'agents-txt',
    },
  });
}

export function agentsJsonResponse(request) {
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
  return new Response(request.method === 'HEAD' ? null : JSON.stringify(AGENTS_JSON), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'X-Dasha-Edge': 'agents-json',
    },
  });
}

/** Exact /agents.txt /agents.json /compute/agents.txt /compute/agents.json. Call before leftover /agents fold. */
export function agentsDiscoveryResponse(request) {
  const path = new URL(request.url).pathname;
  const method = request.method;
  if (isAgentsTxtPath(path) && (method === 'GET' || method === 'HEAD')) {
    return agentsTxtResponse(request);
  }
  if (isAgentsJsonPath(path) && (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')) {
    return agentsJsonResponse(request);
  }
  return null;
}

/** Shared door for agent.json, MCP catalog, /compute/llms.txt, /compute/llms-full.txt, /compute/skill.md, Cursor SKILL.md alias, and agents.txt/json faces. */
export function computeAgentAeoResponse(request) {
  const agents = agentsDiscoveryResponse(request);
  if (agents) return agents;
  const path = new URL(request.url).pathname;
  const method = request.method;
  if (isComputeLlmsPath(path) && (method === 'GET' || method === 'HEAD')) {
    return computeLlmsResponse(request);
  }
  if (isComputeLlmsFullPath(path) && (method === 'GET' || method === 'HEAD')) {
    return computeLlmsFullResponse(request);
  }
  if (isComputeSkillFacePath(path) && (method === 'GET' || method === 'HEAD')) {
    return computeSkillFaceResponse(request);
  }
  if (isComputeAgentJsonPath(path) && (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')) {
    return computeAgentJsonResponse(request);
  }
  if (isComputeMcpJsonPath(path) && (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')) {
    return computeMcpJsonResponse(request);
  }
  return null;
}

/** Quiet HTML describedby so crawlers that only parse the document find /compute/llms.txt. */
export function attachComputeLlmsHtmlLinks(html) {
  const src = String(html || '');
  if (/<link\b[^>]*\brel=["']describedby["'][^>]*\bhref=["']\/compute\/llms\.txt["']/i.test(src)) return src;
  if (/<link\b[^>]*\bhref=["']\/compute\/llms\.txt["'][^>]*\brel=["']describedby["']/i.test(src)) return src;
  const tag = '<link rel="describedby" href="/compute/llms.txt" type="text/plain">';
  return /<\/head>/i.test(src) ? src.replace(/<\/head>/i, `${tag}</head>`) : tag + src;
}
