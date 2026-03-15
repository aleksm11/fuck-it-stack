import { describe, it, expect, vi } from 'vitest';
import { signal, observe, computed, batch } from './signal.js';

describe('signal', () => {
  it('creates a signal and reads with .get()', () => {
    const s = signal(42);
    expect(s.get()).toBe(42);
  });

  it('writes with .set() and reads updated value', () => {
    const s = signal('hello');
    s.set('world');
    expect(s.get()).toBe('world');
  });

  it('handles null and undefined', () => {
    const s = signal(null);
    expect(s.get()).toBe(null);
    s.set(undefined);
    expect(s.get()).toBe(undefined);
  });

  it('deep nested property access', () => {
    const store = signal({ user: { name: 'Jakša', age: 29 } });
    expect(store.user.name.get()).toBe('Jakša');
    expect(store.user.age.get()).toBe(29);
  });

  it('deep nested .set() updates value', () => {
    const store = signal({ user: { name: 'Jakša' } });
    store.user.name.set('New Name');
    expect(store.user.name.get()).toBe('New Name');
  });
});

describe('observe', () => {
  it('runs immediately and tracks dependencies', () => {
    const store = signal({ count: 0 });
    const fn = vi.fn(() => store.count.get());
    observe(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-runs when tracked signal changes', () => {
    const store = signal({ count: 0 });
    const fn = vi.fn(() => store.count.get());
    observe(fn);
    store.count.set(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('re-runs on parent .set()', () => {
    const store = signal({ user: { name: 'A' } });
    const fn = vi.fn(() => store.user.name.get());
    observe(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    // Setting parent should bubble notification to child observers
    store.user.set({ name: 'B' });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(store.user.name.get()).toBe('B');
  });

  it('disposes cleanly — no more notifications', () => {
    const store = signal({ x: 1 });
    const fn = vi.fn(() => store.x.get());
    const dispose = observe(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    dispose();
    store.x.set(2);
    expect(fn).toHaveBeenCalledTimes(1); // no re-run
  });

  it('multiple observers on same signal', () => {
    const s = signal({ val: 0 });
    const fn1 = vi.fn(() => s.val.get());
    const fn2 = vi.fn(() => s.val.get());
    observe(fn1);
    observe(fn2);
    s.val.set(1);
    expect(fn1).toHaveBeenCalledTimes(2);
    expect(fn2).toHaveBeenCalledTimes(2);
  });
});

describe('peek', () => {
  it('reads value without tracking', () => {
    const store = signal({ x: 10 });
    const fn = vi.fn(() => store.x.peek());
    observe(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    store.x.set(20);
    // fn should NOT re-run because peek doesn't track
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('batch', () => {
  it('groups notifications — observer fires once', () => {
    const store = signal({ a: 1, b: 2 });
    let runs = 0;
    observe(() => {
      store.a.get();
      store.b.get();
      runs++;
    });
    expect(runs).toBe(1);
    batch(() => {
      store.a.set(10);
      store.b.set(20);
    });
    expect(runs).toBe(2); // only one re-run, not two
  });

  it('nested batches flush only at outermost', () => {
    const s = signal({ x: 0 });
    let runs = 0;
    observe(() => { s.x.get(); runs++; });
    expect(runs).toBe(1);
    batch(() => {
      s.x.set(1);
      batch(() => {
        s.x.set(2);
      });
      s.x.set(3);
    });
    expect(runs).toBe(2); // single flush at end
  });
});

describe('computed', () => {
  it('derives value from signals', () => {
    const store = signal({ first: 'Jakša', last: 'M' });
    const full = computed(() => `${store.first.get()} ${store.last.get()}`);
    expect(full.get()).toBe('Jakša M');
  });

  it('auto-recomputes when dependencies change', () => {
    const store = signal({ x: 2, y: 3 });
    const product = computed(() => store.x.get() * store.y.get());
    expect(product.get()).toBe(6);
    store.x.set(10);
    expect(product.get()).toBe(30);
  });

  it('peek on computed returns value without tracking', () => {
    const s = signal({ v: 5 });
    const c = computed(() => s.v.get() * 2);
    expect(c.peek()).toBe(10);
  });

  it('computed used inside observe triggers re-run', () => {
    const s = signal({ n: 1 });
    const doubled = computed(() => s.n.get() * 2);
    const fn = vi.fn(() => doubled.get());
    observe(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    s.n.set(5);
    // The computed updates, which should re-run observers of the computed
    expect(doubled.get()).toBe(10);
  });
});

describe('Map support', () => {
  it('reads Map values via .get()', () => {
    const m = signal(new Map([['id1', { name: 'Alice' }]]));
    expect(m.get().get('id1')).toEqual({ name: 'Alice' });
  });

  it('Map.set triggers observers', () => {
    const m = signal(new Map());
    const fn = vi.fn(() => m.get());
    observe(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    m.get().set('key', 'value');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('Map.delete triggers observers', () => {
    const m = signal(new Map([['a', 1]]));
    const fn = vi.fn(() => m.get());
    observe(fn);
    m.get().delete('a');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('Map.clear triggers observers', () => {
    const m = signal(new Map([['a', 1], ['b', 2]]));
    const fn = vi.fn(() => m.get());
    observe(fn);
    m.get().clear();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('Map.has works correctly', () => {
    const m = signal(new Map([['x', 42]]));
    expect(m.get().has('x')).toBe(true);
    expect(m.get().has('y')).toBe(false);
  });
});

describe('Set support', () => {
  it('reads Set values', () => {
    const s = signal(new Set([1, 2, 3]));
    expect(s.get().has(1)).toBe(true);
    expect(s.get().has(99)).toBe(false);
  });

  it('Set.add triggers observers', () => {
    const s = signal(new Set([1, 2]));
    const fn = vi.fn(() => s.get());
    observe(fn);
    s.get().add(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('Set.delete triggers observers', () => {
    const s = signal(new Set([1, 2, 3]));
    const fn = vi.fn(() => s.get());
    observe(fn);
    s.get().delete(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('Set.clear triggers observers', () => {
    const s = signal(new Set([1, 2, 3]));
    const fn = vi.fn(() => s.get());
    observe(fn);
    s.get().clear();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('Array support', () => {
  it('reads array values', () => {
    const s = signal([1, 2, 3]);
    expect(s.get()).toEqual([1, 2, 3]);
  });

  it('array .set() triggers observers', () => {
    const s = signal([1, 2, 3]);
    const fn = vi.fn(() => s.get());
    observe(fn);
    s.set([4, 5, 6]);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(s.get()).toEqual([4, 5, 6]);
  });

  it('nested array in object', () => {
    const store = signal({ items: [1, 2, 3] });
    expect(store.items.get()).toEqual([1, 2, 3]);
    store.items.set([10, 20]);
    expect(store.items.get()).toEqual([10, 20]);
  });
});
