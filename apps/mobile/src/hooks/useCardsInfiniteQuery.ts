import type { Card, CardList } from '@my-binder/core';
import { useInfiniteQuery, type UseInfiniteQueryResult } from '@tanstack/react-query';

import { apiClient } from '@src/services/api/apiClient';
import type { ApiError } from '@src/services/api/ApiError';

import { useSession } from './useSession';

const QUERY_KEY = ['cards', 'list'] as const;
const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;

export type UseCardsInfiniteQueryResult = UseInfiniteQueryResult<
  { pages: ReadonlyArray<CardList>; pageParams: ReadonlyArray<string | undefined> },
  ApiError
>;

export type { Card, CardList };

/**
 * Page the authenticated user's collection from `GET /cards`. Wraps
 * `apiClient.getCards` with TanStack `useInfiniteQuery` so the UI can flatten
 * `data.pages` into a single array for the 3×3 binder grid. The hook is gated
 * on an active session and inherits the global `QueryClient` retry / cache
 * policy (3 retries with 1s/2s/4s back-off, 4xx skipped, no window-focus
 * refetch).
 *
 * The hook is forward-compatible with cursor pagination — when the server
 * starts emitting `nextCursor`, callers can transparently page additional
 * results without any view-layer change. Today's single-page response with
 * `nextCursor: null` reduces the hook to a single fetch.
 *
 * @returns the standard TanStack `useInfiniteQuery` result; `data.pages` is a
 *   list of `CardList`; the first page is fetched on mount when the session
 *   is active.
 *
 * @example
 *   const cardsQuery = useCardsInfiniteQuery();
 *   const cards = useMemo(
 *     () => cardsQuery.data?.pages.flatMap((p) => p.cards) ?? [],
 *     [cardsQuery.data],
 *   );
 */
export const useCardsInfiniteQuery = (): UseCardsInfiniteQueryResult => {
  const { status } = useSession();
  return useInfiniteQuery<
    CardList,
    ApiError,
    { pages: ReadonlyArray<CardList>; pageParams: ReadonlyArray<string | undefined> },
    typeof QUERY_KEY,
    string | undefined
  >({
    queryKey: QUERY_KEY,
    queryFn: ({ pageParam }) => apiClient.getCards(pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: status === 'active',
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};
