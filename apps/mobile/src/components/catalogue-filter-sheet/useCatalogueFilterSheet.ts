import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  EMPTY_FILTER_SET,
  type CatalogueFilterSet,
  type ColorChip,
} from '@src/components/catalogue/types';

import type {
  CatalogueFilterSheetViewProps,
  UseCatalogueFilterSheetOptions,
} from './types';

const toggleArray = <T>(arr: ReadonlyArray<T>, value: T): ReadonlyArray<T> =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

export type UseCatalogueFilterSheetResult = Pick<
  CatalogueFilterSheetViewProps,
  | 'sheetRef'
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
  | 'onClose'
>;

/**
 * Hook backing the catalogue filter sheet (spec 018 / US2). Owns a *working
 * draft* of the filter set so users can twiddle chips without re-running the
 * catalogue query — the draft commits only on Apply.
 *
 * Also owns the `BottomSheetModal` ref and the open/dismiss effect (Data-
 * fetching Rule 4 — side effects and stateful primitives live in the hook,
 * not the view). The view receives `sheetRef` as a stable handle and attaches
 * it directly to `<BottomSheetModal ref={…}>`.
 *
 * The draft re-syncs from `committed` whenever the parent's committed filter
 * state changes (e.g. when a pill is removed externally) so the sheet always
 * mirrors reality when re-opened.
 *
 * All non-primitive return values are memoised per Principle X v1.16.0.
 *
 * @param options - sheet visibility + committed filter set + lifecycle callbacks.
 * @returns the documented `UseCatalogueFilterSheetResult`.
 *
 * @example
 *   const sheet = useCatalogueFilterSheet({
 *     open,
 *     committed: filters,
 *     onApply: setFilters,
 *     onClear: () => setFilters(EMPTY_FILTER_SET),
 *     onClose: () => setOpen(false),
 *   });
 */
const useCatalogueFilterSheet = (
  options: UseCatalogueFilterSheetOptions,
): UseCatalogueFilterSheetResult => {
  const { open, committed, onApply, onClose } = options;

  const sheetRef = useRef<BottomSheetModal | null>(null);
  const [draft, setDraft] = useState<CatalogueFilterSet>(committed);

  // Imperative open/dismiss driven by the `open` prop. The view stays free of
  // useEffect by design (Layer rules table); the hook is the only place that
  // touches the sheet's imperative API.
  useEffect(() => {
    if (open) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [open]);

  // Re-seed the draft when the committed prop changes (pill removal, external
  // filter clear). React 19 may batch this; the explicit dependency keeps the
  // sheet in lock-step.
  useEffect(() => {
    setDraft(committed);
  }, [committed]);

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
    onApply(draft);
  }, [draft, onApply]);

  // FR-008 "Clear all" — local affordance only. The parent's onClear is
  // intentionally NOT invoked here; users may clear the draft, browse the
  // chip rows, then dismiss without committing.
  const handleClearAll = useCallback(() => {
    setDraft(EMPTY_FILTER_SET);
  }, []);

  const handleClose = useCallback(() => {
    // Discard local edits — parent's filter state is untouched.
    setDraft(committed);
    onClose();
  }, [committed, onClose]);

  return useMemo<UseCatalogueFilterSheetResult>(
    () => ({
      sheetRef,
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
      onClose: handleClose,
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
      handleClose,
    ],
  );
};

export default useCatalogueFilterSheet;
export { useCatalogueFilterSheet };
