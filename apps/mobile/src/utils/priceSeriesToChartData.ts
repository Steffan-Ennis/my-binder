// Spec 020 / FR-004 — pure geometry: map a per-source `PricePoint[]` onto a
// fixed-length day axis ending today, producing the `react-native-gifted-charts`
// `LineChart` data shape. Missing days become *gap markers* (`hideDataPoint`)
// carrying the last-known value so the plotted line never dips to a false zero;
// the dot is hidden so a gap reads as a gap. Cents are scaled to dollars (the
// unit the y-axis labels render).
import type { PricePoint } from '@my-binder/core';

import type { ChartPoint } from '@src/components/card-detail-sheet/types';

const DEFAULT_DAYS = 30;

const toIsoDay = (date: Date): string => date.toISOString().slice(0, 10);

// Compact `M/D` x-axis label for one axis day (UTC parts, matching `toIsoDay`'s
// UTC day boundaries). Rendered rotated under every point so each day reads as
// a dated tick rather than an anonymous position.
const toDayLabel = (date: Date): string => `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;

/**
 * Align a price series to a `days`-long axis ending at `endDate` (default
 * today) and convert it to gifted-charts `LineChart` data.
 *
 * Rules (FR-004):
 *  - An empty series returns `[]` — the caller renders the "no recent price
 *    data" annotation instead of an empty plot.
 *  - Every axis day yields a point. Observed days carry `amountCents / 100`.
 *  - Missing days carry the last-known value with `hideDataPoint: true` (gap),
 *    never `0`. Leading gaps carry the earliest observation forward.
 *  - Every point carries a compact `M/D` `label` for its axis day so the chart
 *    can render a dated x-axis tick under each one.
 *
 * @param points - the source's observations (any order; keyed by `observedOn`).
 * @param options - `days` (axis length, default 30) and `endDate` (default now).
 * @returns gifted-charts data, oldest-first, exactly `days` long (or `[]`).
 *
 * @example
 *   priceSeriesToChartData(history.cardKingdom, { days: 30 });
 *   // → [{ value: 16.99, label: '5/4' }, { value: 17.0, label: '5/5', hideDataPoint: true }, …]
 */
export const priceSeriesToChartData = (
  points: ReadonlyArray<PricePoint>,
  options?: { days?: number; endDate?: Date },
): ChartPoint[] => {
  if (points.length === 0) return [];

  const days = options?.days ?? DEFAULT_DAYS;
  const end = options?.endDate ?? new Date();

  const centsByDay = new Map<string, number>();
  for (const point of points) centsByDay.set(point.observedOn, point.amountCents);

  // Seed the carry-forward value with the earliest observation so leading gaps
  // hold a real price rather than zero.
  const earliest = [...points].sort((a, b) => a.observedOn.localeCompare(b.observedOn))[0]!;
  let lastKnownCents = earliest.amountCents;

  const data: ChartPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - offset),
    );
    const label = toDayLabel(day);
    const observedCents = centsByDay.get(toIsoDay(day));
    if (observedCents !== undefined) {
      lastKnownCents = observedCents;
      data.push({ value: observedCents / 100, label });
    } else {
      data.push({ value: lastKnownCents / 100, label, hideDataPoint: true });
    }
  }
  return data;
};
