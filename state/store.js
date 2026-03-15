import { signal, computed } from '/lib/signal.js';
import { persist } from '/lib/persist.js';

// Product data (hardcoded for demo)
export const products = signal([
  { id: '1', name: 'Mechanical Keyboard', price: 149.99, image: '⌨️', description: 'Cherry MX switches, RGB backlight' },
  { id: '2', name: 'Ultra Monitor', price: 599.99, image: '🖥️', description: '4K 144Hz IPS panel' },
  { id: '3', name: 'Wireless Mouse', price: 79.99, image: '🖱️', description: 'Ergonomic, 25K DPI sensor' },
  { id: '4', name: 'USB-C Hub', price: 49.99, image: '🔌', description: '7-in-1, 4K HDMI, 100W PD' },
  { id: '5', name: 'Standing Desk', price: 449.99, image: '🪑', description: 'Electric, memory presets' },
  { id: '6', name: 'Noise-Canceling Headphones', price: 299.99, image: '🎧', description: 'ANC, 30h battery, LDAC' },
]);

// Cart: Map<productId, quantity>
export const cart = signal(new Map());
persist(cart, { key: 'fis-cart', storage: 'local' });

// Computed: cart total
export const cartTotal = computed(() => {
  const items = cart.get();
  let total = 0;
  const prods = products.peek();
  for (const [id, qty] of items) {
    const prod = prods.find(p => p.id === id);
    if (prod) total += prod.price * qty;
  }
  return total;
});

// Computed: cart count
export const cartCount = computed(() => {
  let count = 0;
  for (const qty of cart.get().values()) count += qty;
  return count;
});

// Cart actions
export function addToCart(productId) {
  const items = cart.peek();
  const current = items.get(productId) || 0;
  const updated = new Map(items);
  updated.set(productId, current + 1);
  cart.set(updated);
}

export function removeFromCart(productId) {
  const items = cart.peek();
  const updated = new Map(items);
  updated.delete(productId);
  cart.set(updated);
}

export function updateQuantity(productId, qty) {
  const items = cart.peek();
  const updated = new Map(items);
  if (qty <= 0) {
    updated.delete(productId);
  } else {
    updated.set(productId, qty);
  }
  cart.set(updated);
}
