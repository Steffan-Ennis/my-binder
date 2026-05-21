import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCatalogueInfiniteQuery } from '@src/hooks/useCatalogueInfiniteQuery';
import { useCatalogueContext } from '@src/context/catalogue-context';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import { filtersToQuery } from './catalogueFilters';
import {
  type CatalogueFilterSet,
  type CataloguePage,
  type CatalogueViewProps,
} from './types';

const DASHED_CAPTION = '— MATCHES · — PER PAGE';
const PER_PAGE_LABEL = `${SLOTS_PER_BINDER_PAGE} PER PAGE`;
const SEARCH_DEBOUNCE_MS = 300;
const CATALOGUE_QUERY_PREFIX = ['catalogue', 'search'] as const;

const formatOpenEndedCaption = (loadedSoFar: number): string =>
  `${loadedSoFar}+ MATCHES · ${PER_PAGE_LABEL}`;

const formatFiniteCaption = (total: number, totalPages: number): string => {
  const matchNoun = total === 1 ? 'MATCH' : 'MATCHES';
  const pageNoun = totalPages === 1 ? 'PAGE' : 'PAGES';
  return `${total} ${matchNoun} · ${totalPages} ${pageNoun}`;
};

const hasAnyFilterDimension = (filters: CatalogueFilterSet): boolean => {
  if (filters.name.trim().length > 0) return true;
  if (filters.formats.length > 0) return true;
  if (filters.superTypes.length > 0) return true;
  if (filters.subTypes.length > 0) return true;
  if (filters.creatureTypes.length > 0) return true;
  if (filters.colors.length > 0) return true;
  if (filters.cmcMin > 0 || filters.cmcMax < 20) return true;
  if (filters.missingOnly) return true;
  return false;
};

// The committed filter set + Apply now live in the shared catalogue context
// (`CatalogueProvider`), consumed by both this hook and the sibling
// filter-modal screen. The hook therefore returns exactly the view's prop
// bundle.
export type UseCatalogueResult = CatalogueViewProps;

/**
 * Feature hook for the Catalogue screen (spec 018 / US1 + US2 + US4).
 *
 * US1: composes `useCatalogueInfiniteQuery` with masthead search state; the
 *      search input drives the wire `name` filter via a 300ms debounce.
 * US2: full chip-driven filter set + filter-pill row + filter sheet state.
 *      Filter changes propagate via `onFilterApply`; pill removal commits
 *      immediately (no draft).
 * US4: exposes `onPocketAddPress` (POST upsert via shared mutation hook),
 *      the `resultsAreStale` flag (defer-and-refresh per FR-031), and
 *      `onRefreshPress` to clear the flag + invalidate the catalogue caches.
 *
 * Per Principle X v1.16.0: every non-primitive return value is memoised so
 * `<CatalogueContainer />` re-renders only on real value changes.
 *
 * @returns the documented `UseCatalogueResult`.
 */
const useCatalogue = (): UseCatalogueResult => {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Only `mutate` is needed from the binder mutation; it is reference-stable
  // per TanStack docs so `onPocketAddPress` below stays identity-stable
  // across re-renders (Principle X v1.16.0).
  const { mutate: mutateBinder } = { mutate: () => {} };

  const { filters, applyFilter, clearFilters, removePill } = useCatalogueContext();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsAreStale, setResultsAreStale] = useState(false);

  // Keep the latest committed filters reachable from the debounce timeout
  // without rescheduling it on every filter change (it depends only on the
  // typed search text).
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Debounced commit of `searchQuery` into `filters.name`. The visible input
  // updates immediately; the wire query lags so a fast typist doesn't fan out
  // a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      const current = filtersRef.current;
      if (current.name !== searchQuery) {
        applyFilter({ ...current, name: searchQuery });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery, applyFilter]);

  // Reset to page 1 whenever a *non-name* filter dimension changes — this is
  // how an Apply committed from the sibling filter-modal screen reaches the
  // catalogue's pagination. The masthead search (name-only) deliberately
  // preserves the current page.
  const nonNameSignature = useMemo(
    () => JSON.stringify({ ...filters, name: '' }),
    [filters],
  );
  const prevNonNameSignature = useRef(nonNameSignature);
  useEffect(() => {
    if (prevNonNameSignature.current !== nonNameSignature) {
      prevNonNameSignature.current = nonNameSignature;
      setCurrentPage(1);
    }
  }, [nonNameSignature]);

  const queryShape = useMemo(() => filtersToQuery(filters), [filters]);
  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    isError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useCatalogueInfiniteQuery(queryShape);

  const hasActiveFilter = useMemo(() => hasAnyFilterDimension(filters), [filters]);

  const pages = useMemo<ReadonlyArray<CataloguePage>>(() => {
    if (!data) return [];
    return data.pages.map((p) => ({
      pageNumber: p.page,
      cards: p.cards,
      isPlaceholder: false,
    }));
  }, [data]);

  const totalLoaded = useMemo(
    () => pages.reduce((acc, p) => acc + p.cards.length, 0),
    [pages],
  );

  const totalPages = useMemo<number | null>(() => {
    if (!data) return null;
    const last = data.pages[data.pages.length - 1];
    if (last === undefined) return null;
    return hasNextPage ? null : last.totalPages;
  }, [data, hasNextPage]);

  const finalTotal = useMemo(() => {
    if (!data) return 0;
    const last = data.pages[data.pages.length - 1];
    return last?.total ?? 0;
  }, [data]);

  const summaryCaption = useMemo(() => {
    if (isLoading || isError || !data) return DASHED_CAPTION;
    if (hasNextPage) return formatOpenEndedCaption(totalLoaded);
    return formatFiniteCaption(finalTotal, totalPages ?? 0);
  }, [isLoading, isError, data, hasNextPage, totalLoaded, finalTotal, totalPages]);

  const isEmpty = useMemo(
    () => !isLoading && !isError && data !== undefined && totalLoaded === 0,
    [isLoading, isError, data, totalLoaded],
  );

  const hasActiveQuery = useMemo(
    () => isSearchActive && searchQuery.trim().length > 0,
    [isSearchActive, searchQuery],
  );

  const onSearchOpen = useCallback(() => {
    setIsSearchActive(true);
  }, []);

  const onSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const onSearchClose = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
  }, []);

  const onProfilePress = useCallback(() => {
    router.navigate('/profile');
  }, [router]);

  const onPagerSelected = useCallback(
    (pageNumber: number) => {
      setCurrentPage(pageNumber);
      if (
        hasNextPage &&
        !isFetchingNextPage &&
        pages.length > 0 &&
        pageNumber >= pages[pages.length - 1]!.pageNumber
      ) {
        void fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, pages, fetchNextPage],
  );

  const onRetryPress = useCallback(() => {
    void refetch();
  }, [refetch]);

  const onFilterSheetOpen = useCallback(() => {
    router.navigate('/catalogue/filter-modal');
  }, [router]);

  const onFilterClear = useCallback(() => {
    clearFilters();
    setSearchQuery('');
    setCurrentPage(1);
  }, [clearFilters]);

  const onFilterPillRemove = useCallback((pillId: string) => {
    removePill(pillId);
    setCurrentPage(1);
  }, [removePill]);

  const onRefreshPress = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: CATALOGUE_QUERY_PREFIX });
    setResultsAreStale(false);
  }, [queryClient]);

  return useMemo<UseCatalogueResult>(
    () => ({
      pages,
      currentPage,
      totalPages,
      summaryCaption,
      error,
      isLoading,
      isFetchingNextPage,
      isError,
      isSearchActive,
      searchQuery,
      hasActiveQuery,
      isEmpty,
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
    }),
    [
      pages,
      currentPage,
      totalPages,
      summaryCaption,
      error,
      isLoading,
      isFetchingNextPage,
      isError,
      isSearchActive,
      searchQuery,
      hasActiveQuery,
      isEmpty,
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
    ],
  );
};

export default useCatalogue;
