import type { FC } from 'react';

import BinderHomeView from './BinderHomeView';
import useBinderHome from './useBinderHome';

const BinderHomeContainer: FC = () => {
  const {
    cards,
    matchedCards,
    currentPage,
    totalPages,
    summaryCaption,
    noMatches,
    isLoading,
    isError,
    isSearchActive,
    searchQuery,
    onSearchOpen,
    onSearchChange,
    onSearchClear,
    onProfilePress,
    onRetryPress,
    handlePagerSelected,
    hasActiveQuery,
  } = useBinderHome();

  return (
    <BinderHomeView
      cards={cards}
      matchedCards={matchedCards}
      currentPage={currentPage}
      totalPages={totalPages}
      summaryCaption={summaryCaption}
      noMatches={noMatches}
      isLoading={isLoading}
      isError={isError}
      isSearchActive={isSearchActive}
      searchQuery={searchQuery}
      onSearchOpen={onSearchOpen}
      onSearchChange={onSearchChange}
      onSearchClear={onSearchClear}
      handlePagerSelected={handlePagerSelected}
      hasActiveQuery={hasActiveQuery}
      onProfilePress={onProfilePress}
      onRetryPress={onRetryPress}
    />
  );
};

export default BinderHomeContainer;
