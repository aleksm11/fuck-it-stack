#!/usr/bin/env node

/**
 * FIS Docs Builder — converts docs/*.md to docs-dist/*.html
 * Cyberpunk theme. Syntax highlighting via Prism.js CDN. Client-side search.
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ROOT = join(import.meta.dirname, '..');
const DOCS_SRC = join(ROOT, 'docs');
const DOCS_DIST = join(ROOT, 'docs-dist');
const ASSETS = join(ROOT, 'assets');

// Simple markdown → HTML
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
    if (inList) { out.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
  }

  function flushTable() {
    if (inTable && tableRows.length > 0) {
      let html = '<div class="table-wrap"><table>';
      tableRows.forEach((row, i) => {
        const tag = i === 0 ? 'th' : 'td';
        const cells = row.split('|').filter(c => c.trim() !== '').map(c => `<${tag}>${inline(c.trim())}</${tag}>`);
        if (i === 1 && row.match(/^\s*\|?\s*[-:]+/)) return;
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
    if (line.startsWith('```')) {
      if (inCode) {
        const langClass = codeLang ? ` class="language-${codeLang}"` : '';
        out.push(`<pre class="code-block"><code${langClass}>${codeLines.join('\n')}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushList(); flushTable();
        codeLang = line.slice(3).trim() || '';
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      continue;
    }

    if (line.match(/^\s*\|/)) { flushList(); inTable = true; tableRows.push(line); continue; }
    else { flushTable(); }

    if (line.trim() === '') { flushList(); continue; }

    const hMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (hMatch) {
      flushList();
      const level = hMatch[1].length;
      const text = hMatch[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      continue;
    }

    if (line.match(/^\s*[-*]\s+/)) {
      if (!inList || listType !== 'ul') { flushList(); out.push('<ul>'); inList = true; listType = 'ul'; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (line.match(/^\s*\d+\.\s+/)) {
      if (!inList || listType !== 'ol') { flushList(); out.push('<ol>'); inList = true; listType = 'ol'; }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }

    if (line.startsWith('>')) {
      flushList();
      out.push(`<blockquote>${inline(line.slice(1).trim())}</blockquote>`);
      continue;
    }

    flushList();
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList(); flushTable();
  return out.join('\n');
}

// Navigation order
const NAV = [
  { file: 'getting-started.md', title: 'Getting Started', icon: '🚀' },
  { file: 'signals.md', title: 'Signals', icon: '⚡' },
  { file: 'components.md', title: 'Components', icon: '🧩' },
  { file: 'routing.md', title: 'Routing', icon: '🗺️' },
  { file: 'persistence.md', title: 'Persistence', icon: '💾' },
  { file: 'css.md', title: 'CSS Architecture', icon: '🎨' },
  { file: 'dev-server.md', title: 'Dev Server', icon: '🔧' },
  { file: 'plugins.md', title: 'Plugins', icon: '🔌' },
  { file: 'ai-workflow.md', title: 'AI Workflow', icon: '🤖' },
];

function buildNav(currentFile) {
  return NAV.map(({ file, title, icon }) => {
    const href = file.replace('.md', '.html');
    const cls = file === currentFile ? ' class="active"' : '';
    return `<a href="${href}"${cls}><span class="nav-icon">${icon}</span>${title}</a>`;
  }).join('\n          ');
}

// Build search index
function buildSearchIndex() {
  const entries = [];
  for (const { file, title } of NAV) {
    const srcPath = join(DOCS_SRC, file);
    if (!existsSync(srcPath)) continue;
    const content = readFileSync(srcPath, 'utf8');
    // Extract headings and their content
    const sections = content.split(/^#{1,3}\s+/m).filter(Boolean);
    const headings = content.match(/^#{1,3}\s+(.+)$/gm) || [];
    
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i].replace(/^#+\s+/, '');
      const sectionText = (sections[i + 1] || '').slice(0, 300).replace(/[`*#\[\]()]/g, '').trim();
      const id = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      entries.push({
        page: file.replace('.md', '.html'),
        pageTitle: title,
        heading,
        id,
        text: sectionText,
      });
    }
  }
  return JSON.stringify(entries);
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  
  :root {
    --bg-deep: #050508;
    --bg: #0a0a12;
    --bg-elevated: #0f0f1a;
    --surface: #111120;
    --surface-hover: #16162a;
    --border: #1a1a35;
    --border-glow: #2a2a55;
    --text: #e8e8f0;
    --text-secondary: #9898b8;
    --text-muted: #6868a0;
    --accent: #7c5cfc;
    --accent-bright: #9d7fff;
    --accent-dim: #5a3fd4;
    --accent-glow: rgba(124, 92, 252, 0.12);
    --accent-glow-strong: rgba(124, 92, 252, 0.25);
    --danger: #ff4d6a;
    --success: #00e5a0;
    --warning: #ffb547;
    --code-bg: #0c0c18;
    --code-border: #1a1a38;
    --sidebar-w: 280px;
    --max-content: 800px;
    --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    --glow-sm: 0 0 10px rgba(124, 92, 252, 0.15);
    --glow-md: 0 0 20px rgba(124, 92, 252, 0.2);
    --glow-lg: 0 0 40px rgba(124, 92, 252, 0.15), 0 0 80px rgba(124, 92, 252, 0.05);
  }

  @font-face {
    font-family: 'Inter';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url('https://fonts.gstatic.com/s/inter/v18/UcCo3FwrK3iLTcviYwY.woff2') format('woff2');
  }

  html { scroll-behavior: smooth; }
  
  body {
    font-family: var(--font-sans);
    background: var(--bg-deep);
    color: var(--text);
    line-height: 1.75;
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -webkit-text-size-adjust: 100%;
    overflow-x: hidden;
  }

  ::selection {
    background: var(--accent);
    color: #fff;
  }

  a { color: var(--accent-bright); text-decoration: none; transition: all 0.2s; }
  a:hover { color: #fff; text-shadow: var(--glow-sm); }

  /* === LAYOUT === */
  .layout { display: flex; min-height: 100vh; }
  
  .sidebar {
    width: var(--sidebar-w);
    background: var(--bg);
    border-right: 1px solid var(--border);
    position: fixed;
    top: 0; left: 0; bottom: 0;
    overflow-y: auto;
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .sidebar-header {
    padding: 1.5rem 1.25rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
  }
  .logo:hover { text-decoration: none; }
  .logo img { width: 40px; height: 40px; border-radius: 8px; }
  .logo-text {
    font-size: 1.5rem;
    font-weight: 800;
    font-family: var(--font-mono);
    background: linear-gradient(135deg, var(--accent-bright), #c084fc, var(--accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
  }
  .logo-sub {
    font-size: 0.65rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    display: block;
    margin-top: -2px;
  }

  /* Search */
  .search-container { padding: 0.75rem 1.25rem; }
  .search-box {
    width: 100%;
    padding: 0.55rem 0.75rem 0.55rem 2.25rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--font-sans);
    font-size: 0.85rem;
    outline: none;
    transition: all 0.2s;
  }
  .search-box::placeholder { color: var(--text-muted); }
  .search-box:focus {
    border-color: var(--accent);
    box-shadow: var(--glow-sm);
    background: var(--surface);
  }
  .search-wrap {
    position: relative;
  }
  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 0.85rem;
    pointer-events: none;
  }
  .search-kbd {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-muted);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.1rem 0.4rem;
    pointer-events: none;
  }
  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--surface);
    border: 1px solid var(--border-glow);
    border-radius: 8px;
    margin-top: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
    z-index: 200;
    display: none;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  }
  .search-results.active { display: block; }
  .search-result {
    display: block;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
    text-decoration: none;
  }
  .search-result:hover { background: var(--accent-glow); text-decoration: none; }
  .search-result:last-child { border-bottom: none; }
  .search-result-page { font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; }
  .search-result-title { font-size: 0.9rem; color: var(--text); font-weight: 600; margin-top: 0.15rem; }
  .search-result-snippet { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .search-no-results { padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; }

  /* Nav */
  .sidebar-nav {
    flex: 1;
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sidebar-nav a {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 0.88rem;
    font-weight: 450;
    transition: all 0.15s;
    text-decoration: none;
    position: relative;
  }
  .sidebar-nav a:hover { background: var(--surface-hover); color: var(--text); text-decoration: none; }
  .sidebar-nav a.active {
    background: var(--accent-glow-strong);
    color: var(--accent-bright);
    font-weight: 600;
  }
  .sidebar-nav a.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.4rem;
    bottom: 0.4rem;
    width: 3px;
    background: var(--accent);
    border-radius: 0 3px 3px 0;
    box-shadow: var(--glow-sm);
  }
  .nav-icon { font-size: 1rem; width: 1.25rem; text-align: center; }

  .sidebar-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  .sidebar-footer a {
    color: var(--text-muted);
    font-size: 0.8rem;
    transition: color 0.2s;
  }
  .sidebar-footer a:hover { color: var(--accent-bright); }

  /* === MAIN CONTENT === */
  .main {
    margin-left: var(--sidebar-w);
    flex: 1;
    min-height: 100vh;
    position: relative;
  }

  /* Glow line at top */
  .main::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.4;
  }

  .content {
    max-width: 720px;
    margin: 0 auto;
    padding: 3rem 3rem 5rem;
  }

  /* === TYPOGRAPHY === */
  h1 {
    font-size: 2.5rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.2;
    margin-bottom: 1.5rem;
    background: linear-gradient(135deg, #fff 0%, var(--accent-bright) 50%, #c084fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 3rem 0 1rem;
    color: var(--text);
    position: relative;
    padding-bottom: 0.6rem;
  }
  h2::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0;
    width: 3rem;
    height: 2px;
    background: var(--accent);
    box-shadow: var(--glow-sm);
    border-radius: 1px;
  }

  h3 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 2rem 0 0.6rem;
    color: var(--text);
  }

  h4 { font-size: 1rem; font-weight: 600; margin: 1.5rem 0 0.4rem; color: var(--text-secondary); }

  p { margin-bottom: 1rem; color: var(--text-secondary); }
  p strong, li strong { color: var(--text); }

  /* === CODE === */
  code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--code-bg);
    border: 1px solid var(--code-border);
    padding: 0.15em 0.45em;
    border-radius: 5px;
    color: var(--accent-bright);
  }

  .code-block {
    background: var(--code-bg);
    border: 1px solid var(--code-border);
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    overflow-x: auto;
    margin: 1rem 0 1.75rem;
    position: relative;
  }
  .code-block::before {
    content: '';
    position: absolute;
    top: 0; left: 1.5rem; right: 1.5rem;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent-dim), transparent);
    opacity: 0.3;
  }
  .code-block code {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.85rem;
    color: var(--text);
    line-height: 1.65;
  }

  /* Prism overrides */
  .code-block code[class*="language-"],
  pre[class*="language-"] {
    background: none !important;
    text-shadow: none !important;
  }

  /* === LISTS === */
  ul, ol { margin: 0.5rem 0 1.25rem 1.5rem; }
  li {
    margin-bottom: 0.4rem;
    color: var(--text-secondary);
    line-height: 1.7;
  }
  li::marker { color: var(--accent-dim); }
  li code { font-size: 0.82em; }

  /* === TABLE === */
  .table-wrap { overflow-x: auto; margin: 1.25rem 0; border-radius: 10px; border: 1px solid var(--border); }
  table { border-collapse: collapse; width: 100%; }
  th, td { padding: 0.7rem 1rem; text-align: left; font-size: 0.88rem; border-bottom: 1px solid var(--border); }
  th { background: var(--surface); color: var(--text); font-weight: 600; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em; }
  td { color: var(--text-secondary); }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--accent-glow); }

  /* === BLOCKQUOTE === */
  blockquote {
    border-left: 3px solid var(--accent);
    padding: 0.75rem 1.25rem;
    margin: 1.25rem 0;
    background: var(--accent-glow);
    border-radius: 0 10px 10px 0;
  }
  blockquote p { margin: 0; color: var(--text); }

  /* === PREV/NEXT === */
  .prev-next {
    display: flex;
    justify-content: space-between;
    margin-top: 4rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
    gap: 1rem;
  }
  .prev-next a {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 1.25rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    transition: all 0.2s;
    min-width: 0;
    max-width: 48%;
  }
  .prev-next a:hover {
    border-color: var(--accent);
    background: var(--accent-glow);
    box-shadow: var(--glow-sm);
    text-decoration: none;
  }
  .prev-next-label { font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-mono); }
  .prev-next-title { font-size: 0.95rem; color: var(--accent-bright); font-weight: 600; }
  .prev-next .next { text-align: right; margin-left: auto; }

  /* === MOBILE === */
  .mobile-header {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 56px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    z-index: 200;
    align-items: center;
    padding: 0 1rem;
    gap: 0.75rem;
  }
  .mobile-toggle {
    background: none;
    border: 1px solid var(--border);
    color: var(--text);
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.1rem;
  }
  .mobile-logo {
    font-family: var(--font-mono);
    font-weight: 800;
    color: var(--accent-bright);
    font-size: 1.1rem;
  }

  /* Overlay to close sidebar on mobile */
  .sidebar-overlay {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6);
    z-index: 99;
  }
  .sidebar-overlay.active { display: block; }

  @media (max-width: 768px) {
    .sidebar { transform: translateX(-100%); transition: transform 0.3s; }
    .sidebar.open { transform: translateX(0); box-shadow: 10px 0 40px rgba(0,0,0,0.7); }
    .mobile-header { display: flex; }
    .main { margin-left: 0; padding-top: 56px; }
    .content { padding: 2rem 1.25rem 3rem; }
    h1 { font-size: 1.8rem; }
    h2 { font-size: 1.25rem; }
    .code-block { border-radius: 8px; padding: 1rem; }
    .code-block code { font-size: 0.85rem; }
    .sidebar-nav a { min-height: 44px; padding: 0.65rem 0.75rem; }
    .prev-next { flex-direction: column; }
    .prev-next a { max-width: 100%; min-height: 44px; }
    .prev-next .next { text-align: left; }
    .table-wrap { -webkit-overflow-scrolling: touch; }
  }

  @media (max-width: 480px) {
    .content { padding: 1.5rem 1rem 2.5rem; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.15rem; margin: 2rem 0 0.75rem; }
    h3 { font-size: 1.05rem; }
    .code-block { padding: 0.85rem; margin: 0.75rem 0 1.25rem; }
    .code-block code { font-size: 0.8rem; }
    .sidebar-footer { padding: 0.75rem 1rem; }
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border-glow); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--accent-dim); }

  /* Glitch animation for logo on hover */
  .logo:hover .logo-text {
    animation: glitch 0.3s ease;
  }
  @keyframes glitch {
    0% { transform: translate(0); }
    20% { transform: translate(-2px, 1px); }
    40% { transform: translate(2px, -1px); }
    60% { transform: translate(-1px, -1px); }
    80% { transform: translate(1px, 1px); }
    100% { transform: translate(0); }
  }
`;

const SEARCH_SCRIPT = (searchIndex) => `
  // Search
  const searchIndex = ${searchIndex};
  const searchBox = document.getElementById('search');
  const searchResults = document.getElementById('search-results');

  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (q.length < 2) { searchResults.classList.remove('active'); return; }
      
      const matches = searchIndex.filter(entry =>
        entry.heading.toLowerCase().includes(q) ||
        entry.text.toLowerCase().includes(q) ||
        entry.pageTitle.toLowerCase().includes(q)
      ).slice(0, 8);

      if (matches.length === 0) {
        searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
      } else {
        searchResults.innerHTML = matches.map(m => 
          '<a class="search-result" href="' + m.page + '#' + m.id + '">' +
            '<div class="search-result-page">' + m.pageTitle + '</div>' +
            '<div class="search-result-title">' + m.heading + '</div>' +
            (m.text ? '<div class="search-result-snippet">' + m.text.slice(0, 120) + '...</div>' : '') +
          '</a>'
        ).join('');
      }
      searchResults.classList.add('active');
    });

    searchBox.addEventListener('blur', () => {
      setTimeout(() => searchResults.classList.remove('active'), 200);
    });

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchBox.focus();
      }
      if (e.key === 'Escape') {
        searchResults.classList.remove('active');
        searchBox.blur();
      }
    });
  }

  // Mobile nav toggle
  const toggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (toggle && sidebar) {
    function toggleNav() {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active', sidebar.classList.contains('open'));
    }
    function closeNav() {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('active');
    }
    toggle.addEventListener('click', toggleNav);
    if (overlay) overlay.addEventListener('click', closeNav);
    sidebar.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
  }
`;

const TEMPLATE = (title, nav, content, prevNext, searchIndex, hasLogo) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — FIS Docs</title>
  <meta name="description" content="Documentation for the Fuck It Stack — zero-dependency web framework using native Web Components, vanilla CSS, and Proxy-based signals.">
  <meta name="theme-color" content="#7c5cfc">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet">
  <style>${CSS}</style>
</head>
<body>
  <!-- Mobile header -->
  <div class="mobile-header">
    <button class="mobile-toggle" id="mobile-toggle">☰</button>
    <span class="mobile-logo">FIS</span>
  </div>

  <div class="sidebar-overlay" id="sidebar-overlay"></div>
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <a href="index.html" class="logo">
          ${hasLogo ? '<img src="assets/logo.png" alt="FIS">' : ''}
          <div>
            <span class="logo-text">FIS</span>
            <span class="logo-sub">fuck it stack</span>
          </div>
        </a>
      </div>
      <div class="search-container">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-box" id="search" placeholder="Search docs..." autocomplete="off">
          <span class="search-kbd">⌘K</span>
          <div class="search-results" id="search-results"></div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${nav}
      </nav>
      <div class="sidebar-footer">
        <a href="https://github.com/aleksm11/fuck-it-stack">GitHub</a>
        <span style="color: var(--border)">·</span>
        <a href="../index.html">Demo</a>
      </div>
    </aside>
    <main class="main">
      <div class="content">
        ${content}
        ${prevNext}
      </div>
    </main>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js"><\/script>
  <script>${SEARCH_SCRIPT(searchIndex)}<\/script>
</body>
</html>`;

// Build
mkdirSync(DOCS_DIST, { recursive: true });
mkdirSync(join(DOCS_DIST, 'assets'), { recursive: true });

// Copy logo if exists
const logoSrc = join(ASSETS, 'logo.png');
const hasLogo = existsSync(logoSrc);
if (hasLogo) {
  copyFileSync(logoSrc, join(DOCS_DIST, 'assets', 'logo.png'));
  console.log('✓ copied logo.png');
}

const searchIndex = buildSearchIndex();

for (let i = 0; i < NAV.length; i++) {
  const { file, title } = NAV[i];
  const srcPath = join(DOCS_SRC, file);
  if (!existsSync(srcPath)) { console.warn(`⚠ Missing: ${file}`); continue; }
  
  const md = readFileSync(srcPath, 'utf8');
  const html = md2html(md);
  const nav = buildNav(file);

  let prevNext = '<div class="prev-next">';
  if (i > 0) {
    prevNext += `<a href="${NAV[i-1].file.replace('.md', '.html')}" class="prev"><span class="prev-next-label">← Previous</span><span class="prev-next-title">${NAV[i-1].title}</span></a>`;
  } else {
    prevNext += '<span></span>';
  }
  if (i < NAV.length - 1) {
    prevNext += `<a href="${NAV[i+1].file.replace('.md', '.html')}" class="next"><span class="prev-next-label">Next →</span><span class="prev-next-title">${NAV[i+1].title}</span></a>`;
  } else {
    prevNext += '<span></span>';
  }
  prevNext += '</div>';

  writeFileSync(join(DOCS_DIST, file.replace('.md', '.html')), TEMPLATE(title, nav, html, prevNext, searchIndex, hasLogo));
  console.log(`✓ ${file} → ${basename(file.replace('.md', '.html'))}`);
}

// Index redirect
writeFileSync(join(DOCS_DIST, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=getting-started.html"><title>FIS Docs</title></head>
<body><p>Redirecting to <a href="getting-started.html">Getting Started</a>...</p></body>
</html>`);
console.log('✓ index.html (redirect)');
console.log(`\n🚀 Docs built to ${DOCS_DIST}/`);
