# Persistence

One function to save signal state to storage. Signals restore on page load. Maps and Sets serialize automatically.

**Web standards:** [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## `persist(signal, options)`

```js
import { signal } from '/lib/signal.js';
import { persist } from '/lib/persist.js';

const cart = signal(new Map());
persist(cart, { key: 'my-cart', storage: 'local' });
```

That's it. The cart is saved to localStorage on every change and restored on page load.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | *required* | Storage key |
| `storage` | `'local' \| 'session' \| 'indexeddb'` | `'local'` | Storage backend |
| `debounce` | `number` | `100` | Milliseconds to debounce writes |

## Storage Options

### `'local'` — localStorage

Persists across sessions. Survives tab close, browser restart. ~5MB limit.

```js
persist(settings, { key: 'app-settings', storage: 'local' });
```

### `'session'` — sessionStorage

Persists for the tab's lifetime. Gone when the tab closes.

```js
persist(formDraft, { key: 'draft', storage: 'session' });
```

### `'indexeddb'` — IndexedDB

Async storage with larger limits. Good for big datasets.

```js
persist(cache, { key: 'data-cache', storage: 'indexeddb' });
```

IndexedDB creates a database called `fis-store` with an object store called `fis-data`. Reads are async — the signal updates after the promise resolves.

## Map and Set Serialization

`persist` handles Map and Set automatically. No custom serializers needed.

```js
const cart = signal(new Map([['item-1', 3], ['item-2', 1]]));
persist(cart, { key: 'cart' });

// Stored as: {"__type":"Map","entries":[["item-1",3],["item-2",1]]}
// Restored as: new Map([['item-1', 3], ['item-2', 1]])
```

```js
const tags = signal(new Set(['js', 'css', 'html']));
persist(tags, { key: 'tags' });

// Stored as: {"__type":"Set","values":["js","css","html"]}
// Restored as: new Set(['js', 'css', 'html'])
```

This works for nested structures too — a Map inside an object inside a signal all serializes correctly.

## Debounced Writes

Writes are debounced by default (100ms). Rapid signal updates produce a single write.

```js
import { batch } from '/lib/signal.js';

// Even without batch, these produce one storage write (debounce):
cart.set(new Map([['a', 1]]));
cart.set(new Map([['a', 1], ['b', 2]]));
cart.set(new Map([['a', 1], ['b', 2], ['c', 3]]));
// → One write after 100ms: the final value
```

Increase debounce for high-frequency updates:

```js
persist(mousePosition, { key: 'mouse', debounce: 500 });
```

## Cleanup

`persist` returns a handle with a `dispose()` method. Call it to stop syncing.

```js
const handle = persist(cart, { key: 'cart' });

// Later:
handle.dispose();  // Stops observing the signal, clears pending writes
```

The signal keeps its current value — `dispose()` just stops writing to storage.

## Full Example

```js
import { signal, computed } from '/lib/signal.js';
import { persist } from '/lib/persist.js';

// Cart with persistence
const cart = signal(new Map());
persist(cart, { key: 'fis-cart', storage: 'local' });

// User preferences with session storage
const prefs = signal({ theme: 'dark', fontSize: 16 });
persist(prefs, { key: 'prefs', storage: 'session' });

// Computed total — doesn't need persistence (derived from cart)
const total = computed(() => {
  let sum = 0;
  for (const [id, qty] of cart.get()) {
    sum += getPrice(id) * qty;
  }
  return sum;
});
```
