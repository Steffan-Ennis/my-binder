import type { Card } from '@my-binder/core';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@src/services/api/apiClient';
import type { ApiError } from '@src/services/api/ApiError';

import { useSession } from './useSession';

const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;

export type UseCardDetailQueryResult = UseQueryResult<Card, ApiError>;

/**
 * Fetch the identity record for one owned card by id, hydrating the card detail
 * sheet hero (name / set / type) and `numberOwned` for the stepper (spec 020).
 * Keyed on `['cards','detail', id]` to share the existing `['cards', …]`
 * namespace; the spec-019 ownership mutation invalidates exactly this key on
 * success (FR-011). Retry/back-off are inherited from the project `queryClient`
 * default (3 attempts on 5xx/network, 4xx skipped) — no per-hook override.
 *
 * @param id - MTGJSON printing UUID.
 * @returns the standard TanStack `useQuery` result for the `Card`.
 *
 * @example
 *   const detail = useCardDetailQuery(printingId);
 *   if (detail.isPending) return <Skeleton />;
 *   return <Text>{detail.data!.name}</Text>;
 */
export const useCardDetailQuery = (id: string): UseCardDetailQueryResult => {
  const { status } = useSession();
  return useQuery<Card, ApiError>({
    queryKey: ['cards', 'detail', id],
    queryFn: () => apiClient.getCard(id),
    enabled: status === 'active' && Boolean(id),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};
