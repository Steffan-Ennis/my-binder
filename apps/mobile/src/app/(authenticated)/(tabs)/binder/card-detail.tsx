import { useLocalSearchParams } from 'expo-router';
import type { FC } from 'react';

import { CardDetailSheetContainer } from '@src/components/card-detail-sheet';

// Spec 020 — Binder surface of the card-detail form sheet. Identical to the
// Catalogue route file; only the hosting Stack differs (FR-001).
const CardDetail: FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CardDetailSheetContainer printingId={id} />;
};

export default CardDetail;
