import type { Card } from '@my-binder/core';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useCardsInfiniteQuery } from '@src/hooks/useCardsInfiniteQuery';
import { useBinderStore } from '@src/stores/binderStore';
import { binderSearch } from '@src/utils/binderSearch';
import { pageCount } from '@src/utils/pageMath';

const DASHED_CAPTION = '— CARDS · — PAGE';

const formatSummaryCaption = (cardCount: number, pages: number): string => {
  const cardNoun = cardCount === 1 ? 'CARD' : 'CARDS';
  const pageNoun = pages === 1 ? 'PAGE' : 'PAGES';
  return `${cardCount} ${cardNoun} · ${pages} ${pageNoun}`;
};

export type UseBinderHomeResult = {
  cards: ReadonlyArray<Card>;
  matchedCards: ReadonlyArray<Card>;
  currentPage: number;
  totalPages: number;
  summaryCaption: string;
  noMatches: boolean;
  isLoading: boolean;
  isError: boolean;
  isSearchActive: boolean;
  searchQuery: string;
  onSearchOpen: () => void;
  onSearchChange: (text: string) => void;
  onSearchClear: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onPageChange: (oneBasedPage: number) => void;
  onProfilePress: () => void;
  onRetryPress: () => void;
};

/**
 * Feature hook for the binder-home screen. Owns the cards query, the pagination
 * pointer, and the inline binder-search state (`isSearchActive`, `searchQuery`,
 * the captured `preSearchPage` to restore on close). Returns a memoised result
 * object whose function and array references are stable per Principle X v1.16.0
 * so downstream `BinderHomeContainer` / `BinderHomeView` only re-render on
 * actual value changes.
 *
 * The hook integrates three sources:
 * 1. `useCardsInfiniteQuery` — fetches the user's collection from `/cards`.
 * 2. `useBinderStore` — Zustand state for the current page (1-based).
 * 3. `binderSearch` — pure token-AND filter over the cards by name/set/type.
 *
 * Loading and error states surface the dashed caption (`— CARDS · — PAGE`)
 * and an `isError` flag the view uses to render an inline retry affordance.
 *
 * @returns the documented `UseBinderHomeResult`
 *
 * @example
 *   const {
 *     matchedCards, currentPage, totalPages, summaryCaption, noMatches,
 *     onSearchOpen, onSearchChange, onSearchClear,
 *     onNextPage, onPrevPage, onPageChange,
 *     onProfilePress, onRetryPress,
 *   } = useBinderHome();
 */
export const useBinderHome = (): UseBinderHomeResult => {
  const router = useRouter();
  const cardsQuery = useCardsInfiniteQuery();

  const cards = useMemo<ReadonlyArray<Card>>(
    () => cardsQuery.data?.pages.flatMap((p) => p.cards) ?? [],
    [cardsQuery.data],
  );

  const currentPage = useBinderStore((s) => s.currentPage);
  const storeNextPage = useBinderStore((s) => s.nextPage);
  const storePrevPage = useBinderStore((s) => s.prevPage);
  const storeSetPage = useBinderStore((s) => s.setPage);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const preSearchPageRef = useRef(1);

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

  const onNextPage = useCallback(() => {
    storeNextPage(totalPages);
  }, [storeNextPage, totalPages]);
  const onPrevPage = useCallback(() => {
    storePrevPage();
  }, [storePrevPage]);
  const onPageChange = useCallback(
    (oneBasedPage: number) => {
      storeSetPage(oneBasedPage, totalPages);
    },
    [storeSetPage, totalPages],
  );

  const onSearchOpen = useCallback(() => {
    preSearchPageRef.current = useBinderStore.getState().currentPage;
    setIsSearchActive(true);
    setSearchQuery('');
    useBinderStore.getState().setPage(1, pageCount(cards.length));
  }, [cards.length]);

  const onSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      const filteredPages = pageCount(binderSearch(cards, text).length);
      useBinderStore.getState().setPage(1, filteredPages);
    },
    [cards],
  );

  const onSearchClear = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
    useBinderStore
      .getState()
      .setPage(preSearchPageRef.current, pageCount(cards.length));
  }, [cards.length]);

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
      onSearchOpen,
      onSearchChange,
      onSearchClear,
      onNextPage,
      onPrevPage,
      onPageChange,
      onProfilePress,
      onRetryPress,
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
      onSearchOpen,
      onSearchChange,
      onSearchClear,
      onNextPage,
      onPrevPage,
      onPageChange,
      onProfilePress,
      onRetryPress,
    ],
  );
};
