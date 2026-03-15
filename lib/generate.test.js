import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  fileToRoute,
  scanPages,
  generateSitemap,
  generateRobots,
  generateRoutesModule,
} from './generate.js';

// --- fileToRoute ---

describe('fileToRoute', () => {
  it('converts index.html to /', () => {
    expect(fileToRoute('index.html')).toBe('/');
  });

  it('converts about.html to /about', () => {
    expect(fileToRoute('about.html')).toBe('/about');
  });

  it('converts nested index.html', () => {
    expect(fileToRoute('products/index.html')).toBe('/products');
  });

  it('converts [param] to :param', () => {
    expect(fileToRoute('products/[id].html')).toBe('/products/:id');
  });

  it('converts nested [param]/index.html', () => {
    expect(fileToRoute('blog/[slug]/index.html')).toBe('/blog/:slug');
  });

  it('handles deeply nested paths', () => {
    expect(fileToRoute('a/b/c.html')).toBe('/a/b/c');
  });

  it('handles multiple params', () => {
    expect(fileToRoute('blog/[year]/[slug].html')).toBe('/blog/:year/:slug');
  });

  it('normalizes backslashes', () => {
    expect(fileToRoute('products\\[id].html')).toBe('/products/:id');
  });
});

// --- scanPages (with real temp dirs) ---

describe('scanPages', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fis-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createFile(relPath) {
    const abs = join(tmpDir, relPath);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, `<h1>${relPath}</h1>`);
  }

  it('scans basic pages', () => {
    createFile('index.html');
    createFile('about.html');

    const routes = scanPages(tmpDir);
    expect(routes).toHaveLength(2);

    const routeMap = Object.fromEntries(routes.map(r => [r.route, r.file]));
    expect(routeMap['/']).toContain('index.html');
    expect(routeMap['/about']).toContain('about.html');
  });

  it('scans nested pages', () => {
    createFile('index.html');
    createFile('products/index.html');
    createFile('products/[id].html');

    const routes = scanPages(tmpDir);
    expect(routes).toHaveLength(3);

    const dynamic = routes.find(r => r.route.includes(':'));
    expect(dynamic.route).toBe('/products/:id');
  });

  it('excludes layout.html from routes', () => {
    createFile('index.html');
    createFile('layout.html');

    const routes = scanPages(tmpDir);
    expect(routes).toHaveLength(1);
    expect(routes[0].route).toBe('/');
  });

  it('detects and links layout to child routes', () => {
    createFile('index.html');
    createFile('products/layout.html');
    createFile('products/index.html');
    createFile('products/[id].html');

    const routes = scanPages(tmpDir);
    const productRoutes = routes.filter(r => r.route.startsWith('/products'));

    for (const r of productRoutes) {
      expect(r.layout).toContain('layout.html');
    }

    // Root index should not have the products layout
    const root = routes.find(r => r.route === '/');
    expect(root.layout).toBeUndefined();
  });

  it('sorts static routes before dynamic', () => {
    createFile('products/index.html');
    createFile('products/[id].html');

    const routes = scanPages(tmpDir);
    expect(routes[0].route).toBe('/products');
    expect(routes[1].route).toBe('/products/:id');
  });

  it('ignores non-HTML files', () => {
    createFile('index.html');
    writeFileSync(join(tmpDir, 'style.css'), 'body {}');

    const routes = scanPages(tmpDir);
    expect(routes).toHaveLength(1);
  });
});

// --- generateSitemap ---

describe('generateSitemap', () => {
  it('generates valid XML', () => {
    const routes = [
      { route: '/', file: '/pages/index.html' },
      { route: '/about', file: '/pages/about.html' },
    ];
    const xml = generateSitemap(routes, 'https://example.com');
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<loc>https://example.com</loc>');
    expect(xml).toContain('<loc>https://example.com/about</loc>');
  });

  it('excludes dynamic routes', () => {
    const routes = [
      { route: '/', file: '/pages/index.html' },
      { route: '/products/:id', file: '/pages/products/[id].html' },
    ];
    const xml = generateSitemap(routes, 'https://example.com');
    expect(xml).not.toContain(':id');
    expect(xml).toContain('<loc>https://example.com</loc>');
  });

  it('handles empty routes', () => {
    const xml = generateSitemap([], 'https://example.com');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
  });
});

// --- generateRobots ---

describe('generateRobots', () => {
  it('generates robots.txt with sitemap', () => {
    const txt = generateRobots('https://example.com');
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Sitemap: https://example.com/sitemap.xml');
  });
});

// --- generateRoutesModule ---

describe('generateRoutesModule', () => {
  it('generates valid ES module', () => {
    const routes = [
      { route: '/', file: '/pages/index.html' },
      { route: '/products/:id', file: '/pages/products/[id].html', layout: '/pages/layout.html' },
    ];
    const code = generateRoutesModule(routes);
    expect(code).toContain('export default [');
    expect(code).toContain("route: '/'");
    expect(code).toContain("layout: '/pages/layout.html'");
  });
});
