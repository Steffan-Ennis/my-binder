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