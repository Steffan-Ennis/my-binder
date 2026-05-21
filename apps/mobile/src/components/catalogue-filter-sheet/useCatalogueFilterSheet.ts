import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  EMPTY_FILTER_SET,
  type CatalogueFilterSet,
  type ColorChip,
} from '@src/components/catalogue/types';
import { useCatalogueContext } from '@src/context/catalogue-context';

import type {
  CatalogueFilterSheetViewProps,
} from './types';

const toggleArray = <T>(arr: ReadonlyArray<T>, value: T): ReadonlyArray<T> =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

export type UseCatalogueFilterSheetResult = Pick<
  CatalogueFilterSheetViewProps,
  | 'draft'
  | 'toggleFormat'
  | 'toggleSuperType'
  | 'toggleSubType'
  | 'toggleCreatureType'
  | 'onToggleColor'
  | 'onChangeMin'
  | 'onChangeMax'
  | 'onToggleMissingOnly'
  | 'onApply'
  | 'onClearAll'
>;

/**
 * Hook backing the catalogue filter sheet (spec 018 / US2). Owns a *working
 * draft* of the filter set so users can twiddle chips without re-running the
 * catalogue query — the draft commits only on Apply.
 *
 * The sheet is a sibling route (`/catalogue/filter-modal`), so it reads the
 * committed filter set and the `applyFilter` callback from `CatalogueProvider`
 * rather than from props. On Apply the draft is committed to the context and
 * the modal route is dismissed via `router.back()`.
 *
 * The draft re-syncs from the committed set whenever it changes externally
 * (e.g. a pill removed on the catalogue screen) so a re-open never shows stale
 * chips.
 *
 * All non-primitive return values are memoised per Principle X v1.16.0.
 *
 * @returns the documented `UseCatalogueFilterSheetResult`.
 *
 * @example
 *   const sheet = useCatalogueFilterSheet();
 *   // …render chips from `sheet.draft`; footer button calls `sheet.onApply`.
 */
const useCatalogueFilterSheet = (): UseCatalogueFilterSheetResult => {
  const router = useRouter();
  const { filters, applyFilter } = useCatalogueContext();

  // Seed the working draft from the committed filter set so the sheet mirrors
  // reality when opened…
  const [draft, setDraft] = useState<CatalogueFilterSet>(filters);

  // …and re-sync if the committed set changes underneath us (e.g. a pill was
  // removed on the catalogue screen) so a re-open never shows stale chips.
  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const toggleFormat = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, formats: toggleArray(prev.formats, value) }));
  }, []);

  const toggleSuperType = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, superTypes: toggleArray(prev.superTypes, value) }));
  }, []);

  const toggleSubType = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, subTypes: toggleArray(prev.subTypes, value) }));
  }, []);

  const toggleCreatureType = useCallback((value: string) => {
    setDraft((prev) => ({ ...prev, creatureTypes: toggleArray(prev.creatureTypes, value) }));
  }, []);

  const onToggleColor = useCallback((value: ColorChip) => {
    setDraft((prev) => ({ ...prev, colors: toggleArray(prev.colors, value) }));
  }, []);

  const onChangeMin = useCallback((text: string) => {
    const n = Number.parseInt(text, 10);
    setDraft((prev) => ({
      ...prev,
      cmcMin: Number.isFinite(n) ? n : 0,
    }));
  }, []);

  const onChangeMax = useCallback((text: string) => {
    const n = Number.parseInt(text, 10);
    setDraft((prev) => ({
      ...prev,
      cmcMax: Number.isFinite(n) ? n : 0,
    }));
  }, []);

  const onToggleMissingOnly = useCallback(() => {
    setDraft((prev) => ({ ...prev, missingOnly: !prev.missingOnly }));
  }, []);

  const handleApply = useCallback(() => {
    applyFilter(draft);
    router.back();
  }, [applyFilter, draft, router]);

  // FR-008 "Clear all" — local affordance only. The parent's onClear is
  // intentionally NOT invoked here; users may clear the draft, browse the
  // chip rows, then dismiss without committing.
  const handleClearAll = useCallback(() => {
    setDraft(EMPTY_FILTER_SET);
  }, []);

  return useMemo<UseCatalogueFilterSheetResult>(
    () => ({
      draft,
      toggleFormat,
      toggleSuperType,
      toggleSubType,
      toggleCreatureType,
      onToggleColor,
      onChangeMin,
      onChangeMax,
      onToggleMissingOnly,
      onApply: handleApply,
      onClearAll: handleClearAll,
    }),
    [
      draft,
      toggleFormat,
      toggleSuperType,
      toggleSubType,
      toggleCreatureType,
      onToggleColor,
      onChangeMin,
      onChangeMax,
      onToggleMissingOnly,
      handleApply,
      handleClearAll,
    ],
  );
};

export default useCatalogueFilterSheet;
export { useCatalogueFilterSheet };
