import { describe, it, expect } from "vitest";
import {
  parseHighlights,
  GalleyHighlight,
  HIGHLIGHT_COLORS,
  applyHighlightsToHtml,
} from "../highlights";

describe("parseHighlights", () => {
  it("parses highlights from frontmatter yaml string", () => {
    const frontmatter = {
      "galley-highlights": [
        {
          text: "might not be worth fixing",
          color: "yellow",
          note: "pacing feels rushed",
        },
      ],
    };
    const highlights = parseHighlights(frontmatter);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].text).toBe("might not be worth fixing");
    expect(highlights[0].color).toBe("yellow");
    expect(highlights[0].note).toBe("pacing feels rushed");
  });

  it("returns empty array when no galley-highlights key", () => {
    expect(parseHighlights({})).toEqual([]);
    expect(parseHighlights(null)).toEqual([]);
    expect(parseHighlights(undefined)).toEqual([]);
  });

  it("handles highlights without notes", () => {
    const frontmatter = {
      "galley-highlights": [
        { text: "some passage", color: "red" },
      ],
    };
    const highlights = parseHighlights(frontmatter);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].note).toBeUndefined();
  });

  it("defaults color to yellow when not specified", () => {
    const frontmatter = {
      "galley-highlights": [
        { text: "some passage" },
      ],
    };
    const highlights = parseHighlights(frontmatter);
    expect(highlights[0].color).toBe("yellow");
  });

  it("handles multiple highlights", () => {
    const frontmatter = {
      "galley-highlights": [
        { text: "first passage", color: "yellow" },
        { text: "second passage", color: "red", note: "check this" },
        { text: "third passage", color: "green" },
      ],
    };
    const highlights = parseHighlights(frontmatter);
    expect(highlights).toHaveLength(3);
  });

  it("ignores entries without text", () => {
    const frontmatter = {
      "galley-highlights": [
        { color: "yellow" },
        { text: "valid", color: "red" },
        { text: "" },
      ],
    };
    const highlights = parseHighlights(frontmatter);
    expect(highlights).toHaveLength(1);
    expect(highlights[0].text).toBe("valid");
  });
});

describe("HIGHLIGHT_COLORS", () => {
  it("has all expected colors", () => {
    expect(HIGHLIGHT_COLORS).toHaveProperty("yellow");
    expect(HIGHLIGHT_COLORS).toHaveProperty("red");
    expect(HIGHLIGHT_COLORS).toHaveProperty("green");
    expect(HIGHLIGHT_COLORS).toHaveProperty("blue");
    expect(HIGHLIGHT_COLORS).toHaveProperty("purple");
  });
});

describe("applyHighlightsToHtml", () => {
  it("wraps matched text in highlight span", () => {
    const html = "<p>The thing you built might not be worth fixing.</p>";
    const highlights: GalleyHighlight[] = [
      { text: "might not be worth fixing", color: "yellow" },
    ];
    const result = applyHighlightsToHtml(html, highlights);
    expect(result).toContain("galley-highlight");
    expect(result).toContain("galley-highlight--yellow");
    expect(result).toContain("might not be worth fixing");
  });

  it("does not modify html when no highlights match", () => {
    const html = "<p>Some unrelated text.</p>";
    const highlights: GalleyHighlight[] = [
      { text: "nonexistent passage", color: "red" },
    ];
    const result = applyHighlightsToHtml(html, highlights);
    expect(result).toBe(html);
  });

  it("applies multiple highlights", () => {
    const html = "<p>First passage here. Second passage there.</p>";
    const highlights: GalleyHighlight[] = [
      { text: "First passage", color: "yellow" },
      { text: "Second passage", color: "red" },
    ];
    const result = applyHighlightsToHtml(html, highlights);
    expect(result).toContain("galley-highlight--yellow");
    expect(result).toContain("galley-highlight--red");
  });

  it("adds tooltip with note when present", () => {
    const html = "<p>This needs work on pacing.</p>";
    const highlights: GalleyHighlight[] = [
      { text: "needs work", color: "yellow", note: "too rushed" },
    ];
    const result = applyHighlightsToHtml(html, highlights);
    expect(result).toContain("too rushed");
    expect(result).toContain("title=");
  });

  it("escapes special regex characters in highlight text", () => {
    const html = "<p>Price is $100 (USD).</p>";
    const highlights: GalleyHighlight[] = [
      { text: "$100 (USD)", color: "green" },
    ];
    const result = applyHighlightsToHtml(html, highlights);
    expect(result).toContain("galley-highlight--green");
  });

  it("does not match across html tags", () => {
    const html = "<p>Start</p><p>end</p>";
    const highlights: GalleyHighlight[] = [
      { text: "Start end", color: "yellow" },
    ];
    const result = applyHighlightsToHtml(html, highlights);
    // Should not match because "Start" and "end" are in different elements
    expect(result).not.toContain("galley-highlight");
  });
});
