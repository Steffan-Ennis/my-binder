import type { FC } from 'react';

import CatalogueView from './CatalogueView';
import useCatalogue from './useCatalogue';

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
    filterPills,
    resultsAreStale,
    onSearchOpen,
    onSearchChange,
    onSearchClose,
    onProfilePress,
    onPagerSelected,
    onRetryPress,
    onFilterSheetOpen,
    onFilterClear,
    onFilterPillRemove,
    onRefreshPress,
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
        resultsAreStale={resultsAreStale}
        onSearchOpen={onSearchOpen}
        onSearchChange={onSearchChange}
        onSearchClose={onSearchClose}
        onProfilePress={onProfilePress}
        onPagerSelected={onPagerSelected}
        onRetryPress={onRetryPress}
        onFilterSheetOpen={onFilterSheetOpen}
        onFilterClear={onFilterClear}
        onFilterPillRemove={onFilterPillRemove}
        onRefreshPress={onRefreshPress}
      />
    </>
  );
};

export default CatalogueContainer;
export { CatalogueContainer };
