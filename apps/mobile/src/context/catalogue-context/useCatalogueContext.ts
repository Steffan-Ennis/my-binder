import { useContext } from 'react';

import { CatalogueContext } from './CatalogueContext';
import type { CatalogueContextValue } from './types';

/**
 * Read the shared catalogue filter set + mutators. Throws when used outside a
 * `<CatalogueProvider>` so a missing provider fails loudly at mount rather
 * than silently handing back an empty filter set.
 */
export const useCatalogueContext = (): CatalogueContextValue => {
  const ctx = useContext(CatalogueContext);
  if (ctx === null) {
    throw new Error('useCatalogueContext must be used within a <CatalogueProvider>');
  }
  return ctx;
};
