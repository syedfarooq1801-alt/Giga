// Local stand-in for Vercel's routing: /api/* -> the Python backend,
// everything else -> the static web export (with SPA fallback to index.html).
// Mirrors vercel.json so `npm run preview` behaves like the real deployment.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4173;
const API_TARGET = process.env.API_TARGET || 'http://localhost:8000';
const DIST_DIR = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json',
};

function proxyToApi(req, res) {
  const target = new URL(API_TARGET);
  const proxyReq = http.request({
    hostname: target.hostname,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Backend unreachable', detail: err.message }));
  });
  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  let filePath = path.join(DIST_DIR, decodeURIComponent(req.url.split('?')[0]));
  if (!filePath.startsWith(DIST_DIR)) {
    filePath = DIST_DIR;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }
    const ext = path.extname(filePath);
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    proxyToApi(req, res);
  } else {
    serveStatic(req, res);
  }
}).listen(PORT, () => {
  console.log(`Local preview at http://localhost:${PORT} (proxying /api/* -> ${API_TARGET})`);
});
