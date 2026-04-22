import { describe, it, expect } from "vitest";
import {
  ReadingPosition,
  parseBookmark,
  writeBookmark,
} from "../bookmark";

describe("parseBookmark", () => {
  it("parses galley-position from frontmatter", () => {
    const frontmatter = {
      "galley-position": {
        page: 14,
        scroll: 2400,
        chapter: "Chapter 7: The Disposable Build",
        updated: "2026-04-21",
      },
    };
    const pos = parseBookmark(frontmatter);
    expect(pos).not.toBeNull();
    expect(pos!.page).toBe(14);
    expect(pos!.scroll).toBe(2400);
    expect(pos!.chapter).toBe("Chapter 7: The Disposable Build");
    expect(pos!.updated).toBe("2026-04-21");
  });

  it("returns null when no galley-position", () => {
    expect(parseBookmark({})).toBeNull();
    expect(parseBookmark(null)).toBeNull();
    expect(parseBookmark(undefined)).toBeNull();
  });

  it("handles partial data gracefully", () => {
    const frontmatter = {
      "galley-position": {
        scroll: 1200,
      },
    };
    const pos = parseBookmark(frontmatter);
    expect(pos).not.toBeNull();
    expect(pos!.scroll).toBe(1200);
    expect(pos!.page).toBeUndefined();
    expect(pos!.chapter).toBeUndefined();
  });
});

describe("writeBookmark", () => {
  it("adds galley-position to existing frontmatter", () => {
    const content = `---
type: draft
created: 2026-04-20
---

# Chapter 1
Text here.`;
    const pos: ReadingPosition = {
      page: 5,
      scroll: 1200,
      chapter: "Chapter 1",
      updated: "2026-04-21",
    };
    const result = writeBookmark(content, pos);
    expect(result).toContain("galley-position:");
    expect(result).toContain("page: 5");
    expect(result).toContain("scroll: 1200");
    expect(result).toContain("chapter: Chapter 1");
    expect(result).toContain("updated: 2026-04-21");
    expect(result).toContain("type: draft");
  });

  it("updates existing galley-position", () => {
    const content = `---
type: draft
galley-position:
  page: 3
  scroll: 800
  chapter: Old Chapter
  updated: 2026-04-20
---

# Chapter 1`;
    const pos: ReadingPosition = {
      page: 10,
      scroll: 3000,
      chapter: "New Chapter",
      updated: "2026-04-21",
    };
    const result = writeBookmark(content, pos);
    expect(result).toContain("page: 10");
    expect(result).toContain("scroll: 3000");
    expect(result).toContain("chapter: New Chapter");
    expect(result).not.toContain("page: 3");
    expect(result).not.toContain("Old Chapter");
  });

  it("creates frontmatter if none exists", () => {
    const content = `# Chapter 1
Text here.`;
    const pos: ReadingPosition = {
      scroll: 500,
      updated: "2026-04-21",
    };
    const result = writeBookmark(content, pos);
    expect(result).toMatch(/^---\n/);
    expect(result).toContain("galley-position:");
    expect(result).toContain("scroll: 500");
    expect(result).toContain("# Chapter 1");
  });

  it("preserves other frontmatter keys", () => {
    const content = `---
type: draft
galley-highlights:
  - text: "some passage"
    color: yellow
galley-position:
  page: 1
  scroll: 0
  updated: 2026-04-20
---

Text.`;
    const pos: ReadingPosition = {
      page: 5,
      scroll: 2000,
      updated: "2026-04-21",
    };
    const result = writeBookmark(content, pos);
    expect(result).toContain("type: draft");
    expect(result).toContain("galley-highlights:");
    expect(result).toContain("some passage");
    expect(result).toContain("page: 5");
    expect(result).not.toContain("page: 1");
  });

  it("only includes defined fields", () => {
    const content = `---
type: draft
---

Text.`;
    const pos: ReadingPosition = {
      scroll: 800,
      updated: "2026-04-21",
    };
    const result = writeBookmark(content, pos);
    expect(result).toContain("scroll: 800");
    expect(result).not.toContain("page:");
    expect(result).not.toContain("chapter:");
  });
});
