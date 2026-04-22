/**
 * Pure logic for swipe-to-page pagination.
 * No DOM dependencies — fully testable.
 */

export enum SwipeResult {
  Left = "left",
  Right = "right",
  None = "none",
}

export enum TapZone {
  Left = "left",
  Center = "center",
  Right = "right",
}

export interface SwipeInput {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

const DEFAULT_SWIPE_THRESHOLD = 50;

/**
 * Detect swipe direction from touch start/end coordinates.
 * Returns None if the swipe is too short or too vertical.
 */
export function detectSwipe(
  input: SwipeInput,
  threshold: number = DEFAULT_SWIPE_THRESHOLD
): SwipeResult {
  const deltaX = input.startX - input.endX;
  const deltaY = Math.abs(input.endY - input.startY);
  const absDeltaX = Math.abs(deltaX);

  if (absDeltaX < threshold || deltaY > absDeltaX) {
    return SwipeResult.None;
  }

  return deltaX > 0 ? SwipeResult.Left : SwipeResult.Right;
}

/**
 * Determine which tap zone was hit (left third, center, right third).
 */
export function getTapZone(tapX: number, screenWidth: number): TapZone {
  const third = screenWidth / 3;
  if (tapX < third) return TapZone.Left;
  if (tapX >= third * 2) return TapZone.Right;
  return TapZone.Center;
}

/**
 * Clamp a page number to valid bounds.
 */
export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.max(0, Math.min(page, totalPages - 1));
}

/**
 * Compute total page count from content scroll width and single page width.
 */
export function computePageCount(
  scrollWidth: number,
  pageWidth: number
): number {
  if (scrollWidth <= 0 || pageWidth <= 0) return 1;
  return Math.max(1, Math.ceil(scrollWidth / pageWidth));
}

/**
 * Manages pagination state and touch interactions for a container element.
 *
 * Strategy: wrap the CSS-columned content in a scroll wrapper that uses
 * native scrollTo + scroll-snap for reliable page navigation on mobile.
 * Touch events handle tap zones and update the page indicator.
 */
export class PageController {
  private container: HTMLElement;
  private content: HTMLElement;
  private wrapper: HTMLElement;
  private indicator: HTMLElement;
  private pageHeader: HTMLElement;
  private currentPage = 0;
  private totalPages = 1;
  private pageWidth = 0;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;
  private onPageChange: ((page: number) => void) | null = null;

  constructor(container: HTMLElement, content: HTMLElement, onPageChange?: (page: number) => void) {
    this.onPageChange = onPageChange || null;
    this.container = container;
    this.content = content;

    // Create scroll wrapper between container and content
    this.wrapper = document.createElement("div");
    this.wrapper.className = "galley-scroll-wrapper";
    this.content.parentNode?.insertBefore(this.wrapper, this.content);
    this.wrapper.appendChild(this.content);

    this.pageHeader = document.createElement("div");
    this.pageHeader.className = "galley-page-header";
    this.container.prepend(this.pageHeader);

    this.indicator = document.createElement("div");
    this.indicator.className = "galley-page-indicator";
    this.container.appendChild(this.indicator);

    this.bindEvents();
    this.recalculate();
  }

  private bindEvents(): void {
    // Listen for scroll events to update page indicator
    this.wrapper.addEventListener("scroll", this.onScroll, { passive: true });

    // Tap zones for prev/next
    this.wrapper.addEventListener("click", this.onTap);

    const resizeObserver = new ResizeObserver(() => this.recalculate());
    resizeObserver.observe(this.container);
  }

  recalculate(): void {
    this.pageWidth = this.container.clientWidth;

    const padding = 48;
    const columnWidth = this.pageWidth - padding;
    const bottomReserve = 90;
    const contentHeight = this.container.clientHeight - bottomReserve;

    // Set dimensions on wrapper
    this.wrapper.style.setProperty("width", `${this.pageWidth}px`);
    this.wrapper.style.setProperty("height", `${contentHeight}px`);

    // Set column layout on content
    this.content.style.setProperty("column-width", `${columnWidth}px`);
    this.content.style.setProperty("column-gap", `${padding}px`);
    this.content.style.setProperty("height", `${contentHeight}px`);

    void this.content.offsetWidth;

    this.totalPages = computePageCount(
      this.content.scrollWidth,
      this.pageWidth
    );
    this.currentPage = clampPage(this.currentPage, this.totalPages);
    this.goToPage(this.currentPage, false);
    this.updateIndicator();
  }

  private onScroll = (): void => {
    // Debounce: update page number after scroll settles
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    this.scrollTimer = setTimeout(() => {
      if (this.pageWidth > 0) {
        this.currentPage = Math.round(this.wrapper.scrollLeft / this.pageWidth);
        this.currentPage = clampPage(this.currentPage, this.totalPages);
        this.updateIndicator();
      }
    }, 50);
  };

  private onTap = (e: MouseEvent): void => {
    // Only handle taps, not drags/swipes (those are handled by native scroll)
    const zone = getTapZone(e.clientX, this.pageWidth);
    if (zone === TapZone.Left) {
      this.prevPage();
    } else if (zone === TapZone.Right) {
      this.nextPage();
    }
  };

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.goToPage(this.currentPage, true);
      this.updateIndicator();
    }
  }

  prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.goToPage(this.currentPage, true);
      this.updateIndicator();
    }
  }

  goToPage(page: number, smooth: boolean = true): void {
    this.wrapper.scrollTo({
      left: page * this.pageWidth,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  private updateIndicator(): void {
    const current = this.currentPage + 1;
    this.pageHeader.textContent = `${current}`;
    this.indicator.textContent = `${current} of ${this.totalPages}`;
    if (this.onPageChange) {
      this.onPageChange(this.currentPage);
    }
  }

  destroy(): void {
    this.wrapper.removeEventListener("scroll", this.onScroll);
    this.wrapper.removeEventListener("click", this.onTap);
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
    // Unwrap: move content back out of wrapper
    this.wrapper.parentNode?.insertBefore(this.content, this.wrapper);
    this.wrapper.remove();
    this.pageHeader.remove();
    this.indicator.remove();
  }
}
