# Routing

File-based SPA routing. Drop HTML files in `pages/`, run the generator, and you have routes. No config objects, no route trees, no framework magic.

**Web standard:** [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API)

## File-Based Routes

The `pages/` directory is your route map:

```
pages/
  index.html          →  /
  about.html          →  /about
  products/
    index.html        →  /products
    [id].html         →  /products/:id
  blog/
    index.html        →  /blog
    [slug].html       →  /blog/:slug
  404.html            →  /404 (fallback)
```

**Convention:** `[param]` brackets in filenames become `:param` dynamic segments.

## Route Generation

```bash
node lib/generate.js
```

This scans `pages/` and generates three files:

- **`routes.js`** — ES module route manifest
- **`sitemap.xml`** — static routes only (excludes dynamic `:param` routes)
- **`robots.txt`** — with sitemap reference

Optional: pass a base URL for the sitemap:

```bash
node lib/generate.js https://mysite.com
```

Output:

```js
// routes.js (auto-generated)
export default [
  { route: '/', file: '/pages/index.html', layout: '/pages/layout.html' },
  { route: '/products', file: '/pages/products/index.html', layout: '/pages/layout.html' },
  { route: '/products/:id', file: '/pages/products/[id].html', layout: '/pages/layout.html' },
];
```

Static routes sort before dynamic ones. The dev server auto-regenerates routes when `pages/` changes.

## Layouts

Create a `layout.html` in any directory under `pages/`. Every page in that directory (and subdirectories) wraps in the layout automatically.

```html
<!-- pages/layout.html -->
<nav-bar></nav-bar>
<main class="container">
  <slot></slot>
</main>
<site-footer></site-footer>
```

`<slot></slot>` is where the page content gets injected. The router fetches the layout, replaces `<slot></slot>` with the page HTML, and sets the result as the outlet's innerHTML.

Layouts are resolved by walking up the directory tree from the page file. The nearest `layout.html` wins.

## Router API

### `initRouter(routes)`

Initialize the router. Call once on page load.

```js
import { initRouter } from '/lib/router.js';
import routes from '/routes.js';

initRouter(routes);
```

This:
1. Compiles route patterns into regexes
2. Intercepts `<a>` clicks for client-side navigation
3. Listens for `popstate` (back/forward)
4. Loads the initial route

### `navigate(path)`

Programmatic navigation.

```js
import { navigate } from '/lib/router.js';

navigate('/products/42');
```

Options:

```js
navigate('/products', { pushState: false }); // Navigate without adding to browser history
```

### `beforeNavigate(fn)`

Register a route guard. Guards run before every navigation.

```js
import { beforeNavigate } from '/lib/router.js';

// Require auth
beforeNavigate((path) => {
  if (path.startsWith('/admin') && !isLoggedIn()) {
    return '/login';  // Redirect
  }
  return true;  // Allow
});

// Block navigation
beforeNavigate((path) => {
  if (hasUnsavedChanges()) {
    return false;  // Block — stay on current page
  }
  return true;
});
```

Guard return values:
- `true` — allow navigation
- `false` — block navigation
- `string` — redirect to that path

## Route Events

The router dispatches a `fis:route` [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) on the `#app` outlet after each navigation.

```js
document.getElementById('app').addEventListener('fis:route', (e) => {
  console.log('Navigated to:', e.detail.path);
  console.log('Params:', e.detail.params);

  // Analytics, scroll tracking, etc.
});
```

## Dynamic Parameters

Access route params in page scripts:

```html
<!-- pages/products/[id].html -->
<script type="module">
  const outlet = document.getElementById('app');
  const params = JSON.parse(outlet?.dataset?.routeParams || '{}');

  console.log(params.id);  // "42" for /products/42
</script>
```

In components, use `this.params`:

```js
class ProductPage extends FISElement {
  data() {
    const product = findProduct(this.params.id);
    return { '.name': product.name };
  }
}
```

## CSS Transitions

The router adds `fis-transitioning` to the outlet during navigation. Use it for page transitions:

```css
#app {
  transition: opacity 100ms ease;
}

.fis-transitioning {
  opacity: 0.5;
}
```

The class is added before the page loads and removed after.

## Scroll Restoration

The router automatically:
- **Saves** scroll position to `sessionStorage` when leaving a page
- **Restores** scroll position when navigating back to a page (via back/forward)
- **Scrolls to top** on fresh navigations

Uses `sessionStorage` with keys like `fis-scroll-/products`.

## Link Interception

The router intercepts clicks on `<a href="/...">` elements automatically. Links are handled client-side when:

- `href` starts with `/` (internal link)
- No `target="_blank"`
- No modifier keys (Ctrl, Meta, Shift)

External links, anchor links, and new-tab links work normally.

## 404 Fallback

If no route matches, the router loads `/pages/404.html`:

```html
<!-- pages/404.html -->
<h1>404</h1>
<p>This page doesn't exist.</p>
<a href="/">Go Home</a>
```

## Page Scripts

Pages can include `<script type="module">` tags. The router re-executes them on each navigation by cloning the script elements (the browser ignores script elements injected via innerHTML, so the router creates fresh `<script>` elements to trigger execution).

```html
<!-- pages/dashboard.html -->
<div id="stats"></div>

<script type="module">
  import { fetchStats } from '/state/api.js';

  const stats = await fetchStats();
  document.getElementById('stats').textContent = JSON.stringify(stats);
</script>
```
