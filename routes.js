export default [
  { route: '/', file: '/pages/index.html', layout: '/pages/layout.html' },
  { route: '/404', file: '/pages/404.html', layout: '/pages/layout.html' },
  { route: '/cart', file: '/pages/cart.html', layout: '/pages/layout.html' },
  { route: '/products', file: '/pages/products/index.html', layout: '/pages/layout.html' },
  { route: '/products/:id', file: '/pages/products/[id].html', layout: '/pages/layout.html' },
];
