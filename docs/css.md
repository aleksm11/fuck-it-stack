# CSS

No Tailwind. No CSS-in-JS. No PostCSS. Just CSS — the version that already ships in every browser.

FIS uses modern CSS features that eliminate the need for preprocessors: custom properties for design tokens, `@layer` for cascade control, native nesting for structure, and Shadow DOM for component scoping.

## Design Tokens

All design values live in CSS custom properties in `styles/tokens.css`:

```css
:root {
  /* Colors */
  --color-bg: #0a0a0f;
  --color-surface: #14141f;
  --color-primary: #7c3aed;
  --color-text: #e4e4e7;
  --color-muted: #71717a;
  --color-border: #27272a;

  /* Typography */
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-4: 16px;
  --space-8: 32px;

  /* Border radius */
  --radius: 8px;
  --radius-sm: 4px;

  /* Transitions */
  --transition: 150ms ease;
}
```

**Web standard:** [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

Custom properties pierce Shadow DOM. Define them once in `:root`, use them everywhere — including inside components. This is how you maintain a consistent design system across scoped components.

```css
/* Inside any component's CSS */
.card {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: var(--space-4);
}
```

Change a token in `tokens.css`, and every component using it updates. No build step. No extraction. Just CSS doing CSS things.

## `@layer` for Cascade Management

Global styles use `@layer` to control the cascade explicitly:

```css
@layer reset, base, utilities;

@layer reset {
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
}

@layer base {
  body {
    font-family: var(--font-sans);
    color: var(--color-text);
    background: var(--color-bg);
  }
}

@layer utilities {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--space-4);
  }
}
```

**Web standard:** [CSS Cascade Layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)

Layer order is declared upfront. Styles in later layers always beat styles in earlier layers, regardless of specificity. No more `!important` battles.

## CSS Nesting

Write structured CSS without Sass:

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }

  .title {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-4);
  }
}
```

**Web standard:** [CSS Nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_nesting)

## Shadow DOM Scoping

Each FISElement component gets its own Shadow DOM. CSS inside the shadow tree is scoped to that component. No leaks in, no leaks out.

```html
<!-- components/card/card.html -->
<link rel="stylesheet" href="/components/card/card.css">
<div class="card">
  <h3 class="title"></h3>
</div>
```

```css
/* components/card/card.css */
.title {
  font-size: var(--text-lg);
  /* This .title only affects <h3> inside this component */
  /* Won't conflict with .title in nav-bar, product-card, or anywhere else */
}
```

**Web standard:** [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)

### The `<link>` Approach

Components load styles via `<link rel="stylesheet">` in their template, not inline `<style>` blocks. Why:

- **Browser caches the CSS file.** Multiple instances of the same component share one cached stylesheet.
- **Separation of concerns.** CSS is in `.css` files. HTML is in `.html` files. JS is in `.js` files. Radical, I know.
- **DevTools friendly.** You see real file names in the Sources panel, not anonymous `<style>` blocks.

## Modern CSS Features

FIS doesn't polyfill anything. Use whatever your target browsers support:

### Container Queries

```css
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    grid-template-columns: 1fr 1fr;
  }
}
```

### `:has()` Selector

```css
/* Style a form group that contains an invalid input */
.form-group:has(input:invalid) {
  border-color: var(--color-danger);
}
```

### `@scope`

```css
@scope (.card) to (.card-footer) {
  /* Styles apply inside .card but not inside .card-footer */
  p { color: var(--color-muted); }
}
```

## Global vs Component Styles

| What | Where | Scoped? |
|---|---|---|
| Design tokens | `styles/tokens.css` | Global (`:root` custom properties) |
| Reset + base | `styles/global.css` | Global (via `@layer`) |
| Component styles | `components/{name}/{name}.css` | Yes (Shadow DOM) |
| Page-specific styles | Inline in page HTML | Global (no Shadow DOM on pages) |

The split is clean: tokens and base styles are global, component styles are scoped. No CSS modules, no BEM conventions, no specificity hacks. Shadow DOM does the scoping. Custom properties bridge the gap.
