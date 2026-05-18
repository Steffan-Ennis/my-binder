import type { FC } from 'react';

import { CatalogueFilterSheetContainer } from '@src/components/catalogue-filter-sheet/CatalogueFilterSheetContainer';

import CatalogueView from './CatalogueView';
import { useCatalogue } from './useCatalogue';

const CatalogueContainer: FC = () => {
  const {
    pages,
    currentPage,
    totalPages,
    summaryCaption,
    error,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    isError,
    isEmpty,
    isSearchActive,
    searchQuery,
    hasActiveQuery,
    filters,
    filterPills,
    filterSheetOpen,
    onSearchOpen,
    onSearchChange,
    onSearchClose,
    onProfilePress,
    onPagerSelected,
    onRetryPress,
    onFilterSheetOpen,
    onFilterSheetClose,
    onFilterApply,
    onFilterClear,
    onFilterPillRemove,
  } = useCatalogue();

  return (
    <>
      <CatalogueView
        pages={pages}
        currentPage={currentPage}
        totalPages={totalPages}
        summaryCaption={summaryCaption}
        error={error}
        hasNextPage={hasNextPage}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        isError={isError}
        isEmpty={isEmpty}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        hasActiveQuery={hasActiveQuery}
        filterPills={filterPills}
        onSearchOpen={onSearchOpen}
        onSearchChange={onSearchChange}
        onSearchClose={onSearchClose}
        onProfilePress={onProfilePress}
        onPagerSelected={onPagerSelected}
        onRetryPress={onRetryPress}
        onFilterSheetOpen={onFilterSheetOpen}
        onFilterClear={onFilterClear}
        onFilterPillRemove={onFilterPillRemove}
      />
      <CatalogueFilterSheetContainer
        open={filterSheetOpen}
        committed={filters}
        onApply={onFilterApply}
        onClear={onFilterClear}
        onClose={onFilterSheetClose}
      />
    </>
  );
};

export default CatalogueContainer;
export { CatalogueContainer };
