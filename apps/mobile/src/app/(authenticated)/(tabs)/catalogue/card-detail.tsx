import { useLocalSearchParams } from 'expo-router';
import type { FC } from 'react';

import { CardDetailSheetContainer } from '@src/components/card-detail-sheet';

// Spec 020 — Catalogue surface of the card-detail form sheet. Reads the tapped
// printing id from the route param and hands it to the shared container; the
// `formSheet` presentation (registered in `_layout.tsx`) supplies the slide-up,
// swipe-down-to-dismiss, and corner radius for free (FR-001 / FR-005).
const CardDetail: FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CardDetailSheetContainer printingId={id} />;
};

export default CardDetail;
