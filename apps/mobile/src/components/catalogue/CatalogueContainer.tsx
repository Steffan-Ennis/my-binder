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
    isLoading,
    isFetchingNextPage,
    isError,
    isEmpty,
    isSearchActive,
    searchQuery,
    hasActiveQuery,
    resultsAreStale,
    onSearchOpen,
    onSearchChange,
    onSearchClose,
    onProfilePress,
    onPagerSelected,
    onRetryPress,
    onCardPress,
    onFilterSheetOpen,
    onFilterClear,
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
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        isError={isError}
        isEmpty={isEmpty}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        hasActiveQuery={hasActiveQuery}
        resultsAreStale={resultsAreStale}
        onSearchOpen={onSearchOpen}
        onSearchChange={onSearchChange}
        onSearchClose={onSearchClose}
        onProfilePress={onProfilePress}
        onPagerSelected={onPagerSelected}
        onRetryPress={onRetryPress}
        onCardPress={onCardPress}
        onFilterSheetOpen={onFilterSheetOpen}
        onFilterClear={onFilterClear}
        onRefreshPress={onRefreshPress}
      />
    </>
  );
};

export default CatalogueContainer;
export { CatalogueContainer };
