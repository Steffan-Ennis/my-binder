import type { FC } from 'react';

import { CardScannerContainer } from '@src/components/card-scanner';

// Spec 022 — index screen of the scan stack. Renders the live camera scanner;
// selecting a match pushes `card-detail` (the reused form sheet) on this stack.
const ScanIndex: FC = () => <CardScannerContainer />;
export default ScanIndex;
