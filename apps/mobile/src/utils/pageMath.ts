const SLOTS_PER_PAGE = 9;

/**
 * Compute the number of binder pages required for a collection of `cardCount` cards.
 *
 * An empty collection still has a single (empty) page so the binder view always has
 * something to render. Partial last pages count as one page (e.g., 10 cards → 2 pages).
 *
 * @param cardCount - non-negative integer; number of cards in the collection
 * @returns the page count, always `>= 1`
 * @throws RangeError when `cardCount` is negative
 *
 * @example
 *   pageCount(0)    // 1
 *   pageCount(9)    // 1
 *   pageCount(10)   // 2
 *   pageCount(1000) // 112
 */
export const pageCount = (cardCount: number): number => {
  if (cardCount < 0) {
    throw new RangeError(`pageCount: cardCount must be >= 0, got ${cardCount}`);
  }
  if (cardCount === 0) return 1;
  return Math.ceil(cardCount / SLOTS_PER_PAGE);
};

/**
 * Map a flat 0-indexed card position to its `{ pageNumber, slot }` coordinate
 * within the 9-pocket binder layout.
 *
 * @param cardIndex - 0-indexed position within the flat `cards` array
 * @returns `{ pageNumber: 1..N, slot: 0..8 }`
 *
 * @example
 *   slotIndex(0)   // { pageNumber: 1, slot: 0 }
 *   slotIndex(9)   // { pageNumber: 2, slot: 0 }
 *   slotIndex(999) // { pageNumber: 112, slot: 8 }
 */
export const slotIndex = (cardIndex: number): { pageNumber: number; slot: number } => ({
  pageNumber: Math.floor(cardIndex / SLOTS_PER_PAGE) + 1,
  slot: cardIndex % SLOTS_PER_PAGE,
});

export const SLOTS_PER_BINDER_PAGE = SLOTS_PER_PAGE;

/** Concrete pixel footprint for one binder pocket. */
export type SlotSize = { width: number; height: number };

/**
 * Compute the largest card that fits a `cols × rows` grid inside the measured
 * `box`, honoring a fixed `gap` between cells and the card `aspect` (width / height).
 *
 * The card is limited by whichever axis is tighter, so the whole grid always fits
 * within BOTH the available width and height — this is what lets the binder scale
 * evenly on phone, tablet, and in landscape rather than only with the viewport width.
 *
 * Returns `{ width: 0, height: 0 }` until the box is measured (`onLayout`), so the
 * caller can hold off rendering pockets until a real size is known. The width is
 * floored so three cells plus their gaps never round up past the container and wrap.
 *
 * @example
 *   // wide/short box → height-limited card (the bug case)
 *   computeSlotSize({ width: 900, height: 300 }, { cols: 3, rows: 3, gap: 8, aspect: 5 / 7 })
 */
export const computeSlotSize = (
  box: { width: number; height: number },
  opts: { cols: number; rows: number; gap: number; aspect: number; maxWidth?: number },
): SlotSize => {
  const { cols, rows, gap, aspect, maxWidth } = opts;
  if (box.width <= 0 || box.height <= 0) return { width: 0, height: 0 };

  const cellWidth = (box.width - gap * (cols - 1)) / cols;
  const cellHeight = (box.height - gap * (rows - 1)) / rows;

  let width = Math.min(cellWidth, cellHeight * aspect);
  if (maxWidth !== undefined) width = Math.min(width, maxWidth);
  width = Math.floor(width);
  if (width <= 0) return { width: 0, height: 0 };

  return { width, height: width / aspect };
};