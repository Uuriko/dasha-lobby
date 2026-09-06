#!/usr/bin/env node
/**
 * Leftover pretty path (Worker bbb5dbde): live /swagger_ui /swagger_ui.html
 * /api_docs /compute/swagger-ui /compute/swagger_ui /compute/api-docs
 * /compute/api_docs (+slash / Title-case) html-404 → 308 /compute/api.
 * Keep prior peers /swagger-ui /swagger-ui.html /api-docs /swagger /openapi.
 * Exact /compute/api stays 200 (null dest). Do not invent /redoc
 * /compute/swagger-ui.html. /docs /documentation fold with compute/api peers.
 * Disk only. No Designer. Never plugin.jup.ag.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import edgeWorker, { potterHome308Dest } from './dasha-lobby-worker.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const workerSrc = readFileSync(join(root, 'dasha-lobby-worker.mjs'), 'utf8');
assert.doesNotMatch(workerSrc, /plugin\.jup\.ag/, 'worker must not mention plugin.jup.ag');
assert.match(workerSrc, /POTTER_COMPUTE_API_DOCS_308_PATHS/, 'swagger/api-docs 308 set present');
assert.match(
  workerSrc,
  /\/swagger_ui \/api_docs \/compute\/swagger-ui \/compute\/api-docs/,
  'apex→/compute/api leftover comment lists swagger_ui api_docs compute/swagger-ui compute/api-docs',
);

const API = 'https://www.getdasha.com/compute/api';
const LOBBY_API = 'https://lobby.getdasha.com/compute/api';

const REDO4 = [
  '/swagger_ui', '/swagger_ui/', '/Swagger_ui', '/SWAGGER_UI', '/Swagger_Ui/',
  '/swagger_ui.html', '/swagger_ui.html/', '/Swagger_ui.html', '/SWAGGER_UI.HTML', '/Swagger_Ui.html/',
  '/api_docs', '/api_docs/', '/Api_docs', '/API_DOCS', '/Api_Docs/',
  '/compute/swagger-ui', '/compute/swagger-ui/', '/Compute/swagger-ui', '/COMPUTE/SWAGGER-UI', '/Compute/Swagger-UI/',
  '/compute/swagger_ui', '/compute/swagger_ui/', '/Compute/swagger_ui', '/COMPUTE/SWAGGER_UI', '/Compute/Swagger_Ui/',
  '/compute/api-docs', '/compute/api-docs/', '/Compute/api-docs', '/COMPUTE/API-DOCS', '/Compute/Api-Docs/',
  '/compute/api_docs', '/compute/api_docs/', '/Compute/api_docs', '/COMPUTE/API_DOCS', '/Compute/Api_Docs/',
];
const PRIOR_PEERS = [
  '/swagger-ui', '/swagger-ui/', '/Swagger-ui', '/SWAGGER-UI', '/Swagger-UI/',
  '/swagger-ui.html', '/swagger-ui.html/', '/Swagger-ui.html', '/SWAGGER-UI.HTML', '/Swagger-Ui.html/',
  '/api-docs', '/api-docs/', '/Api-docs', '/API-DOCS', '/Api-Docs/',
  '/swagger', '/swagger/', '/Swagger', '/SWAGGER',
  '/openapi', '/openapi/', '/Openapi', '/OPENAPI',
];
const FOLDS = [...REDO4, ...PRIOR_PEERS];
const STAY_OUT = [
  '/compute/api',
  '/compute/api/',
  '/compute',
  '/compute/skill/provide.md',
  '/compute/skill/use.md',
  '/compute/skill/ocm-host.md',
  '/redoc',
  '/swaggerui',
  '/compute/swagger-ui.html',
  '/compute/swagger_ui.html',
  '/api-doc',
  '/apidocs',
];

for (const path of FOLDS) {
  assert.equal(potterHome308Dest(path), API, path);
}
for (const path of STAY_OUT) {
  assert.equal(potterHome308Dest(path), null, `stay out ${path}`);
}

const env = { LOBBY_SESSION_SECRET: 'swagger-ui-underscore-compute-pretty-path-secret', AI: { run: async () => ({ response: 'ok' }) } };
for (const host of ['www.getdasha.com', 'lobby.getdasha.com']) {
  for (const path of FOLDS) {
    for (const method of ['GET', 'HEAD']) {
      const res = await edgeWorker.fetch(new Request(`https://${host}${path}`, { method }), env);
      assert.equal(res.status, 308, `${host} ${path} ${method}`);
      const want = host === 'lobby.getdasha.com' ? LOBBY_API : API;
      assert.equal(res.headers.get('location'), want, `${host} ${path} ${method} loc`);
      assert.doesNotMatch(res.headers.get('location') || '', /plugin\.jup\.ag/, `${host} ${path} ${method} no plugin.jup.ag`);
      if (method === 'HEAD') assert.equal(await res.text(), '');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const api = await edgeWorker.fetch(new Request(`https://${host}/compute/api`, { method }), env);
    assert.equal(api.status, 200, `${host} /compute/api ${method} stays 200`);
    if (method === 'HEAD') assert.equal(await api.text(), '');
  }
  const compute = await edgeWorker.fetch(new Request(`https://${host}/compute`), env);
  assert.equal(compute.status, 200, `${host} /compute stays 200`);
}

const sitemapXml = workerSrc.match(/const SITEMAP_XML = `([\s\S]*?)`;/)[1];
for (const path of ['/swagger_ui', '/swagger_ui.html', '/api_docs', '/compute/swagger-ui', '/compute/swagger_ui', '/compute/api-docs', '/compute/api_docs', '/swagger-ui', '/swagger', '/openapi']) {
  assert.ok(!sitemapXml.includes(`https://www.getdasha.com${path}</loc>`), `sitemap omits leftover ${path}`);
}

console.log('dasha-swagger-ui-underscore-compute-pretty-path: PASS (/swagger_ui+/swagger_ui.html+/api_docs+/compute/swagger-ui+/compute/swagger_ui+/compute/api-docs+/compute/api_docs 308 /compute/api; prior /swagger-ui+/swagger-ui.html+/api-docs+/swagger+/openapi still fold; Title-case+slash; /compute/api 200; stay-outs; no plugin.jup.ag)');
