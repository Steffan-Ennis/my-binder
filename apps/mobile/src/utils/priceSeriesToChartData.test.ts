import type { PricePoint } from '@my-binder/core';

import {
  HISTORY_ALL_EMPTY,
  HISTORY_BOTH_SERIES,
  HISTORY_GAPPED,
  HISTORY_SINGLE_POINT,
} from '@src/components/card-detail-sheet/fixtures';

import { priceSeriesToChartData } from './priceSeriesToChartData';

const END = new Date('2026-05-22T00:00:00Z');

describe('priceSeriesToChartData', () => {
  describe('empty input (FR-004)', () => {
    it('returns [] for an empty series so the caller renders the no-data annotation', () => {
      expect(priceSeriesToChartData(HISTORY_ALL_EMPTY.cardKingdom, { days: 30, endDate: END }))
        .toEqual([]);
    });
  });

  describe('contiguous 30-day series', () => {
    it('emits one visible point per day with no gap markers', () => {
      const data = priceSeriesToChartData(HISTORY_BOTH_SERIES.cardKingdom, {
        days: 30,
        endDate: END,
      });
      expect(data).toHaveLength(30);
      expect(data.every((point) => point.hideDataPoint === undefined)).toBe(true);
    });

    it('scales cents to dollars from the observed range ($13/$20 design)', () => {
      const points: PricePoint[] = [
        { observedOn: '2026-05-21', amountCents: 1300 },
        { observedOn: '2026-05-22', amountCents: 2000 },
      ];
      const data = priceSeriesToChartData(points, { days: 2, endDate: END });
      // Oldest-first: 05-21 → $13, 05-22 → $20.
      expect(data).toEqual([{ value: 13 }, { value: 20 }]);
    });
  });

  describe('gapped series (FR-004 — gaps, never zeros)', () => {
    it('marks missing days as gap points carrying a non-zero value', () => {
      // HISTORY_GAPPED.cardKingdom omits axis indices 5,6,7,18.
      const data = priceSeriesToChartData(HISTORY_GAPPED.cardKingdom, {
        days: 30,
        endDate: END,
      });
      expect(data).toHaveLength(30);
      for (const gapIndex of [5, 6, 7, 18]) {
        expect(data[gapIndex]!.hideDataPoint).toBe(true);
        expect(data[gapIndex]!.value).toBeGreaterThan(0);
      }
      // A neighbouring present day stays a visible point.
      expect(data[4]!.hideDataPoint).toBeUndefined();
    });
  });

  describe('single-point series', () => {
    it('fills the axis with the single value, hiding every synthetic day', () => {
      // HISTORY_SINGLE_POINT.cardKingdom has one observation on 2026-05-22 ($20).
      const data = priceSeriesToChartData(HISTORY_SINGLE_POINT.cardKingdom, {
        days: 30,
        endDate: END,
      });
      expect(data).toHaveLength(30);
      // Last axis day is the observed one — visible.
      expect(data[29]).toEqual({ value: 20 });
      // Earlier days are carried-back gap markers, never zero.
      expect(data[0]!.hideDataPoint).toBe(true);
      expect(data[0]!.value).toBe(20);
    });
  });
});
