#!/usr/bin/env node
// dev.js — FIS development server with live reload (~70 lines, Node built-ins only)

import { createServer } from 'node:http';
import { readFileSync, existsSync, watch } from 'node:fs';
import { join, extname } from 'node:path';

const PORT = process.env.PORT || 3000;
const ROOT = process.cwd();

const MIMES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** @type {Set<import('node:http').ServerResponse>} */
const clients = new Set();

const RELOAD_SCRIPT = `\n<script>new EventSource('/__fis_reload').onmessage=()=>location.reload()</script>`;

const server = createServer((req, res) => {
  // SSE endpoint for live reload
  if (req.url === '/__fis_reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // Static file serving
  let filePath = join(ROOT, req.url === '/' ? 'index.html' : req.url);

  // SPA fallback: no extension + file doesn't exist → index.html
  if (!existsSync(filePath) && !extname(filePath)) {
    filePath = join(ROOT, 'index.html');
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = extname(filePath);
  const mime = MIMES[ext] || 'application/octet-stream';
  let content = readFileSync(filePath);

  // Inject live reload script into HTML
  if (ext === '.html') {
    content = content.toString() + RELOAD_SCRIPT;
  }

  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
});

function reload() {
  for (const client of clients) {
    client.write('data: reload\n\n');
  }
}

// Watch project directories for changes
for (const dir of ['pages', 'components', 'state', 'styles']) {
  const watchDir = join(ROOT, dir);
  if (existsSync(watchDir)) {
    watch(watchDir, { recursive: true }, () => {
      if (dir === 'pages') {
        import('./generate.js').then((m) => m.generate?.());
      }
      reload();
    });
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ FIS dev server running at http://localhost:${PORT}`);
});
