import type { FC } from 'react';

import CardView from './CardView';
import { useCard } from './useCard';
import type { CardFootprint } from './types';

export type CardProps = {
  id: string;
  footprint: CardFootprint;
};

const CardContainer: FC<CardProps> = ({ id, footprint }) => {
  const viewProps = useCard(id, footprint);
  return <CardView {...viewProps} />;
};

export default CardContainer;
