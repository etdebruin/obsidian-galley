import { describe, it, expect } from "vitest";
import {
  markdownToHtml,
  inlineFormat,
  escapeHtml,
  renderChapter,
  renderManuscript,
} from "../renderer";
import { Chapter, Manuscript } from "../manuscript";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;"
    );
  });
});

describe("inlineFormat", () => {
  it("converts bold markdown", () => {
    expect(inlineFormat("**hello**")).toContain("<strong>hello</strong>");
  });

  it("converts italic markdown", () => {
    expect(inlineFormat("*hello*")).toContain("<em>hello</em>");
  });

  it("converts bold+italic markdown", () => {
    expect(inlineFormat("***hello***")).toContain("<strong><em>hello</em></strong>");
  });

  it("converts triple dashes to em dash", () => {
    expect(inlineFormat("word---word")).toContain("\u2014");
  });

  it("converts double dashes to en dash", () => {
    expect(inlineFormat("1--2")).toContain("\u2013");
  });

  it("converts ellipsis", () => {
    expect(inlineFormat("wait...")).toContain("\u2026");
  });

  it("converts straight quotes to smart quotes", () => {
    const result = inlineFormat('"Hello," she said.');
    expect(result).toContain("\u201C");
    expect(result).toContain("\u201D");
  });
});

describe("markdownToHtml", () => {
  it("wraps plain text in paragraphs", () => {
    expect(markdownToHtml("Hello world")).toContain("<p>");
  });

  it("handles blockquotes", () => {
    expect(markdownToHtml("> A wise quote")).toContain("<blockquote>");
  });

  it("handles horizontal rules", () => {
    expect(markdownToHtml("---")).toContain("<hr");
  });

  it("renders subheadings within chapter content", () => {
    expect(markdownToHtml("### Section Title")).toContain("<h3>");
  });

  it("splits on double newlines for paragraphs", () => {
    const html = markdownToHtml("First paragraph.\n\nSecond paragraph.");
    expect(html).toContain("<p>");
    const pCount = (html.match(/<p>/g) || []).length;
    expect(pCount).toBe(2);
  });
});

describe("renderChapter", () => {
  const chapter: Chapter = {
    title: "Chapter 1",
    level: 1,
    content: "It was a dark night.",
    index: 0,
  };

  it("wraps chapter in a section element", () => {
    const html = renderChapter(chapter);
    expect(html).toContain("<section");
    expect(html).toContain("galley-chapter");
  });

  it("includes the chapter title as H1", () => {
    const html = renderChapter(chapter);
    expect(html).toContain('<h1 class="galley-chapter-title">Chapter 1</h1>');
  });

  it("renders H2 chapter with h2 tag", () => {
    const h2Chapter: Chapter = { ...chapter, level: 2, title: "Scene 1" };
    const html = renderChapter(h2Chapter);
    expect(html).toContain('<h2 class="galley-chapter-title">Scene 1</h2>');
  });

  it("includes data-chapter attribute", () => {
    const html = renderChapter(chapter);
    expect(html).toContain('data-chapter="0"');
  });
});

describe("renderManuscript", () => {
  const manuscript: Manuscript = {
    title: "My Novel",
    chapters: [
      { title: "Chapter 1", level: 1, content: "First chapter.", index: 0 },
      { title: "Chapter 2", level: 1, content: "Second chapter.", index: 1 },
    ],
    wordCount: 42,
  };

  it("renders the manuscript title", () => {
    const html = renderManuscript(manuscript);
    expect(html).toContain("My Novel");
    expect(html).toContain("galley-title");
  });

  it("renders word count", () => {
    const html = renderManuscript(manuscript);
    expect(html).toContain("42");
    expect(html).toContain("words");
  });

  it("renders table of contents", () => {
    const html = renderManuscript(manuscript);
    expect(html).toContain("galley-toc");
    expect(html).toContain("Chapter 1");
    expect(html).toContain("Chapter 2");
  });

  it("renders all chapters", () => {
    const html = renderManuscript(manuscript);
    const sections = (html.match(/galley-chapter"/g) || []).length;
    expect(sections).toBe(2);
  });

  it("escapes HTML in title", () => {
    const xssManuscript: Manuscript = {
      ...manuscript,
      title: '<script>alert("xss")</script>',
    };
    const html = renderManuscript(xssManuscript);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
