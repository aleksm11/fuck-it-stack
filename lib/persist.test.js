// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { signal, observe } from './signal.js';

// Node v25 ships a plain-object localStorage that shadows happy-dom's Storage.
// Replace it with a proper in-memory Storage implementation for tests.
function createStorage() {
  const store = new Map();
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, val) { store.set(key, String(val)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
    get length() { return store.size; },
    key(i) { return [...store.keys()][i] ?? null; },
  };
}

// Must be set before importing persist.js so the module picks up the right global
globalThis.localStorage = createStorage();

const { persist, serialize, deserialize, adapters } = await import('./persist.js');

describe('serialize / deserialize', () => {
  it('round-trips plain objects', () => {
    const obj = { a: 1, b: 'hello', c: [1, 2, 3] };
    expect(deserialize(serialize(obj))).toEqual(obj);
  });

  it('round-trips arrays', () => {
    const arr = [1, 'two', { three: 3 }];
    expect(deserialize(serialize(arr))).toEqual(arr);
  });

  it('round-trips Map', () => {
    const map = new Map([['a', 1], ['b', 2]]);
    const result = deserialize(serialize(map));
    expect(result).toBeInstanceOf(Map);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
    expect(result.size).toBe(2);
  });

  it('round-trips Set', () => {
    const set = new Set([1, 2, 3]);
    const result = deserialize(serialize(set));
    expect(result).toBeInstanceOf(Set);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(true);
    expect(result.has(3)).toBe(true);
    expect(result.size).toBe(3);
  });

  it('round-trips nested Map inside object', () => {
    const obj = { data: new Map([['x', new Set([10, 20])]]) };
    const result = deserialize(serialize(obj));
    expect(result.data).toBeInstanceOf(Map);
    expect(result.data.get('x')).toBeInstanceOf(Set);
    expect(result.data.get('x').has(10)).toBe(true);
  });

  it('handles null and primitives', () => {
    expect(deserialize(serialize(null))).toBe(null);
    expect(deserialize(serialize(42))).toBe(42);
    expect(deserialize(serialize('hello'))).toBe('hello');
    expect(deserialize(serialize(true))).toBe(true);
  });
});

describe('adapters.local', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  it('get returns null for missing key', () => {
    expect(adapters.local.get('missing')).toBe(null);
  });

  it('set + get round-trips a value', () => {
    adapters.local.set('key1', { count: 42 });
    expect(adapters.local.get('key1')).toEqual({ count: 42 });
  });

  it('del removes a key', () => {
    adapters.local.set('key2', 'val');
    adapters.local.del('key2');
    expect(adapters.local.get('key2')).toBe(null);
  });

  it('handles Map values', () => {
    const map = new Map([['a', 1]]);
    adapters.local.set('map', map);
    const result = adapters.local.get('map');
    expect(result).toBeInstanceOf(Map);
    expect(result.get('a')).toBe(1);
  });
});

describe('adapters.session', () => {
  beforeEach(() => sessionStorage.clear());

  it('get returns null for missing key', () => {
    expect(adapters.session.get('missing')).toBe(null);
  });

  it('set + get round-trips a value', () => {
    adapters.session.set('key1', [1, 2, 3]);
    expect(adapters.session.get('key1')).toEqual([1, 2, 3]);
  });

  it('del removes a key', () => {
    adapters.session.set('key2', 'val');
    adapters.session.del('key2');
    expect(adapters.session.get('key2')).toBe(null);
  });

  it('handles Set values', () => {
    const set = new Set(['x', 'y']);
    adapters.session.set('set', set);
    const result = adapters.session.get('set');
    expect(result).toBeInstanceOf(Set);
    expect(result.has('x')).toBe(true);
    expect(result.has('y')).toBe(true);
  });
});

describe('persist()', () => {
  beforeEach(() => { globalThis.localStorage.clear(); });

  it('loads initial value from storage', () => {
    globalThis.localStorage.setItem('init-test', serialize({ name: 'loaded' }));
    const sig = signal({ name: 'default' });
    const handle = persist(sig, { key: 'init-test' });
    expect(sig.get().name).toBe('loaded');
    handle.dispose();
  });

  it('does not overwrite signal if storage is empty', () => {
    const sig = signal('original');
    const handle = persist(sig, { key: 'empty-key' });
    expect(sig.get()).toBe('original');
    handle.dispose();
  });

  it('auto-writes signal changes to storage after debounce', async () => {
    const sig = signal(0);
    const handle = persist(sig, { key: 'auto-write', debounce: 10 });

    sig.set(42);

    // Before debounce fires
    expect(globalThis.localStorage.getItem('auto-write')).toBe(null);

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 50));
    expect(adapters.local.get('auto-write')).toBe(42);

    handle.dispose();
  });

  it('dispose stops further writes', async () => {
    const sig = signal('a');
    const handle = persist(sig, { key: 'dispose-test', debounce: 10 });

    // Wait for initial write
    await new Promise((r) => setTimeout(r, 50));
    expect(adapters.local.get('dispose-test')).toBe('a');

    handle.dispose();
    sig.set('b');

    await new Promise((r) => setTimeout(r, 50));
    // Should still be 'a' since we disposed
    expect(adapters.local.get('dispose-test')).toBe('a');
  });

  it('uses session storage when specified', async () => {
    sessionStorage.clear();
    const sig = signal('sess');
    const handle = persist(sig, { key: 'sess-key', storage: 'session', debounce: 10 });

    await new Promise((r) => setTimeout(r, 50));
    expect(adapters.session.get('sess-key')).toBe('sess');

    handle.dispose();
  });

  it('debounces rapid writes', async () => {
    const sig = signal(0);
    const handle = persist(sig, { key: 'debounce-test', debounce: 30 });

    // Rapid updates
    sig.set(1);
    sig.set(2);
    sig.set(3);

    await new Promise((r) => setTimeout(r, 80));
    // Only the last value should be stored
    expect(adapters.local.get('debounce-test')).toBe(3);

    handle.dispose();
  });

  it('persists Map and Set through signal changes', async () => {
    const sig = signal(new Map([['a', 1]]));
    const handle = persist(sig, { key: 'map-test', debounce: 10 });

    sig.set(new Map([['b', 2]]));
    await new Promise((r) => setTimeout(r, 50));

    const stored = adapters.local.get('map-test');
    expect(stored).toBeInstanceOf(Map);
    expect(stored.get('b')).toBe(2);

    handle.dispose();
  });
});
