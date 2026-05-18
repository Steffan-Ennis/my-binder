import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  useCatalogueInfiniteQuery,
  type CatalogueQueryShape,
} from '@src/hooks/useCatalogueInfiniteQuery';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import type { CataloguePage, CatalogueViewProps } from './types';

const DASHED_CAPTION = '— MATCHES · — PER PAGE';
const PER_PAGE_LABEL = `${SLOTS_PER_BINDER_PAGE} PER PAGE`;

const formatOpenEndedCaption = (loadedSoFar: number): string =>
  `${loadedSoFar}+ MATCHES · ${PER_PAGE_LABEL}`;

const formatFiniteCaption = (total: number, totalPages: number): string => {
  const matchNoun = total === 1 ? 'MATCH' : 'MATCHES';
  const pageNoun = totalPages === 1 ? 'PAGE' : 'PAGES';
  return `${total} ${matchNoun} · ${totalPages} ${pageNoun}`;
};

export type UseCatalogueResult = Pick<
  CatalogueViewProps,
  | 'pages'
  | 'currentPage'
  | 'totalPages'
  | 'summaryCaption'
  | 'hasNextPage'
  | 'isLoading'
  | 'isFetchingNextPage'
  | 'isError'
  | 'isSearchActive'
  | 'searchQuery'
  | 'hasActiveQuery'
  | 'onSearchOpen'
  | 'onSearchChange'
  | 'onSearchClose'
  | 'onProfilePress'
  | 'onPagerSelected'
  | 'onRetryPress'
>;

/**
 * Feature hook for the Catalogue screen (spec 018 / US1 subset).
 *
 * Composes `useCatalogueInfiniteQuery` with the masthead's collapsed/expanded
 * search state. US2 will extend this hook with the full filter reducer, US4
 * with the +/- mutations and refresh-hint, US3 with the detail-sheet handle.
 *
 * Per constitution v1.16.0: non-primitive return values are memoised so
 * `<CatalogueContainer />` re-renders only on real value changes.
 *
 * @returns the documented `UseCatalogueResult`.
 */
const useCatalogue = (): UseCatalogueResult => {
  const router = useRouter();

  // Masthead search state — debounce-into-query lands in US2; US1 simply
  // toggles the surface without yet mutating the wire query.
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // US1 threads the masthead search input directly into the wire `name`
  // filter; the catalogue surface starts blank until the user searches
  // (`useCatalogueInfiniteQuery` gates fetch on `!!filters.name`). US2 will
  // layer the filter sheet + chip dimensions + debounce on top.
  const filters: CatalogueQueryShape = useMemo(() => {
    const trimmed = searchQuery.trim();
    return trimmed.length > 0 ? { name: trimmed } : {};
  }, [searchQuery]);

  const query = useCatalogueInfiniteQuery(filters);

  const pages = useMemo<ReadonlyArray<CataloguePage>>(() => {
    if (!query.data) return [];
    return query.data.pages.map((p) => ({
      pageNumber: p.page,
      cards: p.cards,
      isPlaceholder: false,
    }));
  }, [query.data]);

  const totalLoaded = useMemo(
    () => pages.reduce((acc, p) => acc + p.cards.length, 0),
    [pages],
  );

  const totalPages = useMemo<number | null>(() => {
    if (!query.data) return null;
    const last = query.data.pages[query.data.pages.length - 1];
    if (last === undefined) return null;
    return query.hasNextPage ? null : last.totalPages;
  }, [query.data, query.hasNextPage]);

  const finalTotal = useMemo(() => {
    if (!query.data) return 0;
    const last = query.data.pages[query.data.pages.length - 1];
    return last?.total ?? 0;
  }, [query.data]);

  const summaryCaption = useMemo(() => {
    if (query.isLoading || query.isError || !query.data) return DASHED_CAPTION;
    if (query.hasNextPage) return formatOpenEndedCaption(totalLoaded);
    return formatFiniteCaption(finalTotal, totalPages ?? 0);
  }, [
    query.isLoading,
    query.isError,
    query.data,
    query.hasNextPage,
    totalLoaded,
    finalTotal,
    totalPages,
  ]);

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
      // Lazy-load the next page when the user lands on the last loaded page.
      if (
        query.hasNextPage &&
        !query.isFetchingNextPage &&
        pages.length > 0 &&
        pageNumber >= pages[pages.length - 1]!.pageNumber
      ) {
        void query.fetchNextPage();
      }
    },
    [query, pages],
  );

  const onRetryPress = useCallback(() => {
    void query.refetch();
  }, [query]);

  return useMemo<UseCatalogueResult>(
    () => ({
      pages,
      currentPage,
      totalPages,
      summaryCaption,
      hasNextPage: query.hasNextPage,
      isLoading: query.isLoading,
      isFetchingNextPage: query.isFetchingNextPage,
      isError: query.isError,
      isSearchActive,
      searchQuery,
      hasActiveQuery,
      onSearchOpen,
      onSearchChange,
      onSearchClose,
      onProfilePress,
      onPagerSelected,
      onRetryPress,
    }),
    [
      pages,
      currentPage,
      totalPages,
      summaryCaption,
      query.hasNextPage,
      query.isLoading,
      query.isFetchingNextPage,
      query.isError,
      isSearchActive,
      searchQuery,
      hasActiveQuery,
      onSearchOpen,
      onSearchChange,
      onSearchClose,
      onProfilePress,
      onPagerSelected,
      onRetryPress,
    ],
  );
};

export default useCatalogue;
export { useCatalogue };
