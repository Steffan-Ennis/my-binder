import type { CardPriceHistoryResponse } from '@my-binder/core';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@src/services/api/apiClient';
import type { ApiError } from '@src/services/api/ApiError';

import { useSession } from './useSession';

const DEFAULT_DAYS = 30;
const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;

export type UseCardPriceHistoryQueryResult = UseQueryResult<CardPriceHistoryResponse, ApiError>;

/**
 * Fetch the per-source price history over a `days`-long window (default 30) for
 * one printing, backing the 30-day trend chart (spec 020 / FR-003/FR-004).
 * Keyed on `['cards','prices','history', id, days]` so distinct windows cache
 * independently. Retry/back-off inherit the project `queryClient` default.
 *
 * @param id - MTGJSON printing UUID.
 * @param days - window length in calendar days (default 30).
 * @returns the standard TanStack `useQuery` result for the `CardPriceHistoryResponse`.
 *
 * @example
 *   const history = useCardPriceHistoryQuery(printingId); // last 30 days
 */
export const useCardPriceHistoryQuery = (
  id: string,
  days: number = DEFAULT_DAYS,
): UseCardPriceHistoryQueryResult => {
  const { status } = useSession();
  return useQuery<CardPriceHistoryResponse, ApiError>({
    queryKey: ['cards', 'prices', 'history', id, days],
    queryFn: () => apiClient.getCardPriceHistory(id, days),
    enabled: status === 'active' && Boolean(id),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};
