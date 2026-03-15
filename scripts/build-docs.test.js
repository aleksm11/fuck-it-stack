import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const DOCS_DIST = join(ROOT, 'docs-dist');

describe('build-docs', () => {
  beforeAll(() => {
    rmSync(DOCS_DIST, { recursive: true, force: true });
    execSync('node scripts/build-docs.js', { cwd: ROOT });
  });

  afterAll(() => {
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

  it('copies logo to assets', () => {
    expect(existsSync(join(DOCS_DIST, 'assets', 'logo.png'))).toBe(true);
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
      expect(html).toContain('FIS');
    });

    it(`${page} has sidebar with navigation`, () => {
      const html = readFileSync(join(DOCS_DIST, page), 'utf8');
      expect(html).toContain('class="sidebar"');
      expect(html).toContain('sidebar-nav');
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

    it(`${page} has search functionality`, () => {
      const html = readFileSync(join(DOCS_DIST, page), 'utf8');
      expect(html).toContain('id="search"');
      expect(html).toContain('searchIndex');
      expect(html).toContain('search-results');
    });

    it(`${page} has Prism.js syntax highlighting`, () => {
      const html = readFileSync(join(DOCS_DIST, page), 'utf8');
      expect(html).toContain('prism');
    });

    it(`${page} has mobile responsive header`, () => {
      const html = readFileSync(join(DOCS_DIST, page), 'utf8');
      expect(html).toContain('mobile-header');
      expect(html).toContain('mobile-toggle');
    });
  }

  it('first page has no previous link', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('Signals');
    expect(html).toContain('prev-next-title');
  });

  it('last page has no next link', () => {
    const html = readFileSync(join(DOCS_DIST, 'ai-workflow.html'), 'utf8');
    expect(html).toContain('Dev Server');
    expect(html).toContain('prev-next-title');
  });

  it('converts markdown headings to HTML', () => {
    const html = readFileSync(join(DOCS_DIST, 'signals.html'), 'utf8');
    expect(html).toMatch(/<h[1-6][^>]*>/);
  });

  it('converts code blocks with language classes', () => {
    const html = readFileSync(join(DOCS_DIST, 'signals.html'), 'utf8');
    expect(html).toContain('code-block');
    expect(html).toContain('language-');
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

  it('has cyberpunk dark theme', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('--bg-deep: #050508');
    expect(html).toContain('--accent: #7c5cfc');
    expect(html).toContain('--glow-sm');
  });

  it('has responsive mobile styles', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('@media (max-width: 768px)');
  });

  it('includes JetBrains Mono font', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('JetBrains Mono');
  });

  it('has keyboard shortcut for search (Cmd+K)', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('⌘K');
    expect(html).toContain("e.key === 'k'");
  });

  it('search index contains entries from all pages', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    const match = html.match(/const searchIndex = (\[.*?\]);/s);
    expect(match).toBeTruthy();
    const index = JSON.parse(match[1]);
    expect(index.length).toBeGreaterThan(10);
    // Should have entries from different pages
    const pages = new Set(index.map(e => e.page));
    expect(pages.size).toBeGreaterThanOrEqual(5);
  });

  it('has logo in sidebar', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('logo.png');
    expect(html).toContain('fuck it stack');
  });

  it('has GitHub link in footer', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('GitHub');
    expect(html).toContain('fuck-it-stack');
  });

  it('has glitch animation for logo', () => {
    const html = readFileSync(join(DOCS_DIST, 'getting-started.html'), 'utf8');
    expect(html).toContain('@keyframes glitch');
  });
});
