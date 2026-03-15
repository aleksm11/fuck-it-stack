/**
 * FIS Router — file-based SPA routing
 *
 * Reads route manifest, intercepts navigation, fetches pages on demand.
 * Zero dependencies.
 */

// Configuration
const OUTLET_ID = 'app';
const TRANSITION_CLASS = 'fis-transitioning';

/** @type {Array<{pattern: RegExp, params: string[], path: string, layout?: string}>} */
let compiledRoutes = [];

/** @type {Array<(path: string) => string|boolean>} */
const guards = [];

/**
 * Compile route definitions into regex patterns.
 * Exported for testing.
 * @param {Array<{route: string, file: string, layout?: string}>} routes
 * @returns {Array<{pattern: RegExp, params: string[], path: string, layout?: string}>}
 */
export function compileRoutes(routes) {
  return routes.map(r => {
    const params = [];
    const pattern = r.route.replace(/:([^/]+)/g, (_, name) => {
      params.push(name);
      return '([^/]+)';
    });
    return {
      pattern: new RegExp(`^${pattern}$`),
      params,
      path: r.file,
      layout: r.layout,
    };
  });
}

/**
 * Match a path against compiled routes.
 * Exported for testing.
 * @param {string} path
 * @param {Array<{pattern: RegExp, params: string[], path: string, layout?: string}>} [routes]
 * @returns {{ file: string, params: Record<string, string>, layout?: string } | null}
 */
export function matchRoute(path, routes) {
  const list = routes || compiledRoutes;
  for (const route of list) {
    const m = path.match(route.pattern);
    if (m) {
      const params = {};
      route.params.forEach((name, i) => { params[name] = m[i + 1]; });
      return { file: route.path, params, layout: route.layout };
    }
  }
  return null;
}

/**
 * Initialize the router with a route manifest.
 * Call this on page load.
 * @param {Array<{route: string, file: string, layout?: string}>} routes
 */
export function initRouter(routes) {
  compiledRoutes = compileRoutes(routes);

  // Intercept <a> clicks
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href.startsWith('/')) return;
    if (anchor.target === '_blank') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(href);
  });

  // Handle back/forward
  window.addEventListener('popstate', () => {
    navigate(location.pathname, { pushState: false });
  });

  // Initial route
  navigate(location.pathname, { pushState: false });
}

/**
 * Navigate to a path. Fetches page HTML, injects into outlet.
 * @param {string} path - URL path to navigate to
 * @param {{ pushState?: boolean }} [opts]
 */
export async function navigate(path, opts = {}) {
  const { pushState = true } = opts;

  // Run guards
  for (const guard of guards) {
    const result = guard(path);
    if (result === false) return;
    if (typeof result === 'string') { path = result; break; }
  }

  // Match route
  const match = matchRoute(path);
  if (!match) {
    await loadPage('/pages/404.html', {});
    return;
  }

  const outlet = document.getElementById(OUTLET_ID);
  if (!outlet) return;

  // CSS transition
  outlet.classList.add(TRANSITION_CLASS);

  // Save scroll position
  sessionStorage.setItem(
    `fis-scroll-${location.pathname}`,
    JSON.stringify({ x: scrollX, y: scrollY }),
  );

  // Push state
  if (pushState) history.pushState(null, '', path);

  // Store route params
  outlet.dataset.routeParams = JSON.stringify(match.params);

  // Load layout + page
  await loadPage(match.file, match.params, match.layout);

  // Remove transition class
  outlet.classList.remove(TRANSITION_CLASS);

  // Restore scroll
  const saved = sessionStorage.getItem(`fis-scroll-${path}`);
  if (saved) {
    const { x, y } = JSON.parse(saved);
    scrollTo(x, y);
  } else {
    scrollTo(0, 0);
  }

  // Dispatch event
  outlet.dispatchEvent(
    new CustomEvent('fis:route', { detail: { path, params: match.params } }),
  );
}

/**
 * Register a route guard.
 * @param {(path: string) => string|boolean} fn - Return true to allow, false to block, string to redirect
 */
export function beforeNavigate(fn) {
  guards.push(fn);
}

async function loadPage(file, params, layoutFile) {
  const outlet = document.getElementById(OUTLET_ID);

  let html = '';

  if (layoutFile) {
    const layoutRes = await fetch(layoutFile);
    const layoutHtml = await layoutRes.text();
    const pageRes = await fetch(file);
    const pageHtml = await pageRes.text();
    html = layoutHtml.replace('<slot></slot>', pageHtml);
  } else {
    const res = await fetch(file);
    html = await res.text();
  }

  outlet.innerHTML = html;

  // Execute <script type="module"> tags (clone + replace to trigger execution)
  const scripts = outlet.querySelectorAll('script[type="module"]');
  for (const oldScript of scripts) {
    const newScript = document.createElement('script');
    newScript.type = 'module';
    if (oldScript.src) {
      newScript.src = oldScript.src;
    } else {
      newScript.textContent = oldScript.textContent;
    }
    oldScript.replaceWith(newScript);
  }
}
