/**
 * md.js — small self-contained Markdown renderer for the blog.
 *
 * Supports the GFM subset the posts actually use: headings, paragraphs,
 * bold/italic/strikethrough, inline code, links, images, ordered and
 * unordered lists, blockquotes, fenced code blocks, horizontal rules,
 * and pipe tables. No dependencies, no CDN — it cannot fail to load.
 */
function renderMarkdown(src) {
  'use strict';

  const escapeHtml = s => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const safeUrl = u => (/^\s*javascript:/i.test(u) ? '#' : u.trim());

  // ── Inline formatting ──────────────────────────────────────────────────────
  function inline(text) {
    let out = escapeHtml(text);

    // Protect inline code spans before other formatting touches them
    const codeSpans = [];
    out = out.replace(/`([^`]+)`/g, (_, code) => {
      codeSpans.push(code);
      return `\u0000${codeSpans.length - 1}\u0000`;
    });

    // Images before links (shared bracket syntax)
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (_, alt, url, title) =>
        `<img src="${safeUrl(url)}" alt="${alt}"${title ? ` title="${title}"` : ''}>`);

    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (_, label, url, title) => {
        const ext = /^https?:\/\//i.test(url) ? ' target="_blank" rel="noopener"' : '';
        return `<a href="${safeUrl(url)}"${title ? ` title="${title}"` : ''}${ext}>${label}</a>`;
      });

    out = out
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g,     '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?![\w])/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Restore code spans
    out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codeSpans[+i]}</code>`);
    return out;
  }

  // ── Block parsing ──────────────────────────────────────────────────────────
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const html  = [];
  let i = 0;

  const isBlank    = l => /^\s*$/.test(l);
  const isHr       = l => /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(l);
  const isHeading  = l => /^ {0,3}#{1,6}\s/.test(l);
  const isFence    = l => /^ {0,3}```/.test(l);
  const isQuote    = l => /^ {0,3}>\s?/.test(l);
  const isUl       = l => /^ {0,3}[-*+]\s+/.test(l);
  const isOl       = l => /^ {0,3}\d{1,3}[.)]\s+/.test(l);
  const isTableRow = l => /^\s*\|.*\|\s*$/.test(l);
  const isTableSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) { i++; continue; }

    // Fenced code block
    if (isFence(line)) {
      const lang = line.trim().slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      html.push(`<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (isHr(line)) { html.push('<hr>'); i++; continue; }

    // Heading
    if (isHeading(line)) {
      const m = line.match(/^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      const level = m[1].length;
      html.push(`<h${level}>${inline(m[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote — gather the run, render its contents recursively
    if (isQuote(line)) {
      const buf = [];
      while (i < lines.length && (isQuote(lines[i]) || (!isBlank(lines[i]) && buf.length && !isHeading(lines[i]) && !isFence(lines[i])))) {
        buf.push(lines[i].replace(/^ {0,3}>\s?/, ''));
        i++;
      }
      html.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
      continue;
    }

    // Lists (single level; continuation lines are folded into the item)
    if (isUl(line) || isOl(line)) {
      const ordered = isOl(line);
      const test    = ordered ? isOl : isUl;
      const strip   = ordered
        ? l => l.replace(/^ {0,3}\d{1,3}[.)]\s+/, '')
        : l => l.replace(/^ {0,3}[-*+]\s+/, '');
      const items = [];
      while (i < lines.length) {
        if (test(lines[i])) {
          items.push(strip(lines[i]));
          i++;
        } else if (!isBlank(lines[i]) && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lines[i].trim(); // continuation
          i++;
        } else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map(it => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }

    // Table
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const splitRow = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const headCells = splitRow(line);
      i += 2; // skip header + separator
      const bodyRows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${headCells.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
      const tbody = bodyRows.length
        ? `<tbody>${bodyRows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
        : '';
      html.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Paragraph — consume until a blank line or the start of another block
    {
      const buf = [line];
      i++;
      while (
        i < lines.length && !isBlank(lines[i]) && !isHeading(lines[i]) &&
        !isFence(lines[i]) && !isQuote(lines[i]) && !isUl(lines[i]) &&
        !isOl(lines[i]) && !isHr(lines[i]) &&
        !(isTableRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
      ) {
        buf.push(lines[i]);
        i++;
      }
      html.push(`<p>${inline(buf.join('\n'))}</p>`);
    }
  }

  return html.join('\n');
}

// Node export for testing
if (typeof module !== 'undefined') module.exports = { renderMarkdown };
