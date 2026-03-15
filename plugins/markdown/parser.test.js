import { describe, it, expect } from 'vitest';
import { parseMarkdown, extractFrontmatter } from './parser.js';

describe('parseMarkdown', () => {
  // === HEADINGS ===
  it('parses h1', () => {
    expect(parseMarkdown('# Hello')).toBe('<h1>Hello</h1>');
  });

  it('parses h2', () => {
    expect(parseMarkdown('## World')).toBe('<h2>World</h2>');
  });

  it('parses h3', () => {
    expect(parseMarkdown('### Level 3')).toBe('<h3>Level 3</h3>');
  });

  it('parses h4', () => {
    expect(parseMarkdown('#### Level 4')).toBe('<h4>Level 4</h4>');
  });

  it('parses h5', () => {
    expect(parseMarkdown('##### Level 5')).toBe('<h5>Level 5</h5>');
  });

  it('parses h6', () => {
    expect(parseMarkdown('###### Level 6')).toBe('<h6>Level 6</h6>');
  });

  // === PARAGRAPHS ===
  it('wraps text in paragraph tags', () => {
    expect(parseMarkdown('Hello world')).toBe('<p>Hello world</p>');
  });

  it('separates paragraphs by blank lines', () => {
    const result = parseMarkdown('First paragraph\n\nSecond paragraph');
    expect(result).toContain('<p>First paragraph</p>');
    expect(result).toContain('<p>Second paragraph</p>');
  });

  it('joins consecutive lines within a paragraph', () => {
    const result = parseMarkdown('Line one\nLine two');
    expect(result).toBe('<p>Line one\nLine two</p>');
  });

  // === INLINE FORMATTING ===
  it('parses bold text', () => {
    expect(parseMarkdown('This is **bold** text')).toBe('<p>This is <strong>bold</strong> text</p>');
  });

  it('parses italic text', () => {
    expect(parseMarkdown('This is *italic* text')).toBe('<p>This is <em>italic</em> text</p>');
  });

  it('parses bold+italic text', () => {
    expect(parseMarkdown('This is ***bold italic*** text')).toBe(
      '<p>This is <strong><em>bold italic</em></strong> text</p>'
    );
  });

  it('parses inline code', () => {
    expect(parseMarkdown('Use `console.log()` here')).toBe(
      '<p>Use <code>console.log()</code> here</p>'
    );
  });

  // === LINKS AND IMAGES ===
  it('parses links', () => {
    expect(parseMarkdown('[Click me](https://example.com)')).toBe(
      '<p><a href="https://example.com">Click me</a></p>'
    );
  });

  it('parses images', () => {
    expect(parseMarkdown('![Alt text](image.png)')).toBe(
      '<p><img src="image.png" alt="Alt text"></p>'
    );
  });

  // === CODE BLOCKS ===
  it('parses fenced code blocks', () => {
    const md = '```\nconst x = 1;\n```';
    expect(parseMarkdown(md)).toBe('<pre><code>const x = 1;</code></pre>');
  });

  it('parses fenced code blocks with language', () => {
    const md = '```js\nconst x = 1;\n```';
    expect(parseMarkdown(md)).toBe('<pre><code class="language-js">const x = 1;</code></pre>');
  });

  it('escapes HTML inside code blocks', () => {
    const md = '```\n<div>test</div>\n```';
    expect(parseMarkdown(md)).toContain('&lt;div&gt;test&lt;/div&gt;');
  });

  it('handles multi-line code blocks', () => {
    const md = '```js\nline 1\nline 2\nline 3\n```';
    const result = parseMarkdown(md);
    expect(result).toContain('line 1\nline 2\nline 3');
  });

  // === UNORDERED LISTS ===
  it('parses unordered lists with -', () => {
    const md = '- Item 1\n- Item 2\n- Item 3';
    const result = parseMarkdown(md);
    expect(result).toBe('<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>');
  });

  it('parses unordered lists with *', () => {
    const md = '* Item A\n* Item B';
    const result = parseMarkdown(md);
    expect(result).toBe('<ul><li>Item A</li><li>Item B</li></ul>');
  });

  // === ORDERED LISTS ===
  it('parses ordered lists', () => {
    const md = '1. First\n2. Second\n3. Third';
    const result = parseMarkdown(md);
    expect(result).toBe('<ol><li>First</li><li>Second</li><li>Third</li></ol>');
  });

  // === BLOCKQUOTES ===
  it('parses blockquotes', () => {
    const result = parseMarkdown('> This is a quote');
    expect(result).toBe('<blockquote><p>This is a quote</p></blockquote>');
  });

  it('parses multi-line blockquotes', () => {
    const result = parseMarkdown('> Line one\n> Line two');
    expect(result).toContain('<blockquote>');
    expect(result).toContain('Line one');
    expect(result).toContain('Line two');
  });

  // === TABLES ===
  it('parses GFM tables', () => {
    const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
    const result = parseMarkdown(md);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>Name</th>');
    expect(result).toContain('<th>Age</th>');
    expect(result).toContain('<td>Alice</td>');
    expect(result).toContain('<td>30</td>');
    expect(result).toContain('<td>Bob</td>');
    expect(result).toContain('<td>25</td>');
  });

  it('parses table alignment', () => {
    const md = '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |';
    const result = parseMarkdown(md);
    expect(result).toContain('align="left"');
    expect(result).toContain('align="center"');
    expect(result).toContain('align="right"');
  });

  // === HORIZONTAL RULES ===
  it('parses --- horizontal rule', () => {
    expect(parseMarkdown('---')).toBe('<hr>');
  });

  it('parses *** horizontal rule', () => {
    expect(parseMarkdown('***')).toBe('<hr>');
  });

  it('parses ___ horizontal rule', () => {
    expect(parseMarkdown('___')).toBe('<hr>');
  });

  // === LINE BREAKS ===
  it('parses line break with trailing backslash', () => {
    const result = parseMarkdown('Line one\\\nLine two');
    expect(result).toContain('<br>');
  });

  it('parses line break with two trailing spaces', () => {
    const result = parseMarkdown('Line one  \nLine two');
    expect(result).toContain('<br>');
  });

  // === MIXED CONTENT ===
  it('handles bold inside a link', () => {
    // Bold inside link text: since inline code runs bold before links conceptually,
    // we test that bold works within link text
    const result = parseMarkdown('[**Bold link**](url)');
    expect(result).toContain('<a href="url">');
    expect(result).toContain('<strong>Bold link</strong>');
  });

  it('handles inline code in a heading', () => {
    const result = parseMarkdown('## Use `npm install`');
    expect(result).toBe('<h2>Use <code>npm install</code></h2>');
  });

  it('handles multiple inline styles in one line', () => {
    const result = parseMarkdown('This has **bold** and *italic* and `code`');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<code>code</code>');
  });

  it('handles full document with mixed elements', () => {
    const md = `# Title

A paragraph with **bold** and *italic*.

- List item 1
- List item 2

\`\`\`js
const x = 42;
\`\`\`

> A quote

---

Another paragraph.`;

    const result = parseMarkdown(md);
    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>List item 1</li>');
    expect(result).toContain('class="language-js"');
    expect(result).toContain('<blockquote>');
    expect(result).toContain('<hr>');
    expect(result).toContain('<p>Another paragraph.</p>');
  });

  // === HTML ESCAPING ===
  it('escapes HTML in regular text', () => {
    const result = parseMarkdown('Use <div> tags');
    expect(result).toContain('&lt;div&gt;');
  });

  it('handles image with empty alt', () => {
    expect(parseMarkdown('![](logo.png)')).toBe(
      '<p><img src="logo.png" alt=""></p>'
    );
  });
});

describe('extractFrontmatter', () => {
  it('extracts key-value frontmatter', () => {
    const src = '---\ntitle: Hello World\nauthor: Jaksa\n---\n\n# Content';
    const { metadata, body } = extractFrontmatter(src);
    expect(metadata.title).toBe('Hello World');
    expect(metadata.author).toBe('Jaksa');
    expect(body).toContain('# Content');
  });

  it('returns empty metadata when no frontmatter', () => {
    const src = '# Just a heading';
    const { metadata, body } = extractFrontmatter(src);
    expect(metadata).toEqual({});
    expect(body).toBe('# Just a heading');
  });

  it('handles frontmatter with colons in values', () => {
    const src = '---\nurl: https://example.com\n---\nBody';
    const { metadata } = extractFrontmatter(src);
    expect(metadata.url).toBe('https://example.com');
  });

  it('handles empty frontmatter block', () => {
    const src = '---\n---\nBody text';
    const { metadata, body } = extractFrontmatter(src);
    expect(metadata).toEqual({});
    expect(body).toContain('Body text');
  });

  it('handles frontmatter with various value types as strings', () => {
    const src = '---\ntitle: My Post\ndate: 2025-01-01\ndraft: true\ntags: js, web\n---\nContent';
    const { metadata } = extractFrontmatter(src);
    expect(metadata.title).toBe('My Post');
    expect(metadata.date).toBe('2025-01-01');
    expect(metadata.draft).toBe('true');
    expect(metadata.tags).toBe('js, web');
  });
});
