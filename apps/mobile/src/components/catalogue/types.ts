// Spec 018 — mobile-only types for the Catalogue feature directory.
// Per Principle X v1.26.0 sub-rule #7, feature-local types live with the
// feature and MUST NOT be re-declared in `@my-binder/core`.

import type {Card, CardRecord} from '@my-binder/core';

import type { UseCatalogueInfiniteQueryResult } from '@src/hooks/useCatalogueInfiniteQuery';

// Colour identity letters consumed by both the catalogue filter sheet and the
// chip-row inside the catalogue view (Principle IV — one type, one home; C3
// consolidation from the 2026-05-18 audit).
export type ColorChip = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

// Spec 018 / FR-005 — the full filter set the Catalogue can apply.
// Owned end-to-end by `useCatalogue`; the filter sheet works against a draft
// copy until the user commits via Apply.
//
// Note: multi-set wire support is deferred (audit finding C2 from 2026-05-18);
// the `sets` dimension is intentionally absent here until a follow-up spec
// adds the corresponding server-side support.
export type CatalogueFilterSet = {
  name: string;
  formats: ReadonlyArray<string>;
  superTypes: ReadonlyArray<string>;
  subTypes: ReadonlyArray<string>;
  creatureTypes: ReadonlyArray<string>;
  colors: ReadonlyArray<ColorChip>;
  // Inclusive CMC bounds. `[0, 20]` is treated as "unconstrained".
  cmcMin: number;
  cmcMax: number;
  // FR-005 clarification 3 of 2026-05-17 — only printings the user does NOT own.
  missingOnly: boolean;
};

export const EMPTY_FILTER_SET: CatalogueFilterSet = {
  name: '',
  formats: [],
  superTypes: [],
  subTypes: [],
  creatureTypes: [],
  colors: [],
  cmcMin: 0,
  cmcMax: 20,
  missingOnly: false,
};

// One page of catalogue results (matches the 3×3 binder-page surface).
export type CataloguePage = {
  pageNumber: number;
  cards: CardRecord[];
  isPlaceholder: boolean;
};

// One filter-pill currently visible in the masthead slot.
export type CatalogueFilterPill = {
  id: string;     // dimension + value, stable across renders
  label: string;  // user-visible label (e.g. "Format: Modern")
};

// Surface passed into the shared card-detail sheet so the stepper can render
// the correct "+" / "−" affordances per the calling feature.
export type CatalogueSurface = 'catalogue';

// Props supplied by `useCatalogue` to `<CatalogueContainer />` and threaded
// to `<CatalogueView />` via named props (no spread, per Principle X v1.24.0).
//
// Composes `Pick<UseCatalogueInfiniteQueryResult, ...>` so the view inherits
// the query library's authoritative types for `error`/`isLoading`/etc. (Data-
// fetching Rule 5 — never redeclare fields TanStack already types).
export type CatalogueViewProps = Pick<
  UseCatalogueInfiniteQueryResult,
  'error' | 'isLoading' | 'isFetchingNextPage' | 'isError' | 'hasNextPage'
> & {
  // Display state
  pages: ReadonlyArray<CataloguePage>;
  currentPage: number;
  totalPages: number | null;   // null when result set is still open-ended
  summaryCaption: string;
  // US2 — true when the filter set yields zero results (post-load).
  isEmpty: boolean;

  // Masthead surface
  isSearchActive: boolean;
  searchQuery: string;
  hasActiveQuery: boolean;

  // US2 — filter surface (the view renders the pill row; the sheet is mounted
  // by `<CatalogueContainer />` as a sibling).
  filterPills: ReadonlyArray<CatalogueFilterPill>;

  // US4 — true when a binder mutation landed while at least one filter
  // dimension is active. The view renders the gold-bordered "results out of
  // date" banner (FR-031); tapping the banner fires `onRefreshPress`.
  resultsAreStale: boolean;

  // Callbacks
  onSearchOpen: () => void;
  onSearchChange: (text: string) => void;
  onSearchClose: () => void;
  onProfilePress: () => void;
  onPagerSelected: (pageNumber: number) => void;
  onRetryPress: () => void;
  // US2 — filter pill row + zero-match empty state. The sheet container owns
  // open/close + apply; the view only knows about clear (empty-state) +
  // single-pill removal + sheet open.
  onFilterSheetOpen: () => void;
  onFilterClear: () => void;
  onFilterPillRemove: (pillId: string) => void;
  // US4 — clears the stale flag AND invalidates the catalogue caches.
  onRefreshPress: () => void;
};

// Options accepted by `useCatalogue`. US1 uses the default empty filter set;
// later stories extend this with surface-specific entries.
export type UseCatalogueOptions = Record<string, never>;
