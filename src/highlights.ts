/**
 * Frontmatter-based highlight system for Galley.
 * Parses galley-highlights from frontmatter and applies them as colored overlays.
 */

export interface GalleyHighlight {
  text: string;
  color: string;
  note?: string;
}

export const HIGHLIGHT_COLORS: Record<string, { bg: string; border: string }> = {
  yellow: { bg: "rgba(250, 219, 95, 0.3)", border: "rgba(250, 219, 95, 0.6)" },
  red: { bg: "rgba(239, 83, 80, 0.2)", border: "rgba(239, 83, 80, 0.5)" },
  green: { bg: "rgba(102, 187, 106, 0.2)", border: "rgba(102, 187, 106, 0.5)" },
  blue: { bg: "rgba(66, 165, 245, 0.2)", border: "rgba(66, 165, 245, 0.5)" },
  purple: { bg: "rgba(171, 71, 188, 0.2)", border: "rgba(171, 71, 188, 0.5)" },
};

/**
 * Parse galley-highlights from Obsidian frontmatter object.
 */
export function parseHighlights(
  frontmatter: Record<string, unknown> | null | undefined
): GalleyHighlight[] {
  if (!frontmatter) return [];

  const raw = frontmatter["galley-highlights"];
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null
    )
    .filter((entry) => typeof entry.text === "string" && entry.text.length > 0)
    .map((entry) => ({
      text: entry.text as string,
      color: typeof entry.color === "string" ? entry.color : "yellow",
      note: typeof entry.note === "string" ? entry.note : undefined,
    }));
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Apply highlights to rendered HTML by wrapping matched text in spans.
 * Only matches text within single text nodes (does not cross HTML tags).
 */
export function applyHighlightsToHtml(
  html: string,
  highlights: GalleyHighlight[]
): string {
  let result = html;

  for (const highlight of highlights) {
    const escaped = escapeRegex(highlight.text);
    // Only match text that is not inside an HTML tag (between > and <)
    const pattern = new RegExp(
      `(>[^<]*?)(${escaped})([^<]*?<)`,
      "g"
    );

    const titleAttr = highlight.note
      ? ` title="${highlight.note.replace(/"/g, "&quot;")}"`
      : "";

    result = result.replace(
      pattern,
      `$1<span class="galley-highlight galley-highlight--${highlight.color}"${titleAttr}>$2</span>$3`
    );
  }

  return result;
}
