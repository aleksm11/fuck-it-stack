/**
 * @fis/plugin-markdown — FIS plugin for markdown files
 * Transforms .md files to .html with frontmatter extraction,
 * custom parsing, and syntax highlighting via Prism.js.
 *
 * @module plugins/markdown
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseMarkdown, extractFrontmatter } from './parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, 'assets');
const SERVE_PREFIX = '/@fis/markdown/';

/** @type {Record<string, string>} */
const MIME_TYPES = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

export default {
  name: 'markdown',
  extensions: ['.md'],

  /**
   * Transform a .md file into .html
   * @param {{ path: string, content: string }} file
   * @returns {{ path: string, content: string, metadata: Record<string, string> }}
   */
  transform(file) {
    const { metadata, body } = extractFrontmatter(file.content);
    const html = parseMarkdown(body);
    return {
      path: file.path.replace(/\.md$/, '.html'),
      content: html,
      metadata,
    };
  },

  watch: ['**/*.md'],

  head: '<link rel="stylesheet" href="/@fis/markdown/prism-dark.css">',

  /**
   * Serve static assets from the plugin's assets/ directory.
   * Handles requests to /@fis/markdown/* prefix.
   * @param {{ url: string }} req
   * @param {{ writeHead: function, end: function }} res
   * @returns {boolean|undefined}
   */
  serve(req, res) {
    if (!req.url.startsWith(SERVE_PREFIX)) return;

    const fileName = req.url.slice(SERVE_PREFIX.length);
    if (!fileName || fileName.includes('..')) {
      res.writeHead(400);
      res.end('Bad request');
      return true;
    }

    const filePath = join(ASSETS_DIR, fileName);
    const ext = '.' + fileName.split('.').pop();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return true;
  },
};
