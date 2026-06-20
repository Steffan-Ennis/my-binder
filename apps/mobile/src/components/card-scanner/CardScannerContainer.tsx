// Spec 022 — Container layer (Principle X). Calls the feature hook and bridges
// its result to the presentational view by passing each field as a named prop
// (no spread), so the view's prop surface stays explicit and reviewable. Mounted
// by the scan-stack index route.
import type { FC } from 'react';

import CardScannerView from './CardScannerView';
import useCardScanner from './useCardScanner';

const CardScannerContainer: FC = () => {
  const {
    error,
    isLoading,
    isSuccess,
    status,
    mode,
    reticleTone,
    candidateName,
    matches,
    matchListDismissGesture,
    matchScrollRef,
    onMatchListScroll,
    cameraRef,
    permissionStatus,
    torchEnabled,
    onCapture,
    onPickFromLibrary,
    onRequestPermission,
    onToggleTorch,
    onSelectMatch,
    onRetry,
    onSelectMode,
  } = useCardScanner();

  return (
    <CardScannerView
      error={error}
      isLoading={isLoading}
      isSuccess={isSuccess}
      status={status}
      mode={mode}
      reticleTone={reticleTone}
      candidateName={candidateName}
      matches={matches}
      matchListDismissGesture={matchListDismissGesture}
      matchScrollRef={matchScrollRef}
      onMatchListScroll={onMatchListScroll}
      cameraRef={cameraRef}
      permissionStatus={permissionStatus}
      torchEnabled={torchEnabled}
      onCapture={onCapture}
      onPickFromLibrary={onPickFromLibrary}
      onRequestPermission={onRequestPermission}
      onToggleTorch={onToggleTorch}
      onSelectMatch={onSelectMatch}
      onRetry={onRetry}
      onSelectMode={onSelectMode}
    />
  );
};

export default CardScannerContainer;
export { CardScannerContainer };
