import { describe, it, expect } from "vitest";
import {
  addHighlightToFrontmatter,
  removeHighlightFromFrontmatter,
} from "../highlight-writer";

describe("addHighlightToFrontmatter", () => {
  it("adds galley-highlights to existing frontmatter", () => {
    const content = `---
type: draft
created: 2026-04-20
---

# Chapter 1
Some text here.`;
    const result = addHighlightToFrontmatter(content, {
      text: "Some text",
      color: "yellow",
    });
    expect(result).toContain("galley-highlights:");
    expect(result).toContain('- text: "Some text"');
    expect(result).toContain("  color: yellow");
    // Preserve existing frontmatter
    expect(result).toContain("type: draft");
    expect(result).toContain("created: 2026-04-20");
  });

  it("appends to existing galley-highlights", () => {
    const content = `---
type: draft
galley-highlights:
  - text: "existing highlight"
    color: red
---

# Chapter 1`;
    const result = addHighlightToFrontmatter(content, {
      text: "new highlight",
      color: "blue",
      note: "check this",
    });
    expect(result).toContain('- text: "existing highlight"');
    expect(result).toContain('- text: "new highlight"');
    expect(result).toContain("  color: blue");
    expect(result).toContain("  note: check this");
  });

  it("creates frontmatter if none exists", () => {
    const content = `# Chapter 1
Some text here.`;
    const result = addHighlightToFrontmatter(content, {
      text: "Some text",
      color: "green",
    });
    expect(result).toMatch(/^---\n/);
    expect(result).toContain("galley-highlights:");
    expect(result).toContain('- text: "Some text"');
    expect(result).toContain("# Chapter 1");
  });

  it("includes note when provided", () => {
    const content = `---
type: draft
---

Text.`;
    const result = addHighlightToFrontmatter(content, {
      text: "passage",
      color: "yellow",
      note: "needs revision",
    });
    expect(result).toContain("  note: needs revision");
  });

  it("omits note line when not provided", () => {
    const content = `---
type: draft
---

Text.`;
    const result = addHighlightToFrontmatter(content, {
      text: "passage",
      color: "yellow",
    });
    expect(result).not.toContain("note:");
  });

  it("escapes quotes in highlight text", () => {
    const content = `---
type: draft
---

Text.`;
    const result = addHighlightToFrontmatter(content, {
      text: 'she said "hello"',
      color: "yellow",
    });
    expect(result).toContain("text: ");
    // Should not break YAML
    expect(result).toContain("galley-highlights:");
  });

  it("does not duplicate an identical highlight", () => {
    const content = `---
galley-highlights:
  - text: "already here"
    color: yellow
---

Text.`;
    const result = addHighlightToFrontmatter(content, {
      text: "already here",
      color: "yellow",
    });
    const matches = result.match(/already here/g);
    expect(matches).toHaveLength(1);
  });
});

describe("removeHighlightFromFrontmatter", () => {
  it("removes a highlight by text", () => {
    const content = `---
galley-highlights:
  - text: "remove me"
    color: yellow
  - text: "keep me"
    color: red
---

Text.`;
    const result = removeHighlightFromFrontmatter(content, "remove me");
    expect(result).not.toContain("remove me");
    expect(result).toContain("keep me");
  });

  it("removes galley-highlights key when last highlight removed", () => {
    const content = `---
type: draft
galley-highlights:
  - text: "only one"
    color: yellow
---

Text.`;
    const result = removeHighlightFromFrontmatter(content, "only one");
    expect(result).not.toContain("galley-highlights");
    expect(result).toContain("type: draft");
  });

  it("returns content unchanged if highlight not found", () => {
    const content = `---
galley-highlights:
  - text: "exists"
    color: yellow
---

Text.`;
    const result = removeHighlightFromFrontmatter(content, "nonexistent");
    expect(result).toContain("exists");
  });
});
