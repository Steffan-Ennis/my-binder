import { createContext } from 'react';

import type { CatalogueContextValue } from './types';

// `null` default so `useCatalogueContext` can detect (and throw on) use
// outside a `<CatalogueProvider>`.
export const CatalogueContext = createContext<CatalogueContextValue | null>(null);
