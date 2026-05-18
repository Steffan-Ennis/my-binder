// Spec 018 — mobile-only types for the Catalogue feature directory.
// Per Principle X v1.26.0 sub-rule #7, feature-local types live with the
// feature and MUST NOT be re-declared in `@my-binder/core`.

import type { CardRecord } from '@my-binder/core';

// Spec 018 / FR-005 — the full filter set the Catalogue can apply.
// Owned end-to-end by `useCatalogue` (`useReducer`); the filter sheet works
// against a draft copy until the user commits via Apply.
export type CatalogueFilterSet = {
  // Free-form search input (debounced into the wire `name` field).
  name: string;
  // OR-within-dimension, AND-across-dimension chip selections.
  sets: ReadonlyArray<string>;
  formats: ReadonlyArray<string>;
  superTypes: ReadonlyArray<string>;
  subTypes: ReadonlyArray<string>;
  creatureTypes: ReadonlyArray<string>;
  // Colour identity letters (W/U/B/R/G/C).
  colors: ReadonlyArray<'W' | 'U' | 'B' | 'R' | 'G' | 'C'>;
  // Inclusive CMC bounds. `[0, 20]` is treated as "unconstrained".
  cmcMin: number;
  cmcMax: number;
  // FR-005 clarification 3 of 2026-05-17 — only printings the user does NOT own.
  missingOnly: boolean;
};

export const EMPTY_FILTER_SET: CatalogueFilterSet = {
  name: '',
  sets: [],
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
  cards: ReadonlyArray<CardRecord>;
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
// Extended for US2 (filter sheet + pills + empty state).
export type CatalogueViewProps = {
  // Display state
  pages: ReadonlyArray<CataloguePage>;
  currentPage: number;
  totalPages: number | null;   // null when result set is still open-ended
  summaryCaption: string;
  hasNextPage: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
  // US2 — true when the filter set yields zero results (post-load).
  isEmpty: boolean;

  // Masthead surface
  isSearchActive: boolean;
  searchQuery: string;
  hasActiveQuery: boolean;

  // US2 — filter surface
  filters: CatalogueFilterSet;
  filterPills: ReadonlyArray<CatalogueFilterPill>;
  filterSheetOpen: boolean;

  // Callbacks
  onSearchOpen: () => void;
  onSearchChange: (text: string) => void;
  onSearchClose: () => void;
  onProfilePress: () => void;
  onPagerSelected: (pageNumber: number) => void;
  onRetryPress: () => void;
  // US2 — filter sheet lifecycle and chip-row interactions
  onFilterSheetOpen: () => void;
  onFilterSheetClose: () => void;
  onFilterApply: (next: CatalogueFilterSet) => void;
  onFilterClear: () => void;
  onFilterPillRemove: (pillId: string) => void;
};

// Options accepted by `useCatalogue`. US1 uses the default empty filter set;
// later stories extend this with surface-specific entries.
export type UseCatalogueOptions = {
  // Reserved for future use; US1 takes no input.
};
