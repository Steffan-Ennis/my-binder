import { computeSlotSize, pageCount, slotIndex } from './pageMath';

describe('pageMath.pageCount', () => {
  it('returns 1 for an empty collection (always at least one page)', () => {
    expect(pageCount(0)).toBe(1);
  });

  it('returns 1 when the collection fits exactly in a single 9-card page', () => {
    expect(pageCount(9)).toBe(1);
  });

  it('returns 2 when the collection overflows by a single card', () => {
    expect(pageCount(10)).toBe(2);
  });

  it('returns 112 at the SC-007 ceiling of 1000 cards', () => {
    expect(pageCount(1000)).toBe(112);
  });

  it('throws on negative inputs (no silent clamp)', () => {
    expect(() => pageCount(-1)).toThrow();
  });
});

describe('pageMath.slotIndex', () => {
  it('places card 0 at page 1 slot 0', () => {
    expect(slotIndex(0)).toEqual({ pageNumber: 1, slot: 0 });
  });

  it('places card 8 at page 1 slot 8 (last slot of page 1)', () => {
    expect(slotIndex(8)).toEqual({ pageNumber: 1, slot: 8 });
  });

  it('places card 9 at page 2 slot 0 (first slot of page 2)', () => {
    expect(slotIndex(9)).toEqual({ pageNumber: 2, slot: 0 });
  });

  it('places card 10 at page 2 slot 1 (partial last page)', () => {
    expect(slotIndex(10)).toEqual({ pageNumber: 2, slot: 1 });
  });

  it('places card 998 at page 111 slot 8 (last full page boundary)', () => {
    expect(slotIndex(998)).toEqual({ pageNumber: 111, slot: 8 });
  });

  it('places card 999 at page 112 slot 0 (single-card overflow page in a 1000-card collection)', () => {
    expect(slotIndex(999)).toEqual({ pageNumber: 112, slot: 0 });
  });
});

describe('pageMath.computeSlotSize', () => {
  const GRID = { cols: 3, rows: 3, gap: 8, aspect: 5 / 7 };

  it('returns a zero footprint before the box is measured', () => {
    expect(computeSlotSize({ width: 0, height: 0 }, GRID)).toEqual({ width: 0, height: 0 });
    expect(computeSlotSize({ width: 300, height: 0 }, GRID)).toEqual({ width: 0, height: 0 });
  });

  it('is width-limited on a narrow, tall box (three cards span the width with gaps)', () => {
    const { width, height } = computeSlotSize({ width: 320, height: 2000 }, GRID);
    // (320 - 2*8) / 3 = 101.33 → floored to 101
    expect(width).toBe(101);
    expect(width * 3 + GRID.gap * 2).toBeLessThanOrEqual(320);
    expect(height).toBeCloseTo(width / GRID.aspect);
  });

  it('is height-limited on a wide, short box — the bug case the grid used to ignore', () => {
    const { width, height } = computeSlotSize({ width: 900, height: 300 }, GRID);
    // cellHeight = (300 - 16) / 3 = 94.67; width = 94.67 * 5/7 = 67.6 → floored 67
    expect(width).toBe(67);
    // three rows of cards plus gaps must fit the 300px height
    expect(height * 3 + GRID.gap * 2).toBeLessThanOrEqual(300);
    // and it is the height, not the width, that constrains the card here
    expect(width).toBeLessThan((900 - GRID.gap * 2) / 3);
  });

  it('honors an optional maxWidth cap on very large viewports', () => {
    const { width } = computeSlotSize({ width: 3000, height: 3000 }, { ...GRID, maxWidth: 200 });
    expect(width).toBe(200);
  });
});