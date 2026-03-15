// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from './signal.js';
import { FISElement } from './element.js';

// --- Helpers ---

function mockFetch(html) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ text: () => Promise.resolve(html) })
  );
}

function defineTag(name, overrides = {}) {
  class TestEl extends FISElement {}
  Object.assign(TestEl.prototype, overrides);
  customElements.define(name, TestEl);
  return TestEl;
}

let tagCounter = 0;
function uniqueTag() {
  return `test-el-${++tagCounter}`;
}

async function mount(tag, html = '<div class="title"></div>') {
  mockFetch(html);
  const el = document.createElement(tag);
  document.body.appendChild(el);
  // connectedCallback is async — wait for it
  await new Promise((r) => setTimeout(r, 0));
  return el;
}

beforeEach(() => {
  FISElement._templates.clear();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// --- Tests ---

describe('FISElement', () => {
  describe('template loading', () => {
    it('fetches template from convention-based URL', async () => {
      const tag = uniqueTag();
      defineTag(tag);
      await mount(tag, '<p>hello</p>');

      expect(globalThis.fetch).toHaveBeenCalledWith(`/components/${tag}/${tag}.html`);
    });

    it('creates shadow DOM with open mode', async () => {
      const tag = uniqueTag();
      defineTag(tag);
      const el = await mount(tag, '<p>hello</p>');

      expect(el.shadowRoot).toBeTruthy();
      expect(el.shadowRoot.mode).toBe('open');
    });

    it('clones template content into shadow root', async () => {
      const tag = uniqueTag();
      defineTag(tag);
      const el = await mount(tag, '<p class="msg">hello</p>');

      expect(el.shadowRoot.querySelector('.msg').textContent).toBe('hello');
    });

    it('caches template — second instance does not re-fetch', async () => {
      const tag = uniqueTag();
      defineTag(tag);
      const html = '<span>cached</span>';
      mockFetch(html);

      const el1 = document.createElement(tag);
      document.body.appendChild(el1);
      await new Promise((r) => setTimeout(r, 0));

      const el2 = document.createElement(tag);
      document.body.appendChild(el2);
      await new Promise((r) => setTimeout(r, 0));

      // fetch called only once for this tag
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      // Both instances have the content
      expect(el1.shadowRoot.querySelector('span').textContent).toBe('cached');
      expect(el2.shadowRoot.querySelector('span').textContent).toBe('cached');
    });
  });

  describe('data() bindings', () => {
    it('sets textContent for plain selectors', async () => {
      const tag = uniqueTag();
      const name = signal('World');
      defineTag(tag, {
        data() {
          return { '.title': name.get() };
        },
      });
      const el = await mount(tag);

      expect(el.shadowRoot.querySelector('.title').textContent).toBe('World');
    });

    it('updates textContent reactively when signal changes', async () => {
      const tag = uniqueTag();
      const name = signal('before');
      defineTag(tag, {
        data() {
          return { '.title': name.get() };
        },
      });
      const el = await mount(tag);

      expect(el.shadowRoot.querySelector('.title').textContent).toBe('before');

      name.set('after');
      // observe is synchronous
      expect(el.shadowRoot.querySelector('.title').textContent).toBe('after');
    });

    it('sets attributes with @attr syntax', async () => {
      const tag = uniqueTag();
      const url = signal('https://example.com/img.png');
      defineTag(tag, {
        data() {
          return { 'img@src': url.get() };
        },
      });
      const el = await mount(tag, '<img />');

      expect(el.shadowRoot.querySelector('img').getAttribute('src')).toBe(
        'https://example.com/img.png'
      );
    });

    it('sets style properties with @style.prop syntax', async () => {
      const tag = uniqueTag();
      const color = signal('red');
      defineTag(tag, {
        data() {
          return { '.title@style.color': color.get() };
        },
      });
      const el = await mount(tag);

      expect(el.shadowRoot.querySelector('.title').style.color).toBe('red');

      color.set('blue');
      expect(el.shadowRoot.querySelector('.title').style.color).toBe('blue');
    });

    it('handles boolean attributes (disabled)', async () => {
      const tag = uniqueTag();
      const isDisabled = signal(true);
      defineTag(tag, {
        data() {
          return { 'button@disabled': isDisabled.get() };
        },
      });
      const el = await mount(tag, '<button>Click</button>');

      expect(el.shadowRoot.querySelector('button').hasAttribute('disabled')).toBe(true);

      isDisabled.set(false);
      expect(el.shadowRoot.querySelector('button').hasAttribute('disabled')).toBe(false);
    });

    it('handles boolean attributes (hidden)', async () => {
      const tag = uniqueTag();
      const isHidden = signal(false);
      defineTag(tag, {
        data() {
          return { '.title@hidden': isHidden.get() };
        },
      });
      const el = await mount(tag);

      expect(el.shadowRoot.querySelector('.title').hasAttribute('hidden')).toBe(false);

      isHidden.set(true);
      expect(el.shadowRoot.querySelector('.title').hasAttribute('hidden')).toBe(true);
    });

    it('skips silently when selector matches no element', async () => {
      const tag = uniqueTag();
      defineTag(tag, {
        data() {
          return { '.nonexistent': 'value', '.missing@href': 'url' };
        },
      });
      // Should not throw
      const el = await mount(tag);
      expect(el.shadowRoot).toBeTruthy();
    });
  });

  describe('lifecycle', () => {
    it('calls ready() after template is loaded', async () => {
      const tag = uniqueTag();
      const readyFn = vi.fn();
      defineTag(tag, { ready: readyFn });
      await mount(tag, '<p>hi</p>');

      expect(readyFn).toHaveBeenCalledTimes(1);
    });

    it('disposes observers on disconnectedCallback', async () => {
      const tag = uniqueTag();
      const count = signal(0);
      const dataFn = vi.fn(() => ({ '.title': String(count.get()) }));
      defineTag(tag, { data: dataFn });
      const el = await mount(tag);

      // data() called once during observe setup
      const callsBefore = dataFn.mock.calls.length;

      // Disconnect
      el.remove();

      // Change signal — should NOT trigger data() again
      count.set(42);
      expect(dataFn.mock.calls.length).toBe(callsBefore);
    });

    it('clears _observers array on disconnect', async () => {
      const tag = uniqueTag();
      defineTag(tag, {
        data() {
          return { '.title': 'x' };
        },
      });
      const el = await mount(tag);

      expect(el._observers.length).toBe(1);
      el.remove();
      expect(el._observers.length).toBe(0);
    });
  });

  describe('params getter', () => {
    it('returns parsed route params from #app dataset', async () => {
      const tag = uniqueTag();
      defineTag(tag);
      const el = await mount(tag, '<p>hi</p>');

      const app = document.createElement('div');
      app.id = 'app';
      app.dataset.routeParams = JSON.stringify({ id: '42', slug: 'hello' });
      document.body.appendChild(app);

      expect(el.params).toEqual({ id: '42', slug: 'hello' });
    });

    it('returns empty object when #app has no params', async () => {
      const tag = uniqueTag();
      defineTag(tag);
      const el = await mount(tag, '<p>hi</p>');

      expect(el.params).toEqual({});
    });

    it('returns empty object when #app does not exist', async () => {
      const tag = uniqueTag();
      defineTag(tag);
      const el = await mount(tag, '<p>hi</p>');

      // No #app in DOM
      expect(el.params).toEqual({});
    });
  });

  describe('multiple bindings', () => {
    it('applies multiple bindings in one data() call', async () => {
      const tag = uniqueTag();
      const title = signal('Hello');
      const color = signal('green');
      defineTag(tag, {
        data() {
          return {
            '.title': title.get(),
            '.title@style.color': color.get(),
          };
        },
      });
      const el = await mount(tag);

      const titleEl = el.shadowRoot.querySelector('.title');
      expect(titleEl.textContent).toBe('Hello');
      expect(titleEl.style.color).toBe('green');
    });
  });
});
