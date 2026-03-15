import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const DOCS_DIST = join(ROOT, 'docs-dist');

describe('build-docs', () => {
  beforeAll(() => {
    // Clean and rebuild
    rmSync(DOCS_DIST, { recursive: true, force: true });
    execSync('node scripts/build-docs.js', { cwd: ROOT });
  });

  afterAll(() => {
    // Clean up
    rmSync(DOCS_DIST, { recursive: true, force: true });
  });

  it('creates docs-dist directory', () => {
    expect(existsSync(DOCS_DIST)).toBe(true);
  });

  it('generates index.html with redirect', () => {
    const html = readFileSync(join(DOCS_DIST, 'index.html'), 'utf8');
    expect(html).toContain('getting-started.html');
    expect(html).toContain('meta http-equiv="refresh"');
  });

  const pages = [
    'getting-started.html',
    'signals.html',
    'components.html',
    'routing.html',
    'persistence.html',
    'css.html',
    'dev-server.html',
    'ai-workflow.html',
  ];

  for (const page of pages) {
    it(`generates ${page}`, () => {
      expect(existsSync(join(DOCS_DIST, page))).toBe(true);
    });

    it(`${page} has valid HTML structure`, () => {
      const html = readFileSync(join(DOCS_DIST, page), 'utf8');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
      expect(html).toContain('Fuck It Stack');
    });

    it(`${page} has navigation sidebar`, () => {
      const html = readFileSync(join(DOCS_DIST, page), 'utf8');
      expect(html).toContain('<aside class="sidebar">');
      expect(html).toContain('Getting Started');
      expect(html).toContain('Signals');
    });

    it(`${page} has active nav item`, () => {
      const html = readFileSync(join(DOCS_DIST, page), 'utf8');
      expect(html).toContain('class="active"');
    });

    it(`${page} has prev/next navigation`, () => {
      const html = readFileSync(join(DOCS_DIST, page), 'utf8');
      expect(html).toContain('prev-next');
    });
  }

  it('first page has no previous link', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    // Should have next but prev is empty span
    expect(html).toContain('Signals →');
  });

  it('last page has no next link', () => {
    const html = readFileSync(join(DOCS_DIST, 'ai-workflow.html'), 'utf8');
    expect(html).toContain('← Dev Server');
  });

  it('converts markdown headings to HTML', () => {
    const html = readFileSync(join(DOCS_DIST, 'signals.html'), 'utf8');
    expect(html).toMatch(/<h[1-6][^>]*>/);
  });

  it('converts code blocks to pre/code', () => {
    const html = readFileSync(join(DOCS_DIST, 'signals.html'), 'utf8');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
  });

  it('converts inline code', () => {
    const html = readFileSync(join(DOCS_DIST, 'signals.html'), 'utf8');
    expect(html).toMatch(/<code>[^<]+<\/code>/);
  });

  it('converts bold text', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toMatch(/<strong>[^<]+<\/strong>/);
  });

  it('does not contain personal data', () => {
    for (const page of pages) {
      const html = readFileSync(join(DOCS_DIST, page), 'utf8');
      expect(html).not.toContain('Jakša');
      expect(html).not.toContain('Mališić');
      expect(html).not.toContain('jaksa.malisic');
      expect(html).not.toContain('openclawmalisic');
    }
  });

  it('has dark theme styling', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('--bg: #0a0a0f');
    expect(html).toContain('--accent: #7c5cfc');
  });

  it('has responsive mobile styles', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('@media (max-width: 768px)');
  });
});
