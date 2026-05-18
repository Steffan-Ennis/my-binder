import { useCallback, useEffect, useMemo, useState } from 'react';

import { EMPTY_FILTER_SET, type CatalogueFilterSet } from '@src/components/catalogue/types';

import type {
  CatalogueFilterSheetViewProps,
  ChipDimension,
  ColorChip,
  UseCatalogueFilterSheetOptions,
} from './types';

const toggleArray = <T>(arr: ReadonlyArray<T>, value: T): ReadonlyArray<T> =>
  arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

export type UseCatalogueFilterSheetResult = Pick<
  CatalogueFilterSheetViewProps,
  | 'open'
  | 'draft'
  | 'onToggleChip'
  | 'onToggleColor'
  | 'onSetCmcRange'
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

  const [draft, setDraft] = useState<CatalogueFilterSet>(committed);

  // Re-seed the draft when the committed prop changes (pill removal, external
  // filter clear). React 19 may batch this; the explicit dependency keeps the
  // sheet in lock-step.
  useEffect(() => {
    setDraft(committed);
  }, [committed]);

  const onToggleChip = useCallback((dimension: ChipDimension, value: string) => {
    setDraft((prev) => ({ ...prev, [dimension]: toggleArray(prev[dimension], value) }));
  }, []);

  const onToggleColor = useCallback((value: ColorChip) => {
    setDraft((prev) => ({ ...prev, colors: toggleArray(prev.colors, value) }));
  }, []);

  const onSetCmcRange = useCallback((min: number, max: number) => {
    setDraft((prev) => ({ ...prev, cmcMin: min, cmcMax: max }));
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
      open,
      draft,
      onToggleChip,
      onToggleColor,
      onSetCmcRange,
      onToggleMissingOnly,
      onApply: handleApply,
      onClearAll: handleClearAll,
      onClose: handleClose,
    }),
    [
      open,
      draft,
      onToggleChip,
      onToggleColor,
      onSetCmcRange,
      onToggleMissingOnly,
      handleApply,
      handleClearAll,
      handleClose,
    ],
  );
};

export default useCatalogueFilterSheet;
export { useCatalogueFilterSheet };
