import { FISElement } from '/lib/element.js';
import { updateQuantity, removeFromCart } from '/state/store.js';

class CartItem extends FISElement {
  data() {
    const price = parseFloat(this.getAttribute('price') || '0');
    const qty = parseInt(this.getAttribute('qty') || '1', 10);
    return {
      '.item-image': this.getAttribute('image') || '',
      '.item-name': this.getAttribute('name') || '',
      '.item-price': '$' + price.toFixed(2),
      '.item-qty': String(qty),
      '.item-total': '$' + (price * qty).toFixed(2),
    };
  }

  ready() {
    const id = this.getAttribute('product-id');

    this.shadowRoot.querySelector('.btn-plus').addEventListener('click', () => {
      const qty = parseInt(this.getAttribute('qty') || '1', 10);
      this.setAttribute('qty', String(qty + 1));
      updateQuantity(id, qty + 1);
    });

    this.shadowRoot.querySelector('.btn-minus').addEventListener('click', () => {
      const qty = parseInt(this.getAttribute('qty') || '1', 10);
      if (qty > 1) {
        this.setAttribute('qty', String(qty - 1));
        updateQuantity(id, qty - 1);
      } else {
        removeFromCart(id);
      }
    });

    this.shadowRoot.querySelector('.btn-remove').addEventListener('click', () => {
      removeFromCart(id);
    });
  }
}
customElements.define('cart-item', CartItem);
