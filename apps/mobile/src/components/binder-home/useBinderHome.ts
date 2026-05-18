import type { Card } from '@my-binder/core';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useReducer } from 'react';

import { useCardsInfiniteQuery } from '@src/hooks/useCardsInfiniteQuery';
import { binderSearch } from '@src/utils/binderSearch';
import { pageCount } from '@src/utils/pageMath';
import type { MastheadProps } from '@src/components/masthead/types';
import {BinderHomeViewProps} from "@src/components/binder-home/BinderHomeView";

const DASHED_CAPTION = '— CARDS · — PAGE';
const INITIAL_PAGE = 1;
const SEARCH_PLACEHOLDER = 'Search this binder';

type BinderHomeState = {
  currentPage: number;
  isSearchActive: boolean;
  searchQuery: string;
  preSearchPage: number;
};

type BinderHomeAction =
  | { type: 'PAGE_SELECTED'; position: number; totalPages: number }
  | { type: 'SEARCH_OPENED' }
  | { type: 'SEARCH_CHANGED'; text: string }
  | { type: 'SEARCH_CLEARED'; totalPagesUnfiltered: number };

const INITIAL_STATE: BinderHomeState = {
  currentPage: INITIAL_PAGE,
  isSearchActive: false,
  searchQuery: '',
  preSearchPage: INITIAL_PAGE,
};

const formatSummaryCaption = (cardCount: number, pages: number): string => {
  const cardNoun = cardCount === 1 ? 'CARD' : 'CARDS';
  const pageNoun = pages === 1 ? 'PAGE' : 'PAGES';
  return `${cardCount} ${cardNoun} · ${pages} ${pageNoun}`;
};

const clampPage = (page: number, totalPages: number): number => {
  if (page < 1) return 1;
  const ceiling = Math.max(1, totalPages);
  return page > ceiling ? ceiling : page;
};

const binderHomeReducer = (
  state: BinderHomeState,
  action: BinderHomeAction,
): BinderHomeState => {
  switch (action.type) {
    case 'PAGE_SELECTED':
      return {
        ...state,
        currentPage: clampPage(action.position + 1, action.totalPages),
      };
    case 'SEARCH_OPENED':
      return {
        ...state,
        isSearchActive: true,
        searchQuery: '',
        preSearchPage: state.currentPage,
        currentPage: INITIAL_PAGE,
      };
    case 'SEARCH_CHANGED':
      return {
        ...state,
        searchQuery: action.text,
        currentPage: INITIAL_PAGE,
      };
    case 'SEARCH_CLEARED':
      return {
        ...state,
        isSearchActive: false,
        searchQuery: '',
        currentPage: clampPage(state.preSearchPage, action.totalPagesUnfiltered),
      };
  }
};

export type UseBinderHomeResult = Pick<
  BinderHomeViewProps,
  'handlePagerSelected' |
  'hasActiveQuery' |
  'cards' |
  'currentPage' |
  'isLoading' |
  'matchedCards' |
  'totalPages' |
  'summaryCaption' |
  'noMatches' |
  'isError' |
  'isSearchActive' |
  'searchQuery' |
  'onRetryPress' |
  'mastheadProps'
>;

/**
 * Feature hook for the binder-home screen. Owns the cards query and a single
 * `useReducer` driving the pagination pointer (`currentPage`) and the inline
 * binder-search state (`isSearchActive`, `searchQuery`, `preSearchPage`).
 * Returns a memoised result object whose function and array references are
 * stable per Principle X v1.16.0 so downstream `BinderHomeContainer` /
 * `BinderHomeView` only re-render on actual value changes.
 *
 * Reducer state survives only as long as the screen — it does not need to
 * persist across app restarts, and the only consumer is this screen.
 *
 * Loading and error states surface the dashed caption (`— CARDS · — PAGE`)
 * and an `isError` flag the view uses to render an inline retry affordance.
 *
 * @returns the documented `UseBinderHomeResult`
 */
const useBinderHome = (): UseBinderHomeResult => {
  const router = useRouter();
  const cardsQuery = useCardsInfiniteQuery();

  const cards = useMemo<ReadonlyArray<Card>>(
    () => cardsQuery.data?.pages.flatMap((p) => p.cards) ?? [],
    [cardsQuery.data],
  );

  const [{ currentPage, isSearchActive, searchQuery }, dispatch] = useReducer(binderHomeReducer, INITIAL_STATE);

  const matchedCards = useMemo(
    () => binderSearch(cards, searchQuery),
    [cards, searchQuery],
  );

  const totalPages = useMemo(() => pageCount(matchedCards.length), [matchedCards.length]);

  const isLoading = cardsQuery.isLoading;
  const isError = cardsQuery.isError;

  const noMatches =
    isSearchActive && searchQuery.trim().length > 0 && matchedCards.length === 0;

  const summaryCaption = useMemo(() => {
    if (isLoading || isError) return DASHED_CAPTION;
    return formatSummaryCaption(matchedCards.length, totalPages);
  }, [isLoading, isError, matchedCards.length, totalPages]);

  const onProfilePress = useCallback(() => {
    router.navigate('/profile');
  }, [router]);

  const onRetryPress = useCallback(() => {
    void cardsQuery.refetch();
  }, [cardsQuery]);

  const onSearchOpen = useCallback(() => {
    dispatch({ type: 'SEARCH_OPENED' });
  }, []);

  const onSearchChange = useCallback((text: string) => {
    dispatch({ type: 'SEARCH_CHANGED', text });
  }, []);

  const onSearchClose = useCallback(() => {
    dispatch({ type: 'SEARCH_CLEARED', totalPagesUnfiltered: pageCount(cards.length) });
  }, [cards.length]);

  const hasActiveQuery = useMemo(() => {
    return isSearchActive && searchQuery.trim().length > 0;
  }, [isSearchActive, searchQuery])

  const handlePagerSelected = useCallback<BinderHomeViewProps['handlePagerSelected']>((event) => {
    dispatch({ type: 'PAGE_SELECTED', position: event.nativeEvent.position, totalPages });
  }, [totalPages]);

  const mastheadProps = useMemo<MastheadProps>(
    () => ({
      subtitle: 'Binder',
      searchPlaceholder: SEARCH_PLACEHOLDER,
      isSearchActive,
      searchQuery,
      hasActiveQuery,
      onSearchOpen,
      onSearchChange,
      onSearchClose,
      onProfilePress,
    }),
    [isSearchActive, searchQuery, hasActiveQuery, onSearchOpen, onSearchChange, onSearchClose, onProfilePress],
  );


  return useMemo<UseBinderHomeResult>(
    () => ({
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
      handlePagerSelected,
      mastheadProps,
    }),
    [
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
      handlePagerSelected,
      hasActiveQuery,
      mastheadProps,
    ],
  );
};

export default useBinderHome
export { useBinderHome }
