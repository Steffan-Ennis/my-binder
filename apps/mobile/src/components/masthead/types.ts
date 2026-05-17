import type { ReactNode } from 'react';

// Spec 018 / FR-002 + FR-022 — props for the shared `<Masthead />` component.
// Consumed by both the Binder and the Catalogue screens. The masthead is a
// pure presentation primitive (no hook, no state) — its consumers' feature
// hooks (`useBinderHome`, `useCatalogue`) own every piece of state listed
// below and thread it down via these props.
export type MastheadProps = {
  // Sub-line under the `MY-BINDER` overline ("Binder" / "Catalogue").
  subtitle: string;
  // Placeholder text shown inside the inline search input.
  searchPlaceholder: string;
  // True while the expanded search bar is rendered in place of the masthead.
  isSearchActive: boolean;
  // Current value of the search input (only meaningful when `isSearchActive`).
  searchQuery: string;
  // Drives the gold-dot indicator inside the search input (FR-007/FR-008).
  hasActiveQuery: boolean;
  onSearchOpen: () => void;
  onSearchChange: (text: string) => void;
  onSearchClose: () => void;
  onProfilePress: () => void;
  // Optional slot rendered below the masthead row — used by the Catalogue
  // to surface its filter-pill row. When `undefined` the slot is omitted.
  filterPills?: ReactNode;
};
