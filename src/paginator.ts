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

  // Reject if too short or more vertical than horizontal
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
 * This is the DOM-aware controller — instantiated only on mobile.
 */
export class PageController {
  private container: HTMLElement;
  private content: HTMLElement;
  private indicator: HTMLElement;
  private currentPage = 0;
  private totalPages = 1;
  private pageWidth = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchStartTime = 0;
  private isDragging = false;
  private currentTranslate = 0;

  constructor(container: HTMLElement, content: HTMLElement) {
    this.container = container;
    this.content = content;

    // Create page indicator
    this.indicator = document.createElement("div");
    this.indicator.className = "galley-page-indicator";
    this.container.appendChild(this.indicator);

    this.bindEvents();
    this.recalculate();
  }

  private bindEvents(): void {
    this.content.addEventListener("touchstart", this.onTouchStart, {
      passive: true,
    });
    this.content.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.content.addEventListener("touchend", this.onTouchEnd, {
      passive: true,
    });

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(() => this.recalculate());
    resizeObserver.observe(this.container);
  }

  recalculate(): void {
    this.pageWidth = this.container.clientWidth;
    // Account for column gap in the total scrollable width
    this.totalPages = computePageCount(
      this.content.scrollWidth,
      this.pageWidth
    );
    this.currentPage = clampPage(this.currentPage, this.totalPages);
    this.updatePosition(false);
    this.updateIndicator();
  }

  private onTouchStart = (e: TouchEvent): void => {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.touchStartTime = Date.now();
    this.isDragging = true;
    this.content.style.transition = "none";
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.isDragging) return;

    const deltaX = e.touches[0].clientX - this.touchStartX;
    const deltaY = Math.abs(e.touches[0].clientY - this.touchStartY);

    // If vertical scrolling, bail
    if (deltaY > Math.abs(deltaX)) {
      this.isDragging = false;
      return;
    }

    e.preventDefault();

    // Live drag follow — offset from current page position
    const baseOffset = -(this.currentPage * this.pageWidth);
    this.currentTranslate = baseOffset + deltaX;
    this.content.style.transform = `translateX(${this.currentTranslate}px)`;
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.isDragging) {
      // Check for tap
      const touch = e.changedTouches[0];
      const elapsed = Date.now() - this.touchStartTime;
      if (elapsed < 300) {
        const zone = getTapZone(touch.clientX, this.pageWidth);
        if (zone === TapZone.Left) this.prevPage();
        else if (zone === TapZone.Right) this.nextPage();
      }
      return;
    }

    this.isDragging = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;

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
    } else {
      // Snap back
      this.updatePosition(true);
    }
  };

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.updatePosition(true);
      this.updateIndicator();
    } else {
      this.updatePosition(true); // snap back
    }
  }

  prevPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updatePosition(true);
      this.updateIndicator();
    } else {
      this.updatePosition(true); // snap back
    }
  }

  private updatePosition(animate: boolean): void {
    const offset = -(this.currentPage * this.pageWidth);
    if (animate) {
      this.content.style.transition = "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)";
    } else {
      this.content.style.transition = "none";
    }
    this.content.style.transform = `translateX(${offset}px)`;
  }

  private updateIndicator(): void {
    this.indicator.textContent = `${this.currentPage + 1} of ${this.totalPages}`;
  }

  goToPage(page: number): void {
    this.currentPage = clampPage(page, this.totalPages);
    this.updatePosition(true);
    this.updateIndicator();
  }

  destroy(): void {
    this.content.removeEventListener("touchstart", this.onTouchStart);
    this.content.removeEventListener("touchmove", this.onTouchMove);
    this.content.removeEventListener("touchend", this.onTouchEnd);
    this.indicator.remove();
  }
}
