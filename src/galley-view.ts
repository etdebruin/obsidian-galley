import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile, Platform, Menu } from "obsidian";
import type GalleyPlugin from "./main";
import { parseManuscript } from "./manuscript";
import { parseHighlights, GalleyHighlight, HIGHLIGHT_COLORS } from "./highlights";
import { addHighlightToFrontmatter, removeHighlightFromFrontmatter } from "./highlight-writer";
import { parseBookmark, writeBookmark, ReadingPosition } from "./bookmark";
import { PageController } from "./paginator";

export const GALLEY_VIEW_TYPE = "galley-view";

export class GalleyView extends ItemView {
  plugin: GalleyPlugin;
  private currentFile: string | null = null;
  private pageController: PageController | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private isSavingBookmark = false;

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
        void this.renderActiveFile();
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path === this.currentFile && !this.isSavingBookmark) {
          void this.renderActiveFile();
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

      const target = e.target as HTMLElement;
      const existingHighlight = target.closest(".galley-highlight");

      e.preventDefault();
      const menu = new Menu();

      if (existingHighlight) {
        menu.addItem((item) =>
          item
            .setTitle("Remove highlight")
            .setIcon("trash")
            .onClick(() => {
              void this.removeHighlight(existingHighlight.textContent || "");
            })
        );
        menu.addSeparator();
      }

      const colors = Object.keys(HIGHLIGHT_COLORS);
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
            .onClick(() => {
              void this.addHighlightInteractive(selectedText, color);
            })
        );
      }

      menu.showAtMouseEvent(e);
    });
  }

  private async addHighlightInteractive(text: string, color: string): Promise<void> {
    const note = await this.promptForNote();
    const highlight: GalleyHighlight = { text, color, note: note || undefined };
    await this.writeHighlightToFile(highlight);
  }

  private promptForNote(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "galley-note-modal";

      const backdrop = modal.createDiv({ cls: "galley-note-backdrop" });
      const dialog = modal.createDiv({ cls: "galley-note-dialog" });
      dialog.createEl("label", {
        cls: "galley-note-label",
        text: "Add a note (optional)",
      });
      const input = dialog.createEl("input", {
        cls: "galley-note-input",
        type: "text",
        placeholder: "e.g. pacing feels rushed here",
      });
      const buttons = dialog.createDiv({ cls: "galley-note-buttons" });
      const skipBtn = buttons.createEl("button", {
        cls: "galley-note-btn galley-note-skip",
        text: "Skip",
      });
      const saveBtn = buttons.createEl("button", {
        cls: "galley-note-btn galley-note-save",
        text: "Save",
      });

      document.body.appendChild(modal);

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
    container.setCssProps({
      "--galley-font": settings.fontFamily,
      "--galley-size": `${settings.fontSize}px`,
      "--galley-line-height": String(settings.lineHeight),
      "--galley-page-width": `${settings.pageWidth}px`,
    });
    container.setAttribute("data-galley-theme", settings.theme);

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

    // Chapters
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

    // Apply frontmatter-based highlights via DOM manipulation instead of innerHTML
    const highlights = this.getHighlights(file);
    if (highlights.length > 0) {
      this.applyHighlightsDOM(body, highlights);
      this.renderHighlightsSummary(galleyEl, highlights);
    }

    // Mobile + paginate setting: swipe pages; otherwise: scroll with running header
    if (Platform.isMobile && settings.mobileMode === "paginate") {
      container.addClass("galley-paginated");
      this.setupPagination(container, galleyEl);
    } else {
      this.setupRunningHeader(container, manuscript.chapters);
      this.setupScrollBookmark(container);
    }

    // Restore saved reading position
    this.restoreBookmark(file, container);
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
    this.pageController?.destroy();

    setTimeout(() => {
      this.pageController = new PageController(container, content, (page) => {
        this.debouncedSaveBookmark(0, page);
      });
    }, 100);
  }

  private getHighlights(file: TFile): GalleyHighlight[] {
    const cache = this.app.metadataCache.getFileCache(file);
    return parseHighlights(cache?.frontmatter);
  }

  /**
   * Apply highlights using DOM TreeWalker instead of innerHTML.
   */
  private applyHighlightsDOM(
    container: HTMLElement,
    highlights: GalleyHighlight[]
  ): void {
    for (const highlight of highlights) {
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT
      );

      const nodesToProcess: { node: Text; index: number }[] = [];
      let textNode: Text | null;
      while ((textNode = walker.nextNode() as Text | null)) {
        const idx = textNode.textContent?.indexOf(highlight.text) ?? -1;
        if (idx >= 0) {
          nodesToProcess.push({ node: textNode, index: idx });
        }
      }

      for (const { node, index } of nodesToProcess) {
        const text = node.textContent || "";
        const before = text.substring(0, index);
        const match = text.substring(index, index + highlight.text.length);
        const after = text.substring(index + highlight.text.length);

        const span = document.createElement("span");
        span.className = `galley-highlight galley-highlight--${highlight.color}`;
        span.textContent = match;
        if (highlight.note) {
          span.setAttribute("title", highlight.note);
        }

        const parent = node.parentNode;
        if (parent) {
          if (before) parent.insertBefore(document.createTextNode(before), node);
          parent.insertBefore(span, node);
          if (after) parent.insertBefore(document.createTextNode(after), node);
          parent.removeChild(node);
        }
      }
    }
  }

  private renderHighlightsSummary(
    parent: HTMLElement,
    highlights: GalleyHighlight[]
  ): void {
    const summary = parent.createDiv({ cls: "galley-highlights-summary" });
    summary.createEl("h2", {
      cls: "galley-highlights-title",
      text: "Revision marks",
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

  private restoreBookmark(file: TFile, container: HTMLElement): void {
    const cache = this.app.metadataCache.getFileCache(file);
    const bookmark = parseBookmark(cache?.frontmatter);
    if (!bookmark) return;

    // Small delay to let layout settle
    setTimeout(() => {
      if (Platform.isMobile && this.pageController && bookmark.page !== undefined) {
        this.pageController.goToPage(bookmark.page);
      } else if (bookmark.scroll !== undefined) {
        container.scrollTop = bookmark.scroll;
      }
    }, 200);
  }

  private setupScrollBookmark(container: HTMLElement): void {
    container.addEventListener("scroll", () => {
      this.debouncedSaveBookmark(container.scrollTop);
    }, { passive: true });
  }

  private debouncedSaveBookmark(scroll: number, page?: number): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.saveBookmark(scroll, page);
    }, 2000);
  }

  private async saveBookmark(scroll: number, page?: number): Promise<void> {
    if (!this.currentFile) return;
    const file = this.app.vault.getAbstractFileByPath(this.currentFile);
    if (!file || !(file instanceof TFile)) return;

    // Find current chapter from visible content
    const chapter = this.getCurrentChapter();
    const today = new Date().toISOString().split("T")[0];

    const pos: ReadingPosition = {
      scroll,
      updated: today,
    };
    if (page !== undefined) pos.page = page;
    if (chapter) pos.chapter = chapter;

    const content = await this.app.vault.read(file);
    const updated = writeBookmark(content, pos);
    if (updated !== content) {
      this.isSavingBookmark = true;
      await this.app.vault.modify(file, updated);
      this.isSavingBookmark = false;
    }
  }

  private getCurrentChapter(): string | undefined {
    const container = this.contentEl;
    const chapters = container.querySelectorAll(".galley-chapter");
    for (const ch of Array.from(chapters).reverse()) {
      const rect = ch.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (rect.top <= containerRect.top + containerRect.height / 2) {
        const title = ch.querySelector(".galley-chapter-title");
        return title?.textContent || undefined;
      }
    }
    return undefined;
  }

  private renderEmpty(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("galley-container");
    const empty = container.createDiv({ cls: "galley-empty" });
    empty.createEl("p", {
      text: "Open a markdown file to begin reading.",
      cls: "galley-empty-message",
    });
  }

  async onClose(): Promise<void> {
    // Save position before closing
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const container = this.contentEl;
    const page = this.pageController ? undefined : undefined;
    await this.saveBookmark(container.scrollTop, page);

    this.pageController?.destroy();
    this.pageController = null;
    this.contentEl.empty();
  }
}
