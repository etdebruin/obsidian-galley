import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile, Platform } from "obsidian";
import type GalleyPlugin from "./main";
import { parseManuscript } from "./manuscript";
import { parseHighlights, applyHighlightsToHtml, GalleyHighlight } from "./highlights";
import { PageController } from "./paginator";

export const GALLEY_VIEW_TYPE = "galley-view";

export class GalleyView extends ItemView {
  plugin: GalleyPlugin;
  private currentFile: string | null = null;
  private pageController: PageController | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: GalleyPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return GALLEY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Galley";
  }

  getIcon(): string {
    return "book-open";
  }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.renderActiveFile();
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path === this.currentFile) {
          this.renderActiveFile();
        }
      })
    );
    await this.renderActiveFile();
  }

  async renderActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      this.renderEmpty();
      return;
    }

    this.currentFile = file.path;
    const content = await this.app.vault.read(file);
    const manuscript = parseManuscript(content, file.basename);
    const settings = this.plugin.settings;

    const container = this.contentEl;
    container.empty();
    container.addClass("galley-container");
    container.setAttribute(
      "style",
      `--galley-font: ${settings.fontFamily}; ` +
        `--galley-size: ${settings.fontSize}px; ` +
        `--galley-line-height: ${settings.lineHeight}; ` +
        `--galley-page-width: ${settings.pageWidth}px;`
    );
    container.setAttribute("data-galley-theme", settings.theme);

    // Use Obsidian's MarkdownRenderer for rich rendering
    const galleyEl = container.createDiv({ cls: "galley-manuscript" });

    // Header
    const header = galleyEl.createDiv({ cls: "galley-header" });
    header.createEl("h1", { cls: "galley-title", text: manuscript.title });
    if (settings.showWordCount) {
      header.createEl("p", {
        cls: "galley-wordcount",
        text: `${manuscript.wordCount.toLocaleString()} words`,
      });
    }

    // Table of contents
    if (settings.showTableOfContents && manuscript.chapters.length > 1) {
      const toc = galleyEl.createDiv({ cls: "galley-toc" });
      toc.createEl("h2", { cls: "galley-toc-title", text: "Contents" });
      const list = toc.createEl("ol", { cls: "galley-toc-list" });
      for (const chapter of manuscript.chapters) {
        const li = list.createEl("li");
        const link = li.createEl("a", {
          cls: "galley-toc-link",
          text: chapter.title,
        });
        link.addEventListener("click", () => {
          const target = container.querySelector(
            `[data-chapter="${chapter.index}"]`
          );
          target?.scrollIntoView({ behavior: "smooth" });
        });
      }
    }

    // Chapters — rendered via Obsidian's markdown renderer for full plugin support
    const body = galleyEl.createDiv({ cls: "galley-body" });
    for (const chapter of manuscript.chapters) {
      const section = body.createDiv({ cls: "galley-chapter" });
      section.setAttribute("data-chapter", String(chapter.index));

      if (chapter.title && chapter.title !== "Prologue") {
        const tag = chapter.level === 1 ? "h1" : "h2";
        section.createEl(tag, {
          cls: "galley-chapter-title",
          text: chapter.title,
        });
      }

      const chapterBody = section.createDiv({ cls: "galley-chapter-body" });
      await MarkdownRenderer.render(
        this.app,
        chapter.content,
        chapterBody,
        file.path,
        this
      );
    }

    // Apply frontmatter-based highlights
    const highlights = this.getHighlights(file);
    if (highlights.length > 0) {
      this.applyHighlights(body, highlights);
      this.renderHighlightsSummary(galleyEl, highlights);
    }

    // Mobile: paginated swipe view; Desktop: scroll with running header
    if (Platform.isMobile) {
      container.addClass("galley-paginated");
      this.setupPagination(container, galleyEl);
    } else {
      this.setupRunningHeader(container, manuscript.chapters);
    }
  }

  private setupRunningHeader(
    container: HTMLElement,
    chapters: { title: string; index: number }[]
  ): void {
    let runningHeader = container.querySelector(
      ".galley-running-header"
    ) as HTMLElement;
    if (!runningHeader) {
      runningHeader = container.createDiv({ cls: "galley-running-header" });
      container.prepend(runningHeader);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.chapter
            );
            const ch = chapters.find((c) => c.index === idx);
            if (ch) {
              runningHeader.textContent = ch.title;
            }
          }
        }
      },
      { root: container, threshold: 0, rootMargin: "-10% 0px -80% 0px" }
    );

    container
      .querySelectorAll(".galley-chapter")
      .forEach((el) => observer.observe(el));

    this.register(() => observer.disconnect());
  }

  private setupPagination(
    container: HTMLElement,
    content: HTMLElement
  ): void {
    // Destroy previous controller if any
    this.pageController?.destroy();

    // Small delay to let the DOM settle before measuring columns
    setTimeout(() => {
      this.pageController = new PageController(container, content);
    }, 100);
  }

  private getHighlights(file: TFile): GalleyHighlight[] {
    const cache = this.app.metadataCache.getFileCache(file);
    return parseHighlights(cache?.frontmatter);
  }

  private applyHighlights(
    container: HTMLElement,
    highlights: GalleyHighlight[]
  ): void {
    // Apply highlights to each chapter body's rendered HTML
    container.querySelectorAll(".galley-chapter-body").forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.innerHTML = applyHighlightsToHtml(htmlEl.innerHTML, highlights);
    });
  }

  private renderHighlightsSummary(
    parent: HTMLElement,
    highlights: GalleyHighlight[]
  ): void {
    const summary = parent.createDiv({ cls: "galley-highlights-summary" });
    summary.createEl("h2", {
      cls: "galley-highlights-title",
      text: "Revision Marks",
    });
    const list = summary.createEl("ul", { cls: "galley-highlights-list" });
    for (const h of highlights) {
      const li = list.createEl("li", { cls: "galley-highlights-item" });
      const swatch = li.createSpan({ cls: `galley-highlight-swatch galley-highlight-swatch--${h.color}` });
      swatch.setAttribute("aria-hidden", "true");
      li.createSpan({ cls: "galley-highlights-text", text: `"${h.text}"` });
      if (h.note) {
        li.createSpan({ cls: "galley-highlights-note", text: ` — ${h.note}` });
      }
    }
  }

  private renderEmpty(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("galley-container");
    const empty = container.createDiv({ cls: "galley-empty" });
    empty.createEl("p", {
      text: "Open a markdown file to view it in Galley.",
      cls: "galley-empty-message",
    });
  }

  async onClose(): Promise<void> {
    this.pageController?.destroy();
    this.pageController = null;
    this.contentEl.empty();
  }
}
