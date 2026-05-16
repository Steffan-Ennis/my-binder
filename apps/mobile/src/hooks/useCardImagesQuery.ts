import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiClient } from '@src/services/api/apiClient';
import type { ApiError } from '@src/services/api/ApiError';
import { computeRetryDelay, isFourXX } from '@src/services/api/queryClient';
import type { CardImages } from '@src/services/api/schemas';

import { useSession } from './useSession';

const STALE_TIME_MS = 60_000;
const GC_TIME_MS = 5 * 60_000;

// Spec 017 / FR-006 — per-query budget of 5 total attempts (1 initial + 4
// retries), overriding the project queryClient default of 3, which is correctly
// tuned for non-image endpoints. Reuses `isFourXX` / `computeRetryDelay` from
// `queryClient.ts` so the back-off schedule (1s → 2s → 4s → 8s → 16s capped
// at 30s) and the 4xx skip-retry behaviour stay in lock-step with project
// policy. Recorded in plan.md "Complexity Tracking" — single deliberate
// deviation from the global default.
//
// FR-007 (request deduplication via shared queryKey) and FR-008 (within-
// session warm-cache hit) are inherited from the shared queryClient — no
// additional logic.
const RETRY_BUDGET = 5;
const MAX_RETRIES = RETRY_BUDGET - 1;

const shouldRetry = (failureCount: number, error: unknown): boolean =>
  failureCount < MAX_RETRIES && !isFourXX(error);

export type UseCardImagesQueryResult = UseQueryResult<CardImages, ApiError>;

/**
 * Fetch the small/medium/large image URLs for one owned card by id. Backs the
 * reusable `<Card />` component (spec 017); the queryKey `['cards','images', id]`
 * is deterministic so duplicate consumers on the same screen and same-session
 * revisits dedupe to a single network call.
 *
 * @param id - MTGJSON printing UUID.
 * @returns the standard TanStack `useQuery` result.
 *
 * @example
 *   const q = useCardImagesQuery('6ca7af0b-4b6a-59ba-90be-6da4f62bcff1');
 *   if (q.isPending) return <Skeleton />;
 *   return <Image source={{ uri: q.data!.medium }} />;
 */
export const useCardImagesQuery = (id: string): UseCardImagesQueryResult => {
  const { status } = useSession();
  return useQuery<CardImages, ApiError>({
    queryKey: ['cards', 'images', id],
    queryFn: () => apiClient.getCardImages(id),
    retry: shouldRetry,
    retryDelay: computeRetryDelay,
    enabled: status === 'active' && Boolean(id),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
  });
};
