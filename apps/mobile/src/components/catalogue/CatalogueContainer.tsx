import type { FC } from 'react';

import CatalogueView from './CatalogueView';
import { useCatalogue } from './useCatalogue';

const CatalogueContainer: FC = () => {
  const {
    pages,
    currentPage,
    totalPages,
    summaryCaption,
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
    <CatalogueView
      pages={pages}
      currentPage={currentPage}
      totalPages={totalPages}
      summaryCaption={summaryCaption}
      hasNextPage={hasNextPage}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      isError={isError}
      isEmpty={isEmpty}
      isSearchActive={isSearchActive}
      searchQuery={searchQuery}
      hasActiveQuery={hasActiveQuery}
      filters={filters}
      filterPills={filterPills}
      filterSheetOpen={filterSheetOpen}
      onSearchOpen={onSearchOpen}
      onSearchChange={onSearchChange}
      onSearchClose={onSearchClose}
      onProfilePress={onProfilePress}
      onPagerSelected={onPagerSelected}
      onRetryPress={onRetryPress}
      onFilterSheetOpen={onFilterSheetOpen}
      onFilterSheetClose={onFilterSheetClose}
      onFilterApply={onFilterApply}
      onFilterClear={onFilterClear}
      onFilterPillRemove={onFilterPillRemove}
    />
  );
};

export default CatalogueContainer;
export { CatalogueContainer };
