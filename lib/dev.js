#!/usr/bin/env node
// dev.js — FIS development server with live reload (Node built-ins only)

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

/**
 * Standard trailing-edge debounce.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer;
  const debounced = function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/**
 * Route a directory change to the right handler(s).
 * @param {'components'|'pages'|'styles'|'state'} dirType
 * @param {{onComponentsChange: Function, onPagesChange: Function, onReload: Function}} handlers
 */
export async function handleDirChange(dirType, handlers) {
  if (dirType === 'components') {
    await handlers.onComponentsChange();
    handlers.onReload();
  } else if (dirType === 'pages') {
    await handlers.onPagesChange();
    handlers.onReload();
  } else {
    // styles, state — reload only
    handlers.onReload();
  }
}

/**
 * Create file watchers for project directories.
 * @param {{root: string, debounceMs?: number, onComponentsChange: Function, onPagesChange: Function, onReload: Function}} config
 * @returns {{stop: () => Promise<void>}}
 */
export function createWatcher(config) {
  const { root, debounceMs = 100, onComponentsChange, onPagesChange, onReload } = config;
  const dirs = ['components', 'pages', 'styles', 'state'];
  const handlers = { onComponentsChange, onPagesChange, onReload };
  const existingDirs = dirs.filter(d => existsSync(join(root, d)));

  // Create per-directory debounced handlers
  const debouncedByDir = {};
  for (const dir of existingDirs) {
    debouncedByDir[dir] = debounce(() => {
      handleDirChange(dir, handlers);
    }, debounceMs);
  }

  // Single watcher on root with recursive — route events by path prefix
  // This avoids macOS FSEvents leaking events across sibling directory watchers
  // Filter: only react to events with a nested path (dir/file), not bare dir names
  // (macOS fires initial rename events for just-created directories)
  const w = watch(root, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    const normalized = filename.replace(/\\/g, '/');
    // Must be a path like "styles/main.css", not just "styles"
    if (!normalized.includes('/')) return;
    const topDir = normalized.split('/')[0];
    if (debouncedByDir[topDir]) {
      debouncedByDir[topDir]();
    }
  });

  return {
    stop() {
      return Promise.resolve().then(() => {
        for (const dir of existingDirs) {
          debouncedByDir[dir].cancel();
        }
        w.close();
      });
    },
  };
}

// --- Server (only when run directly) ---

if (process.argv[1]?.endsWith('dev.js')) {
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

  // Set up watchers using the new system
  createWatcher({
    root: ROOT,
    debounceMs: 100,
    onComponentsChange: () => {
      // Future: auto-regenerate components.js
    },
    onPagesChange: () => {
      return import('./generate.js').then((m) => m.generate?.());
    },
    onReload: reload,
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ FIS dev server running at http://localhost:${PORT}`);
  });
}
