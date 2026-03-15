// signal.js — Proxy-based reactive state (~140 lines, zero dependencies)

/** @type {Set<import('./signal.js').Node> | null} */
let tracking = null;

/** @type {Set<Function> | null} */
let batchQueue = null;

/**
 * @typedef {{ value: any, children: Map<string|symbol, Node>, listeners: Set<Function>, parent: Node|null, key: string|null }} Node
 */

/** @param {Node} node @param {'up'|'down'|'both'} [dir='both'] */
function notify(node, dir = 'both') {
  if (batchQueue) {
    for (const fn of node.listeners) batchQueue.add(fn);
  } else {
    for (const fn of [...node.listeners]) fn();
  }
  if (dir !== 'down' && node.parent) notify(node.parent, 'up');
  if (dir !== 'up') {
    for (const child of node.children.values()) notify(child, 'down');
  }
}

/** @param {any} raw @param {Node} node */
function wrapCollection(raw, node) {
  if (raw instanceof Map) {
    return new Proxy(raw, {
      get(target, prop) {
        const val = Reflect.get(target, prop, target);
        if (typeof val !== 'function') return val;
        if (prop === 'get') return (k) => target.get(k);
        if (prop === 'has') return (k) => target.has(k);
        if (prop === 'set') return (k, v) => { target.set(k, v); notify(node); return raw; };
        if (prop === 'delete') return (k) => { const r = target.delete(k); notify(node); return r; };
        if (prop === 'clear') return () => { target.clear(); notify(node); };
        if (typeof val === 'function') return val.bind(target);
        return val;
      },
    });
  }
  if (raw instanceof Set) {
    return new Proxy(raw, {
      get(target, prop) {
        const val = Reflect.get(target, prop, target);
        if (typeof val !== 'function') return val;
        if (prop === 'has') return (k) => target.has(k);
        if (prop === 'add') return (v) => { target.add(v); notify(node); return raw; };
        if (prop === 'delete') return (k) => { const r = target.delete(k); notify(node); return r; };
        if (prop === 'clear') return () => { target.clear(); notify(node); };
        if (typeof val === 'function') return val.bind(target);
        return val;
      },
    });
  }
  return raw;
}

/** @param {Node} node @returns {Proxy} */
function makeProxy(node) {
  return new Proxy(node, {
    get(target, prop) {
      if (prop === 'get') return () => {
        if (tracking) tracking.add(target);
        const v = target.value;
        return (v instanceof Map || v instanceof Set) ? wrapCollection(v, target) : v;
      };
      if (prop === 'peek') return () => target.value;
      if (prop === 'set') return (val) => {
        target.value = val;
        // Sync children for objects
        if (val && typeof val === 'object' && !(val instanceof Map) && !(val instanceof Set)) {
          for (const [k, child] of target.children) {
            if (k in val) child.value = val[k];
          }
        }
        notify(target);
      };
      // Deep nested access — create child node
      if (typeof prop === 'string' || typeof prop === 'symbol') {
        if (!target.children.has(prop)) {
          const childVal = (target.value != null && typeof target.value === 'object') ? target.value[prop] : undefined;
          /** @type {Node} */
          const child = { value: childVal, children: new Map(), listeners: new Set(), parent: target, key: String(prop) };
          target.children.set(prop, child);
        }
        return makeProxy(target.children.get(prop));
      }
    },
  });
}

/**
 * Create a reactive signal from any value.
 * @param {any} initial - Initial value (object, primitive, Map, Set, Array)
 * @returns {Proxy} Reactive proxy with .get()/.set()/.peek() and deep property access
 */
export function signal(initial) {
  /** @type {Node} */
  const root = { value: initial, children: new Map(), listeners: new Set(), parent: null, key: null };
  // Pre-populate children for object values
  if (initial && typeof initial === 'object' && !(initial instanceof Map) && !(initial instanceof Set)) {
    for (const [k, v] of Object.entries(initial)) {
      root.children.set(k, { value: v, children: new Map(), listeners: new Set(), parent: root, key: k });
    }
  }
  return makeProxy(root);
}

/**
 * Run fn, track which signals are read via .get(), re-run when any dependency changes.
 * @param {Function} fn - Observer function
 * @returns {Function} Dispose function that removes all listeners
 */
export function observe(fn) {
  let disposed = false;
  /** @type {Set<Node>} */
  let deps = new Set();

  function run() {
    if (disposed) return;
    // Clean old deps
    for (const node of deps) node.listeners.delete(run);
    deps = new Set();
    tracking = deps;
    try { fn(); } finally { tracking = null; }
    for (const node of deps) node.listeners.add(run);
  }

  run();
  return () => {
    disposed = true;
    for (const node of deps) node.listeners.delete(run);
    deps.clear();
  };
}

/**
 * Create a computed (derived) read-only signal that re-evaluates when dependencies change.
 * @param {Function} fn - Computation function
 * @returns {{ get: () => any, peek: () => any }} Computed signal
 */
export function computed(fn) {
  let value;
  let dirty = true;
  const node = { value: undefined, children: new Map(), listeners: new Set(), parent: null, key: null };

  const dispose = observe(() => {
    value = fn();
    node.value = value;
    dirty = false;
    // Notify computed's own listeners (except during initial run)
    if (node.listeners.size > 0) notify(node);
  });

  return {
    get() { if (tracking) tracking.add(node); return node.value; },
    peek() { return node.value; },
    dispose,
  };
}

/**
 * Batch multiple signal writes — observers fire once at the end, not per-write.
 * @param {Function} fn - Function containing multiple .set() calls
 */
export function batch(fn) {
  const prev = batchQueue;
  batchQueue = batchQueue || new Set();
  try {
    fn();
  } finally {
    if (!prev) {
      const queue = batchQueue;
      batchQueue = null;
      for (const run of queue) run();
    } else {
      batchQueue = prev;
    }
  }
}
