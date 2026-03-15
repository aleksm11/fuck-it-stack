// element.js — FISElement base class for Web Components (~70 lines, zero dependencies)

import { observe } from './signal.js';

const BOOL_ATTRS = new Set(['disabled', 'hidden', 'checked', 'readonly', 'required', 'open', 'selected', 'autofocus', 'novalidate', 'formnovalidate', 'multiple']);

export class FISElement extends HTMLElement {
  // Template cache: one fetch per tag name, shared across instances
  static _templates = new Map();

  // Observers to dispose on disconnect
  _observers = [];

  async connectedCallback() {
    // 1. Create Shadow DOM
    this.attachShadow({ mode: 'open' });

    // 2. Load + cache template HTML from /components/{tag-name}/{tag-name}.html
    const tag = this.tagName.toLowerCase();
    if (!FISElement._templates.has(tag)) {
      const res = await fetch(`/components/${tag}/${tag}.html`);
      const html = await res.text();
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      FISElement._templates.set(tag, tpl);
    }

    // 3. Clone template into shadow root
    const tpl = FISElement._templates.get(tag);
    this.shadowRoot.appendChild(tpl.content.cloneNode(true));

    // 4. Set up reactive bindings if data() is defined
    if (this.data) {
      const dispose = observe(() => {
        const bindings = this.data();
        for (const [selector, value] of Object.entries(bindings)) {
          this._applyBinding(selector, value);
        }
      });
      this._observers.push(dispose);
    }

    // 5. Call ready() lifecycle hook
    if (this.ready) this.ready();
  }

  disconnectedCallback() {
    for (const dispose of this._observers) dispose();
    this._observers = [];
  }

  // Route params from closest router outlet
  get params() {
    const outlet = document.getElementById('app');
    const raw = outlet?.dataset?.routeParams;
    return raw ? JSON.parse(raw) : {};
  }

  _applyBinding(selector, value) {
    const atIdx = selector.indexOf('@');
    if (atIdx === -1) {
      // Plain selector → textContent
      const el = this.shadowRoot.querySelector(selector);
      if (el) el.textContent = value;
    } else {
      const sel = selector.slice(0, atIdx);
      const attr = selector.slice(atIdx + 1);
      const el = this.shadowRoot.querySelector(sel);
      if (!el) return;
      if (attr.startsWith('style.')) {
        el.style[attr.slice(6)] = value;
      } else if (BOOL_ATTRS.has(attr)) {
        value ? el.setAttribute(attr, '') : el.removeAttribute(attr);
      } else {
        el.setAttribute(attr, value);
      }
    }
  }
}
