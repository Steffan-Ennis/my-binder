import type { FC } from 'react';

import type { CatalogueFilterSet } from '@src/components/catalogue/types';

import CatalogueFilterSheetView from './CatalogueFilterSheetView';
import { useCatalogueFilterSheet } from './useCatalogueFilterSheet';

export type CatalogueFilterSheetContainerProps = {
  open: boolean;
  committed: CatalogueFilterSet;
  onApply: (next: CatalogueFilterSet) => void;
  onClear: () => void;
  onClose: () => void;
};

const CatalogueFilterSheetContainer: FC<CatalogueFilterSheetContainerProps> = ({
  open,
  committed,
  onApply,
  onClear,
  onClose,
}) => {
  const {
    open: sheetOpen,
    draft,
    onToggleChip,
    onToggleColor,
    onSetCmcRange,
    onToggleMissingOnly,
    onApply: handleApply,
    onClearAll,
    onClose: handleClose,
  } = useCatalogueFilterSheet({ open, committed, onApply, onClear, onClose });

  return (
    <CatalogueFilterSheetView
      open={sheetOpen}
      draft={draft}
      onToggleChip={onToggleChip}
      onToggleColor={onToggleColor}
      onSetCmcRange={onSetCmcRange}
      onToggleMissingOnly={onToggleMissingOnly}
      onApply={handleApply}
      onClearAll={onClearAll}
      onClose={handleClose}
    />
  );
};

export default CatalogueFilterSheetContainer;
export { CatalogueFilterSheetContainer };
