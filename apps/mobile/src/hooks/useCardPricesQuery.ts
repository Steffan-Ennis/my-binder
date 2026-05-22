import type { CardPricesResponse } from '@my-binder/core';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@src/services/api/apiClient';
import type { ApiError } from '@src/services/api/ApiError';

import { useSession } from './useSession';

const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;

export type UseCardPricesQueryResult = UseQueryResult<CardPricesResponse, ApiError>;

/**
 * Fetch the latest per-source price quote (Card Kingdom + TCG Player) for one
 * printing, backing the card detail sheet's price rows (spec 020 / FR-002).
 * Keyed on `['cards','prices', id]`. Ownership changes do not affect prices, so
 * the stepper mutation never invalidates this key. Retry/back-off inherit the
 * project `queryClient` default (3 attempts on 5xx/network, 4xx skipped).
 *
 * @param id - MTGJSON printing UUID.
 * @returns the standard TanStack `useQuery` result for the `CardPricesResponse`.
 *
 * @example
 *   const prices = useCardPricesQuery(printingId);
 *   const ck = prices.data?.cardKingdom; // null when MTGJSON has no observation
 */
export const useCardPricesQuery = (id: string): UseCardPricesQueryResult => {
  const { status } = useSession();
  return useQuery<CardPricesResponse, ApiError>({
    queryKey: ['cards', 'prices', id],
    queryFn: () => apiClient.getCardPrices(id),
    enabled: status === 'active' && Boolean(id),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};
