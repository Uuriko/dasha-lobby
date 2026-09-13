/** /compute/docs page + OpenAPI 3.1 spec (JSON + YAML) - replayed from the live edge bundle.
 *  Live-only layer until this commit; keep these templates byte-equal to what the edge serves. */
export const DOCS_PAGE_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dasha Compute API docs</title>
<link rel="canonical" href="https://www.getdasha.com/compute/docs">
<meta name="description" content="Dasha Compute API reference - OpenAI-compatible inference on community Macs, signed chained receipts, machine-readable errors.">
<meta property="og:type" content="website"><meta property="og:url" content="https://www.getdasha.com/compute/docs"><meta property="og:title" content="Dasha Compute API docs"><meta property="og:description" content="OpenAI-compatible inference on community Macs. Every settled job settles with a signed receipt on a public chain."><meta property="og:image" content="https://lobby.getdasha.com/og/dasha-social-card.png">
<style>
body{background:#070608;color:#e8e6df;font:15px/1.55 Arial,Helvetica,sans-serif;margin:0;padding:0}
main{max-width:880px;margin:0 auto;padding:48px 20px 80px}
h1{font-size:26px;letter-spacing:.02em;margin:0 0 6px}
h1 .v{color:#8a8a8a;font-size:14px;font-weight:400}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:#dfff00;margin:38px 0 12px}
p.sub{color:#b9b7ae;margin:0 0 8px}
code{background:#111015;border:1px solid #26242c;border-radius:6px;padding:1px 6px;font:13px/1.4 ui-monospace,Menlo,monospace}
ul{margin:8px 0;padding-left:20px}
li{margin:3px 0}
.ep{border:1px solid #26242c;border-radius:12px;padding:16px 18px;margin:14px 0;background:#0c0b0e}
.ep-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.m{font:800 12px/1 Arial,Helvetica,sans-serif;border:1px solid;border-radius:6px;padding:4px 8px;letter-spacing:.08em}
.p{font-size:14px}
.s{color:#cfcdc4;margin:10px 0 0}
.auth{color:#ffb84d;font-size:13px;margin:8px 0 0}
.prm{color:#b9b7ae;font-size:13px;margin:6px 0 0}
.lbl{font:700 11px/1 Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:.12em;color:#8a8a8a}
.rb,.rs{margin-top:10px}
.rs .c{color:#dfff00}
.t{color:#8a8a8a}
.nav a{color:#dfff00;text-decoration:none;border-bottom:1px solid #3a3800}
.nav a:hover{border-bottom-color:#dfff00}
.nav{margin:18px 0 0;font-size:14px}
.fine{color:#8a8a8a;font-size:13px;margin-top:40px;border-top:1px solid #26242c;padding-top:18px}
.fine a{color:#dfff00;text-decoration:none}
</style></head><body><main>
<h1>Dasha Compute API <span class="v">v0.1.0</span></h1>
<p class="sub">OpenAI-compatible inference on community Macs; every settled job gets a signed receipt on a public chain. Observed from live traffic Sep 11-12, 2026; impl lane to confirm/adopt.</p>
<div class="nav">Spec: <a href="/compute/openapi.json">openapi.json</a> &middot; <a href="/compute/openapi.yaml">openapi.yaml</a> &middot; Agent quickstart: <a href="/compute/skill.md">skill.md</a> &middot; <a href="/compute/llms.txt">llms.txt</a> &middot; Verify receipts: <a href="/verify">/verify</a></div>
<h2>Servers</h2>
<ul><li><code>https://lobby.getdasha.com</code> - recommended for interactive (chat, keys); all endpoints answer on both hosts</li>
<li><code>https://www.getdasha.com</code> - recommended for read-only verification + network state</li></ul>
<h2>Endpoints</h2>
<div class="ep"><div class="ep-head"><span class="m" style="color:#dfff00;border-color:#dfff00">POST</span><code class="p">/compute/api/guest-keys</code></div>
<p class="s">Mint a 24h guest key (3/hour/IP)</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">201</code> Key minted. Response also carries status/reason/hint/next/mint/name/prefix/note fields. Save api_key now; only its hash is stored. Guest keys serve only /v1/chat/completions and /v1/models; all other endpoints 403 guest_key_scope.</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/compute/api/v1/models</code></div>
<p class="s">List models (community + hosted). No auth required.</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> OpenAI-style model list</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#dfff00;border-color:#dfff00">POST</span><code class="p">/compute/api/v1/chat/completions</code></div>
<p class="s">Chat completion; settled jobs return an inline receipt</p>
<p class="auth">auth: bearer key required</p>
<div class="rb"><span class="lbl">request body</span><ul>
<li><code>model</code> <b>*</b> <span class="t">string</span> - e.g. <code>qwen3-4b</code></li>
<li><code>messages</code> <b>*</b> <span class="t">array</span> - 1-12 user/assistant messages, max 2000 chars each, 6000 total</li>
<li><code>max_tokens</code> <span class="t">integer</span> - (min 1, max 4096, default 512)</li>
<li><code>temperature</code> <span class="t">number</span> - (min 0, max 2, default 0.6)</li>
</ul></div>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> OpenAI chat completion + job_id + inline receipt (model_id</li>
<li><code class="c">401</code> invalid_api_key</li>
<li><code class="c">400</code> invalid_messages | unsupported_model | tools/tool_choice present (tools unsupported - fail-loud)</li>
<li><code class="c">402</code> spend limit</li>
<li><code class="c">409</code> one queued job per key</li>
<li><code class="c">429</code> per-key rate limit</li>
<li><code class="c">499</code> client abort</li>
<li><code class="c">504</code> timeout</li>
<li><code class="c">503</code> no_mac_online (community down) | hosted_offline (hosted model unavailable) - fail-loud</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/compute/api/verify</code></div>
<p class="s">JSON verdict. Optional hash param (receipt hash | job_id | request_id)</p>
<p class="prm">param <code>hash</code> (query)</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> settled.verify.v0 - ANCHORED | SELF-CONSISTENT | INVALID + chain state + query result</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/compute/api/chain</code></div>
<p class="s">Full receipt chain (public)</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> receipts[] with job_id, engine, tokens, cents, at, prev_hash, hash, sig, signer, model, latency_ms, kind</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/heads</code></div>
<p class="s">Signed heads log (tail). Anchors the chain; see llms.txt for format</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> head[] with ts, tip, prev_head_hash, hash, sig, signer</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/compute/api/network</code></div>
<p class="s">Live network state (public)</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> providers_online, models_available, capacity[] (measured tok/s), jobs_queued, kit_versions</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/compute/api/readyz</code></div>
<p class="s">Readiness probe</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> ready</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/compute/api/pricing</code></div>
<p class="s">Live pricing</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> pricing.compute.v0 - $0.05/successful completion</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/heads/checkpoint</code></div>
<p class="s">Signed checkpoint of current head (external-anchor friendly)</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> checkpoint JSON</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/heads/archive/{date}.json</code></div>
<p class="s">Archived heads for a UTC date</p>
<p class="prm">param <code>date</code> (path) <b>required</b> - e.g. <code>2026-09-12</code></p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> heads[]</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/compute/api/receipts</code></div>
<p class="s">Owner view (401 unauthenticated)</p>
<p class="auth">auth: bearer key required</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">401</code> owner-only</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#39d98a;border-color:#39d98a">GET</span><code class="p">/keys.json</code></div>
<p class="s">Published verification keys (Ed25519 spki_pem)</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">200</code> dasha.keys.v0</li>
</ul></div>
</div>
<div class="ep"><div class="ep-head"><span class="m" style="color:#dfff00;border-color:#dfff00">POST</span><code class="p">/compute/api/v1/responses</code></div>
<p class="s">Not implemented (Vercel AI SDK default route) - use /v1/chat/completions</p>
<p class="auth">auth: bearer key required</p>
<div class="rs"><span class="lbl">responses</span><ul>
<li><code class="c">401</code> invalid_api_key</li>
<li><code class="c">403</code> guest_key_scope (guest keys are chat + models only)</li>
<li><code class="c">400</code> responses are not supported; use POST /v1/chat/completions</li>
</ul></div>
</div>
<p class="fine">Sources: <a href="/compute/api/network">/compute/api/network</a> &middot; <a href="/compute/api/chain">/compute/api/chain</a> &middot; <a href="/keys.json">/keys.json</a> &middot; format: <a href="/compute/llms.txt">/compute/llms.txt</a>. Errors are fail-loud and machine-readable; nothing degrades silently. Run a Mac: <a href="/compute">/compute</a>.</p>
</main></body></html>`;

export const DOCS_OPENAPI_JSON = `{
  "openapi": "3.1.0",
  "info": {
    "title": "Dasha Compute API",
    "version": "0.1.0",
    "description": "OpenAI-compatible inference on community Macs; every settled job gets a signed receipt on a public chain. Observed from live traffic Sep 11-12, 2026; impl lane to confirm/adopt."
  },
  "servers": [
    {
      "url": "https://lobby.getdasha.com",
      "description": "recommended for interactive (chat, keys); all endpoints answer on both hosts"
    },
    {
      "url": "https://www.getdasha.com",
      "description": "recommended for read-only verification + network state"
    }
  ],
  "paths": {
    "/compute/api/guest-keys": {
      "post": {
        "summary": "Mint a 24h guest key (3/hour/IP)",
        "responses": {
          "201": {
            "description": "Key minted. Response also carries status/reason/hint/next/mint/name/prefix/note fields. Save api_key now; only its hash is stored. Guest keys serve only /v1/chat/completions and /v1/models; all other endpoints 403 guest_key_scope.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "api_key": {
                      "type": "string",
                      "example": "dgk_xxx.yyy"
                    },
                    "id": {
                      "type": "string"
                    },
                    "expires_at": {
                      "type": "integer",
                      "format": "epoch-ms"
                    },
                    "ttl_seconds": {
                      "type": "integer",
                      "example": 86400
                    },
                    "scopes": {
                      "type": "array",
                      "items": {
                        "type": "string",
                        "enum": [
                          "chat",
                          "models"
                        ]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/compute/api/v1/models": {
      "get": {
        "summary": "List models (community + hosted). No auth required.",
        "responses": {
          "200": {
            "description": "OpenAI-style model list"
          }
        }
      }
    },
    "/compute/api/v1/chat/completions": {
      "post": {
        "summary": "Chat completion; settled jobs return an inline receipt",
        "security": [
          {
            "bearer": []
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "model",
                  "messages"
                ],
                "properties": {
                  "model": {
                    "type": "string",
                    "example": "qwen3-4b"
                  },
                  "messages": {
                    "type": "array",
                    "description": "1-12 user/assistant messages, max 2000 chars each, 6000 total",
                    "items": {
                      "type": "object"
                    }
                  },
                  "max_tokens": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 4096,
                    "default": 512
                  },
                  "temperature": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 2,
                    "default": 0.6
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "OpenAI chat completion + job_id + inline receipt (model_id",
            "provider_class)": null
          },
          "401": {
            "description": "invalid_api_key"
          },
          "400": {
            "description": "invalid_messages | unsupported_model | tools/tool_choice present (tools unsupported - fail-loud)"
          },
          "402": {
            "description": "spend limit"
          },
          "409": {
            "description": "one queued job per key"
          },
          "429": {
            "description": "per-key rate limit"
          },
          "499": {
            "description": "client abort"
          },
          "504": {
            "description": "timeout"
          },
          "503": {
            "description": "no_mac_online (community down) | hosted_offline (hosted model unavailable) - fail-loud",
            "machine-readable": null
          }
        }
      }
    },
    "/compute/api/verify": {
      "get": {
        "summary": "JSON verdict. Optional hash param (receipt hash | job_id | request_id)",
        "parameters": [
          {
            "name": "hash",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "settled.verify.v0 - ANCHORED | SELF-CONSISTENT | INVALID + chain state + query result"
          }
        }
      }
    },
    "/compute/api/chain": {
      "get": {
        "summary": "Full receipt chain (public)",
        "responses": {
          "200": {
            "description": "receipts[] with job_id, engine, tokens, cents, at, prev_hash, hash, sig, signer, model, latency_ms, kind"
          }
        }
      }
    },
    "/heads": {
      "get": {
        "summary": "Signed heads log (tail). Anchors the chain; see llms.txt for format",
        "responses": {
          "200": {
            "description": "head[] with ts, tip, prev_head_hash, hash, sig, signer"
          }
        }
      }
    },
    "/compute/api/network": {
      "get": {
        "summary": "Live network state (public)",
        "responses": {
          "200": {
            "description": "providers_online, models_available, capacity[] (measured tok/s), jobs_queued, kit_versions"
          }
        }
      }
    },
    "/compute/api/readyz": {
      "get": {
        "summary": "Readiness probe",
        "responses": {
          "200": {
            "description": "ready"
          }
        }
      }
    },
    "/compute/api/pricing": {
      "get": {
        "summary": "Live pricing",
        "responses": {
          "200": {
            "description": "pricing.compute.v0 - $0.05/successful completion"
          }
        }
      }
    },
    "/heads/checkpoint": {
      "get": {
        "summary": "Signed checkpoint of current head (external-anchor friendly)",
        "responses": {
          "200": {
            "description": "checkpoint JSON"
          }
        }
      }
    },
    "/heads/archive/{date}.json": {
      "get": {
        "summary": "Archived heads for a UTC date",
        "parameters": [
          {
            "name": "date",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string",
              "example": "2026-09-12"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "heads[]"
          }
        }
      }
    },
    "/compute/api/receipts": {
      "get": {
        "summary": "Owner view (401 unauthenticated)",
        "security": [
          {
            "bearer": []
          }
        ],
        "responses": {
          "401": {
            "description": "owner-only"
          }
        }
      }
    },
    "/keys.json": {
      "get": {
        "summary": "Published verification keys (Ed25519 spki_pem)",
        "responses": {
          "200": {
            "description": "dasha.keys.v0"
          }
        }
      }
    },
    "/compute/api/v1/responses": {
      "post": {
        "summary": "Not implemented (Vercel AI SDK default route) - use /v1/chat/completions",
        "security": [
          {
            "bearer": []
          }
        ],
        "responses": {
          "401": {
            "description": "invalid_api_key"
          },
          "403": {
            "description": "guest_key_scope (guest keys are chat + models only)"
          },
          "400": {
            "description": "responses are not supported; use POST /v1/chat/completions"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "bearer": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  }
}`;

export const DOCS_OPENAPI_YAML = `openapi: 3.1.0
info:
  title: Dasha Compute API
  version: 0.1.0
  description: OpenAI-compatible inference on community Macs; every settled job gets
    a signed receipt on a public chain. Observed from live traffic Sep 11-12, 2026;
    impl lane to confirm/adopt.
servers:
- url: https://lobby.getdasha.com
  description: recommended for interactive (chat, keys); all endpoints answer on both
    hosts
- url: https://www.getdasha.com
  description: recommended for read-only verification + network state
paths:
  /compute/api/guest-keys:
    post:
      summary: Mint a 24h guest key (3/hour/IP)
      responses:
        '201':
          description: Key minted. Response also carries status/reason/hint/next/mint/name/prefix/note
            fields. Save api_key now; only its hash is stored. Guest keys serve only
            /v1/chat/completions and /v1/models; all other endpoints 403 guest_key_scope.
          content:
            application/json:
              schema:
                type: object
                properties:
                  api_key:
                    type: string
                    example: dgk_xxx.yyy
                  id:
                    type: string
                  expires_at:
                    type: integer
                    format: epoch-ms
                  ttl_seconds:
                    type: integer
                    example: 86400
                  scopes:
                    type: array
                    items:
                      type: string
                      enum:
                      - chat
                      - models
  /compute/api/v1/models:
    get:
      summary: List models (community + hosted). No auth required.
      responses:
        '200':
          description: OpenAI-style model list
  /compute/api/v1/chat/completions:
    post:
      summary: Chat completion; settled jobs return an inline receipt
      security:
      - bearer: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required:
              - model
              - messages
              properties:
                model:
                  type: string
                  example: qwen3-4b
                messages:
                  type: array
                  description: 1-12 user/assistant messages, max 2000 chars each,
                    6000 total
                  items:
                    type: object
                max_tokens:
                  type: integer
                  minimum: 1
                  maximum: 4096
                  default: 512
                temperature:
                  type: number
                  minimum: 0
                  maximum: 2
                  default: 0.6
      responses:
        '200':
          description: OpenAI chat completion + job_id + inline receipt (model_id
          provider_class): null
        '401':
          description: invalid_api_key
        '400':
          description: invalid_messages | unsupported_model | tools/tool_choice present
            (tools unsupported - fail-loud)
        '402':
          description: spend limit
        '409':
          description: one queued job per key
        '429':
          description: per-key rate limit
        '499':
          description: client abort
        '504':
          description: timeout
        '503':
          description: no_mac_online (community down) | hosted_offline (hosted model
            unavailable) - fail-loud
          machine-readable: null
  /compute/api/verify:
    get:
      summary: JSON verdict. Optional hash param (receipt hash | job_id | request_id)
      parameters:
      - name: hash
        in: query
        schema:
          type: string
      responses:
        '200':
          description: settled.verify.v0 - ANCHORED | SELF-CONSISTENT | INVALID +
            chain state + query result
  /compute/api/chain:
    get:
      summary: Full receipt chain (public)
      responses:
        '200':
          description: receipts[] with job_id, engine, tokens, cents, at, prev_hash,
            hash, sig, signer, model, latency_ms, kind
  /heads:
    get:
      summary: Signed heads log (tail). Anchors the chain; see llms.txt for format
      responses:
        '200':
          description: head[] with ts, tip, prev_head_hash, hash, sig, signer
  /compute/api/network:
    get:
      summary: Live network state (public)
      responses:
        '200':
          description: providers_online, models_available, capacity[] (measured tok/s),
            jobs_queued, kit_versions
  /compute/api/readyz:
    get:
      summary: Readiness probe
      responses:
        '200':
          description: ready
  /compute/api/pricing:
    get:
      summary: Live pricing
      responses:
        '200':
          description: pricing.compute.v0 - $0.05/successful completion
  /heads/checkpoint:
    get:
      summary: Signed checkpoint of current head (external-anchor friendly)
      responses:
        '200':
          description: checkpoint JSON
  /heads/archive/{date}.json:
    get:
      summary: Archived heads for a UTC date
      parameters:
      - name: date
        in: path
        required: true
        schema:
          type: string
          example: '2026-09-12'
      responses:
        '200':
          description: heads[]
  /compute/api/receipts:
    get:
      summary: Owner view (401 unauthenticated)
      security:
      - bearer: []
      responses:
        '401':
          description: owner-only
  /keys.json:
    get:
      summary: Published verification keys (Ed25519 spki_pem)
      responses:
        '200':
          description: dasha.keys.v0
  /compute/api/v1/responses:
    post:
      summary: Not implemented (Vercel AI SDK default route) - use /v1/chat/completions
      security:
      - bearer: []
      responses:
        '401':
          description: invalid_api_key
        '403':
          description: guest_key_scope (guest keys are chat + models only)
        '400':
          description: responses are not supported; use POST /v1/chat/completions
components:
  securitySchemes:
    bearer:
      type: http
      scheme: bearer
`;
