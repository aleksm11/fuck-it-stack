// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileRoutes, matchRoute, initRouter, navigate, beforeNavigate } from './router.js';

// --- Pure function tests (no DOM needed) ---

describe('compileRoutes', () => {
  it('compiles static routes', () => {
    const compiled = compileRoutes([{ route: '/', file: '/pages/index.html' }]);
    expect(compiled).toHaveLength(1);
    expect(compiled[0].pattern).toBeInstanceOf(RegExp);
    expect(compiled[0].params).toEqual([]);
    expect(compiled[0].path).toBe('/pages/index.html');
  });

  it('compiles dynamic routes with params', () => {
    const compiled = compileRoutes([
      { route: '/products/:id', file: '/pages/products/[id].html' },
    ]);
    expect(compiled[0].params).toEqual(['id']);
    expect(compiled[0].pattern.source).toBe('^\\/products\\/([^/]+)$');
  });

  it('compiles multiple params', () => {
    const compiled = compileRoutes([
      { route: '/blog/:year/:slug', file: '/pages/blog/[year]/[slug].html' },
    ]);
    expect(compiled[0].params).toEqual(['year', 'slug']);
  });

  it('preserves layout', () => {
    const compiled = compileRoutes([
      { route: '/about', file: '/pages/about.html', layout: '/pages/layout.html' },
    ]);
    expect(compiled[0].layout).toBe('/pages/layout.html');
  });
});

describe('matchRoute', () => {
  const routes = compileRoutes([
    { route: '/', file: '/pages/index.html' },
    { route: '/about', file: '/pages/about.html' },
    { route: '/products', file: '/pages/products/index.html' },
    { route: '/products/:id', file: '/pages/products/[id].html', layout: '/pages/layout.html' },
    { route: '/blog/:year/:slug', file: '/pages/blog/[year]/[slug].html' },
  ]);

  it('matches root', () => {
    const match = matchRoute('/', routes);
    expect(match).not.toBeNull();
    expect(match.file).toBe('/pages/index.html');
    expect(match.params).toEqual({});
  });

  it('matches static routes', () => {
    const match = matchRoute('/about', routes);
    expect(match.file).toBe('/pages/about.html');
  });

  it('matches dynamic route and extracts params', () => {
    const match = matchRoute('/products/42', routes);
    expect(match.file).toBe('/pages/products/[id].html');
    expect(match.params).toEqual({ id: '42' });
    expect(match.layout).toBe('/pages/layout.html');
  });

  it('matches multiple params', () => {
    const match = matchRoute('/blog/2026/hello-world', routes);
    expect(match.params).toEqual({ year: '2026', slug: 'hello-world' });
  });

  it('returns null for unmatched routes', () => {
    expect(matchRoute('/nonexistent', routes)).toBeNull();
  });

  it('does not partially match', () => {
    expect(matchRoute('/about/extra', routes)).toBeNull();
    expect(matchRoute('/aboutx', routes)).toBeNull();
  });

  it('prefers static over dynamic when static listed first', () => {
    const match = matchRoute('/products', routes);
    expect(match.file).toBe('/pages/products/index.html');
    expect(match.params).toEqual({});
  });
});

// --- DOM-dependent tests ---

describe('initRouter (DOM)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    // Mock fetch
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ text: () => Promise.resolve('<h1>Page</h1>') }),
    );
    // Mock history
    globalThis.history.pushState = vi.fn();
    // Mock sessionStorage
    globalThis.sessionStorage = {
      _store: {},
      getItem(k) { return this._store[k] || null; },
      setItem(k, v) { this._store[k] = v; },
    };
    // Mock scrollTo
    globalThis.scrollTo = vi.fn();
  });

  it('loads initial route into outlet', async () => {
    initRouter([{ route: '/', file: '/pages/index.html' }]);
    // Wait for async navigate
    await new Promise(r => setTimeout(r, 10));
    const outlet = document.getElementById('app');
    expect(outlet.innerHTML).toBe('<h1>Page</h1>');
  });

  it('stores route params as dataset', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/items/99' },
      writable: true,
    });
    initRouter([{ route: '/items/:id', file: '/pages/items/[id].html' }]);
    await new Promise(r => setTimeout(r, 10));
    const outlet = document.getElementById('app');
    expect(JSON.parse(outlet.dataset.routeParams)).toEqual({ id: '99' });
  });

  it('dispatches fis:route event', async () => {
    // Ensure location is at root
    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
    });
    const outlet = document.getElementById('app');
    const eventPromise = new Promise(resolve => {
      outlet.addEventListener('fis:route', resolve);
    });
    initRouter([{ route: '/', file: '/pages/index.html' }]);
    const event = await eventPromise;
    expect(event.detail.path).toBe('/');
  });
});
