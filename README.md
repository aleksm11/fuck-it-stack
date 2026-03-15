# ⚡ Fuck It Stack

> **[Live Demo](https://aleksm11.github.io/fuck-it-stack/)** · **[Documentation](https://aleksm11.github.io/fuck-it-stack/docs/)**

**Zero dependencies. ~350 lines of framework. Just use the platform.**

FIS is the anti-framework web framework. No build step. No node_modules. No virtual DOM. No JSX. No transpilation. Just Web Components, vanilla CSS, Proxy-based signals, and file-based routing — all built on web standards that already exist.

The philosophy is simple: **fuck it, use the platform.**

```
Framework code:  ~350 lines (excluding comments/JSDoc)
Dependencies:    0
Build step:      none
Bundle size:     0 KB (it's just your code)
```

## Quick Start

```bash
git clone https://github.com/jaksm/fuck-it-stack my-app
cd my-app
node lib/generate.js    # Generate routes from pages/
node lib/dev.js          # Start dev server with live reload
```

Open `http://localhost:3000`. That's it.

## What You Get

### Signals — Reactive state in 3 lines

```js
import { signal, observe } from '/lib/signal.js';

const count = signal(0);
observe(() => console.log(count.get()));  // Auto-runs when count changes
count.set(1);  // Logs: 1
```

Deep property access, Map/Set support, computed values, batching. [Full docs →](docs/signals.md)

### Components — Web Components without the ceremony

```js
import { FISElement } from '/lib/element.js';

class UserCard extends FISElement {
  data() {
    return {
      '.name': user.name.get(),          // textContent
      '.avatar@src': user.avatar.get(),  // attribute
      '.card@style.opacity': '1',        // style property
    };
  }
}
customElements.define('user-card', UserCard);
```

Shadow DOM, template caching, reactive bindings. [Full docs →](docs/components.md)

### Routing — File-based, zero config

```
pages/
  index.html        →  /
  products/
    index.html      →  /products
    [id].html       →  /products/:id
  layout.html       →  wraps all pages with <slot></slot>
```

Dynamic params, nested layouts, guards, scroll restoration. [Full docs →](docs/routing.md)

### Persistence — One line to save state

```js
import { persist } from '/lib/persist.js';

persist(cart, { key: 'cart', storage: 'local' });
// Cart survives page reloads. That's it.
```

localStorage, sessionStorage, IndexedDB. Map/Set serialization built in. [Full docs →](docs/persistence.md)

### Dev Server — Live reload, no config

```bash
node lib/dev.js
# ⚡ FIS dev server running at http://localhost:3000
```

SSE-based live reload. Auto route regeneration. LAN access. [Full docs →](docs/dev-server.md)

## FIS vs Everything Else

| | **FIS** | React | Vue | Svelte | HTMX |
|---|---|---|---|---|---|
| Bundle size | **0 KB** | ~45 KB | ~33 KB | ~2 KB | ~14 KB |
| Dependencies | **0** | 4+ | 10+ | 3+ | 0 |
| Build step | **None** | Required | Required | Required | None |
| Learning curve | **HTML + JS + CSS** | JSX, hooks, lifecycle | SFC, composition API | Runes, compiler magic | Attributes, AJAX |
| Signals | **Native (Proxy)** | useState/useReducer | ref/reactive | $state rune | N/A |
| SSR | No | Yes | Yes | Yes | Server-driven |
| Component model | **Web Components** | React components | Vue components | Svelte components | HTML extensions |
| AI-friendly | **Yes — what you write is what ships** | Transpiled | Transpiled | Compiled | Yes |

FIS is not trying to replace React for your enterprise SaaS. It's for when you want to build something fast, ship something small, and not fight your tools. It's for when you say "fuck it" and use what the browser already gives you.

## Project Structure

```
my-app/
├── index.html              # Entry point — registers components, starts router
├── routes.js               # Auto-generated route manifest
├── lib/                    # The framework (you own it)
│   ├── signal.js           # Reactive signals (~140 lines)
│   ├── element.js          # FISElement base class (~70 lines)
│   ├── router.js           # SPA router (~140 lines)
│   ├── persist.js          # Storage adapters (~80 lines)
│   ├── dev.js              # Dev server (~70 lines)
│   └── generate.js         # Route generator (~130 lines)
├── pages/                  # File-based routes
│   ├── index.html
│   ├── layout.html
│   └── products/
│       ├── index.html
│       └── [id].html
├── components/             # Web Components
│   └── nav-bar/
│       ├── nav-bar.js
│       ├── nav-bar.html
│       └── nav-bar.css
├── state/                  # Signals and stores
│   └── store.js
└── styles/                 # Global CSS
    ├── tokens.css          # Design tokens (custom properties)
    └── global.css          # Base styles + utilities
```

## Docs

- [Getting Started](docs/getting-started.md)
- [Signals](docs/signals.md)
- [Components](docs/components.md)
- [Routing](docs/routing.md)
- [Persistence](docs/persistence.md)
- [CSS](docs/css.md)
- [Dev Server](docs/dev-server.md)
- [AI Workflow](docs/ai-workflow.md)

## Why?

Modern web development is absurd. You need a bundler to write a button. You need a framework to show a list. You need 200MB of node_modules to render "Hello World."

The browser has had everything you need for years:
- **Custom Elements** — components with lifecycle hooks
- **Shadow DOM** — scoped styles without CSS modules
- **CSS Custom Properties** — design tokens without Tailwind
- **CSS Nesting** — structured styles without Sass
- **Proxy** — reactive state without a virtual DOM
- **ES Modules** — imports without webpack

FIS just wires these together. ~350 lines of glue code. You own every line. No black boxes. No magic. No "eject."

## License

MIT
