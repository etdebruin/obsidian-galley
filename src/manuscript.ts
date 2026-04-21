/**
 * Pure functions for parsing manuscript markdown into structured chapters.
 * No Obsidian dependencies — fully testable.
 */

export interface Chapter {
  title: string;
  level: number;
  content: string;
  index: number;
}

export interface Manuscript {
  title: string;
  chapters: Chapter[];
  wordCount: number;
}

/**
 * Count words in a string, ignoring markdown syntax.
 */
export function countWords(text: string): number {
  const cleaned = text
    .replace(/^---[\s\S]*?---/m, "") // strip frontmatter
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // replace links/images with their text
    .replace(/[#*_`~>|[\]()-]/g, " ") // strip markdown punctuation
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0) return 0;
  return cleaned.split(/\s+/).length;
}

/**
 * Strip YAML frontmatter from markdown content.
 */
export function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

/**
 * Extract the document title from the first H1, or fallback to filename.
 */
export function extractTitle(content: string, fallback: string = "Untitled"): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

/**
 * Parse markdown into chapters split by headings.
 * Each H1 or H2 becomes a chapter boundary.
 */
export function parseChapters(content: string): Chapter[] {
  const body = stripFrontmatter(content);
  const lines = body.split("\n");
  const chapters: Chapter[] = [];
  let currentTitle = "";
  let currentLevel = 0;
  let currentLines: string[] = [];
  let chapterIndex = 0;

  const flush = () => {
    const text = currentLines.join("\n").trim();
    if (text.length > 0 || currentTitle) {
      chapters.push({
        title: currentTitle || "Prologue",
        level: currentLevel,
        content: text,
        index: chapterIndex++,
      });
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,2})\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentLevel = headingMatch[1].length;
      currentTitle = headingMatch[2].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return chapters;
}

/**
 * Parse full markdown content into a Manuscript.
 */
export function parseManuscript(content: string, filename?: string): Manuscript {
  const body = stripFrontmatter(content);
  const title = extractTitle(body, filename);
  const chapters = parseChapters(content);
  const wordCount = countWords(body);

  return { title, chapters, wordCount };
}
