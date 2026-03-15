# Components

Web Components. For real this time. No polyfills, no compiler, no framework-specific component model. Just the [Custom Elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) spec with a thin base class.

## FISElement

Every component extends `FISElement`, which extends `HTMLElement`. It handles:

1. Shadow DOM creation (`mode: 'open'`)
2. Template loading and caching
3. Reactive data bindings via `data()`
4. Lifecycle hook via `ready()`
5. Route params via `this.params`

```js
import { FISElement } from '/lib/element.js';

class MyComponent extends FISElement {
  // Optional: reactive bindings
  data() { return {}; }

  // Optional: called after template is loaded
  ready() {}
}
customElements.define('my-component', MyComponent);
```

That's the entire API surface.

## Template Convention

Templates live at `/components/{tag-name}/{tag-name}.html`. FIS fetches this automatically when the component connects to the DOM.

```
components/
  nav-bar/
    nav-bar.js      # Component class
    nav-bar.html    # Shadow DOM template
    nav-bar.css     # Scoped styles
```

The HTML file is the Shadow DOM content:

```html
<link rel="stylesheet" href="/components/nav-bar/nav-bar.css">
<nav>
  <a href="/" class="logo">⚡ My App</a>
  <span class="cart-count">0</span>
</nav>
```

**Template caching:** The first instance of a component fetches the template. All subsequent instances clone from the cached `<template>` element. One fetch per tag name, ever.

## Shadow DOM

Every FISElement gets a Shadow DOM (`mode: 'open'`). This means:

- **Styles are scoped.** CSS in your component doesn't leak out. Global CSS doesn't leak in (unless you use CSS custom properties, which pierce the shadow boundary by design).
- **DOM is encapsulated.** `document.querySelector` won't find elements inside your component. Use `this.shadowRoot.querySelector` instead.
- **No class name conflicts.** Use `.card`, `.title`, `.btn` freely — they're scoped to your component.

## `data()` — Reactive Bindings

The `data()` method maps CSS selectors to values. FIS calls it inside an `observe()`, so signal reads are automatically tracked and the bindings update when signals change.

### Text Content

Plain selector → sets `textContent`:

```js
data() {
  return {
    '.username': user.name.get(),       // <span class="username">Alex</span>
    '.count': String(items.get().length), // <span class="count">5</span>
  };
}
```

### Attributes

`selector@attribute` → sets the attribute:

```js
data() {
  return {
    '.avatar@src': user.avatar.get(),           // <img class="avatar" src="...">
    '.link@href': `/users/${user.id.get()}`,    // <a class="link" href="/users/42">
    '.card@data-status': status.get(),          // <div class="card" data-status="active">
  };
}
```

### Boolean Attributes

Boolean HTML attributes (`disabled`, `hidden`, `checked`, `readonly`, `required`, `open`, `selected`, `autofocus`, `novalidate`, `formnovalidate`, `multiple`) are handled automatically — truthy values add the attribute, falsy values remove it:

```js
data() {
  return {
    '.submit-btn@disabled': !isValid.get(),  // Adds/removes disabled attribute
    '.details@open': expanded.get(),         // Adds/removes open attribute
    '.field@required': true,                 // Always required
  };
}
```

### Style Properties

`selector@style.property` → sets inline style:

```js
data() {
  return {
    '.progress@style.width': `${percent.get()}%`,
    '.panel@style.opacity': isVisible.get() ? '1' : '0',
    '.item@style.backgroundColor': color.get(),
  };
}
```

## `ready()` — Lifecycle Hook

Called once after the template is loaded and bindings are set up. Use it for event listeners, DOM manipulation, or any setup that needs the template to exist.

```js
class SearchBar extends FISElement {
  data() {
    return { '.results-count': results.get().length };
  }

  ready() {
    const input = this.shadowRoot.querySelector('input');
    input.addEventListener('input', (e) => {
      query.set(e.target.value);
    });

    // Focus on mount
    input.focus();
  }
}
customElements.define('search-bar', SearchBar);
```

## `this.params` — Route Parameters

Access the current route parameters from any component. Reads from the `#app` outlet's `data-route-params` attribute, which the router sets on navigation.

```js
class ProductDetail extends FISElement {
  data() {
    const product = products.peek().find(p => p.id === this.params.id);
    return {
      '.product-name': product?.name || 'Not found',
      '.product-price': `$${product?.price || 0}`,
    };
  }
}
customElements.define('product-detail', ProductDetail);
```

## CSS Scoping

Shadow DOM gives you free CSS scoping. Your component's CSS only affects its own DOM. Use a `<link>` tag in your template to load styles:

```html
<!-- components/card/card.html -->
<link rel="stylesheet" href="/components/card/card.css">
<div class="card">
  <h3 class="title"></h3>
  <p class="body"></p>
</div>
```

```css
/* components/card/card.css */
.card {
  background: var(--color-surface);       /* CSS custom properties pierce shadow DOM */
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--space-4);
}

.title {
  font-size: var(--text-lg);  /* No conflict with any other .title in the app */
}
```

**Why `<link>` instead of `<style>`?** The browser caches linked stylesheets. Multiple instances of the same component share one cached CSS file.

## Minimal Component

No `data()`, no `ready()` — just a template:

```js
import { FISElement } from '/lib/element.js';

class SiteFooter extends FISElement {}
customElements.define('site-footer', SiteFooter);
```

```html
<!-- components/site-footer/site-footer.html -->
<link rel="stylesheet" href="/components/site-footer/site-footer.css">
<footer>
  <p>Built with ⚡ Fuck It Stack</p>
</footer>
```

The template loads, Shadow DOM scopes the styles, done. Three lines of JS.

## Full Example: Nav Bar with Cart Count

```js
// components/nav-bar/nav-bar.js
import { FISElement } from '/lib/element.js';
import { cartCount } from '/state/store.js';

class NavBar extends FISElement {
  data() {
    return {
      '.cart-count': cartCount.get(),  // Auto-updates when cart changes
    };
  }
}
customElements.define('nav-bar', NavBar);
```

```html
<!-- components/nav-bar/nav-bar.html -->
<link rel="stylesheet" href="/components/nav-bar/nav-bar.css">
<nav>
  <a href="/" class="logo">⚡ FIS Store</a>
  <div class="links">
    <a href="/">Home</a>
    <a href="/products">Products</a>
    <a href="/cart">Cart (<span class="cart-count">0</span>)</a>
  </div>
</nav>
```

The `.cart-count` span updates reactively whenever the cart signal changes. No manual DOM manipulation. No re-renders. Just a binding.
