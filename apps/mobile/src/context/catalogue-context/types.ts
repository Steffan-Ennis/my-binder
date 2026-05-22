// Spec 018 / US2 — value carried by the catalogue context. The committed
// filter set lives here (not in `useCatalogue`) because the filter sheet is a
// sibling route (`/catalogue/filter-modal`), so the two screens have no
// parent-child prop relationship and must share state through a provider.
//
// Per Principle X v1.26.0 sub-rule #7, the underlying `CatalogueFilterSet`
// type keeps its single home in the catalogue feature directory; this context
// re-uses it rather than re-declaring it.
import type { CatalogueFilterSet } from '@src/components/catalogue/types';

export type CatalogueContextValue = {
  // The committed filter set shared across the catalogue screen and the
  // filter-modal screen.
  filters: CatalogueFilterSet;

  // Replace the committed set wholesale (the sheet commits its draft here on
  // Apply; the masthead search debounce commits a name-only change).
  applyFilter: (next: CatalogueFilterSet) => void;

  // Reset to the empty filter set.
  clearFilters: () => void;
};
