import type { FC } from 'react';

import CardView from './CardView';
import { useCard } from './useCard';
import type { CardFootprint } from './types';

export type CardProps = {
  id: string;
  footprint: CardFootprint;
};

const CardContainer: FC<CardProps> = ({ id, footprint }) => {
  const { isSuccess, isLoading, onRetry, imageUrl, pulseRef, error } = useCard({id, footprint});
  return (
    <CardView
      isLoading={isLoading}
      pulseRef={pulseRef}
      isSuccess={isSuccess}
      onRetry={onRetry}
      imageUrl={imageUrl}
      error={error}
    />
  );
};

export default CardContainer;
