import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile, Platform, Menu } from "obsidian";
import type GalleyPlugin from "./main";
import { parseManuscript } from "./manuscript";
import { parseHighlights, applyHighlightsToHtml, GalleyHighlight, HIGHLIGHT_COLORS } from "./highlights";
import { addHighlightToFrontmatter, removeHighlightFromFrontmatter } from "./highlight-writer";
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

  private setupContextMenu(container: HTMLElement): void {
    container.addEventListener("contextmenu", (e: MouseEvent) => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();
      if (!selectedText) return;

      // Check if right-clicking an existing highlight
      const target = e.target as HTMLElement;
      const existingHighlight = target.closest(".galley-highlight") as HTMLElement | null;

      e.preventDefault();
      const menu = new Menu();

      if (existingHighlight) {
        // Offer to remove existing highlight
        menu.addItem((item) =>
          item
            .setTitle("Remove highlight")
            .setIcon("trash")
            .onClick(() => this.removeHighlight(existingHighlight.textContent || ""))
        );
        menu.addSeparator();
      }

      // Color options
      const colors = Object.keys(HIGHLIGHT_COLORS) as string[];
      const colorLabels: Record<string, string> = {
        yellow: "Yellow — needs work",
        red: "Red — problem",
        green: "Green — keep this",
        blue: "Blue — research needed",
        purple: "Purple — idea",
      };

      for (const color of colors) {
        menu.addItem((item) =>
          item
            .setTitle(`Highlight: ${colorLabels[color] || color}`)
            .setIcon("highlighter")
            .onClick(() => this.addHighlightInteractive(selectedText, color))
        );
      }

      menu.showAtMouseEvent(e);
    });
  }

  private async addHighlightInteractive(text: string, color: string): Promise<void> {
    // Prompt for optional note
    const note = await this.promptForNote();
    const highlight: GalleyHighlight = { text, color, note: note || undefined };
    await this.writeHighlightToFile(highlight);
  }

  private promptForNote(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "galley-note-modal";
      modal.innerHTML = `
        <div class="galley-note-backdrop"></div>
        <div class="galley-note-dialog">
          <label class="galley-note-label">Add a note (optional)</label>
          <input type="text" class="galley-note-input" placeholder="e.g. pacing feels rushed here" />
          <div class="galley-note-buttons">
            <button class="galley-note-btn galley-note-skip">Skip</button>
            <button class="galley-note-btn galley-note-save">Save</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const input = modal.querySelector(".galley-note-input") as HTMLInputElement;
      const saveBtn = modal.querySelector(".galley-note-save") as HTMLButtonElement;
      const skipBtn = modal.querySelector(".galley-note-skip") as HTMLButtonElement;
      const backdrop = modal.querySelector(".galley-note-backdrop") as HTMLElement;

      const cleanup = (value: string | null) => {
        modal.remove();
        resolve(value);
      };

      input.focus();
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") cleanup(input.value || null);
        if (e.key === "Escape") cleanup(null);
      });
      saveBtn.addEventListener("click", () => cleanup(input.value || null));
      skipBtn.addEventListener("click", () => cleanup(null));
      backdrop.addEventListener("click", () => cleanup(null));
    });
  }

  private async writeHighlightToFile(highlight: GalleyHighlight): Promise<void> {
    if (!this.currentFile) return;
    const file = this.app.vault.getAbstractFileByPath(this.currentFile);
    if (!file || !(file instanceof TFile)) return;

    const content = await this.app.vault.read(file);
    const updated = addHighlightToFrontmatter(content, highlight);
    await this.app.vault.modify(file, updated);
    // View will re-render via the modify event listener
  }

  private async removeHighlight(text: string): Promise<void> {
    if (!this.currentFile) return;
    const file = this.app.vault.getAbstractFileByPath(this.currentFile);
    if (!file || !(file instanceof TFile)) return;

    const content = await this.app.vault.read(file);
    const updated = removeHighlightFromFrontmatter(content, text);
    await this.app.vault.modify(file, updated);
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

    // Context menu for highlight creation
    this.setupContextMenu(body);

    // Apply frontmatter-based highlights
    const highlights = this.getHighlights(file);
    if (highlights.length > 0) {
      this.applyHighlights(body, highlights);
      this.renderHighlightsSummary(galleyEl, highlights);
    }

    // Mobile + paginate setting: swipe pages; otherwise: scroll with running header
    if (Platform.isMobile && settings.mobileMode === "paginate") {
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
