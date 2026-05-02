import { pageCount, slotIndex } from './pageMath';

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