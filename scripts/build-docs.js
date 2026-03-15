#!/usr/bin/env node

/**
 * Minimal docs builder — converts docs/*.md to docs-dist/*.html
 * Zero dependencies. Uses a simple markdown-to-HTML converter.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ROOT = join(import.meta.dirname, '..');
const DOCS_SRC = join(ROOT, 'docs');
const DOCS_DIST = join(ROOT, 'docs-dist');

// Simple markdown → HTML (handles headings, code blocks, inline code, bold, italic, links, lists, tables, paragraphs)
function md2html(md) {
  const lines = md.split('\n');
  const out = [];
  let inCode = false;
  let codeLang = '';
  let codeLines = [];
  let inList = false;
  let listType = '';
  let inTable = false;
  let tableRows = [];

  function flushList() {
    if (inList) {
      out.push(listType === 'ul' ? '</ul>' : '</ol>');
      inList = false;
    }
  }

  function flushTable() {
    if (inTable && tableRows.length > 0) {
      let html = '<div class="table-wrap"><table>';
      tableRows.forEach((row, i) => {
        const tag = i === 0 ? 'th' : 'td';
        const cells = row.split('|').filter(c => c.trim() !== '').map(c => `<${tag}>${inline(c.trim())}</${tag}>`);
        if (i === 1 && row.match(/^\s*\|?\s*[-:]+/)) return; // skip separator
        html += `<tr>${cells.join('')}</tr>`;
      });
      html += '</table></div>';
      out.push(html);
      tableRows = [];
      inTable = false;
    }
  }

  function inline(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  for (const line of lines) {
    // Code blocks
    if (line.startsWith('```')) {
      if (inCode) {
        out.push(`<pre><code class="language-${codeLang}">${codeLines.join('\n')}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushList();
        flushTable();
        codeLang = line.slice(3).trim() || 'text';
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      continue;
    }

    // Tables
    if (line.match(/^\s*\|/)) {
      flushList();
      inTable = true;
      tableRows.push(line);
      continue;
    } else {
      flushTable();
    }

    // Empty lines
    if (line.trim() === '') { flushList(); continue; }

    // Headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      const text = hMatch[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }

    // Unordered list
    if (line.match(/^\s*[-*]\s+/)) {
      if (!inList || listType !== 'ul') { flushList(); out.push('<ul>'); inList = true; listType = 'ul'; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }

    // Ordered list
    if (line.match(/^\s*\d+\.\s+/)) {
      if (!inList || listType !== 'ol') { flushList(); out.push('<ol>'); inList = true; listType = 'ol'; }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      flushList();
      out.push(`<blockquote>${inline(line.slice(1).trim())}</blockquote>`);
      continue;
    }

    // Paragraph
    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  flushTable();
  return out.join('\n');
}

// Navigation order
const NAV = [
  { file: 'getting-started.md', title: 'Getting Started' },
  { file: 'signals.md', title: 'Signals' },
  { file: 'components.md', title: 'Components' },
  { file: 'routing.md', title: 'Routing' },
  { file: 'persistence.md', title: 'Persistence' },
  { file: 'css.md', title: 'CSS Architecture' },
  { file: 'dev-server.md', title: 'Dev Server' },
  { file: 'ai-workflow.md', title: 'AI Workflow' },
];

function buildNav(currentFile) {
  const items = NAV.map(({ file, title }) => {
    const href = file.replace('.md', '.html');
    const cls = file === currentFile ? ' class="active"' : '';
    return `<a href="${href}"${cls}>${title}</a>`;
  });
  return items.join('\n        ');
}

const TEMPLATE = (title, nav, content, prevNext) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Fuck It Stack</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0a0f; --surface: #12121a; --border: #1e1e2e;
      --text: #e0e0e8; --text-muted: #8888a0; --accent: #7c5cfc;
      --accent-glow: rgba(124,92,252,0.15); --code-bg: #16161e;
      --sidebar-w: 260px; --max-content: 780px;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* Layout */
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: var(--sidebar-w); background: var(--surface); border-right: 1px solid var(--border); padding: 2rem 1.25rem; position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto; }
    .sidebar .logo { font-size: 1.15rem; font-weight: 700; color: var(--accent); margin-bottom: 2rem; display: block; }
    .sidebar .logo span { color: var(--text-muted); font-weight: 400; font-size: 0.85rem; }
    .sidebar nav { display: flex; flex-direction: column; gap: 0.25rem; }
    .sidebar nav a { padding: 0.5rem 0.75rem; border-radius: 6px; color: var(--text-muted); font-size: 0.9rem; transition: all 0.15s; }
    .sidebar nav a:hover { background: var(--accent-glow); color: var(--text); text-decoration: none; }
    .sidebar nav a.active { background: var(--accent-glow); color: var(--accent); font-weight: 600; }

    .main { margin-left: var(--sidebar-w); flex: 1; padding: 3rem 2.5rem; max-width: calc(var(--max-content) + var(--sidebar-w) + 5rem); }
    .content { max-width: var(--max-content); }

    /* Typography */
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; background: linear-gradient(135deg, var(--accent), #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h2 { font-size: 1.4rem; font-weight: 600; margin: 2.5rem 0 0.75rem; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h3 { font-size: 1.15rem; font-weight: 600; margin: 1.75rem 0 0.5rem; color: var(--text); }
    p { margin-bottom: 1rem; color: var(--text-muted); }
    p strong, li strong { color: var(--text); }

    /* Code */
    code { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.88em; background: var(--code-bg); padding: 0.15em 0.4em; border-radius: 4px; color: #c4b5fd; }
    pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; overflow-x: auto; margin: 1rem 0 1.5rem; }
    pre code { background: none; padding: 0; font-size: 0.85rem; color: var(--text); }

    /* Lists */
    ul, ol { margin: 0.5rem 0 1rem 1.5rem; }
    li { margin-bottom: 0.35rem; color: var(--text-muted); }
    li code { font-size: 0.85em; }

    /* Tables */
    .table-wrap { overflow-x: auto; margin: 1rem 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 0.6rem 1rem; border: 1px solid var(--border); text-align: left; font-size: 0.9rem; }
    th { background: var(--surface); color: var(--text); font-weight: 600; }
    td { color: var(--text-muted); }

    /* Blockquote */
    blockquote { border-left: 3px solid var(--accent); padding: 0.5rem 1rem; margin: 1rem 0; background: var(--accent-glow); border-radius: 0 6px 6px 0; }
    blockquote p { margin: 0; color: var(--text); }

    /* Prev/Next */
    .prev-next { display: flex; justify-content: space-between; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
    .prev-next a { color: var(--accent); font-size: 0.9rem; }

    /* Mobile */
    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main { margin-left: 0; padding: 1.5rem 1rem; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <a href="index.html" class="logo">FIS <span>docs</span></a>
      <nav>
        ${nav}
      </nav>
    </aside>
    <main class="main">
      <div class="content">
        ${content}
        ${prevNext}
      </div>
    </main>
  </div>
</body>
</html>`;

// Build
mkdirSync(DOCS_DIST, { recursive: true });

// Build each doc page
for (let i = 0; i < NAV.length; i++) {
  const { file, title } = NAV[i];
  const srcPath = join(DOCS_SRC, file);
  if (!existsSync(srcPath)) {
    console.warn(`⚠ Missing: ${file}`);
    continue;
  }
  const md = readFileSync(srcPath, 'utf8');
  const html = md2html(md);
  const nav = buildNav(file);

  let prevNext = '<div class="prev-next">';
  if (i > 0) prevNext += `<a href="${NAV[i - 1].file.replace('.md', '.html')}">← ${NAV[i - 1].title}</a>`;
  else prevNext += '<span></span>';
  if (i < NAV.length - 1) prevNext += `<a href="${NAV[i + 1].file.replace('.md', '.html')}">${NAV[i + 1].title} →</a>`;
  else prevNext += '<span></span>';
  prevNext += '</div>';

  const outFile = join(DOCS_DIST, file.replace('.md', '.html'));
  writeFileSync(outFile, TEMPLATE(title, nav, html, prevNext));
  console.log(`✓ ${file} → ${basename(outFile)}`);
}

// Build index that redirects to getting-started
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=getting-started.html">
  <title>FIS Documentation</title>
</head>
<body>
  <p>Redirecting to <a href="getting-started.html">Getting Started</a>...</p>
</body>
</html>`;
writeFileSync(join(DOCS_DIST, 'index.html'), indexHtml);
console.log('✓ index.html (redirect)');

console.log(`\nDocs built to ${DOCS_DIST}/`);
