// Spec 018 / Phase 4.5 — pure helpers extracted from `useCatalogue.ts` per the
// 2026-05-18 audit (C1). Keeping these as a sibling pure module lets unit
// tests cover the wire-translation, pill-construction, and pill-removal logic
// without booting React or the TanStack Query cache.

import type { CatalogueQueryShape } from '@src/hooks/useCatalogueInfiniteQuery';

import type { CatalogueFilterSet, ColorChip } from './types';

const CMC_UNCONSTRAINED_MAX = 20;

/**
 * Translate the local filter set into the wire shape consumed by
 * `useCatalogueInfiniteQuery`. Empty arrays + sentinel CMC bounds collapse to
 * undefined so the query key stays stable across no-op filter toggles.
 */
export const filtersToQuery = (filters: CatalogueFilterSet): CatalogueQueryShape => {
  const trimmedName = filters.name.trim();
  const query: CatalogueQueryShape = {};
  if (trimmedName.length > 0) query.name = trimmedName;
  if (filters.formats.length > 0) query.formats = [...filters.formats];
  if (filters.superTypes.length > 0) query.superTypes = [...filters.superTypes];
  if (filters.subTypes.length > 0) query.subTypes = [...filters.subTypes];
  if (filters.creatureTypes.length > 0) query.creatureTypes = [...filters.creatureTypes];
  if (filters.colors.length > 0) {
    query.colorIdentity = filters.colors.map((c) => String(c));
  }
  if (filters.cmcMin > 0) query.cmcMin = filters.cmcMin;
  if (filters.cmcMax < CMC_UNCONSTRAINED_MAX) query.cmcMax = filters.cmcMax;
  if (filters.missingOnly) query.missingOnly = true;
  return query;
};

/**
 * Remove one pill from a filter set. Pill ids are `dimension:value` for array
 * dimensions, `cmc` for the range pill, and `missingOnly` for the toggle pill.
 * Unknown pill ids are no-ops.
 */
export const removePillFromFilters = (
  filters: CatalogueFilterSet,
  pillId: string,
): CatalogueFilterSet => {
  if (pillId === 'cmc') return { ...filters, cmcMin: 0, cmcMax: CMC_UNCONSTRAINED_MAX };
  if (pillId === 'missingOnly') return { ...filters, missingOnly: false };
  const sep = pillId.indexOf(':');
  if (sep === -1) return filters;
  const dim = pillId.slice(0, sep);
  const value = pillId.slice(sep + 1);
  switch (dim) {
    case 'format':
      return { ...filters, formats: filters.formats.filter((v) => v !== value) };
    case 'superType':
      return { ...filters, superTypes: filters.superTypes.filter((v) => v !== value) };
    case 'subType':
      return { ...filters, subTypes: filters.subTypes.filter((v) => v !== value) };
    case 'creatureType':
      return {
        ...filters,
        creatureTypes: filters.creatureTypes.filter((v) => v !== value),
      };
    case 'color':
      return {
        ...filters,
        colors: filters.colors.filter((v) => v !== (value as ColorChip)),
      };
    default:
      return filters;
  }
};
