import { FISElement } from '/lib/element.js';
import { addToCart } from '/state/store.js';

class ProductCard extends FISElement {
  data() {
    return {
      '.card-name': this.getAttribute('name') || '',
      '.card-description': this.getAttribute('description') || '',
      '.card-price': '$' + (this.getAttribute('price') || '0'),
      '.card-image': this.getAttribute('image') || '',
    };
  }

  ready() {
    const btn = this.shadowRoot.querySelector('.add-btn');
    btn.addEventListener('click', () => {
      const id = this.getAttribute('product-id');
      if (id) addToCart(id);
    });

    // Make card clickable to navigate to product detail
    const card = this.shadowRoot.querySelector('.card');
    card.addEventListener('click', (e) => {
      if (e.target.closest('.add-btn')) return;
      const id = this.getAttribute('product-id');
      if (id) {
        import('/lib/router.js').then(({ navigate }) => navigate(`/products/${id}`));
      }
    });
  }
}
customElements.define('product-card', ProductCard);
