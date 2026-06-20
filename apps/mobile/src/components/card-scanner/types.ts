// Spec 022 — mobile-local types for the Card Scanner feature directory.
// Per Principle X sub-rule #7 these feature-local types live with the feature
// and MUST NOT be re-declared in `@my-binder/core`. Shared types are
// re-exported from the file that owns them (Principle IV — one type, one home),
// never redeclared: `ReticleTone` from the leaf component, `CaptureResult` /
// `CameraPermissionStatus` from the shared capture hook, `CardRecord` from core.
import type { CardRecord } from '@my-binder/core';
import type { CameraView } from 'expo-camera';
import type { ComponentRef, RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { GestureType, ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import type { ReticleTone } from '@src/components/scan-reticle/ScanReticle';
import type {
  CameraPermissionStatus,
  CaptureResult,
} from '@src/hooks/useCardCapture';
import type { UseCatalogueInfiniteQueryResult } from '@src/hooks/useCatalogueInfiniteQuery';

// Re-export the shared leaf/hook types so feature consumers import them from one
// place without reaching across directories (and without redeclaring them).
export type { CameraPermissionStatus, CaptureResult, ReticleTone };

// The only active capture mode in plan A. `'multi'` exists so the toggle can
// render a disabled second segment; plan B wires its pipeline (FR-002).
export type ScanMode = 'single' | 'multi';

// The single-consumer status of one scan attempt — maps 1:1 to the FR-007
// state set the view branches on. Owned by `useCardScanner` (State-locality
// rule: single-consumer ⇒ `useState`, not a store).
export type ScanStatus =
  | 'permissionDenied' // camera permission not granted
  | 'ready' // live viewfinder, awaiting capture
  | 'capturing' // shutter pressed, taking the still
  | 'recognizing' // running on-device text recognition
  | 'searching' // candidate name → catalogue search in flight
  | 'noText' // recognition found no legible text
  | 'recognitionError' // recognition threw
  | 'noMatch' // name read, catalogue returned zero cards
  | 'matches' // ≥1 catalogue match to choose from
  | 'unsupported'; // platform has no camera / on-device recognition (web)

// Props supplied by `useCardScanner` to `<CardScannerContainer />` and threaded
// to `<CardScannerView />` via named props (no spread, per Principle X).
//
// Composes `Pick<UseCatalogueInfiniteQueryResult, ...>` so the view inherits the
// query library's authoritative types for `error`/`isLoading`/`isSuccess`
// (Data-fetching Rule 5 — never redeclare fields TanStack already types).
export type CardScannerViewProps = Pick<
  UseCatalogueInfiniteQueryResult,
  'error' | 'isLoading' | 'isSuccess'
> & {
  // Scan state
  status: ScanStatus;
  mode: ScanMode;
  reticleTone: ReticleTone;
  // The recognised name once a still is read; absent until then.
  candidateName?: string;
  // The catalogue matches for `candidateName`, flattened from the query pages.
  matches: ReadonlyArray<CardRecord>;

  // Pull-to-dismiss for the match list (react-native-gesture-handler).
  // `matchListDismissGesture` wraps the scroll container in a `<GestureDetector>`,
  // `matchScrollRef` lets the pan run simultaneously with the native scroll, and
  // `onMatchListScroll` tracks the offset so the gesture only dismisses once
  // scrolled to the top. All three are constructed in the hook and surfaced as
  // stable handles (Principle X — Data-fetching rule 4: gestures live in the hook,
  // not the view).
  matchListDismissGesture: GestureType;
  matchScrollRef: RefObject<ComponentRef<typeof GestureScrollView> | null>;
  onMatchListScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;

  // Camera surface (from the shared `useCardCapture` hook)
  cameraRef: RefObject<CameraView | null>;
  permissionStatus: CameraPermissionStatus;
  torchEnabled: boolean;

  // Callbacks — the async capture/recognition handlers return a promise the
  // view fires-and-forgets via `onPress`; the rest are synchronous.
  onCapture: () => Promise<void>;
  onPickFromLibrary: () => Promise<void>;
  onRequestPermission: () => Promise<void>;
  onToggleTorch: () => void;
  onSelectMatch: (printingId: string) => void;
  onRetry: () => void;
  onSelectMode: (mode: ScanMode) => void;
};

// `useCardScanner` returns exactly the view's prop bundle.
export type UseCardScannerResult = CardScannerViewProps;
