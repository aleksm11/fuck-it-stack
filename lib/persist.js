// persist.js — Swappable storage adapter for signals (~80 lines, zero dependencies)

import { observe } from './signal.js';

/** @param {any} val */
function serialize(val) {
  return JSON.stringify(val, (_key, v) => {
    if (v instanceof Map) return { __type: 'Map', entries: [...v] };
    if (v instanceof Set) return { __type: 'Set', values: [...v] };
    return v;
  });
}

/** @param {string} raw */
function deserialize(raw) {
  return JSON.parse(raw, (_key, v) => {
    if (v && v.__type === 'Map') return new Map(v.entries);
    if (v && v.__type === 'Set') return new Set(v.values);
    return v;
  });
}

// Lazy getters — resolve storage at call time so test environments can override globals
function getLocalStorage() { return globalThis.localStorage; }
function getSessionStorage() { return globalThis.sessionStorage; }

/** @type {Record<string, { get: (key: string) => any, set: (key: string, val: any) => void, del: (key: string) => void }>} */
const adapters = {
  local: {
    get(key) {
      const raw = getLocalStorage().getItem(key);
      return raw != null ? deserialize(raw) : null;
    },
    set(key, val) { getLocalStorage().setItem(key, serialize(val)); },
    del(key) { getLocalStorage().removeItem(key); },
  },
  session: {
    get(key) {
      const raw = getSessionStorage().getItem(key);
      return raw != null ? deserialize(raw) : null;
    },
    set(key, val) { getSessionStorage().setItem(key, serialize(val)); },
    del(key) { getSessionStorage().removeItem(key); },
  },
  indexeddb: {
    /** @type {IDBDatabase | null} */
    _db: null,
    _open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('fis-store', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('fis-data');
        };
        req.onsuccess = () => { this._db = req.result; resolve(req.result); };
        req.onerror = () => reject(req.error);
      });
    },
    async get(key) {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fis-data', 'readonly');
        const req = tx.objectStore('fis-data').get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    },
    async set(key, val) {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fis-data', 'readwrite');
        const req = tx.objectStore('fis-data').put(val, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async del(key) {
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('fis-data', 'readwrite');
        const req = tx.objectStore('fis-data').delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
  },
};

/**
 * Bind a signal to persistent storage.
 * @param {Proxy} sig - A signal created by signal()
 * @param {{ key: string, storage?: 'local'|'session'|'indexeddb', debounce?: number }} opts
 * @returns {{ dispose: () => void }} Cleanup handle
 */
export function persist(sig, { key, storage = 'local', debounce = 100 }) {
  const adapter = adapters[storage];

  // Load initial value from storage (sync adapters only)
  const stored = adapter.get(key);
  if (stored !== null && stored !== undefined) {
    // IndexedDB returns a Promise — handle async init
    if (stored instanceof Promise) {
      stored.then((val) => { if (val !== null && val !== undefined) sig.set(val); });
    } else {
      sig.set(stored);
    }
  }

  // Auto-write on changes with debounce
  let timer;
  const dispose = observe(() => {
    const val = sig.get();
    clearTimeout(timer);
    timer = setTimeout(() => adapter.set(key, val), debounce);
  });

  return {
    dispose: () => {
      clearTimeout(timer);
      dispose();
    },
  };
}

// Export for testing
export { serialize, deserialize, adapters };
