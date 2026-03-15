/**
 * FIS Route Generator — build-time file-based routing
 *
 * Scans pages/ directory, generates:
 *   - routes.js  (ES module route manifest)
 *   - sitemap.xml (excludes dynamic routes)
 *   - robots.txt  (with sitemap reference)
 *
 * Uses only Node built-ins.
 */

import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, relative, sep, basename, dirname } from 'path';

/**
 * Convert a file path (relative to pages/) into a route string.
 * @param {string} filePath - e.g. 'products/[id].html'
 * @returns {string} - e.g. '/products/:id'
 */
export function fileToRoute(filePath) {
  // Normalize separators
  let route = filePath.replace(/\\/g, '/');

  // Remove .html extension
  route = route.replace(/\.html$/, '');

  // Remove trailing /index
  route = route.replace(/\/index$/, '') || '/';

  // Handle bare 'index'
  if (route === 'index') return '/';

  // Convert [param] to :param
  route = route.replace(/\[([^\]]+)\]/g, ':$1');

  // Ensure leading slash
  if (!route.startsWith('/')) route = '/' + route;

  return route;
}

/**
 * Scan a pages directory and return route definitions.
 * @param {string} pagesDir - Absolute path to pages/ directory
 * @returns {Array<{route: string, file: string, layout?: string}>}
 */
export function scanPages(pagesDir) {
  const routes = [];
  const layouts = new Map(); // dir → layout file path

  // First pass: find all layout.html files
  walkDir(pagesDir, (absPath) => {
    if (basename(absPath) === 'layout.html') {
      const dir = dirname(absPath);
      const relDir = relative(pagesDir, dir) || '.';
      layouts.set(relDir, '/pages/' + relative(pagesDir, absPath).replace(/\\/g, '/'));
    }
  });

  // Second pass: collect routes
  walkDir(pagesDir, (absPath) => {
    const name = basename(absPath);

    // Skip non-HTML and layout files
    if (!name.endsWith('.html')) return;
    if (name === 'layout.html') return;

    const relPath = relative(pagesDir, absPath).replace(/\\/g, '/');
    const route = fileToRoute(relPath);
    const file = '/pages/' + relPath;

    // Find nearest layout: check this file's dir and parents
    let layout;
    let checkDir = relative(pagesDir, dirname(absPath)) || '.';
    while (true) {
      if (layouts.has(checkDir)) {
        layout = layouts.get(checkDir);
        break;
      }
      if (checkDir === '.') break;
      checkDir = dirname(checkDir);
      if (checkDir === '..' || checkDir === '') { checkDir = '.'; }
    }

    const entry = { route, file };
    if (layout) entry.layout = layout;
    routes.push(entry);
  });

  // Sort: static routes before dynamic, then alphabetical
  routes.sort((a, b) => {
    const aDynamic = a.route.includes(':');
    const bDynamic = b.route.includes(':');
    if (aDynamic !== bDynamic) return aDynamic ? 1 : -1;
    return a.route.localeCompare(b.route);
  });

  return routes;
}

/**
 * Generate sitemap.xml content (excludes dynamic routes).
 * @param {Array<{route: string}>} routes
 * @param {string} baseUrl
 * @returns {string}
 */
export function generateSitemap(routes, baseUrl) {
  const staticRoutes = routes.filter(r => !r.route.includes(':'));
  const urls = staticRoutes.map(r =>
    `  <url><loc>${baseUrl}${r.route === '/' ? '' : r.route}</loc></url>`,
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Generate robots.txt content.
 * @param {string} baseUrl
 * @returns {string}
 */
export function generateRobots(baseUrl) {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * Generate routes.js ES module content.
 * @param {Array<{route: string, file: string, layout?: string}>} routes
 * @returns {string}
 */
export function generateRoutesModule(routes) {
  const entries = routes.map(r => {
    let entry = `  { route: '${r.route}', file: '${r.file}'`;
    if (r.layout) entry += `, layout: '${r.layout}'`;
    entry += ' }';
    return entry;
  });

  return `export default [\n${entries.join(',\n')},\n];\n`;
}

/** Walk directory recursively, calling fn for each file. */
function walkDir(dir, fn) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      walkDir(abs, fn);
    } else {
      fn(abs);
    }
  }
}

/**
 * Scan components/ directory for web component subdirectories.
 * @param {string} componentsDir - Absolute path to components/ directory
 * @returns {Array<{name: string, path: string}>}
 */
export function scanComponents(componentsDir) {
  if (!existsSync(componentsDir)) return [];

  const entries = readdirSync(componentsDir);
  const components = [];

  for (const entry of entries) {
    // Skip hidden dirs
    if (entry.startsWith('.')) continue;
    // Must contain a hyphen (web component spec)
    if (!entry.includes('-')) continue;

    const abs = join(componentsDir, entry);
    if (!statSync(abs).isDirectory()) continue;

    // Check for matching .js file
    const jsFile = join(abs, `${entry}.js`);
    if (!existsSync(jsFile)) continue;

    components.push({
      name: entry,
      path: `./components/${entry}/${entry}.js`,
    });
  }

  return components;
}

/**
 * Generate a components.js ES module with side-effect imports.
 * @param {Array<{name: string, path: string}>} components
 * @returns {string}
 */
export function generateComponentsModule(components) {
  const sorted = [...components].sort((a, b) => a.name.localeCompare(b.name));
  const imports = sorted.map(c => `import '${c.path}';`);
  return `// Auto-generated — do not edit\n${imports.join('\n')}${imports.length ? '\n' : ''}`;
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith('generate.js')) {
  const root = process.cwd();
  const pagesDir = join(root, 'pages');

  if (!existsSync(pagesDir)) {
    console.error('No pages/ directory found');
    process.exit(1);
  }

  const baseUrl = process.argv[2] || 'https://example.com';
  const routes = scanPages(pagesDir);

  writeFileSync(join(root, 'routes.js'), generateRoutesModule(routes));
  writeFileSync(join(root, 'sitemap.xml'), generateSitemap(routes, baseUrl));
  writeFileSync(join(root, 'robots.txt'), generateRobots(baseUrl));

  console.log(`Generated ${routes.length} routes`);
  routes.forEach(r => console.log(`  ${r.route} → ${r.file}${r.layout ? ` (layout: ${r.layout})` : ''}`));
}
