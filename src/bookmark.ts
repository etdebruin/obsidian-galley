/**
 * Reading position bookmark — saves/restores where you left off.
 * Persists to frontmatter so it syncs across devices.
 */

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export interface ReadingPosition {
  page?: number;
  scroll?: number;
  chapter?: string;
  updated: string;
}

/**
 * Parse galley-position from Obsidian frontmatter object.
 */
export function parseBookmark(
  frontmatter: Record<string, unknown> | null | undefined
): ReadingPosition | null {
  if (!frontmatter) return null;

  const raw = frontmatter["galley-position"];
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  return {
    page: typeof obj.page === "number" ? obj.page : undefined,
    scroll: typeof obj.scroll === "number" ? obj.scroll : undefined,
    chapter: typeof obj.chapter === "string" ? obj.chapter : undefined,
    updated: typeof obj.updated === "string" ? obj.updated : "",
  };
}

/**
 * Serialize a ReadingPosition to YAML lines.
 */
function serializePosition(pos: ReadingPosition): string {
  const lines: string[] = [];
  if (pos.page !== undefined) lines.push(`  page: ${pos.page}`);
  if (pos.scroll !== undefined) lines.push(`  scroll: ${pos.scroll}`);
  if (pos.chapter !== undefined) lines.push(`  chapter: ${pos.chapter}`);
  lines.push(`  updated: ${pos.updated}`);
  return lines.join("\n");
}

/**
 * Write reading position to file frontmatter.
 * Creates or updates the galley-position block.
 */
export function writeBookmark(content: string, pos: ReadingPosition): string {
  const fmMatch = content.match(FRONTMATTER_RE);
  const posYaml = `galley-position:\n${serializePosition(pos)}`;

  if (!fmMatch) {
    return `---\n${posYaml}\n---\n\n${content}`;
  }

  const frontmatterBody = fmMatch[1];
  const afterFrontmatter = content.slice(fmMatch[0].length);

  if (frontmatterBody.includes("galley-position:")) {
    // Replace existing position block
    const updated = frontmatterBody.replace(
      /galley-position:\n(?:\s+\w+:.*\n?)*/,
      posYaml + "\n"
    );
    return `---\n${updated}---\n${afterFrontmatter}`;
  } else {
    // Append new position block
    return `---\n${frontmatterBody}\n${posYaml}\n---\n${afterFrontmatter}`;
  }
}
