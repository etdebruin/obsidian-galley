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
 * Manages pagination for mobile.
 *
 * Strategy: content is laid out normally (single column, vertical).
 * The container clips to viewport height. We paginate by shifting
 * the content's scrollTop in viewport-height increments.
 * Swipe left = next page (scroll down), swipe right = previous.
 * Tap right third = next, left third = previous.
 */
export class PageController {
  private container: HTMLElement;
  private content: HTMLElement;
  private indicator: HTMLElement;
  private pageHeader: HTMLElement;
  private currentPage = 0;
  private totalPages = 1;
  private pageHeight = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private directionLocked: "horizontal" | "vertical" | null = null;
  private onPageChange: ((page: number) => void) | null = null;

  constructor(
    container: HTMLElement,
    content: HTMLElement,
    onPageChange?: (page: number) => void
  ) {
    this.container = container;
    this.content = content;
    this.onPageChange = onPageChange || null;

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
    this.container.addEventListener("touchstart", this.onTouchStart, {
      passive: true,
    });
    this.container.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.container.addEventListener("touchend", this.onTouchEnd, {
      passive: true,
    });
    this.container.addEventListener("click", this.onTap);

    const resizeObserver = new ResizeObserver(() => this.recalculate());
    resizeObserver.observe(this.container);
  }

  recalculate(): void {
    // Page height = container height minus space for header + indicator
    this.pageHeight = this.container.clientHeight - 60;
    if (this.pageHeight <= 0) return;

    this.totalPages = Math.max(
      1,
      Math.ceil(this.content.scrollHeight / this.pageHeight)
    );
    this.currentPage = clampPage(this.currentPage, this.totalPages);
    this.goToPage(this.currentPage, false);
    this.updateIndicator();
  }

  private onTouchStart = (e: TouchEvent): void => {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.touchStartTime = Date.now();
    this.directionLocked = null;
  };

  private onTouchMove = (e: TouchEvent): void => {
    const deltaX = e.touches[0].clientX - this.touchStartX;
    const deltaY = e.touches[0].clientY - this.touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (!this.directionLocked && (absDeltaX > 10 || absDeltaY > 10)) {
      this.directionLocked = absDeltaX > absDeltaY ? "horizontal" : "vertical";
    }

    // Prevent all scrolling in paginated mode
    if (this.directionLocked === "horizontal") {
      e.preventDefault();
    }
    // Also prevent vertical scroll — we control pagination
    if (this.directionLocked === "vertical") {
      e.preventDefault();
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const elapsed = Date.now() - this.touchStartTime;

    // Check for tap (short touch, minimal movement)
    const movedX = Math.abs(endX - this.touchStartX);
    const movedY = Math.abs(endY - this.touchStartY);
    if (elapsed < 300 && movedX < 10 && movedY < 10) {
      // Let the click handler deal with taps
      return;
    }

    const result = detectSwipe({
      startX: this.touchStartX,
      endX,
      startY: this.touchStartY,
      endY,
    });

    if (result === SwipeResult.Left) {
      this.nextPage();
    } else if (result === SwipeResult.Right) {
      this.prevPage();
    }
  };

  private onTap = (e: MouseEvent): void => {
    const zone = getTapZone(e.clientX, this.container.clientWidth);
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
    this.currentPage = clampPage(page, this.totalPages);
    const offset = this.currentPage * this.pageHeight;
    this.container.scrollTo({
      top: offset,
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
    this.container.removeEventListener("touchstart", this.onTouchStart);
    this.container.removeEventListener("touchmove", this.onTouchMove);
    this.container.removeEventListener("touchend", this.onTouchEnd);
    this.container.removeEventListener("click", this.onTap);
    this.pageHeader.remove();
    this.indicator.remove();
  }
}
