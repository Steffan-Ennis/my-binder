import { useCallback, useMemo } from 'react';

import { ApiError } from '@src/services/api/ApiError';
import type { CardImages } from '@src/services/api/schemas';
import { useCardImagesQuery } from '@src/hooks/useCardImagesQuery';

import type { CardFootprint, CardViewProps, CardViewState } from './types';

const variantForFootprint = (footprint: CardFootprint, images: CardImages): string =>
  footprint === 'pocket' ? images.medium : images.large;

/**
 * Compose the discriminated `CardViewState` for one card id at one footprint
 * by reading `useCardImagesQuery` and mapping result branches to view states.
 * Memoises the returned object per constitution v1.16.0 — same inputs
 * produce a reference-equal `{ state, footprint }` across re-renders so view
 * memoisation downstream stays effective.
 */
export const useCard = (id: string, footprint: CardFootprint): CardViewProps => {
  const query = useCardImagesQuery(id);
  const { isPending, isError, data, error, refetch } = query;

  const onRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const state = useMemo<CardViewState>(() => {
    if (data) {
      return { kind: 'loaded', imageUrl: variantForFootprint(footprint, data) };
    }
    if (isError) {
      if (error instanceof ApiError && error.kind === 'CARD_NOT_FOUND') {
        return { kind: 'notFound' };
      }
      return { kind: 'error', onRetry };
    }
    if (isPending) return { kind: 'loading' };
    return { kind: 'loading' };
  }, [data, isError, error, isPending, footprint, onRetry]);

  return useMemo<CardViewProps>(() => ({ state, footprint }), [state, footprint]);
};
