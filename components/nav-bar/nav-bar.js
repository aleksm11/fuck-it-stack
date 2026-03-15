import { FISElement } from '/lib/element.js';
import { cartCount } from '/state/store.js';

class NavBar extends FISElement {
  data() {
    return {
      '.cart-count': cartCount.get(),
    };
  }
}
customElements.define('nav-bar', NavBar);
