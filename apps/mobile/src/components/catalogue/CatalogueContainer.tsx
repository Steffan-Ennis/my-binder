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
    isSearchActive,
    searchQuery,
    hasActiveQuery,
    onSearchOpen,
    onSearchChange,
    onSearchClose,
    onProfilePress,
    onPagerSelected,
    onRetryPress,
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
      isSearchActive={isSearchActive}
      searchQuery={searchQuery}
      hasActiveQuery={hasActiveQuery}
      onSearchOpen={onSearchOpen}
      onSearchChange={onSearchChange}
      onSearchClose={onSearchClose}
      onProfilePress={onProfilePress}
      onPagerSelected={onPagerSelected}
      onRetryPress={onRetryPress}
    />
  );
};

export default CatalogueContainer;
export { CatalogueContainer };
