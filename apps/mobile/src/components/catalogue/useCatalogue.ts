import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useCatalogueInfiniteQuery,
  type CatalogueQueryShape,
} from '@src/hooks/useCatalogueInfiniteQuery';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import {
  EMPTY_FILTER_SET,
  type CatalogueFilterPill,
  type CatalogueFilterSet,
  type CataloguePage,
  type CatalogueViewProps,
} from './types';

const DASHED_CAPTION = '— MATCHES · — PER PAGE';
const PER_PAGE_LABEL = `${SLOTS_PER_BINDER_PAGE} PER PAGE`;
const SEARCH_DEBOUNCE_MS = 300;

const formatOpenEndedCaption = (loadedSoFar: number): string =>
  `${loadedSoFar}+ MATCHES · ${PER_PAGE_LABEL}`;

const formatFiniteCaption = (total: number, totalPages: number): string => {
  const matchNoun = total === 1 ? 'MATCH' : 'MATCHES';
  const pageNoun = totalPages === 1 ? 'PAGE' : 'PAGES';
  return `${total} ${matchNoun} · ${totalPages} ${pageNoun}`;
};

// Translate the local filter set into the wire shape consumed by
// `useCatalogueInfiniteQuery`. Empty arrays + sentinel CMC bounds collapse
// to undefined so the query key stays stable across no-op filter toggles.
const filtersToQuery = (filters: CatalogueFilterSet): CatalogueQueryShape => {
  const trimmedName = filters.name.trim();
  const query: CatalogueQueryShape = {};
  if (trimmedName.length > 0) query.name = trimmedName;
  if (filters.sets.length > 0) query.set = filters.sets[0];
  if (filters.formats.length > 0) query.formats = [...filters.formats];
  if (filters.superTypes.length > 0) query.superTypes = [...filters.superTypes];
  if (filters.subTypes.length > 0) query.subTypes = [...filters.subTypes];
  if (filters.creatureTypes.length > 0) query.creatureTypes = [...filters.creatureTypes];
  if (filters.colors.length > 0) {
    query.colorIdentity = filters.colors.map((c) => String(c));
  }
  if (filters.cmcMin > 0) query.cmcMin = filters.cmcMin;
  if (filters.cmcMax < 20) query.cmcMax = filters.cmcMax;
  if (filters.missingOnly) query.missingOnly = true;
  return query;
};

const dimensionLabels: Record<
  Exclude<keyof CatalogueFilterPill, 'id' | 'label'>,
  string
> = {} as never;

const buildPills = (filters: CatalogueFilterSet): ReadonlyArray<CatalogueFilterPill> => {
  void dimensionLabels;
  const pills: CatalogueFilterPill[] = [];
  for (const v of filters.formats) pills.push({ id: `format:${v}`, label: `Format: ${v}` });
  for (const v of filters.superTypes) pills.push({ id: `superType:${v}`, label: `Super: ${v}` });
  for (const v of filters.subTypes) pills.push({ id: `subType:${v}`, label: `Sub: ${v}` });
  for (const v of filters.creatureTypes) pills.push({ id: `creatureType:${v}`, label: `Creature: ${v}` });
  for (const v of filters.sets) pills.push({ id: `set:${v}`, label: `Set: ${v}` });
  for (const v of filters.colors) pills.push({ id: `color:${v}`, label: `Colour: ${v}` });
  if (filters.cmcMin > 0 || filters.cmcMax < 20) {
    pills.push({ id: 'cmc', label: `CMC: ${filters.cmcMin}–${filters.cmcMax}` });
  }
  if (filters.missingOnly) {
    pills.push({ id: 'missingOnly', label: 'Missing only' });
  }
  return pills;
};

const removePillFromFilters = (
  filters: CatalogueFilterSet,
  pillId: string,
): CatalogueFilterSet => {
  if (pillId === 'cmc') return { ...filters, cmcMin: 0, cmcMax: 20 };
  if (pillId === 'missingOnly') return { ...filters, missingOnly: false };
  const sep = pillId.indexOf(':');
  if (sep === -1) return filters;
  const dim = pillId.slice(0, sep);
  const value = pillId.slice(sep + 1);
  switch (dim) {
    case 'format':
      return { ...filters, formats: filters.formats.filter((v) => v !== value) };
    case 'superType':
      return { ...filters, superTypes: filters.superTypes.filter((v) => v !== value) };
    case 'subType':
      return { ...filters, subTypes: filters.subTypes.filter((v) => v !== value) };
    case 'creatureType':
      return { ...filters, creatureTypes: filters.creatureTypes.filter((v) => v !== value) };
    case 'set':
      return { ...filters, sets: filters.sets.filter((v) => v !== value) };
    case 'color':
      return {
        ...filters,
        colors: filters.colors.filter((v) => v !== (value as typeof filters.colors[number])),
      };
    default:
      return filters;
  }
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
> & {
  // US2 additions
  filters: CatalogueFilterSet;
  filterPills: ReadonlyArray<CatalogueFilterPill>;
  filterSheetOpen: boolean;
  isEmpty: boolean;
  onFilterSheetOpen: () => void;
  onFilterSheetClose: () => void;
  onFilterApply: (next: CatalogueFilterSet) => void;
  onFilterClear: () => void;
  onFilterPillRemove: (pillId: string) => void;
};

/**
 * Feature hook for the Catalogue screen (spec 018 / US1 + US2).
 *
 * US1: composes `useCatalogueInfiniteQuery` with masthead search state; the
 *      search input drives the wire `name` filter via a 300ms debounce.
 * US2: full chip-driven filter set + filter-pill row + filter sheet state.
 *      Filter changes propagate via `onFilterApply`; pill removal commits
 *      immediately (no draft).
 *
 * Per Principle X v1.16.0: every non-primitive return value is memoised so
 * `<CatalogueContainer />` re-renders only on real value changes.
 *
 * @returns the documented `UseCatalogueResult`.
 */
const useCatalogue = (): UseCatalogueResult => {
  const router = useRouter();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<CatalogueFilterSet>(EMPTY_FILTER_SET);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Debounced commit of `searchQuery` into `filters.name`. The visible input
  // updates immediately; the wire query lags so a fast typist doesn't fan out
  // a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((prev) => (prev.name === searchQuery ? prev : { ...prev, name: searchQuery }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const queryShape = useMemo(() => filtersToQuery(filters), [filters]);
  const query = useCatalogueInfiniteQuery(queryShape);

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

  const isEmpty = useMemo(
    () => !query.isLoading && !query.isError && query.data !== undefined && totalLoaded === 0,
    [query.isLoading, query.isError, query.data, totalLoaded],
  );

  const hasActiveQuery = useMemo(
    () => isSearchActive && searchQuery.trim().length > 0,
    [isSearchActive, searchQuery],
  );

  const filterPills = useMemo(() => buildPills(filters), [filters]);

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

  const onFilterSheetOpen = useCallback(() => {
    setFilterSheetOpen(true);
  }, []);

  const onFilterSheetClose = useCallback(() => {
    setFilterSheetOpen(false);
  }, []);

  const onFilterApply = useCallback((next: CatalogueFilterSet) => {
    setFilters(next);
    setFilterSheetOpen(false);
    setCurrentPage(1);
  }, []);

  const onFilterClear = useCallback(() => {
    setFilters(EMPTY_FILTER_SET);
    setSearchQuery('');
    setCurrentPage(1);
  }, []);

  const onFilterPillRemove = useCallback((pillId: string) => {
    setFilters((prev) => removePillFromFilters(prev, pillId));
    setCurrentPage(1);
  }, []);

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
      filters,
      filterPills,
      filterSheetOpen,
      isEmpty,
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
      filters,
      filterPills,
      filterSheetOpen,
      isEmpty,
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
    ],
  );
};

export default useCatalogue;
export { useCatalogue };
