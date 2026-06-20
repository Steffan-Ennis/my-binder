// Spec 022 — Card Scanner View (Layer = View: pure JSX, no state/effects/service
// imports). Renders the live `expo-camera` viewfinder, the palette-driven framing
// reticle, the Single/Multi mode toggle (Multi disabled until plan B), the
// gallery · capture · flash control bar, and one branch per `ScanStatus`
// (FR-001/FR-007/FR-008). Sub-views are real child components (no `renderX`
// functions, per the no-render-functions rule).
import { Ionicons } from '@expo/vector-icons';
import type { CardRecord } from '@my-binder/core';
import { CameraView } from 'expo-camera';
import type { FC } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import ScanReticle from '@src/components/scan-reticle/ScanReticle';
import { Colors } from '@src/constants/theme';

import useStyles, { type CardScannerViewStyles } from './CardScannerView.theme';
import type { CardScannerViewProps, ScanMode, ScanStatus } from './types';

const ICON_SIZE = 22;
const CAPTURE_ICON_SIZE = 30;
// ~60fps scroll-offset sampling so the dismiss gesture's at-top check stays current.
const SCROLL_EVENT_THROTTLE = 16;

// Capture is locked out while a still is being taken / read / searched.
const isBusy = (status: ScanStatus): boolean =>
  status === 'capturing' || status === 'recognizing' || status === 'searching';

const ModeToggle: FC<{
  styles: CardScannerViewStyles;
  mode: ScanMode;
  onSelectMode: (mode: ScanMode) => void;
}> = ({ styles, mode, onSelectMode }) => (
  <View style={styles.modeToggle} testID="scan-mode-toggle">
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: mode === 'single' }}
      onPress={() => onSelectMode('single')}
      testID="scan-mode-single"
      style={[styles.modeSegment, mode === 'single' && styles.modeSegmentActive]}
    >
      <Text style={[styles.modeLabel, mode === 'single' && styles.modeLabelActive]}>SINGLE</Text>
    </Pressable>
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      disabled
      testID="scan-mode-multi"
      style={styles.modeSegment}
    >
      <Text style={[styles.modeLabel, styles.modeLabelDisabled]}>MULTI</Text>
    </Pressable>
  </View>
);

const ControlBar: FC<{
  styles: CardScannerViewStyles;
  torchEnabled: boolean;
  captureDisabled: boolean;
  onCapture: () => void;
  onPickFromLibrary: () => void;
  onToggleTorch: () => void;
}> = ({ styles, torchEnabled, captureDisabled, onCapture, onPickFromLibrary, onToggleTorch }) => (
  <View style={styles.controlBar} testID="scan-control-bar">
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Import a card photo from your library"
      onPress={onPickFromLibrary}
      testID="scan-gallery-button"
      style={styles.sideButton}
    >
      <Ionicons name="images-outline" size={ICON_SIZE} color={Colors.dark.accent} />
    </Pressable>

    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Capture the framed card"
      accessibilityState={{ disabled: captureDisabled }}
      disabled={captureDisabled}
      onPress={onCapture}
      testID="scan-capture-button"
      style={[styles.captureButton, captureDisabled && styles.captureButtonDisabled]}
    >
      <Ionicons name="scan-outline" size={CAPTURE_ICON_SIZE} color={Colors.dark.textOnAccent} />
    </Pressable>

    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Toggle the camera flash"
      accessibilityState={{ selected: torchEnabled }}
      onPress={onToggleTorch}
      testID="scan-flash-button"
      style={[styles.sideButton, torchEnabled && styles.sideButtonActive]}
    >
      <Ionicons
        name={torchEnabled ? 'flash' : 'flash-outline'}
        size={ICON_SIZE}
        color={torchEnabled ? Colors.dark.textOnAccent : Colors.dark.accent}
      />
    </Pressable>
  </View>
);

const ScanProgress: FC<{ styles: CardScannerViewStyles; label: string; testID: string }> = ({
  styles,
  label,
  testID,
}) => (
  <View style={styles.banner} testID={testID}>
    <ActivityIndicator color={Colors.dark.accent} />
    <Text style={styles.bannerText}>{label}</Text>
  </View>
);

const ScanMessage: FC<{
  styles: CardScannerViewStyles;
  message: string;
  testID: string;
  onRetry: () => void;
}> = ({ styles, message, testID, onRetry }) => (
  <View style={styles.banner} testID={testID}>
    <Text style={styles.bannerText}>{message}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Scan another card"
      onPress={onRetry}
      testID="scan-retry-button"
      style={styles.retryButton}
    >
      <Text style={styles.retryLabel}>Try again</Text>
    </Pressable>
  </View>
);

const MatchList: FC<{
  styles: CardScannerViewStyles;
  matches: ReadonlyArray<CardRecord>;
  matchListPanHandlers: CardScannerViewProps['matchListPanHandlers'];
  onMatchListScroll: CardScannerViewProps['onMatchListScroll'];
  onSelectMatch: (printingId: string) => void;
}> = ({ styles, matches, matchListPanHandlers, onMatchListScroll, onSelectMatch }) => (
  // The wrapper carries the pull-to-dismiss pan handlers; the inner ScrollView
  // owns the height cap + scrolling. The pan only intercepts at the top (gated in
  // the hook), so normal scrolling stays with the ScrollView.
  <View style={styles.matchListWrapper} testID="scan-match-list" {...matchListPanHandlers}>
    <ScrollView
      style={styles.matchList}
      contentContainerStyle={styles.matchListContent}
      testID="scan-status-matches"
      onScroll={onMatchListScroll}
      scrollEventThrottle={SCROLL_EVENT_THROTTLE}
      keyboardShouldPersistTaps="handled"
    >
      {matches.map((match) => (
        <Pressable
          key={match.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${match.name}`}
          onPress={() => onSelectMatch(match.id)}
          testID={`scan-match-${match.id}`}
          style={styles.matchRow}
        >
          <Text style={styles.matchName}>{match.name}</Text>
          <Text style={styles.matchMeta}>{`${match.set} · #${match.cardNumber}`}</Text>
        </Pressable>
      ))}
    </ScrollView>
  </View>
);

const ScanStatusOverlay: FC<{
  styles: CardScannerViewStyles;
  status: ScanStatus;
  candidateName?: string;
  matches: ReadonlyArray<CardRecord>;
  matchListPanHandlers: CardScannerViewProps['matchListPanHandlers'];
  onMatchListScroll: CardScannerViewProps['onMatchListScroll'];
  onSelectMatch: (printingId: string) => void;
  onRetry: () => void;
}> = ({
  styles,
  status,
  candidateName,
  matches,
  matchListPanHandlers,
  onMatchListScroll,
  onSelectMatch,
  onRetry,
}) => {
  switch (status) {
    case 'capturing':
      return <ScanProgress styles={styles} label="Capturing…" testID="scan-status-capturing" />;
    case 'recognizing':
      return <ScanProgress styles={styles} label="Reading the card…" testID="scan-status-recognizing" />;
    case 'searching':
      return <ScanProgress styles={styles} label="Searching the catalogue…" testID="scan-status-searching" />;
    case 'noText':
      return (
        <ScanMessage
          styles={styles}
          message="Couldn't find a readable name. Re-frame the card and try again."
          testID="scan-status-noText"
          onRetry={onRetry}
        />
      );
    case 'recognitionError':
      return (
        <ScanMessage
          styles={styles}
          message="Something went wrong reading the card. Try again."
          testID="scan-status-recognitionError"
          onRetry={onRetry}
        />
      );
    case 'noMatch':
      return (
        <ScanMessage
          styles={styles}
          message={`No catalogue match for "${candidateName ?? ''}". Try again.`}
          testID="scan-status-noMatch"
          onRetry={onRetry}
        />
      );
    case 'matches':
      return (
        <MatchList
          styles={styles}
          matches={matches}
          matchListPanHandlers={matchListPanHandlers}
          onMatchListScroll={onMatchListScroll}
          onSelectMatch={onSelectMatch}
        />
      );
    default:
      return null;
  }
};

const CardScannerView: FC<CardScannerViewProps> = ({
  status,
  mode,
  reticleTone,
  candidateName,
  matches,
  matchListPanHandlers,
  onMatchListScroll,
  cameraRef,
  torchEnabled,
  onCapture,
  onPickFromLibrary,
  onRequestPermission,
  onToggleTorch,
  onSelectMatch,
  onRetry,
  onSelectMode,
}) => {
  const styles = useStyles();

  if (status === 'unsupported') {
    return (
      <View style={[styles.root, styles.centered]} testID="scan-unsupported">
        <Text style={styles.messageTitle}>Scanning isn’t available here</Text>
        <Text style={styles.messageBody}>
          Card scanning needs a device camera. Open My Binder on your phone to scan a card.
        </Text>
      </View>
    );
  }

  if (status === 'permissionDenied') {
    return (
      <View style={[styles.root, styles.centered]} testID="scan-permission-denied">
        <Text style={styles.messageTitle}>Camera access needed</Text>
        <Text style={styles.messageBody}>
          Allow camera access to scan a card and match it against your catalogue.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Grant camera access"
          onPress={onRequestPermission}
          testID="scan-grant-permission"
          style={styles.retryButton}
        >
          <Text style={styles.retryLabel}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="card-scanner-root">
      <CameraView ref={cameraRef} enableTorch={torchEnabled} style={styles.camera} testID="camera-view" />
      <ScanReticle tone={reticleTone} />

      <ModeToggle styles={styles} mode={mode} onSelectMode={onSelectMode} />

      <ScanStatusOverlay
        styles={styles}
        status={status}
        candidateName={candidateName}
        matches={matches}
        matchListPanHandlers={matchListPanHandlers}
        onMatchListScroll={onMatchListScroll}
        onSelectMatch={onSelectMatch}
        onRetry={onRetry}
      />

      <ControlBar
        styles={styles}
        torchEnabled={torchEnabled}
        captureDisabled={isBusy(status)}
        onCapture={onCapture}
        onPickFromLibrary={onPickFromLibrary}
        onToggleTorch={onToggleTorch}
      />
    </View>
  );
};

export default CardScannerView;
