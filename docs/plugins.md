# Plugins

A build-time plugin system for extending FIS with custom file transforms, HTML injection, and dev server middleware. Zero runtime weight — plugins run during the build and dev server only.

## Philosophy

FIS plugins follow three principles:

- **Build-time only.** Plugins transform files before they reach the browser. No runtime framework overhead, no client-side plugin loader. The output is plain HTML, CSS, and JS.
- **Zero dependencies.** Plugins are plain ES modules. No plugin SDK, no peer dependencies, no version matrix. Export an object with the right shape and you're done.
- **First non-null wins.** When multiple plugins handle the same file extension, the first one to return a result from `transform()` wins. Order matters — list plugins in priority order in your config.

## Configuration

Plugins are declared in `fis.config.js` at the project root:

```js
export default {
  plugins: [
    './plugins/markdown/index.js',
  ],
};
```

Three resolution styles are supported:

**Local path** — relative to project root:

```js
plugins: [
  './plugins/my-plugin/index.js',
]
```

**npm package** — resolved from `node_modules`:

```js
plugins: [
  '@fis/plugin-markdown',
]
```

**Tuple with options** — pass configuration to a plugin factory:

```js
plugins: [
  ['./plugins/my-plugin/index.js', { highlightTheme: 'monokai' }],
]
```

When a tuple is used, the plugin's default export must be a **factory function** that receives the options object and returns a plugin object:

```js
export default function(options) {
  return {
    name: 'my-plugin',
    extensions: ['.txt'],
    transform(file) {
      // use options.highlightTheme here
    },
  };
}
```

## Plugin Interface

A plugin is a plain object (or a factory function that returns one) with the following properties:

### `name` (required)

A unique string identifier for the plugin.

```js
name: 'markdown'
```

### `extensions` (required)

An array of file extensions this plugin handles. Include the leading dot.

```js
extensions: ['.md']
```

### `transform(file)`

Converts a source file into output. Receives a file object with three properties:

| Property | Type | Description |
|---|---|---|
| `path` | `string` | File path relative to project root |
| `content` | `string` | Raw file content |
| `ext` | `string` | File extension (e.g., `.md`) |

Returns an object with the transformed result, or `null` to skip (letting the next plugin try):

```js
transform(file) {
  const html = convertToHtml(file.content);
  return {
    path: file.path.replace(/\.md$/, '.html'),
    content: html,
    metadata: { title: 'My Page' },
  };
}
```

The return object has:

| Property | Type | Description |
|---|---|---|
| `path` | `string` | Output file path (typically with a new extension) |
| `content` | `string` | Transformed content |
| `metadata` | `object` | Extracted metadata (e.g., frontmatter fields) |

### `watch`

An array of glob patterns for the dev server to watch beyond the default directories. When matched files change, the server triggers a rebuild and reload.

```js
watch: ['**/*.md']
```

### `head`

A string or function that injects HTML into the `<head>` of served pages. Use this for stylesheets, meta tags, or preloads.

**Static string:**

```js
head: '<link rel="stylesheet" href="/@fis/markdown/prism-dark.css">'
```

**Dynamic function** (receives the current page path):

```js
head: (pagePath) => {
  if (pagePath.endsWith('.md')) {
    return '<link rel="stylesheet" href="/markdown-styles.css">';
  }
  return '';
}
```

### `body`

Same as `head`, but injects at the end of `<body>`. Useful for scripts that need the DOM ready.

```js
body: '<script src="/@fis/my-plugin/enhance.js"></script>'
```

Also accepts a function with the page path as argument.

### `serve(req, res)`

Dev server middleware for serving plugin-specific assets. Receives standard Node.js-style `req` and `res` objects. Return a truthy value to indicate the request was handled (stops further middleware).

```js
serve(req, res) {
  if (!req.url.startsWith('/@fis/my-plugin/')) return;

  const fileName = req.url.slice('/@fis/my-plugin/'.length);
  const filePath = join(ASSETS_DIR, fileName);

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
  return true;
}
```

**Convention:** Use the `/@fis/plugin-name/` URL prefix to avoid collisions with project files.

### `setup(config)`

Called once during plugin loading, after the plugin is resolved but before any transforms run. Receives the full `fis.config.js` object. Use this for one-time initialization.

```js
setup(config) {
  // Access other config properties
  console.log('Plugin initialized with config:', config);
}
```

If `setup()` throws, plugin loading fails with a clear error message.

## Creating a Custom Plugin

### 1. Create the plugin directory

```
plugins/
  csv-table/
    index.js
    assets/
      table-styles.css
```

### 2. Export a plugin object

```js
// plugins/csv-table/index.js
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  name: 'csv-table',
  extensions: ['.csv'],

  transform(file) {
    const rows = file.content.trim().split('\n').map(r => r.split(','));
    const [header, ...body] = rows;

    let html = '<table><thead><tr>';
    header.forEach(h => { html += `<th>${h.trim()}</th>`; });
    html += '</tr></thead><tbody>';
    body.forEach(row => {
      html += '<tr>';
      row.forEach(cell => { html += `<td>${cell.trim()}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table>';

    return {
      path: file.path.replace(/\.csv$/, '.html'),
      content: html,
      metadata: { rows: body.length },
    };
  },

  head: '<link rel="stylesheet" href="/@fis/csv-table/table-styles.css">',

  serve(req, res) {
    if (!req.url.startsWith('/@fis/csv-table/')) return;
    const filePath = join(__dirname, 'assets', req.url.slice('/@fis/csv-table/'.length));
    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return true;
  },
};
```

### 3. Register in config

```js
// fis.config.js
export default {
  plugins: [
    './plugins/csv-table/index.js',
  ],
};
```

### 4. Test it

Create a `.csv` file in your `pages/` directory and run the dev server. The plugin transforms it to an HTML table on the fly.

## Built-in Plugins

### `@fis/plugin-markdown`

Transforms `.md` files to `.html` with zero dependencies. Included in the FIS repository at `plugins/markdown/`.

**Features:**

- Full markdown parsing — headings, paragraphs, lists (ordered and unordered), blockquotes, horizontal rules, line breaks
- GFM tables with column alignment (left, center, right)
- Fenced code blocks with language detection
- Inline formatting — bold, italic, bold+italic, inline code, links, images
- Frontmatter extraction — YAML-like `key: value` pairs between `---` fences
- Syntax highlighting via [Prism.js](https://prismjs.com/) (injected via `head` hook)
- Plugin-served CSS for code highlighting (via `serve` middleware at `/@fis/markdown/`)

**Frontmatter example:**

```
---
title: My Blog Post
date: 2025-01-15
author: FIS Team
---

# My Blog Post

Content starts after the frontmatter fence.
```

The `metadata` object returned from `transform()` contains all frontmatter key-value pairs:

```js
{ title: 'My Blog Post', date: '2025-01-15', author: 'FIS Team' }
```

**Configuration:**

```js
// fis.config.js
export default {
  plugins: [
    './plugins/markdown/index.js',
  ],
};
```

## Plugin Resolution

When `loadPlugins()` processes the `plugins` array from `fis.config.js`, it resolves each entry as follows:

1. **Relative paths** (`./` or `../`) — resolved relative to the project root directory using `pathToFileURL()`
2. **Bare specifiers** (anything else) — resolved from the project's `node_modules` using `createRequire()`, matching standard Node.js module resolution

After resolution, the module's **default export** is examined:

- If it's an **object** — used directly as the plugin
- If it's a **function** (factory pattern) — called with the options from the tuple config, and the returned object is used as the plugin

**Validation:** Every plugin must have a `name` (string) and `extensions` (array). Missing either causes a clear error at load time. After validation, `setup()` is called if present.

**Transform pipeline:** `runTransform()` iterates plugins in config order. For each plugin whose `extensions` array includes the file's extension, `transform()` is called. The first non-null result wins — remaining plugins are skipped for that file.
