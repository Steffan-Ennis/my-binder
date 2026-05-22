// Spec 020 — in-memory fixtures driving the mock-first phase (view / chart /
// hook tests). Test-only: never imported by runtime code (Phase C swaps the
// live queries in). Covers the four shapes from research.md §3:
//   (a) both live sources present
//   (b) one source null / '—'
//   (c) all-empty (no-data annotation)
//   (d) a gapped series (missing days)
import type {
  Card,
  CardPriceHistoryResponse,
  CardPricesResponse,
  PricePoint,
} from '@my-binder/core';

// Deterministic anchor so the 30-day chart geometry is reproducible in tests.
export const FIXTURE_END_DATE = '2026-05-22';
export const FIXTURE_PRINTING_ID = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';

// ── Card identity ──────────────────────────────────────────────────────────
// Mirrors the design mockup hero (LCI · LCI, Legendary Creature — Demon).
export const CARD_FIXTURE: Card = {
  id: FIXTURE_PRINTING_ID,
  name: 'Bloodthirsty Conqueror',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-20T00:00:00Z',
  setName: 'The Lost Caverns of Ixalan',
  setCode: 'LCI',
  typeLine: 'Legendary Creature — Demon',
  numberOwned: 2,
};

export const CARD_FIXTURE_UNOWNED: Card = {
  ...CARD_FIXTURE,
  numberOwned: 0,
};

// ── Prices (latest observation per source) ───────────────────────────────────
// (a) both live sources present.
export const PRICES_BOTH_PRESENT: CardPricesResponse = {
  printingId: FIXTURE_PRINTING_ID,
  cardKingdom: {
    source: 'CARD_KINGDOM',
    amountCents: 1723,
    currency: 'USD',
    observedOn: FIXTURE_END_DATE,
  },
  tcgPlayer: {
    source: 'TCG_PLAYER',
    amountCents: 1638,
    currency: 'USD',
    observedOn: FIXTURE_END_DATE,
  },
};

// (b) one source null — Card Kingdom present, TCG Player has no observation.
export const PRICES_ONE_SOURCE_NULL: CardPricesResponse = {
  printingId: FIXTURE_PRINTING_ID,
  cardKingdom: {
    source: 'CARD_KINGDOM',
    amountCents: 1723,
    currency: 'USD',
    observedOn: FIXTURE_END_DATE,
  },
  tcgPlayer: null,
};

// (c) all-empty — neither live source has an observation.
export const PRICES_ALL_EMPTY: CardPricesResponse = {
  printingId: FIXTURE_PRINTING_ID,
  cardKingdom: null,
  tcgPlayer: null,
};

// ── Price history (per-source series over the window) ────────────────────────
// Build a contiguous daily series ending at FIXTURE_END_DATE. `skip` indices
// (0 = oldest) are omitted to model a gapped series.
const buildSeries = (
  centsByDay: ReadonlyArray<number>,
  skip: ReadonlySet<number> = new Set(),
): PricePoint[] => {
  const end = new Date(`${FIXTURE_END_DATE}T00:00:00Z`);
  const total = centsByDay.length;
  const points: PricePoint[] = [];
  for (let i = 0; i < total; i++) {
    if (skip.has(i)) continue;
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - (total - 1 - i));
    points.push({
      observedOn: day.toISOString().slice(0, 10),
      amountCents: centsByDay[i]!,
    });
  }
  return points;
};

// A 30-day shape oscillating within the $13–$20 design range.
const THIRTY_DAY_CK = Array.from({ length: 30 }, (_, i) => 1600 + ((i * 37) % 400));
const THIRTY_DAY_TCGP = Array.from({ length: 30 }, (_, i) => 1500 + ((i * 53) % 500));

// (a) both live series present, contiguous.
export const HISTORY_BOTH_SERIES: CardPriceHistoryResponse = {
  printingId: FIXTURE_PRINTING_ID,
  days: 30,
  cardKingdom: buildSeries(THIRTY_DAY_CK),
  tcgPlayer: buildSeries(THIRTY_DAY_TCGP),
};

// (d) a gapped series — several interior days are missing per source.
export const HISTORY_GAPPED: CardPriceHistoryResponse = {
  printingId: FIXTURE_PRINTING_ID,
  days: 30,
  cardKingdom: buildSeries(THIRTY_DAY_CK, new Set([5, 6, 7, 18])),
  tcgPlayer: buildSeries(THIRTY_DAY_TCGP, new Set([10, 11, 12, 13, 14])),
};

// A single-observation series (drives the single-point geometry case).
export const HISTORY_SINGLE_POINT: CardPriceHistoryResponse = {
  printingId: FIXTURE_PRINTING_ID,
  days: 30,
  cardKingdom: [{ observedOn: FIXTURE_END_DATE, amountCents: 2000 }],
  tcgPlayer: [],
};

// (c) all-empty — no observations in the window for either source.
export const HISTORY_ALL_EMPTY: CardPriceHistoryResponse = {
  printingId: FIXTURE_PRINTING_ID,
  days: 30,
  cardKingdom: [],
  tcgPlayer: [],
};
