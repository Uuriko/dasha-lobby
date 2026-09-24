import release from './dasha-compute-download-release.json' with { type: 'json' };

/** Four immutable release surfaces; unrelated assets retain their existing owner. */
export async function computeDownloadResponse(request, fetcher = globalThis.fetch, config = release) {
  const pathname = new URL(request.url).pathname;
  const archivePath = '/dasha-compute-open-alpha.tar.gz';
  if (![archivePath, `${archivePath}.sha256`, '/compute/release.json', '/compute/kit.json', '/compute/kit.json/'].includes(pathname)) return null;
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  const { commit, manifest } = config;
  if (!/^[a-f0-9]{40}$/.test(commit) || !/^[a-f0-9]{64}$/.test(manifest.sha256) || !Number.isSafeInteger(manifest.bytes) || manifest.bytes < 1 || manifest.bytes > 2000000) return new Response('Release unavailable', { status: 503 });
  const headers = { 'Cache-Control': 'public, max-age=300', 'X-Dasha-Edge': 'compute-kit-release', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' };
  let body;
  if (pathname === archivePath) {
    try {
      // Never forward cookies, authorization, query strings, or redirects upstream.
      const response = await fetcher(`https://raw.githubusercontent.com/Uuriko/dasha-desk/${commit}/artifacts/dasha-compute${archivePath}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok || !response.body) throw new Error('archive unavailable');
      const reader = response.body.getReader();
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          if (bytes > manifest.bytes) { await reader.cancel(); throw new Error('archive oversized'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      if (bytes !== manifest.bytes) throw new Error('archive size mismatch');
      body = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', body))].map(n => n.toString(16).padStart(2, '0')).join('');
      if (digest !== manifest.sha256) throw new Error('archive digest mismatch');
      headers['Content-Type'] = 'application/gzip';
      headers['Content-Disposition'] = 'attachment; filename="dasha-compute-open-alpha.tar.gz"';
      headers['Content-Length'] = String(bytes);
      headers.ETag = `"${digest}"`;
    } catch { return new Response('Release download temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } }); }
  } else if (pathname.endsWith('.sha256')) {
    body = `${manifest.sha256}  dasha-compute-open-alpha.tar.gz\n`;
    headers['Content-Type'] = 'text/plain; charset=utf-8';
  } else {
    const data = pathname === '/compute/release.json' ? manifest : { version: manifest.version, min_version: '0.3.0', url: `https://www.getdasha.com${archivePath}`, sha256: manifest.sha256 };
    body = JSON.stringify(data, null, 2);
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  return new Response(request.method === 'HEAD' ? null : body, { headers });
}
