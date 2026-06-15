import type { FC } from 'react';

import CatalogueFilterSheetView from './CatalogueFilterSheetView';
import { useCatalogueFilterSheet } from './useCatalogueFilterSheet';

const CatalogueFilterSheetContainer: FC = () => {
  const {
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
  } = useCatalogueFilterSheet();

  return (
    <CatalogueFilterSheetView
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
    />
  );
};

export default CatalogueFilterSheetContainer;
export { CatalogueFilterSheetContainer };
