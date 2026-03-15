/**
 * FIS Plugin System
 * Loads, validates, and runs plugins for the Fuck It Stack.
 * Zero dependencies — pure JS with ESM.
 */

import { join } from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

/**
 * Load plugins from fis.config.js in the given project root.
 * @param {string} projectRoot
 * @returns {Promise<Array<{name: string, extensions: string[], setup?: function, transform?: function, head?: string|function, body?: string|function, serve?: function}>>}
 */
export async function loadPlugins(projectRoot) {
  let config;
  try {
    const configUrl = pathToFileURL(join(projectRoot, 'fis.config.js')).href;
    const mod = await import(configUrl);
    config = mod.default;
  } catch {
    return [];
  }

  const entries = config?.plugins;
  if (!entries || !Array.isArray(entries) || entries.length === 0) return [];

  const plugins = [];
  for (const entry of entries) {
    const isTuple = Array.isArray(entry);
    const specifier = isTuple ? entry[0] : entry;
    const options = isTuple ? entry[1] : undefined;

    // Resolve path
    let modulePath;
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      modulePath = pathToFileURL(join(projectRoot, specifier)).href;
    } else {
      // npm-style: resolve from project's node_modules
      const require = createRequire(join(projectRoot, 'package.json'));
      const resolved = require.resolve(specifier);
      modulePath = pathToFileURL(resolved).href;
    }

    let mod;
    try {
      mod = await import(modulePath);
    } catch (err) {
      throw new Error(`Failed to load plugin "${specifier}": ${err.message}`);
    }

    let plugin = mod.default;
    if (!plugin) {
      throw new Error(`Plugin "${specifier}" has no default export`);
    }

    // Factory pattern: if default export is a function, call it with options
    if (typeof plugin === 'function') {
      plugin = plugin(options);
    }

    // Validate
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error(`Plugin "${specifier}" must have a "name" string property`);
    }
    if (!plugin.extensions || !Array.isArray(plugin.extensions)) {
      throw new Error(`Plugin "${specifier}" must have an "extensions" array property`);
    }

    // Call setup if present
    if (typeof plugin.setup === 'function') {
      try {
        plugin.setup(config);
      } catch (err) {
        throw new Error(`Plugin "${plugin.name}" setup() failed: ${err.message}`);
      }
    }

    plugins.push(plugin);
  }

  return plugins;
}

/**
 * Run transform pipeline. First non-null result wins.
 * @param {{path: string, content: string, ext: string}} file
 * @param {Array} plugins
 * @returns {Promise<any|null>}
 */
export async function runTransform(file, plugins) {
  for (const plugin of plugins) {
    if (!plugin.extensions.includes(file.ext)) continue;
    if (typeof plugin.transform !== 'function') continue;
    const result = await plugin.transform(file);
    if (result != null) return result;
  }
  return null;
}

/**
 * Collect head injections from all plugins.
 * @param {Array} plugins
 * @param {string} pagePath
 * @returns {string}
 */
export function getHeadInjections(plugins, pagePath) {
  const parts = [];
  for (const plugin of plugins) {
    if (plugin.head == null) continue;
    parts.push(typeof plugin.head === 'function' ? plugin.head(pagePath) : plugin.head);
  }
  return parts.join('\n');
}

/**
 * Collect body injections from all plugins.
 * @param {Array} plugins
 * @param {string} pagePath
 * @returns {string}
 */
export function getBodyInjections(plugins, pagePath) {
  const parts = [];
  for (const plugin of plugins) {
    if (plugin.body == null) continue;
    parts.push(typeof plugin.body === 'function' ? plugin.body(pagePath) : plugin.body);
  }
  return parts.join('\n');
}

/**
 * Run serve middleware pipeline. Stops on first truthy return.
 * @param {object} req
 * @param {object} res
 * @param {Array} plugins
 * @returns {Promise<boolean>}
 */
export async function runServeMiddleware(req, res, plugins) {
  for (const plugin of plugins) {
    if (typeof plugin.serve !== 'function') continue;
    const result = await plugin.serve(req, res);
    if (result) return true;
  }
  return false;
}
