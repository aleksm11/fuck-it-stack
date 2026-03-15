/**
 * dev.test.js — Tests for dev server file watching behavior
 *
 * These tests require dev.js to export:
 *   - debounce(fn, ms): standard debounce utility
 *   - handleDirChange(dirType, handlers): routes a dir change to the right action
 *   - createWatcher(config): sets up watchers and returns a stop() function
 *
 * The createWatcher config shape:
 *   {
 *     root: string,                          // project root
 *     debounceMs?: number,                   // default 100
 *     onComponentsChange: () => Promise<void> | void,
 *     onPagesChange: () => Promise<void> | void,
 *     onReload: () => void,
 *   }
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { debounce, handleDirChange, createWatcher } from './dev.js';

// --- debounce ---

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call fn immediately', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls fn after the delay has elapsed', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires only once for multiple rapid calls within the delay window', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();
    debounced();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on each call (trailing edge behavior)', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);  // halfway — not fired yet
    expect(fn).not.toHaveBeenCalled();

    debounced();                 // reset the clock
    vi.advanceTimersByTime(50);  // 50ms into new window — still not fired
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);  // now 100ms since last call
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires again after the cooldown if called a second time', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);

    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('forwards arguments to the wrapped function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('event', 'components');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('event', 'components');
  });

  it('passes the arguments from the last call (not the first)', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('third');
  });
});

// --- handleDirChange ---

describe('handleDirChange', () => {
  it('calls onComponentsChange when dir is "components"', async () => {
    const handlers = {
      onComponentsChange: vi.fn().mockResolvedValue(undefined),
      onPagesChange: vi.fn().mockResolvedValue(undefined),
      onReload: vi.fn(),
    };

    await handleDirChange('components', handlers);

    expect(handlers.onComponentsChange).toHaveBeenCalledTimes(1);
    expect(handlers.onPagesChange).not.toHaveBeenCalled();
  });

  it('calls onReload after onComponentsChange (reload follows regeneration)', async () => {
    const callOrder = [];
    const handlers = {
      onComponentsChange: vi.fn().mockImplementation(async () => {
        callOrder.push('regenerate');
      }),
      onPagesChange: vi.fn(),
      onReload: vi.fn().mockImplementation(() => {
        callOrder.push('reload');
      }),
    };

    await handleDirChange('components', handlers);

    expect(callOrder).toEqual(['regenerate', 'reload']);
  });

  it('calls onPagesChange when dir is "pages"', async () => {
    const handlers = {
      onComponentsChange: vi.fn(),
      onPagesChange: vi.fn().mockResolvedValue(undefined),
      onReload: vi.fn(),
    };

    await handleDirChange('pages', handlers);

    expect(handlers.onPagesChange).toHaveBeenCalledTimes(1);
    expect(handlers.onComponentsChange).not.toHaveBeenCalled();
  });

  it('calls onReload after onPagesChange', async () => {
    const callOrder = [];
    const handlers = {
      onComponentsChange: vi.fn(),
      onPagesChange: vi.fn().mockImplementation(async () => {
        callOrder.push('regenerate');
      }),
      onReload: vi.fn().mockImplementation(() => {
        callOrder.push('reload');
      }),
    };

    await handleDirChange('pages', handlers);

    expect(callOrder).toEqual(['regenerate', 'reload']);
  });

  it('calls only onReload when dir is "styles"', async () => {
    const handlers = {
      onComponentsChange: vi.fn(),
      onPagesChange: vi.fn(),
      onReload: vi.fn(),
    };

    await handleDirChange('styles', handlers);

    expect(handlers.onReload).toHaveBeenCalledTimes(1);
    expect(handlers.onComponentsChange).not.toHaveBeenCalled();
    expect(handlers.onPagesChange).not.toHaveBeenCalled();
  });

  it('calls only onReload when dir is "state"', async () => {
    const handlers = {
      onComponentsChange: vi.fn(),
      onPagesChange: vi.fn(),
      onReload: vi.fn(),
    };

    await handleDirChange('state', handlers);

    expect(handlers.onReload).toHaveBeenCalledTimes(1);
    expect(handlers.onComponentsChange).not.toHaveBeenCalled();
    expect(handlers.onPagesChange).not.toHaveBeenCalled();
  });
});

// --- createWatcher integration (real FS, real watcher, short debounce) ---

describe('createWatcher', () => {
  let tmpDir;
  let watcher;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'fis-watcher-test-'));
    // Create the four standard project directories
    for (const dir of ['components', 'pages', 'styles', 'state']) {
      mkdirSync(join(tmpDir, dir), { recursive: true });
    }
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.stop();
      watcher = null;
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns an object with a stop() method', () => {
    const handlers = {
      onComponentsChange: vi.fn(),
      onPagesChange: vi.fn(),
      onReload: vi.fn(),
    };
    watcher = createWatcher({ root: tmpDir, debounceMs: 50, ...handlers });
    expect(typeof watcher.stop).toBe('function');
  });

  it('triggers onComponentsChange when a file changes inside components/', async () => {
    const onComponentsChange = vi.fn().mockResolvedValue(undefined);
    const onReload = vi.fn();

    watcher = createWatcher({
      root: tmpDir,
      debounceMs: 50,
      onComponentsChange,
      onPagesChange: vi.fn(),
      onReload,
    });

    // Write a file into components/
    writeFileSync(join(tmpDir, 'components', 'test-change.js'), '// trigger');

    // Wait for debounce + handler to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(onComponentsChange).toHaveBeenCalled();
  });

  it('triggers onPagesChange when a file changes inside pages/', async () => {
    const onPagesChange = vi.fn().mockResolvedValue(undefined);
    const onReload = vi.fn();

    watcher = createWatcher({
      root: tmpDir,
      debounceMs: 50,
      onComponentsChange: vi.fn(),
      onPagesChange,
      onReload,
    });

    writeFileSync(join(tmpDir, 'pages', 'index.html'), '<h1>Hello</h1>');

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(onPagesChange).toHaveBeenCalled();
  });

  it('triggers only onReload when a file changes inside styles/', async () => {
    const onComponentsChange = vi.fn();
    const onPagesChange = vi.fn();
    const onReload = vi.fn();

    watcher = createWatcher({
      root: tmpDir,
      debounceMs: 50,
      onComponentsChange,
      onPagesChange,
      onReload,
    });

    writeFileSync(join(tmpDir, 'styles', 'main.css'), 'body { color: red; }');

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(onReload).toHaveBeenCalled();
    expect(onComponentsChange).not.toHaveBeenCalled();
    expect(onPagesChange).not.toHaveBeenCalled();
  });

  it('triggers only onReload when a file changes inside state/', async () => {
    const onComponentsChange = vi.fn();
    const onPagesChange = vi.fn();
    const onReload = vi.fn();

    watcher = createWatcher({
      root: tmpDir,
      debounceMs: 50,
      onComponentsChange,
      onPagesChange,
      onReload,
    });

    writeFileSync(join(tmpDir, 'state', 'store.js'), 'export const state = {};');

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(onReload).toHaveBeenCalled();
    expect(onComponentsChange).not.toHaveBeenCalled();
    expect(onPagesChange).not.toHaveBeenCalled();
  });

  it('debounces multiple rapid changes into a single callback invocation', async () => {
    const onComponentsChange = vi.fn().mockResolvedValue(undefined);

    watcher = createWatcher({
      root: tmpDir,
      debounceMs: 150,
      onComponentsChange,
      onPagesChange: vi.fn(),
      onReload: vi.fn(),
    });

    // Write 5 files in rapid succession
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(tmpDir, 'components', `rapid-${i}.js`), `// ${i}`);
    }

    // Wait longer than the debounce window
    await new Promise(resolve => setTimeout(resolve, 400));

    // Should have fired once, not five times
    expect(onComponentsChange).toHaveBeenCalledTimes(1);
  });

  it('does not watch directories that do not exist in the project root', () => {
    // Root has no styles/ directory — createWatcher should not throw
    const noStylesRoot = mkdtempSync(join(tmpdir(), 'fis-no-styles-'));
    mkdirSync(join(noStylesRoot, 'pages'), { recursive: true });

    let noStylesWatcher;
    expect(() => {
      noStylesWatcher = createWatcher({
        root: noStylesRoot,
        debounceMs: 50,
        onComponentsChange: vi.fn(),
        onPagesChange: vi.fn(),
        onReload: vi.fn(),
      });
    }).not.toThrow();

    noStylesWatcher?.stop();
    rmSync(noStylesRoot, { recursive: true, force: true });
  });

  it('stop() closes all watchers without throwing', async () => {
    watcher = createWatcher({
      root: tmpDir,
      debounceMs: 50,
      onComponentsChange: vi.fn(),
      onPagesChange: vi.fn(),
      onReload: vi.fn(),
    });

    await expect(watcher.stop()).resolves.not.toThrow();
    watcher = null; // already stopped — skip afterEach cleanup
  });
});
