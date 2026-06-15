import type { FC } from 'react';

import BinderHomeView from './BinderHomeView';
import { useBinderHome } from './useBinderHome';

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
    hasActiveQuery,
    onRetryPress,
    onCardPress,
    mastheadProps,
    handlePagerSelected,
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
      hasActiveQuery={hasActiveQuery}
      onRetryPress={onRetryPress}
      onCardPress={onCardPress}
      mastheadProps={mastheadProps}
      handlePagerSelected={handlePagerSelected}
    />
  );
};

export default BinderHomeContainer;
