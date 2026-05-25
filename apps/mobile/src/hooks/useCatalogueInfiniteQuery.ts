import isEmpty from 'lodash/isEmpty';
import type {CardRecord, SearchQuery, SearchResult } from '@my-binder/core';
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';

import { apiClient } from '@src/services/api/apiClient';
import type { ApiError } from '@src/services/api/ApiError';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import { useSession } from './useSession';

const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;

export type UseCatalogueInfiniteQueryResult = UseInfiniteQueryResult<
  { pages: ReadonlyArray<SearchResult>; pageParams: ReadonlyArray<number> },
  ApiError
>;

export type { CardRecord, SearchResult };

// Subset of `SearchQuery` that is part of the cache key — internal `userId`
// and `page`/`limit` are intentionally excluded so the cache survives auth
// changes and pager-driven page-param transitions.
export type CatalogueQueryShape = Omit<SearchQuery, 'page' | 'limit' | 'userId'>;

/**
 * Page the catalogue via `GET /cards/search`. Wraps TanStack `useInfiniteQuery`
 * around `apiClient.searchCards` so the catalogue view flattens
 * `data.pages.flatMap(p => p.cards)` into the swipe-paging surface.
 *
 * Cache key includes the structured filter shape (sorted by key) so two
 * different filter combinations get independent caches and back-paging hits
 * cache instead of refetching. Gated on `useSession().status === 'active'`.
 *
 * @param filters - the structured filter dimensions. Page/limit are injected internally.
 * @returns the standard TanStack `useInfiniteQuery` result.
 *
 * @example
 *   const cat = useCatalogueInfiniteQuery({ name: 'bolt', formats: ['Modern'] });
 *   const cards = cat.data?.pages.flatMap((p) => p.cards) ?? [];
 */
export const useCatalogueInfiniteQuery = (
  filters: CatalogueQueryShape,
): UseCatalogueInfiniteQueryResult => {
  const { status } = useSession();
  return useInfiniteQuery<
    SearchResult,
    ApiError,
    { pages: Array<SearchResult>; pageParams: ReadonlyArray<number> },
    readonly ['catalogue', 'search', CatalogueQueryShape],
    number
  >({
    queryKey: ['catalogue', 'search', filters] as const,
    queryFn: ({ pageParam }) =>
      apiClient.searchCards({ ...filters, page: pageParam, limit: 9 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: status === 'active' && !isEmpty(filters),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};
