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
    onClearAll,
    onClose: handleClose,
  } = useCatalogueFilterSheet({ open, committed, onApply, onClear, onClose });

  return (
    <CatalogueFilterSheetView
      sheetRef={sheetRef}
      draft={draft}
      toggleFormat={toggleFormat}
      toggleSuperType={toggleSuperType}
      toggleSubType={toggleSubType}
      toggleCreatureType={toggleCreatureType}
      onToggleColor={onToggleColor}
      onChangeMin={onChangeMin}
      onChangeMax={onChangeMax}
      onToggleMissingOnly={onToggleMissingOnly}
      onApply={handleApply}
      onClearAll={onClearAll}
      onClose={handleClose}
    />
  );
};

export default CatalogueFilterSheetContainer;
export { CatalogueFilterSheetContainer };
