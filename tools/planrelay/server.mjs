import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { store } from './store.mjs';
import { summary, artifactById, feedback, markdownFeedback, fail } from './core.mjs';
const assets = new Map([['/', ['index.html', 'text/html']], ['/app.mjs', ['app.mjs', 'text/javascript']], ['/core.mjs', ['../core.mjs', 'text/javascript']], ['/style.css', ['style.css', 'text/css']]]);
const MAX_BODY = 1200000;
export async function startServer({ path, port = 0 }) {
  const db = store(path), token = randomBytes(32).toString('hex');
  let origin;
  const server = createServer(async (req, res) => {
    const send = (status, data, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" });
      res.end(type === 'application/json' ? JSON.stringify(data) : data);
    };
    try {
      // Reject DNS rebinding and cross-origin browser requests, including reads.
      if (req.headers.host !== new URL(origin).host) fail('Unrecognized host', 403);
      if (req.headers.origin && req.headers.origin !== origin) fail('Cross-origin request refused', 403);
      if (req.headers['sec-fetch-site'] === 'cross-site') fail('Cross-site request refused', 403);
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [name, type] = assets.get(url.pathname);
        return send(200, readFileSync(new URL(`./public/${name}`, import.meta.url), 'utf8'), type);
      }
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, { ...db.read(), token });
      if (req.method === 'GET' && url.pathname === '/api/export') {
        const artifact = artifactById(db.read(), url.searchParams.get('id'));
        return url.searchParams.get('format') === 'markdown' ? send(200, markdownFeedback(artifact), 'text/markdown') : send(200, feedback(artifact));
      }
      if (req.method === 'POST' && url.pathname === '/api/action') {
        const supplied = Buffer.from(req.headers['x-planrelay-token'] || '');
        const expected = Buffer.from(token);
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) fail('Missing session token', 403);
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') fail('Expected application/json', 415);
        let size = 0, chunks = [];
        // Drain oversized requests without destroying the socket before the 413 arrives.
        await new Promise((resolve, reject) => {
          let overflow = false;
          req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY) {
              if (!overflow) { overflow = true; chunks = []; reject(Object.assign(new Error('Request too large'), { status: 413 })); }
            } else if (!overflow) chunks.push(chunk);
          });
          req.once('end', resolve); req.once('error', reject);
          req.once('aborted', () => reject(Object.assign(new Error('Request aborted'), { status: 400 })));
        });
        let input;
        try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Malformed JSON'); }
        const result = db.mutate(input);
        return send(200, { ...result, token });
      }
      return send(404, { error: 'Not found' });
    } catch (err) { send(err.status || 500, { error: err.status ? err.message : 'Workspace operation failed; inspect the local server console.' }); if (!err.status) console.error(err); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin, db };
}
