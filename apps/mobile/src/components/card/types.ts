// Mobile-only types for the reusable `<Card />` component (spec 017).
// These never cross the wire — kept inside the mobile workspace.
import { RefObject } from "react";
import { Animated } from "react-native";
import { UseCardImagesQueryResult } from "@src/hooks/useCardImagesQuery";

export type CardFootprint = 'pocket' | 'detail';

export type UseCardOptions = {
  id: string,
  footprint: CardFootprint,
}

export type CardViewProps = Pick<UseCardImagesQueryResult, 'error' | 'isLoading' | 'isSuccess'> & {
  onRetry: () => Promise<void>
  imageUrl?: string
  pulseRef: RefObject<Animated.Value>
}
