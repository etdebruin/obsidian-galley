import { describe, it, expect } from "vitest";
import {
  countWords,
  stripFrontmatter,
  extractTitle,
  parseChapters,
  parseManuscript,
} from "../manuscript";

describe("countWords", () => {
  it("counts words in plain text", () => {
    expect(countWords("Hello world")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace only", () => {
    expect(countWords("   \n\n  ")).toBe(0);
  });

  it("strips markdown syntax before counting", () => {
    expect(countWords("**bold** and *italic* text")).toBe(4);
  });

  it("strips frontmatter before counting", () => {
    const content = `---
title: Test
---
One two three`;
    expect(countWords(content)).toBe(3);
  });

  it("strips links and images", () => {
    expect(countWords("Click [here](http://example.com) now")).toBe(3);
    expect(countWords("See ![alt](image.png) this")).toBe(3);
  });
});

describe("stripFrontmatter", () => {
  it("removes YAML frontmatter", () => {
    const input = `---
title: My Book
author: Me
---
The actual content`;
    expect(stripFrontmatter(input)).toBe("The actual content");
  });

  it("returns content as-is when no frontmatter", () => {
    const input = "Just regular content";
    expect(stripFrontmatter(input)).toBe("Just regular content");
  });
});

describe("extractTitle", () => {
  it("extracts title from first H1", () => {
    expect(extractTitle("# My Great Novel\n\nSome text")).toBe("My Great Novel");
  });

  it("returns fallback when no H1 found", () => {
    expect(extractTitle("No heading here", "backup.md")).toBe("backup.md");
  });

  it("returns default fallback when no H1 and no fallback given", () => {
    expect(extractTitle("No heading here")).toBe("Untitled");
  });

  it("picks first H1 even if there are H2s before it", () => {
    const content = "## Subtitle\n\n# Real Title\n\nText";
    expect(extractTitle(content)).toBe("Real Title");
  });
});

describe("parseChapters", () => {
  it("splits content by H1 headings", () => {
    const content = `# Chapter 1
First chapter text.

# Chapter 2
Second chapter text.`;
    const chapters = parseChapters(content);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Chapter 1");
    expect(chapters[0].content).toContain("First chapter text.");
    expect(chapters[1].title).toBe("Chapter 2");
    expect(chapters[1].content).toContain("Second chapter text.");
  });

  it("splits content by H2 headings", () => {
    const content = `## Scene 1
Scene one text.

## Scene 2
Scene two text.`;
    const chapters = parseChapters(content);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Scene 1");
    expect(chapters[1].title).toBe("Scene 2");
  });

  it("creates prologue for content before first heading", () => {
    const content = `Some introductory text.

# Chapter 1
Chapter content.`;
    const chapters = parseChapters(content);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("Prologue");
    expect(chapters[0].content).toContain("Some introductory text.");
    expect(chapters[1].title).toBe("Chapter 1");
  });

  it("strips frontmatter before parsing", () => {
    const content = `---
title: Test
---

# Chapter 1
Text here.`;
    const chapters = parseChapters(content);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("Chapter 1");
  });

  it("assigns sequential indices", () => {
    const content = `# A
Text.

# B
Text.

# C
Text.`;
    const chapters = parseChapters(content);
    expect(chapters.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it("records heading level", () => {
    const content = `# Part One

## Chapter 1
Text.`;
    const chapters = parseChapters(content);
    expect(chapters[0].level).toBe(1);
    expect(chapters[1].level).toBe(2);
  });
});

describe("parseManuscript", () => {
  it("parses a full manuscript", () => {
    const content = `---
title: The Great Story
---

# The Great Story

## Chapter 1
It was a dark and stormy night. The wind howled through the trees.

## Chapter 2
The sun rose the next morning, bringing with it a sense of hope.`;

    const manuscript = parseManuscript(content, "story.md");
    expect(manuscript.title).toBe("The Great Story");
    expect(manuscript.chapters).toHaveLength(3);
    expect(manuscript.wordCount).toBeGreaterThan(0);
  });

  it("uses filename as fallback title", () => {
    const content = "Just text, no heading.";
    const manuscript = parseManuscript(content, "my-draft.md");
    expect(manuscript.title).toBe("my-draft.md");
  });
});
