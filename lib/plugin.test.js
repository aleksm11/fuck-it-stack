/**
 * plugin.test.js — Tests for FIS Plugin System
 *
 * These tests require lib/plugin.js to export:
 *   - loadPlugins(projectRoot): Promise<Plugin[]>
 *       Reads fis.config.js from projectRoot, resolves + loads each plugin.
 *   - runTransform(file, plugins): Promise<TransformResult|null>
 *       Runs the transform pipeline; first non-null result wins.
 *   - getHeadInjections(plugins, pagePath): string
 *       Collects head HTML from all plugins, joined with newline.
 *   - getBodyInjections(plugins, pagePath): string
 *       Collects body HTML from all plugins, joined with newline.
 *   - runServeMiddleware(req, res, plugins): Promise<boolean>
 *       Runs serve middleware pipeline; stops on first truthy return.
 *
 * Plugin shape:
 *   {
 *     name: string,            // required
 *     extensions: string[],    // required
 *     setup?(config): void,    // called during loadPlugins
 *     transform?(file): any,   // called during runTransform
 *     head?: string|fn,        // string or (pagePath) => string
 *     body?: string|fn,        // string or (pagePath) => string
 *     serve?(req, res): any,   // truthy return = request handled
 *   }
 *
 * NOTE: Tests in loadPlugins describe() will FAIL until lib/plugin.js exists.
 * Tests in runTransform, getHeadInjections, getBodyInjections, and
 * runServeMiddleware describe()s use in-memory plugin objects and will
 * also fail until plugin.js exports those functions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadPlugins,
  runTransform,
  getHeadInjections,
  getBodyInjections,
  runServeMiddleware,
} from './plugin.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temp directory for an isolated project. */
function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'fis-plugin-test-'));
}

/** Write fis.config.js with a plugins array. Entries may be strings or arrays. */
function writeFisConfig(projectRoot, plugins) {
  // Serialize using JSON — valid for arrays of strings/arrays/objects.
  const src = `export default { plugins: ${JSON.stringify(plugins)} };\n`;
  writeFileSync(join(projectRoot, 'fis.config.js'), src, 'utf8');
}

/** Write fis.config.js with no plugins key. */
function writeFisConfigNoPlugins(projectRoot) {
  writeFileSync(join(projectRoot, 'fis.config.js'), `export default { siteUrl: 'https://example.com' };\n`, 'utf8');
}

/**
 * Write a minimal valid plugin file.
 * Uses globalThis.__fisTestState (if present) for setup/call tracking.
 */
function writePluginFile(filePath, opts = {}) {
  const {
    name = 'test-plugin',
    extensions = ['.md'],
    includeSetup = false,
    setupThrows = false,
    includeTransform = false,
    transformResult = null,
    includeHead = false,
    headValue = null,
    includeBody = false,
    bodyValue = null,
    includeServe = false,
    serveReturn = null,
    isFactory = false,          // if true: export default (options) => plugin
    captureOptions = false,     // store received options in globalThis.__fisTestState.receivedOptions
  } = opts;

  const setupBody = setupThrows
    ? `throw new Error('setup failed in ${name}');`
    : `if (globalThis.__fisTestState) { globalThis.__fisTestState.setupCalls = globalThis.__fisTestState.setupCalls || []; globalThis.__fisTestState.setupCalls.push(${JSON.stringify(name)}); }`;

  const captureBody = captureOptions
    ? `if (globalThis.__fisTestState) { globalThis.__fisTestState.receivedOptions = options; }`
    : '';

  const pluginObj = [
    `name: ${JSON.stringify(name)}`,
    `extensions: ${JSON.stringify(extensions)}`,
    includeSetup  ? `setup(config) { ${setupBody} }` : null,
    includeTransform ? `transform(file) { return ${JSON.stringify(transformResult)}; }` : null,
    includeHead && headValue !== null
      ? (typeof headValue === 'string'
          ? `head: ${JSON.stringify(headValue)}`
          : `head: (pagePath) => ${JSON.stringify(headValue)} + '|' + pagePath`)
      : null,
    includeBody && bodyValue !== null
      ? (typeof bodyValue === 'string'
          ? `body: ${JSON.stringify(bodyValue)}`
          : `body: (pagePath) => ${JSON.stringify(bodyValue)} + '|' + pagePath`)
      : null,
    includeServe
      ? `serve(req, res) { return ${JSON.stringify(serveReturn)}; }`
      : null,
  ].filter(Boolean).join(',\n    ');

  let src;
  if (isFactory) {
    src = `export default function createPlugin(options) {
  ${captureBody}
  return {
    ${pluginObj}
  };
}\n`;
  } else {
    src = `export default {\n  ${pluginObj}\n};\n`;
  }

  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, src, 'utf8');
}

/** Build a minimal in-memory plugin object for non-loadPlugins tests. */
function makePlugin(overrides = {}) {
  return {
    name: 'inline-plugin',
    extensions: ['.md'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. loadPlugins(projectRoot)
// ---------------------------------------------------------------------------

describe('loadPlugins', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Reset shared tracking state before each test
    globalThis.__fisTestState = { setupCalls: [] };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete globalThis.__fisTestState;
  });

  // --- Basic loading ---

  it('returns an empty array when fis.config.js has an empty plugins array', async () => {
    writeFisConfig(tmpDir, []);
    const plugins = await loadPlugins(tmpDir);
    expect(plugins).toEqual([]);
  });

  it('returns an empty array when fis.config.js is missing', async () => {
    // No fis.config.js written — bare temp dir
    const plugins = await loadPlugins(tmpDir);
    expect(plugins).toEqual([]);
  });

  it('returns an empty array when fis.config.js has no plugins key', async () => {
    writeFisConfigNoPlugins(tmpDir);
    const plugins = await loadPlugins(tmpDir);
    expect(plugins).toEqual([]);
  });

  it('loads a single local plugin and returns it in the array', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'md-transform.js');
    writePluginFile(pluginPath, { name: 'md-transform', extensions: ['.md'] });
    writeFisConfig(tmpDir, ['./plugins/md-transform.js']);

    const plugins = await loadPlugins(tmpDir);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('md-transform');
    expect(plugins[0].extensions).toEqual(['.md']);
  });

  it('resolves local plugin path relative to projectRoot', async () => {
    // Plugin is in a nested folder
    const pluginPath = join(tmpDir, 'plugins', 'sub', 'deep-plugin.js');
    writePluginFile(pluginPath, { name: 'deep-plugin', extensions: ['.html'] });
    writeFisConfig(tmpDir, ['./plugins/sub/deep-plugin.js']);

    const plugins = await loadPlugins(tmpDir);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('deep-plugin');
  });

  it('loads multiple local plugins and returns them in registration order', async () => {
    writePluginFile(join(tmpDir, 'plugins', 'alpha.js'), { name: 'alpha', extensions: ['.md'] });
    writePluginFile(join(tmpDir, 'plugins', 'beta.js'), { name: 'beta', extensions: ['.html'] });
    writePluginFile(join(tmpDir, 'plugins', 'gamma.js'), { name: 'gamma', extensions: ['.css'] });
    writeFisConfig(tmpDir, [
      './plugins/alpha.js',
      './plugins/beta.js',
      './plugins/gamma.js',
    ]);

    const plugins = await loadPlugins(tmpDir);
    expect(plugins).toHaveLength(3);
    expect(plugins.map(p => p.name)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('loads a plugin from npm-style bare specifier (via local node_modules)', async () => {
    // Simulate an installed npm package in the project's node_modules
    const pkgDir = join(tmpDir, 'node_modules', 'fis-plugin-highlight');
    writePluginFile(join(pkgDir, 'index.js'), {
      name: 'fis-plugin-highlight',
      extensions: ['.md'],
    });
    writeFileSync(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: 'fis-plugin-highlight', main: 'index.js' }),
      'utf8',
    );
    writeFisConfig(tmpDir, ['fis-plugin-highlight']);

    const plugins = await loadPlugins(tmpDir);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('fis-plugin-highlight');
  });

  // --- Tuple syntax ---

  it('handles tuple syntax — string plugin ref', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'themed.js');
    writePluginFile(pluginPath, { name: 'themed', extensions: ['.md'], isFactory: true, captureOptions: true });
    writeFisConfig(tmpDir, [['./plugins/themed.js', { theme: 'dark' }]]);

    const plugins = await loadPlugins(tmpDir);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('themed');
  });

  it('passes options from tuple to the plugin factory', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'themed.js');
    writePluginFile(pluginPath, { name: 'themed', extensions: ['.md'], isFactory: true, captureOptions: true });
    writeFisConfig(tmpDir, [['./plugins/themed.js', { theme: 'dark' }]]);

    await loadPlugins(tmpDir);
    expect(globalThis.__fisTestState.receivedOptions).toEqual({ theme: 'dark' });
  });

  // --- Validation ---

  it('throws with a clear message when plugin file is not found', async () => {
    writeFisConfig(tmpDir, ['./plugins/does-not-exist.js']);
    await expect(loadPlugins(tmpDir)).rejects.toThrow('./plugins/does-not-exist.js');
  });

  it('throws with a clear message when plugin has no name', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'nameless.js');
    mkdirSync(join(tmpDir, 'plugins'), { recursive: true });
    writeFileSync(pluginPath, `export default { extensions: ['.md'] };\n`, 'utf8');
    writeFisConfig(tmpDir, ['./plugins/nameless.js']);

    await expect(loadPlugins(tmpDir)).rejects.toThrow(/name/i);
  });

  it('throws with a clear message when plugin has no extensions', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'noext.js');
    mkdirSync(join(tmpDir, 'plugins'), { recursive: true });
    writeFileSync(pluginPath, `export default { name: 'noext-plugin' };\n`, 'utf8');
    writeFisConfig(tmpDir, ['./plugins/noext.js']);

    await expect(loadPlugins(tmpDir)).rejects.toThrow(/extensions/i);
  });

  it('throws when plugin file has no default export', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'no-default.js');
    mkdirSync(join(tmpDir, 'plugins'), { recursive: true });
    writeFileSync(pluginPath, `export const name = 'oops';\n`, 'utf8');
    writeFisConfig(tmpDir, ['./plugins/no-default.js']);

    await expect(loadPlugins(tmpDir)).rejects.toThrow();
  });

  // --- setup() calls ---

  it('calls setup() on each plugin during loading', async () => {
    writePluginFile(join(tmpDir, 'plugins', 'a.js'), {
      name: 'plugin-a',
      extensions: ['.md'],
      includeSetup: true,
    });
    writeFisConfig(tmpDir, ['./plugins/a.js']);

    await loadPlugins(tmpDir);
    expect(globalThis.__fisTestState.setupCalls).toContain('plugin-a');
  });

  it('calls setup() on all plugins in registration order', async () => {
    for (const name of ['first', 'second', 'third']) {
      writePluginFile(join(tmpDir, 'plugins', `${name}.js`), {
        name,
        extensions: ['.md'],
        includeSetup: true,
      });
    }
    writeFisConfig(tmpDir, [
      './plugins/first.js',
      './plugins/second.js',
      './plugins/third.js',
    ]);

    await loadPlugins(tmpDir);
    expect(globalThis.__fisTestState.setupCalls).toEqual(['first', 'second', 'third']);
  });

  it('passes the fis.config.js config to setup()', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'config-check.js');
    mkdirSync(join(tmpDir, 'plugins'), { recursive: true });
    writeFileSync(pluginPath, `
export default {
  name: 'config-check',
  extensions: ['.md'],
  setup(config) {
    if (globalThis.__fisTestState) {
      globalThis.__fisTestState.receivedConfig = config;
    }
  }
};
`, 'utf8');
    writeFisConfig(tmpDir, ['./plugins/config-check.js']);

    await loadPlugins(tmpDir);
    // config should be the parsed fis.config.js object
    expect(globalThis.__fisTestState.receivedConfig).toBeDefined();
    expect(typeof globalThis.__fisTestState.receivedConfig).toBe('object');
  });

  it('propagates setup() errors with the plugin name in the message', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'exploder.js');
    mkdirSync(join(tmpDir, 'plugins'), { recursive: true });
    writeFileSync(pluginPath, `
export default {
  name: 'exploder',
  extensions: ['.md'],
  setup() { throw new Error('boom'); }
};
`, 'utf8');
    writeFisConfig(tmpDir, ['./plugins/exploder.js']);

    await expect(loadPlugins(tmpDir)).rejects.toThrow(/exploder/i);
  });
});

// ---------------------------------------------------------------------------
// 2. runTransform(file, plugins)
// ---------------------------------------------------------------------------

describe('runTransform', () => {
  it('returns null when plugins array is empty', async () => {
    const file = { path: 'pages/index.md', content: '# Hello', ext: '.md' };
    const result = await runTransform(file, []);
    expect(result).toBeNull();
  });

  it('returns null when no plugin handles the file extension', async () => {
    const plugin = makePlugin({
      extensions: ['.html'],
      transform: vi.fn().mockReturnValue('<p>transformed</p>'),
    });
    const file = { path: 'pages/blog.md', content: '# Hello', ext: '.md' };

    const result = await runTransform(file, [plugin]);
    expect(result).toBeNull();
    expect(plugin.transform).not.toHaveBeenCalled();
  });

  it('only calls transform on plugins whose extensions include the file ext', async () => {
    const htmlPlugin = makePlugin({ name: 'html-plugin', extensions: ['.html'], transform: vi.fn() });
    const mdPlugin = makePlugin({ name: 'md-plugin', extensions: ['.md'], transform: vi.fn().mockReturnValue('<p>parsed</p>') });

    const file = { path: 'pages/blog.md', content: '# Hello', ext: '.md' };

    await runTransform(file, [htmlPlugin, mdPlugin]);

    expect(htmlPlugin.transform).not.toHaveBeenCalled();
    expect(mdPlugin.transform).toHaveBeenCalledTimes(1);
  });

  it('passes the correct file object to transform()', async () => {
    const transform = vi.fn().mockReturnValue('<p>hello</p>');
    const plugin = makePlugin({ extensions: ['.md'], transform });

    const file = { path: 'pages/blog.md', content: '# Hello', ext: '.md' };
    await runTransform(file, [plugin]);

    expect(transform).toHaveBeenCalledWith(file);
    expect(transform).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'pages/blog.md', content: '# Hello', ext: '.md' }),
    );
  });

  it('returns the result of the first plugin that handles the file', async () => {
    const result = '<p>converted</p>';
    const plugin = makePlugin({
      extensions: ['.md'],
      transform: vi.fn().mockReturnValue(result),
    });
    const file = { path: 'pages/blog.md', content: '# Hello', ext: '.md' };

    expect(await runTransform(file, [plugin])).toBe(result);
  });

  it('stops calling further plugins after the first non-null result', async () => {
    const first = makePlugin({ name: 'first', extensions: ['.md'], transform: vi.fn().mockReturnValue('<p>first</p>') });
    const second = makePlugin({ name: 'second', extensions: ['.md'], transform: vi.fn().mockReturnValue('<p>second</p>') });

    const file = { path: 'pages/blog.md', content: '# Hello', ext: '.md' };
    const result = await runTransform(file, [first, second]);

    expect(result).toBe('<p>first</p>');
    expect(second.transform).not.toHaveBeenCalled();
  });

  it('skips null-returning plugins and continues to the next', async () => {
    const passThrough = makePlugin({ name: 'pass', extensions: ['.md'], transform: vi.fn().mockReturnValue(null) });
    const handler = makePlugin({ name: 'handler', extensions: ['.md'], transform: vi.fn().mockReturnValue('<p>got it</p>') });

    const file = { path: 'pages/blog.md', content: '# Hello', ext: '.md' };
    const result = await runTransform(file, [passThrough, handler]);

    expect(result).toBe('<p>got it</p>');
    expect(passThrough.transform).toHaveBeenCalled();
    expect(handler.transform).toHaveBeenCalled();
  });

  it('skips plugins with no transform method without throwing', async () => {
    const noTransform = makePlugin({ name: 'no-transform', extensions: ['.md'] }); // no transform
    const file = { path: 'pages/blog.md', content: '# Hello', ext: '.md' };

    await expect(runTransform(file, [noTransform])).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. getHeadInjections(plugins, pagePath)
// ---------------------------------------------------------------------------

describe('getHeadInjections', () => {
  it('returns empty string when plugins array is empty', () => {
    expect(getHeadInjections([], '/index.html')).toBe('');
  });

  it('returns empty string when no plugin has a head property', () => {
    const plugin = makePlugin({ extensions: ['.md'] }); // no head
    expect(getHeadInjections([plugin], '/index.html')).toBe('');
  });

  it('uses string head value as-is', () => {
    const plugin = makePlugin({ head: '<link rel="stylesheet" href="/app.css">' });
    const result = getHeadInjections([plugin], '/index.html');
    expect(result).toBe('<link rel="stylesheet" href="/app.css">');
  });

  it('calls function head value with pagePath and uses the return value', () => {
    const headFn = vi.fn().mockReturnValue('<meta name="page" content="/about">');
    const plugin = makePlugin({ head: headFn });

    const result = getHeadInjections([plugin], '/about');
    expect(headFn).toHaveBeenCalledWith('/about');
    expect(result).toContain('<meta name="page" content="/about">');
  });

  it('concatenates head injections from multiple plugins in registration order', () => {
    const p1 = makePlugin({ name: 'p1', head: '<meta name="p1">' });
    const p2 = makePlugin({ name: 'p2', head: '<meta name="p2">' });
    const p3 = makePlugin({ name: 'p3', head: '<meta name="p3">' });

    const result = getHeadInjections([p1, p2, p3], '/');
    // All three should appear, in order
    const idx1 = result.indexOf('<meta name="p1">');
    const idx2 = result.indexOf('<meta name="p2">');
    const idx3 = result.indexOf('<meta name="p3">');
    expect(idx1).not.toBe(-1);
    expect(idx2).not.toBe(-1);
    expect(idx3).not.toBe(-1);
    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
  });

  it('skips plugins without head and includes those that do have it', () => {
    const noHead = makePlugin({ name: 'no-head' });
    const withHead = makePlugin({ name: 'with-head', head: '<script src="/app.js"></script>' });

    const result = getHeadInjections([noHead, withHead], '/');
    expect(result).toContain('<script src="/app.js"></script>');
  });

  it('joins multiple head injections with a newline', () => {
    const p1 = makePlugin({ name: 'p1', head: '<meta name="p1">' });
    const p2 = makePlugin({ name: 'p2', head: '<meta name="p2">' });

    const result = getHeadInjections([p1, p2], '/');
    expect(result).toContain('\n');
  });
});

// ---------------------------------------------------------------------------
// 4. getBodyInjections(plugins, pagePath) — mirrors getHeadInjections
// ---------------------------------------------------------------------------

describe('getBodyInjections', () => {
  it('returns empty string when plugins array is empty', () => {
    expect(getBodyInjections([], '/index.html')).toBe('');
  });

  it('returns empty string when no plugin has a body property', () => {
    const plugin = makePlugin({ extensions: ['.md'] });
    expect(getBodyInjections([plugin], '/index.html')).toBe('');
  });

  it('uses string body value as-is', () => {
    const plugin = makePlugin({ body: '<script src="/analytics.js"></script>' });
    const result = getBodyInjections([plugin], '/index.html');
    expect(result).toBe('<script src="/analytics.js"></script>');
  });

  it('calls function body value with pagePath', () => {
    const bodyFn = vi.fn().mockReturnValue('<div id="portal"></div>');
    const plugin = makePlugin({ body: bodyFn });

    const result = getBodyInjections([plugin], '/checkout');
    expect(bodyFn).toHaveBeenCalledWith('/checkout');
    expect(result).toContain('<div id="portal"></div>');
  });

  it('concatenates body injections from multiple plugins in registration order', () => {
    const p1 = makePlugin({ name: 'p1', body: '<!-- p1 -->' });
    const p2 = makePlugin({ name: 'p2', body: '<!-- p2 -->' });

    const result = getBodyInjections([p1, p2], '/');
    const idx1 = result.indexOf('<!-- p1 -->');
    const idx2 = result.indexOf('<!-- p2 -->');
    expect(idx1).not.toBe(-1);
    expect(idx2).not.toBe(-1);
    expect(idx1).toBeLessThan(idx2);
  });

  it('skips plugins without body and includes those that have it', () => {
    const noBody = makePlugin({ name: 'no-body' });
    const withBody = makePlugin({ name: 'with-body', body: '<footer>injected</footer>' });

    const result = getBodyInjections([noBody, withBody], '/');
    expect(result).toContain('<footer>injected</footer>');
  });
});

// ---------------------------------------------------------------------------
// 5. runServeMiddleware(req, res, plugins)
// ---------------------------------------------------------------------------

describe('runServeMiddleware', () => {
  it('returns falsy when plugins array is empty', async () => {
    const req = { url: '/style.css' };
    const res = { end: vi.fn() };
    const result = await runServeMiddleware(req, res, []);
    expect(result).toBeFalsy();
  });

  it('returns falsy when all plugins pass through (serve returns falsy)', async () => {
    const p1 = makePlugin({ name: 'p1', serve: vi.fn().mockReturnValue(null) });
    const p2 = makePlugin({ name: 'p2', serve: vi.fn().mockReturnValue(false) });

    const req = { url: '/style.css' };
    const res = { end: vi.fn() };
    const result = await runServeMiddleware(req, res, [p1, p2]);

    expect(result).toBeFalsy();
    expect(p1.serve).toHaveBeenCalledTimes(1);
    expect(p2.serve).toHaveBeenCalledTimes(1);
  });

  it('stops the pipeline on the first plugin that returns truthy', async () => {
    const p1 = makePlugin({ name: 'p1', serve: vi.fn().mockReturnValue(true) });
    const p2 = makePlugin({ name: 'p2', serve: vi.fn().mockReturnValue(true) });

    const req = { url: '/style.css' };
    const res = { end: vi.fn() };
    await runServeMiddleware(req, res, [p1, p2]);

    expect(p1.serve).toHaveBeenCalledTimes(1);
    expect(p2.serve).not.toHaveBeenCalled();
  });

  it('passes req and res to serve()', async () => {
    const serve = vi.fn().mockReturnValue(true);
    const plugin = makePlugin({ serve });

    const req = { url: '/assets/logo.png', method: 'GET' };
    const res = { end: vi.fn(), setHeader: vi.fn() };
    await runServeMiddleware(req, res, [plugin]);

    expect(serve).toHaveBeenCalledWith(req, res);
  });

  it('skips plugins that have no serve() method', async () => {
    const noServe = makePlugin({ name: 'no-serve' }); // no serve property
    const withServe = makePlugin({ name: 'with-serve', serve: vi.fn().mockReturnValue(true) });

    const req = { url: '/app.js' };
    const res = { end: vi.fn() };

    // Should not throw, and should call the second plugin
    await expect(runServeMiddleware(req, res, [noServe, withServe])).resolves.toBeTruthy();
    expect(withServe.serve).toHaveBeenCalled();
  });

  it('calls plugins in registration order', async () => {
    const callOrder = [];
    const p1 = makePlugin({ name: 'p1', serve: vi.fn().mockImplementation(() => { callOrder.push('p1'); return null; }) });
    const p2 = makePlugin({ name: 'p2', serve: vi.fn().mockImplementation(() => { callOrder.push('p2'); return true; }) });
    const p3 = makePlugin({ name: 'p3', serve: vi.fn() });

    await runServeMiddleware({ url: '/' }, {}, [p1, p2, p3]);

    expect(callOrder).toEqual(['p1', 'p2']);
    expect(p3.serve).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    globalThis.__fisTestState = {};
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    delete globalThis.__fisTestState;
  });

  it('loads a plugin that has only name and extensions (all optional hooks omitted)', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'minimal.js');
    // Write the most minimal valid plugin
    mkdirSync(join(tmpDir, 'plugins'), { recursive: true });
    writeFileSync(pluginPath, `export default { name: 'minimal', extensions: ['.md'] };\n`, 'utf8');
    writeFisConfig(tmpDir, ['./plugins/minimal.js']);

    const plugins = await loadPlugins(tmpDir);
    expect(plugins).toHaveLength(1);
    expect(plugins[0].name).toBe('minimal');
  });

  it('allows duplicate plugin names — both load (last wins or both retained)', async () => {
    // Two separate plugin files with the same name value
    for (const file of ['dup-a.js', 'dup-b.js']) {
      const pluginPath = join(tmpDir, 'plugins', file);
      writePluginFile(pluginPath, { name: 'duplicate-name', extensions: ['.md'] });
    }
    writeFisConfig(tmpDir, ['./plugins/dup-a.js', './plugins/dup-b.js']);

    // Should not throw
    const plugins = await loadPlugins(tmpDir);
    // Both should be present (loader does not deduplicate by name)
    expect(plugins.length).toBeGreaterThanOrEqual(1);
    // Every returned plugin has the name field
    for (const p of plugins) {
      expect(p.name).toBe('duplicate-name');
    }
  });

  it('propagates setup() error and includes plugin name in the thrown error message', async () => {
    const pluginPath = join(tmpDir, 'plugins', 'kaboom.js');
    mkdirSync(join(tmpDir, 'plugins'), { recursive: true });
    writeFileSync(pluginPath, `
export default {
  name: 'kaboom',
  extensions: ['.md'],
  setup() { throw new Error('intentional setup failure'); }
};
`, 'utf8');
    writeFisConfig(tmpDir, ['./plugins/kaboom.js']);

    let thrownError;
    try {
      await loadPlugins(tmpDir);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    // The error message should mention the plugin name so developers can identify which plugin failed
    expect(thrownError.message).toMatch(/kaboom/i);
  });
});
