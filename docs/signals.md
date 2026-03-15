# Signals

Reactive state built on `Proxy`. No virtual DOM diffing. No dependency arrays. When a signal changes, observers re-run. That's the whole model.

**Web standard:** [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

## `signal(initialValue)`

Create a reactive signal from any value — primitives, objects, arrays, Maps, Sets.

```js
import { signal } from '/lib/signal.js';

const count = signal(0);
const user = signal({ name: 'Jakša', role: 'admin' });
const tags = signal(new Set(['js', 'css']));
const cache = signal(new Map());
```

## `.get()` / `.set()`

Read with `.get()`, write with `.set()`. That's it.

```js
count.get();   // 0
count.set(1);  // Triggers all observers watching count
```

`.get()` registers the signal as a dependency when called inside `observe()` or `computed()`. This is how auto-tracking works.

```js
user.set({ name: 'Jakša', role: 'superadmin' });
// Replaces the entire value and notifies observers
```

## `.peek()`

Read without tracking. Useful when you need a value but don't want to create a dependency.

```js
observe(() => {
  const name = user.name.get();     // Tracked — observer re-runs when name changes
  const role = user.role.peek();    // NOT tracked — role changes won't re-run this observer
  console.log(`${name} (${role})`);
});
```

## Deep Property Access

Signals support nested property access. Each nested path creates a child signal node.

```js
const user = signal({ name: 'Jakša', address: { city: 'Belgrade' } });

// Access nested properties — returns a signal-like proxy
user.name.get();           // 'Jakša'
user.address.city.get();   // 'Belgrade'

// Set nested properties
user.name.set('Marko');    // Notifies user AND user.name observers

// Set parent — syncs children
user.set({ name: 'Ana', address: { city: 'Novi Sad' } });
// Both user.name and user.address.city observers fire
```

## `observe(fn)`

Run a function and automatically re-run it whenever any `.get()` signal it reads changes. Returns a dispose function.

```js
import { observe } from '/lib/signal.js';

const count = signal(0);

const dispose = observe(() => {
  document.title = `Count: ${count.get()}`;
});

count.set(5);  // Document title updates to "Count: 5"

dispose();     // Stop observing — no more updates
```

Observers clean up their dependencies on each run. If your function conditionally reads different signals, only the signals read in the *last* run are tracked.

```js
const showDetails = signal(false);
const summary = signal('TL;DR');
const details = signal('The full story...');

observe(() => {
  if (showDetails.get()) {
    console.log(details.get());   // Only tracked when showDetails is true
  } else {
    console.log(summary.get());   // Only tracked when showDetails is false
  }
});
```

## `computed(fn)`

Create a derived read-only signal. The function re-evaluates when its dependencies change.

```js
import { computed } from '/lib/signal.js';

const items = signal([
  { name: 'Widget', price: 10, qty: 2 },
  { name: 'Gadget', price: 25, qty: 1 },
]);

const total = computed(() => {
  return items.get().reduce((sum, item) => sum + item.price * item.qty, 0);
});

total.get();   // 45
total.peek();  // 45 (without tracking)
```

Computed signals can be observed like regular signals:

```js
observe(() => {
  document.getElementById('total').textContent = `$${total.get()}`;
});
```

Computed signals also expose a `dispose()` method to tear down the internal observer:

```js
const c = computed(() => count.get() * 2);
c.dispose(); // Stops recomputing
```

## `batch(fn)`

Group multiple signal writes. Observers fire once at the end, not per write.

```js
import { batch } from '/lib/signal.js';

const firstName = signal('');
const lastName = signal('');

observe(() => {
  // Without batch: fires twice (once per set)
  // With batch: fires once
  console.log(`${firstName.get()} ${lastName.get()}`);
});

batch(() => {
  firstName.set('Jakša');
  lastName.set('Mališić');
});
// Observer fires once: "Jakša Mališić"
```

Batches can nest. The queue flushes only when the outermost batch completes.

## Map and Set Support

Signals wrap `Map` and `Set` values with reactive proxies. Mutations through the proxy trigger notifications automatically.

```js
const cart = signal(new Map());

observe(() => {
  const items = cart.get();  // Returns a reactive Map proxy
  console.log(`Cart has ${items.size} items`);
});

// These all trigger observers:
cart.get().set('item-1', 3);
cart.get().delete('item-1');
cart.get().clear();
```

```js
const tags = signal(new Set());

observe(() => {
  console.log(`Tags: ${[...tags.get()].join(', ')}`);
});

tags.get().add('javascript');
tags.get().delete('javascript');
```

**Supported reactive methods:**

| Map | Set |
|---|---|
| `.set(key, value)` | `.add(value)` |
| `.delete(key)` | `.delete(value)` |
| `.clear()` | `.clear()` |
| `.get(key)` (read) | `.has(value)` (read) |
| `.has(key)` (read) | |

## Full Example: Todo List

```js
import { signal, computed, observe, batch } from '/lib/signal.js';

// State
const todos = signal([]);
const filter = signal('all'); // 'all' | 'active' | 'done'

// Derived
const filtered = computed(() => {
  const list = todos.get();
  const f = filter.get();
  if (f === 'active') return list.filter(t => !t.done);
  if (f === 'done') return list.filter(t => t.done);
  return list;
});

const remaining = computed(() => {
  return todos.get().filter(t => !t.done).length;
});

// Actions
function addTodo(text) {
  todos.set([...todos.peek(), { text, done: false }]);
}

function toggleTodo(index) {
  const list = [...todos.peek()];
  list[index] = { ...list[index], done: !list[index].done };
  todos.set(list);
}

// Render
observe(() => {
  document.getElementById('list').innerHTML = filtered.get()
    .map((t, i) => `<li class="${t.done ? 'done' : ''}">${t.text}</li>`)
    .join('');
  document.getElementById('remaining').textContent = `${remaining.get()} left`;
});
```
