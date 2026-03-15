# Dev Server

A zero-dependency development server in ~70 lines. Node built-ins only. No express, no vite, no webpack-dev-server.

## Start

```bash
node lib/dev.js
```

```
⚡ FIS dev server running at http://localhost:3000
```

Or use the npm script:

```bash
npm run dev
```

## Live Reload

The server injects a tiny SSE (Server-Sent Events) script into every HTML response:

```js
new EventSource('/__fis_reload').onmessage = () => location.reload()
```

When any file changes in `pages/`, `components/`, `state/`, or `styles/`, the server sends a reload event to all connected browsers. Full page reload — no HMR complexity, no stale state.

**Web standard:** [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)

## Auto Route Regeneration

When files change in `pages/`, the server automatically re-runs the route generator before triggering the reload. Add a new page, save it, and the route is live.

No manual `node lib/generate.js` during development.

## LAN Access

The server binds to `0.0.0.0`, so it's accessible from any device on your local network. Find your machine's IP and hit `http://192.168.x.x:3000` from your phone.

## Custom Port

```bash
PORT=8080 node lib/dev.js
```

## SPA Fallback

Requests for paths without file extensions that don't match a file on disk fall back to `index.html`. This lets the client-side router handle all routes.

```
GET /products/42  →  no file at /products/42  →  serves index.html  →  router handles it
```

## MIME Types

The server handles all the usual suspects:

| Extension | MIME Type |
|---|---|
| `.html` | `text/html` |
| `.js` | `application/javascript` |
| `.css` | `text/css` |
| `.json` | `application/json` |
| `.png` | `image/png` |
| `.jpg` | `image/jpeg` |
| `.svg` | `image/svg+xml` |
| `.ico` | `image/x-icon` |
| `.woff2` | `font/woff2` |

Everything else gets `application/octet-stream`.

## Auto File Watcher

The dev server watches your project directories and automatically responds to changes — no manual commands needed.

### How It Works

`createWatcher(config)` sets up a single recursive file watcher on the project root, routing events by directory:

- **`components/`** — runs component auto-registration, then reloads
- **`pages/`** — regenerates routes, then reloads
- **`styles/`** and **`state/`** — triggers a reload

All watchers use **debounced handlers** — rapid file changes (e.g., saving multiple files in quick succession) are collapsed into a single rebuild. The default debounce is 100ms.

### Component Auto-Discovery

`scanComponents(dir)` scans the `components/` directory for valid web component subdirectories:

1. Finds directories containing a hyphen (required by the Custom Elements spec)
2. Checks for a matching `.js` file inside (e.g., `nav-bar/nav-bar.js`)
3. Returns the list of discovered components

`generateComponentsModule(components)` takes that list and generates a `components.js` barrel file with side-effect imports:

```js
// Auto-generated — do not edit
import './components/nav-bar/nav-bar.js';
import './components/search-bar/search-bar.js';
import './components/site-footer/site-footer.js';
```

**Zero manual commands:** create a new component folder with the right structure → the dev server detects it, regenerates `components.js`, and reloads the browser. Your component is registered and ready to use.

### Directory Change Routing

`handleDirChange(dirType, handlers)` routes each directory type to the right handler(s):

| Directory | Action |
|---|---|
| `components/` | Regenerate `components.js` → reload |
| `pages/` | Regenerate `routes.js` → reload |
| `styles/` | Reload only |
| `state/` | Reload only |

## What It Doesn't Do

- **No HMR.** Full reload on every change. It's fast enough. Your app has zero bundle overhead.
- **No HTTPS.** Use a reverse proxy if you need TLS locally.
- **No compression.** Your files are small. You have zero dependencies. Gzip can wait for production.
- **No bundling.** There's nothing to bundle. ES modules load directly.

This is a development server. For production, use any static file server — nginx, Caddy, Cloudflare Pages, GitHub Pages, a `python3 -m http.server`. Your app is static files.
