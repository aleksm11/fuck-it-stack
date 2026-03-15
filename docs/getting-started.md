# Getting Started

## Prerequisites

- A modern browser (Chrome, Firefox, Safari, Edge — anything with Custom Elements v1 and ES modules)
- Node.js (any recent version — only needed for the dev server and route generation)

No npm install. No build tools. No config files.

## Project Structure

```
my-app/
├── index.html          # Entry point
├── routes.js           # Generated route manifest
├── lib/                # Framework source (you own it)
│   ├── signal.js       # Reactive signals
│   ├── element.js      # FISElement base class
│   ├── router.js       # SPA router
│   ├── persist.js      # Storage adapters
│   ├── dev.js          # Dev server
│   └── generate.js     # Route generator
├── pages/              # File-based routes (HTML files)
├── components/         # Web Components (js + html + css per component)
├── state/              # Signal stores
└── styles/             # Global CSS (tokens + base styles)
```

## Create Your First Component

Components live in `components/{tag-name}/` with three files:

**1. `components/hello-world/hello-world.js`**

```js
import { FISElement } from '/lib/element.js';
import { signal } from '/lib/signal.js';

const name = signal('World');

class HelloWorld extends FISElement {
  data() {
    return {
      '.greeting': `Hello, ${name.get()}!`,
    };
  }

  ready() {
    this.shadowRoot.querySelector('input').addEventListener('input', (e) => {
      name.set(e.target.value);
    });
  }
}
customElements.define('hello-world', HelloWorld);
```

**2. `components/hello-world/hello-world.html`**

```html
<link rel="stylesheet" href="/components/hello-world/hello-world.css">
<div>
  <h1 class="greeting">Hello, World!</h1>
  <input type="text" placeholder="Enter your name">
</div>
```

**3. `components/hello-world/hello-world.css`**

```css
h1 {
  color: var(--color-primary);
  font-size: var(--text-3xl);
}

input {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-base);
}
```

**4. Register it in `index.html`:**

```html
<script type="module">
  import '/components/hello-world/hello-world.js';
  // ...other imports
</script>
```

**5. Use it in any page:**

```html
<hello-world></hello-world>
```

That's a reactive component with scoped styles. No build step. No JSX. The browser does the work.

## Run the Dev Server

```bash
node lib/dev.js
```

Output:
```
⚡ FIS dev server running at http://localhost:3000
```

Edit any file in `pages/`, `components/`, `state/`, or `styles/` — the browser reloads automatically via SSE.

## Add a New Page

**1. Create `pages/about.html`:**

```html
<h1>About</h1>
<p>Built with the Fuck It Stack.</p>
```

**2. Regenerate routes:**

```bash
node lib/generate.js
```

This scans `pages/` and writes `routes.js`, `sitemap.xml`, and `robots.txt`.

If the dev server is running, it auto-regenerates routes when `pages/` changes. No restart needed.

**3. Navigate to `/about`** — your page is live.

## Add a Dynamic Route

Create `pages/users/[id].html`:

```html
<div id="user-profile"></div>

<script type="module">
  const outlet = document.getElementById('app');
  const params = JSON.parse(outlet?.dataset?.routeParams || '{}');

  document.getElementById('user-profile').textContent = `User ID: ${params.id}`;
</script>
```

`[id]` in the filename becomes `:id` in the route. Navigate to `/users/42` and `params.id` is `"42"`.

## Add a Layout

Create `pages/layout.html`:

```html
<nav-bar></nav-bar>
<main class="container">
  <slot></slot>
</main>
<site-footer></site-footer>
```

The `<slot></slot>` is where page content gets injected. Every page in the same directory (and subdirectories) uses this layout automatically.

## Next Steps

- [Signals](signals.md) — reactive state management
- [Components](components.md) — the FISElement base class
- [Routing](routing.md) — file-based SPA routing
- [CSS](css.md) — design tokens and styling approach
