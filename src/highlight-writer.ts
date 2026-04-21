/**
 * Read/write galley-highlights in markdown frontmatter.
 * Pure string manipulation — no Obsidian dependencies.
 */

import { GalleyHighlight } from "./highlights";

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;
/**
 * Serialize a single highlight entry to YAML.
 */
function serializeHighlight(h: GalleyHighlight): string {
  // Escape text for YAML — wrap in quotes, escape internal quotes
  const escapedText = h.text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  let yaml = `  - text: "${escapedText}"\n    color: ${h.color}`;
  if (h.note) {
    yaml += `\n    note: ${h.note}`;
  }
  return yaml;
}

/**
 * Parse existing galley-highlights from raw frontmatter YAML string.
 * Simple parser — handles the subset of YAML we generate.
 */
function parseExistingHighlights(frontmatterBody: string): GalleyHighlight[] {
  const highlights: GalleyHighlight[] = [];
  const match = frontmatterBody.match(/galley-highlights:\n([\s\S]*?)(?=\n\w|\s*$)/);
  if (!match) return highlights;

  const entries = match[1].split(/\n\s+-\s+/).filter(Boolean);
  for (const entry of entries) {
    const textMatch = entry.match(/text:\s*"(.+?)"/);
    const colorMatch = entry.match(/color:\s*(\w+)/);
    const noteMatch = entry.match(/note:\s*(.+)/);
    if (textMatch) {
      highlights.push({
        text: textMatch[1],
        color: colorMatch ? colorMatch[1] : "yellow",
        note: noteMatch ? noteMatch[1].trim() : undefined,
      });
    }
  }
  return highlights;
}

/**
 * Add a highlight to the file's frontmatter.
 * Creates frontmatter if it doesn't exist.
 */
export function addHighlightToFrontmatter(
  content: string,
  highlight: GalleyHighlight
): string {
  const fmMatch = content.match(FRONTMATTER_RE);

  if (!fmMatch) {
    // No frontmatter — create it
    const entry = serializeHighlight(highlight);
    return `---\ngalley-highlights:\n${entry}\n---\n\n${content}`;
  }

  const frontmatterBody = fmMatch[1];
  const afterFrontmatter = content.slice(fmMatch[0].length);

  // Check for duplicate
  const existing = parseExistingHighlights(frontmatterBody);
  if (existing.some((h) => h.text === highlight.text)) {
    return content;
  }

  const entry = serializeHighlight(highlight);

  if (frontmatterBody.includes("galley-highlights:")) {
    // Append to existing highlights block
    const updated = frontmatterBody.replace(
      /galley-highlights:\n([\s\S]*?)(?=\n\w|\s*$)/,
      (match) => `${match}\n${entry}`
    );
    return `---\n${updated}\n---\n${afterFrontmatter}`;
  } else {
    // Add new galley-highlights key
    const updated = `${frontmatterBody}\ngalley-highlights:\n${entry}`;
    return `---\n${updated}\n---\n${afterFrontmatter}`;
  }
}

/**
 * Remove a highlight from the file's frontmatter by its text content.
 */
export function removeHighlightFromFrontmatter(
  content: string,
  highlightText: string
): string {
  const fmMatch = content.match(FRONTMATTER_RE);
  if (!fmMatch) return content;

  const frontmatterBody = fmMatch[1];
  const afterFrontmatter = content.slice(fmMatch[0].length);

  const existing = parseExistingHighlights(frontmatterBody);
  const filtered = existing.filter((h) => h.text !== highlightText);

  if (filtered.length === existing.length) {
    // Nothing to remove
    return content;
  }

  // Remove the old galley-highlights block
  let updated = frontmatterBody
    .replace(/\ngalley-highlights:\n[\s\S]*?(?=\n\w|\s*$)/, "")
    .replace(/galley-highlights:\n[\s\S]*?(?=\n\w|\s*$)/, "")
    .trim();

  if (filtered.length > 0) {
    // Re-add with remaining highlights
    const entries = filtered.map(serializeHighlight).join("\n");
    updated = updated ? `${updated}\ngalley-highlights:\n${entries}` : `galley-highlights:\n${entries}`;
  }

  if (!updated) {
    // Frontmatter is empty — but keep it if there was other content
    return `---\n\n---\n${afterFrontmatter}`;
  }

  return `---\n${updated}\n---\n${afterFrontmatter}`;
}
