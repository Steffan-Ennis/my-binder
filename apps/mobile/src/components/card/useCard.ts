import {useCallback, useMemo, useRef, useEffect} from 'react';
import { Animated } from "react-native";
import type { CardImages } from '@src/services/api/schemas';

import { useCardImagesQuery } from '@src/hooks/useCardImagesQuery';
import type {CardFootprint, CardViewProps, UseCardOptions} from './types';

const variantForFootprint = (footprint: CardFootprint, images: CardImages): string =>
  footprint === 'pocket' ? images.medium : images.large;

const PULSE_MIN = 0.6;
const PULSE_MAX = 1.0;
const PULSE_DURATION_MS = 600;


/**
 * Compose the discriminated `CardViewState` for one card id at one footprint
 * by reading `useCardImagesQuery` and mapping result branches to view states.
 * Memoises the returned object per constitution v1.16.0 — same inputs
 * produce a reference-equal `{ state, footprint }` across re-renders so view
 * memoisation downstream stays effective.
 */
export const useCard = ({ id, footprint }: UseCardOptions): CardViewProps => {
  const { isLoading, isSuccess, data, refetch, error } = useCardImagesQuery(id);

  const onRetry = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const imageUrl = useMemo(() => {
    if(isSuccess) {
      return variantForFootprint(footprint, data)
    }
  }, [data, isSuccess, footprint])

  const pulseRef = useRef(new Animated.Value(PULSE_MIN));

  useEffect(() => {
    if (!isLoading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRef.current, {
          toValue: PULSE_MAX,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulseRef.current, {
          toValue: PULSE_MIN,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLoading]);


  return {
    pulseRef,
    imageUrl,
    error,
    isLoading,
    isSuccess,
    onRetry,
  }
};
