import { useCallback, useMemo, useState, type FC, type PropsWithChildren } from 'react';

import { EMPTY_FILTER_SET, type CatalogueFilterSet } from '@src/components/catalogue/types';

import { CatalogueContext } from './CatalogueContext';
import type { CatalogueContextValue } from './types';

/**
 * Owns the committed catalogue filter set and shares it across the catalogue
 * screen (`useCatalogue`) and the filter-modal screen (`useCatalogueFilterSheet`),
 * which are sibling routes with no prop relationship (spec 018 / US2).
 *
 * Mounted in `catalogue/_layout.tsx` above both `<Stack.Screen>`s. All
 * non-primitive values are memoised per Principle X v1.16.0 so consumers
 * re-render only on real filter changes.
 *
 * @example
 *   <CatalogueProvider>
 *     <Stack>…</Stack>
 *   </CatalogueProvider>
 */
const CatalogueProvider: FC<PropsWithChildren> = ({ children }) => {
  const [filters, setFilters] = useState<CatalogueFilterSet>(EMPTY_FILTER_SET);

  const applyFilter = useCallback((next: CatalogueFilterSet) => {
    setFilters(next);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTER_SET);
  }, []);

  const value = useMemo<CatalogueContextValue>(
    () => ({ filters, applyFilter, clearFilters }),
    [filters, applyFilter, clearFilters],
  );

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
};

export default CatalogueProvider;
export { CatalogueProvider };
