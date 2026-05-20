// Spec 018 / US2 — mobile-only types for the catalogue filter sheet.
// Per Principle X v1.26.0 sub-rule #7, feature-local types live with the
// feature directory.
import type { CatalogueFilterSet, ColorChip } from '@src/components/catalogue/types';

// Hook options — the sheet edits a *working draft* of the filter set so chip
// taps don't re-run the underlying catalogue query on every keystroke. The
// draft commits to the parent's filter state only when `onApply` fires.
export type UseCatalogueFilterSheetOptions = {
  open: boolean;
  committed: CatalogueFilterSet;          // current filter state from useCatalogue
  onApply: (next: CatalogueFilterSet) => void;
  onClear: () => void;                    // parent owns the post-clear semantics
  onClose: () => void;                    // dismiss without applying
};

// Re-export `ColorChip` so consumers inside this feature don't have to import
// from `@src/components/catalogue/types` (Principle IX — one type, one home).
export type { ColorChip };

// View props (mirrors contracts/ui.md §4.2). The container threads the hook's
// derived state + callbacks down via NAMED props (no spread) per Principle X.
// The sheet ref is constructed in the hook (Data-fetching Rule 4 — effects in
// the hook, not the view) and threaded through as a stable handle.
export type CatalogueFilterSheetViewProps = {
  // Working draft (sheet edits this in place via the toggle/setCmcRange
  // callbacks; commits via onApply).
  draft: CatalogueFilterSet;

  // Per-dimension chip toggles — constructed in the hook so the view stays
  // free of `useCallback`/`useMemo` (Data-fetching Rule 4 + Layer rules table).
  toggleFormat: (value: string) => void;
  toggleSuperType: (value: string) => void;
  toggleSubType: (value: string) => void;
  toggleCreatureType: (value: string) => void;
  onToggleColor: (value: ColorChip) => void;
  onChangeMin: (text: string) => void;
  onChangeMax: (text: string) => void;
  onToggleMissingOnly: () => void;

  // Footer + sheet lifecycle
  onApply: () => void;
  onClearAll: () => void;
};

// Concrete chip suggestion sets (contracts/ui.md §4.2). Set chips come from the
// loaded catalogue's distinct sets at runtime; this constant holds the static
// suggestion list for the other dimensions so the view renders a stable surface
// before any catalogue results arrive.
// TODO these should be fetch from the backend using MTGJSON
export const FORMAT_OPTIONS: ReadonlyArray<string> = [
  'Standard',
  'Modern',
  'Legacy',
  'Vintage',
  'Commander',
  'Pauper',
];
export const SUPER_TYPE_OPTIONS: ReadonlyArray<string> = ['Legendary', 'Basic', 'Snow', 'World'];
export const SUB_TYPE_OPTIONS: ReadonlyArray<string> = ['Equipment', 'Aura', 'Saga', 'Vehicle'];
export const CREATURE_TYPE_OPTIONS: ReadonlyArray<string> = [
  'Elf',
  'Goblin',
  'Wizard',
  'Dragon',
  'Zombie',
];
export const COLOR_OPTIONS: ReadonlyArray<ColorChip> = ['W', 'U', 'B', 'R', 'G', 'C'];
