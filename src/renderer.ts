/**
 * Renders manuscript chapters into HTML for the galley view.
 * Pure functions — no Obsidian dependencies.
 */

import { Chapter, Manuscript } from "./manuscript";

/**
 * Convert basic markdown to HTML. This is a lightweight renderer
 * for the galley view — Obsidian's own renderer handles the heavy lifting,
 * but we need this for standalone chapter rendering.
 */
export function markdownToHtml(md: string): string {
  const html = md;

  // Paragraphs: split on double newlines
  const blocks = html.split(/\n{2,}/);
  const rendered = blocks.map((block) => {
    block = block.trim();
    if (!block) return "";

    // Headings (H3-H6 within chapter content)
    const headingMatch = block.match(/^(#{3,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      return `<h${level}>${escapeHtml(headingMatch[2])}</h${level}>`;
    }

    // Blockquotes
    if (block.startsWith(">")) {
      const quoteContent = block
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join(" ");
      return `<blockquote><p>${inlineFormat(quoteContent)}</p></blockquote>`;
    }

    // Horizontal rules
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) {
      return `<hr class="galley-separator" />`;
    }

    // Regular paragraph
    const lines = block.split("\n").join(" ");
    return `<p>${inlineFormat(lines)}</p>`;
  });

  return rendered.filter(Boolean).join("\n");
}

/**
 * Apply inline markdown formatting.
 */
export function inlineFormat(text: string): string {
  let result = escapeHtml(text);

  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code
  result = result.replace(/`(.+?)`/g, '<code class="galley-inline-code">$1</code>');
  // Em dash
  result = result.replace(/---/g, "\u2014");
  // En dash
  result = result.replace(/--/g, "\u2013");
  // Ellipsis
  result = result.replace(/\.\.\./g, "\u2026");
  // Smart quotes (simple heuristic)
  result = result.replace(/"([^"]+)"/g, "\u201C$1\u201D");
  result = result.replace(/'([^']+)'/g, "\u2018$1\u2019");

  return result;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Render a single chapter to HTML.
 */
export function renderChapter(chapter: Chapter): string {
  const tag = chapter.level === 1 ? "h1" : "h2";
  const titleHtml =
    chapter.title === "Prologue" && !chapter.content.includes(chapter.title)
      ? ""
      : `<${tag} class="galley-chapter-title">${escapeHtml(chapter.title)}</${tag}>`;

  return `<section class="galley-chapter" data-chapter="${chapter.index}">
  ${titleHtml}
  <div class="galley-chapter-body">
    ${markdownToHtml(chapter.content)}
  </div>
</section>`;
}

/**
 * Render the full manuscript to HTML.
 */
export function renderManuscript(manuscript: Manuscript): string {
  const chaptersHtml = manuscript.chapters.map(renderChapter).join("\n\n");

  return `<div class="galley-manuscript">
  <header class="galley-header">
    <h1 class="galley-title">${escapeHtml(manuscript.title)}</h1>
    <p class="galley-wordcount">${manuscript.wordCount.toLocaleString()} words</p>
  </header>
  <nav class="galley-toc">
    <h2 class="galley-toc-title">Contents</h2>
    <ol class="galley-toc-list">
      ${manuscript.chapters
        .map(
          (ch) =>
            `<li><a class="galley-toc-link" data-chapter="${ch.index}">${escapeHtml(ch.title)}</a></li>`
        )
        .join("\n      ")}
    </ol>
  </nav>
  <div class="galley-body">
    ${chaptersHtml}
  </div>
</div>`;
}
