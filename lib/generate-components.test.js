import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanComponents, generateComponentsModule } from './generate.js';

// --- scanComponents ---

describe('scanComponents', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fis-components-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createComponent(name, extraFiles = []) {
    const compDir = join(tmpDir, name);
    mkdirSync(compDir, { recursive: true });
    writeFileSync(join(compDir, `${name}.js`), `// ${name} component`);
    for (const file of extraFiles) {
      writeFileSync(join(compDir, file), '');
    }
  }

  it('returns empty array for empty components/ directory', () => {
    const result = scanComponents(tmpDir);
    expect(result).toEqual([]);
  });

  it('returns a single component with correct shape', () => {
    createComponent('my-button');
    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'my-button',
      path: './components/my-button/my-button.js',
    });
  });

  it('returns multiple components', () => {
    createComponent('my-button');
    createComponent('nav-bar');
    createComponent('hero-section');

    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(3);

    const names = result.map(c => c.name);
    expect(names).toContain('my-button');
    expect(names).toContain('nav-bar');
    expect(names).toContain('hero-section');
  });

  it('uses directory name as component tag name', () => {
    createComponent('custom-card');
    const result = scanComponents(tmpDir);
    expect(result[0].name).toBe('custom-card');
  });

  it('path follows ./components/{name}/{name}.js pattern', () => {
    createComponent('app-header');
    const result = scanComponents(tmpDir);
    expect(result[0].path).toBe('./components/app-header/app-header.js');
  });

  it('ignores directories without a matching .js file', () => {
    // Directory with only a CSS file — no JS
    const noJsDir = join(tmpDir, 'style-only');
    mkdirSync(noJsDir, { recursive: true });
    writeFileSync(join(noJsDir, 'style-only.css'), '.style-only {}');

    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(0);
  });

  it('ignores directories where the .js file name does not match the directory name', () => {
    // Directory named 'my-widget' but only has 'widget.js' — no 'my-widget.js'
    const dir = join(tmpDir, 'my-widget');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'widget.js'), '// wrong name');

    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(0);
  });

  it('ignores hidden directories (starting with .)', () => {
    createComponent('my-button');
    // Hidden dir with a JS file — should be ignored
    const hiddenDir = join(tmpDir, '.DS_Store_dir');
    mkdirSync(hiddenDir, { recursive: true });
    writeFileSync(join(hiddenDir, '.DS_Store_dir.js'), '');

    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('my-button');
  });

  it('ignores .git directory', () => {
    createComponent('my-button');
    const gitDir = join(tmpDir, '.git');
    mkdirSync(join(gitDir, 'hooks'), { recursive: true });

    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(1);
  });

  it('only scans top-level directories (ignores nested subdirectories as components)', () => {
    createComponent('my-button');
    // Nested sub-component inside my-button — should NOT appear as its own component
    const nestedDir = join(tmpDir, 'my-button', 'inner-part');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'inner-part.js'), '// nested');

    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('my-button');
  });

  it('requires directory name to contain a hyphen (web component spec)', () => {
    // 'button' has no hyphen — not a valid web component tag name
    const invalidDir = join(tmpDir, 'button');
    mkdirSync(invalidDir, { recursive: true });
    writeFileSync(join(invalidDir, 'button.js'), '// invalid tag name');

    // 'my-button' is valid
    createComponent('my-button');

    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('my-button');
  });

  it('ignores plain files in the components root (not directories)', () => {
    createComponent('nav-bar');
    // Stray JS file at root level
    writeFileSync(join(tmpDir, 'helper.js'), '// helper');

    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('nav-bar');
  });

  it('component directory can also contain CSS and other files alongside the JS file', () => {
    createComponent('rich-card', ['rich-card.css', 'rich-card.html']);
    const result = scanComponents(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('rich-card');
  });
});

// --- generateComponentsModule ---

describe('generateComponentsModule', () => {
  it('returns a string', () => {
    const output = generateComponentsModule([]);
    expect(typeof output).toBe('string');
  });

  it('contains an auto-generated comment header', () => {
    const output = generateComponentsModule([]);
    expect(output).toMatch(/auto.?generated/i);
  });

  it('generates valid ES module syntax', () => {
    const components = [
      { name: 'my-button', path: './components/my-button/my-button.js' },
    ];
    const output = generateComponentsModule(components);
    expect(output).toContain("import './components/my-button/my-button.js'");
  });

  it('generates one import per component', () => {
    const components = [
      { name: 'my-button', path: './components/my-button/my-button.js' },
      { name: 'nav-bar', path: './components/nav-bar/nav-bar.js' },
    ];
    const output = generateComponentsModule(components);
    const importLines = output.split('\n').filter(l => l.startsWith('import'));
    expect(importLines).toHaveLength(2);
  });

  it('sorts imports alphabetically by component name', () => {
    const components = [
      { name: 'zoo-keeper', path: './components/zoo-keeper/zoo-keeper.js' },
      { name: 'alpha-widget', path: './components/alpha-widget/alpha-widget.js' },
      { name: 'mid-section', path: './components/mid-section/mid-section.js' },
    ];
    const output = generateComponentsModule(components);
    const importLines = output.split('\n').filter(l => l.startsWith('import'));

    expect(importLines[0]).toContain('alpha-widget');
    expect(importLines[1]).toContain('mid-section');
    expect(importLines[2]).toContain('zoo-keeper');
  });

  it('returns a valid module with no imports for empty array', () => {
    const output = generateComponentsModule([]);
    // Should not throw, should be a valid (comment-only or empty) module
    const importLines = output.split('\n').filter(l => l.startsWith('import'));
    expect(importLines).toHaveLength(0);
  });

  it('uses the path from the component object (not a reconstructed one)', () => {
    const components = [
      { name: 'my-button', path: './components/my-button/my-button.js' },
    ];
    const output = generateComponentsModule(components);
    expect(output).toContain('./components/my-button/my-button.js');
  });

  it('output does not contain named exports (side-effect-only imports)', () => {
    const components = [
      { name: 'my-button', path: './components/my-button/my-button.js' },
    ];
    const output = generateComponentsModule(components);
    // Side-effect import: import '...' not import { } from '...' or import X from '...'
    expect(output).not.toMatch(/import\s+\{/);
    expect(output).not.toMatch(/import\s+\w+\s+from/);
  });
});
