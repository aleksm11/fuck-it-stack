# AI Workflow

FIS was designed for AI-assisted development. Not as an afterthought — as a core principle.

## Why AI Loves FIS

### What You Write Is What Ships

There's no transpilation. No compilation. No build step. The HTML, JS, and CSS you see in your editor is exactly what the browser executes.

This means an AI agent can:
- Read any file and understand exactly what it does
- Write any file and know exactly what will happen
- Debug by looking at source — not source maps, not compiled output, not minified bundles

Compare this to React: the AI writes JSX, which gets transpiled to `React.createElement` calls, which get bundled with webpack/vite, which produces a minified chunk that bears no resemblance to what was written. Good luck debugging that with an AI.

### No Build = No Build Errors

The #1 time sink for AI agents working with modern frameworks: build tooling. Webpack configs, TypeScript errors, ESLint rules, PostCSS plugins, Babel presets — none of this exists in FIS. The AI writes a file, the browser loads it. Done.

### Simple, Predictable API

The entire FIS API fits on an index card:

```
signal(value)           → reactive state
observe(fn)             → auto-run on changes
computed(fn)            → derived values
batch(fn)               → group updates

FISElement              → extend for components
  data()                → return { selector: value }
  ready()               → setup after mount

initRouter(routes)      → start routing
navigate(path)          → go to page
beforeNavigate(fn)      → route guard

persist(signal, opts)   → save to storage
```

No hooks rules. No dependency arrays. No compiler directives. No lifecycle matrix. An AI can memorize this in one prompt.

### The Binding API is AI-Readable

`data()` returns a plain object mapping selectors to values:

```js
data() {
  return {
    '.username': user.name.get(),      // Set text
    '.avatar@src': user.avatar.get(),  // Set attribute
    '.bar@style.width': '50%',         // Set style
  };
}
```

An AI reads this and immediately understands: this selector gets this value. No virtual DOM diffing, no reconciliation, no render cycle to reason about.

## Chrome DevTools MCP

AI agents with access to Chrome DevTools (via MCP or similar) can work with FIS apps at full speed:

### Inspect Live DOM

```js
// AI can query the actual DOM — no virtual DOM abstraction layer
document.querySelector('nav-bar').shadowRoot.querySelector('.cart-count').textContent
// → "3"
```

### Check Computed Styles

```js
getComputedStyle(element).getPropertyValue('--color-primary')
// → "#7c3aed"
```

### Debug Reactively

```js
// Read signal state directly in console
import('/state/store.js').then(m => console.log(m.cart.peek()))
```

### The Inspect → Edit → Reload Loop

1. AI inspects the live page via DevTools
2. AI edits the source file (HTML, JS, or CSS)
3. Dev server detects the change, reloads the browser
4. AI inspects again to verify

No webpack rebuild. No HMR partial updates that might not reflect the change. No stale module cache. Full reload, clean state, accurate inspection.

## Prompt Template

When asking an AI to build with FIS, include this context:

```
You're building a web app with Fuck It Stack (FIS).

Rules:
- Zero dependencies. No npm install. No build step.
- Components: extend FISElement, use data() for reactive bindings, ready() for setup.
- Templates: /components/{tag}/{tag}.html with Shadow DOM.
- Styling: CSS custom properties from styles/tokens.css, scoped via Shadow DOM.
- State: signal() for reactive values, computed() for derived, persist() for storage.
- Routing: file-based, pages/ directory, [param] for dynamic routes.
- No JSX. No TypeScript. No framework-specific syntax. Just HTML + JS + CSS.

The API:
- signal(val) → .get() / .set() / .peek()
- observe(fn) → auto-tracks .get() calls, returns dispose()
- computed(fn) → read-only signal, .get() / .peek() / .dispose()
- batch(fn) → group writes, fire observers once
- FISElement: data() returns { 'selector': value, 'sel@attr': value, 'sel@style.prop': value }
- persist(signal, { key, storage: 'local'|'session'|'indexeddb', debounce })
```

## Why This Matters

AI agents are good at writing code. They're bad at fighting tooling. Every layer of abstraction — every transpiler, every bundler, every framework-specific concept — is a layer where AI can fail.

FIS removes all those layers. What's left is the platform: HTML, JS, CSS. The things every AI model was trained on. The things that haven't changed fundamentally in 25 years.

Fuck the tooling. Let the AI write for the browser directly.
