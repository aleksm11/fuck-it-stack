/**
 * @fis/plugin-markdown — Custom zero-dependency markdown parser
 * Converts markdown source to HTML. Handles all common markdown features
 * including GFM tables, fenced code blocks, and inline formatting.
 *
 * @module plugins/markdown/parser
 */

/**
 * Parse markdown source into HTML string.
 * @param {string} src - Raw markdown text
 * @returns {string} HTML output
 */
export function parseMarkdown(src) {
  const lines = src.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip (paragraph breaks handled by collecting non-blank lines)
    if (line.trim() === '') { i++; continue; }

    // Fenced code block
    const fenceMatch = line.match(/^(`{3,})([\w-]*)\s*$/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const lang = fenceMatch[2];
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing fence
      const langAttr = lang ? ` class="language-${lang}"` : '';
      out.push(`<pre><code${langAttr}>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote — collect consecutive > lines
    if (line.startsWith('>')) {
      const bqLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        bqLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote><p>${inlineFormat(bqLines.join(' '))}</p></blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\s]*[-*]\s+/.test(lines[i])) {
        items.push(inlineFormat(lines[i].replace(/^[\s]*[-*]\s+/, '')));
        i++;
      }
      out.push('<ul>' + items.map(item => `<li>${item}</li>`).join('') + '</ul>');
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
        items.push(inlineFormat(lines[i].replace(/^[\s]*\d+\.\s+/, '')));
        i++;
      }
      out.push('<ol>' + items.map(item => `<li>${item}</li>`).join('') + '</ol>');
      continue;
    }

    // Table (GFM)
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*$/.test(lines[i + 1])) {
      const headerCells = parseTableRow(lines[i]);
      const alignments = parseAlignments(lines[i + 1]);
      i += 2; // skip header + separator
      const bodyRows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        bodyRows.push(parseTableRow(lines[i]));
        i++;
      }
      let table = '<table><thead><tr>';
      headerCells.forEach((cell, ci) => {
        const align = alignments[ci] ? ` align="${alignments[ci]}"` : '';
        table += `<th${align}>${inlineFormat(cell)}</th>`;
      });
      table += '</tr></thead>';
      if (bodyRows.length > 0) {
        table += '<tbody>';
        for (const row of bodyRows) {
          table += '<tr>';
          row.forEach((cell, ci) => {
            const align = alignments[ci] ? ` align="${alignments[ci]}"` : '';
            table += `<td${align}>${inlineFormat(cell)}</td>`;
          });
          table += '</tr>';
        }
        table += '</tbody>';
      }
      table += '</table>';
      out.push(table);
      continue;
    }

    // Paragraph — collect consecutive non-blank, non-special lines
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i], lines, i)) {
      // Line break: two trailing spaces or trailing backslash
      let text = lines[i];
      if (text.endsWith('\\')) {
        paraLines.push(inlineFormat(text.slice(0, -1)) + '<br>');
      } else if (text.endsWith('  ')) {
        paraLines.push(inlineFormat(text.trimEnd()) + '<br>');
      } else {
        paraLines.push(inlineFormat(text));
      }
      i++;
    }
    if (paraLines.length > 0) {
      out.push(`<p>${paraLines.join('\n')}</p>`);
    }
  }

  return out.join('\n');
}

/**
 * Check if a line starts a block-level element (not a paragraph continuation).
 * @param {string} line
 * @param {string[]} lines
 * @param {number} idx
 * @returns {boolean}
 */
function isBlockStart(line, lines, idx) {
  if (/^#{1,6}\s+/.test(line)) return true;
  if (/^(`{3,})/.test(line)) return true;
  if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) return true;
  if (line.startsWith('>')) return true;
  if (/^[\s]*[-*]\s+/.test(line)) return true;
  if (/^[\s]*\d+\.\s+/.test(line)) return true;
  // Table: line with | followed by separator line
  if (line.includes('|') && idx + 1 < lines.length && /^\s*\|?\s*[-:]+[-| :]*$/.test(lines[idx + 1])) return true;
  return false;
}

/**
 * Parse a GFM table row into cells.
 * @param {string} row
 * @returns {string[]}
 */
function parseTableRow(row) {
  return row.split('|').map(c => c.trim()).filter((_, i, arr) => {
    // Remove empty first/last entries from leading/trailing |
    if (i === 0 && arr[i] === '') return false;
    if (i === arr.length - 1 && arr[i] === '') return false;
    return true;
  });
}

/**
 * Parse GFM table alignment row.
 * @param {string} row
 * @returns {(string|null)[]}
 */
function parseAlignments(row) {
  return row.split('|').map(c => c.trim()).filter(Boolean).map(cell => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });
}

/**
 * Apply inline formatting: bold+italic, bold, italic, code, images, links.
 * @param {string} text
 * @returns {string}
 */
function inlineFormat(text) {
  let s = escapeHtml(text);

  // Inline code (must be first to prevent inner formatting)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images: ![alt](src)
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Links: [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Bold + italic (*** or ___)
  s = s.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');

  // Bold
  s = s.replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>');

  // Italic
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');

  return s;
}

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Extract frontmatter from markdown source.
 * Expects YAML-like key: value pairs between --- fences at the start.
 * @param {string} src - Raw markdown text
 * @returns {{ metadata: Record<string, string>, body: string }}
 */
export function extractFrontmatter(src) {
  const trimmed = src.trimStart();
  if (!trimmed.startsWith('---')) {
    return { metadata: {}, body: src };
  }

  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) {
    return { metadata: {}, body: src };
  }

  const frontBlock = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trimStart();

  /** @type {Record<string, string>} */
  const metadata = {};
  for (const line of frontBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) metadata[key] = value;
  }

  return { metadata, body };
}
