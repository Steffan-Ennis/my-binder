// Spec 022 — Card Scanner feature hook (Layer = Hook: orchestration + scan
// state). Composes the shared `useCardCapture` hook, the `recognizeCardName`
// service, and the reused `useCatalogueInfiniteQuery`. The capture → recognise →
// search flow lives entirely in handlers (no `useEffect` chain — useEffect
// discipline); the catalogue search is reactive on the recognised name. Per
// Principle X v1.16.0 every non-primitive return value is memoised.
import type { CardRecord } from '@my-binder/core';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { recognizeCardName } from '@src/services/scan/cardTextRecognition';
import { useCardCapture, type CaptureResult } from '@src/hooks/useCardCapture';
import {
  useCatalogueInfiniteQuery,
  type CatalogueQueryShape,
} from '@src/hooks/useCatalogueInfiniteQuery';

import type {
  CardScannerViewProps,
  ReticleTone,
  ScanMode,
  ScanStatus,
  UseCardScannerResult,
} from './types';

// The capture/recognise stage the hook owns directly. The public `ScanStatus`
// derives the search-phase outcomes (`matches`/`noMatch`) from the query state,
// so those never need to be set imperatively (no race, no effect).
type ScanPhase =
  | 'ready'
  | 'permissionDenied'
  | 'capturing'
  | 'recognizing'
  | 'searching'
  | 'noText'
  | 'recognitionError'
  | 'unsupported';

const CARD_DETAIL_ROUTE = '/scan/card-detail';

const toReticleTone = (status: ScanStatus): ReticleTone => {
  if (status === 'matches') return 'aligned';
  if (
    status === 'noMatch' ||
    status === 'noText' ||
    status === 'recognitionError' ||
    status === 'permissionDenied' ||
    status === 'unsupported'
  ) {
    return 'error';
  }
  return 'idle';
};

/**
 * Feature hook for the Scan screen (spec 022 / US1).
 *
 * Orchestrates the on-device pipeline: `useCardCapture` takes a still (or imports
 * one from the gallery), `recognizeCardName` reads its printed name on-device,
 * and `useCatalogueInfiniteQuery({ name })` looks the name up against the existing
 * catalogue. The recognised name only ever crosses the boundary as a search
 * string (SC-004); the image never leaves the device.
 *
 * @returns the documented `CardScannerViewProps` bundle.
 */
const useCardScanner = (): UseCardScannerResult => {
  const router = useRouter();
  const { cameraRef, permissionStatus, requestPermission, capture, pickFromLibrary, torchEnabled, toggleTorch } =
    useCardCapture();

  const [phase, setPhase] = useState<ScanPhase>('ready');
  const [candidateName, setCandidateName] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<ScanMode>('single');

  // Empty filter object ⇒ the catalogue hook self-gates `enabled` off (lodash
  // `isEmpty({}) === true`), so no request is issued until a name is recognised.
  const queryFilters = useMemo<CatalogueQueryShape>(
    () => (candidateName ? { name: candidateName } : {}),
    [candidateName],
  );
  const { data, error, isLoading, isSuccess } = useCatalogueInfiniteQuery(queryFilters);

  const matches = useMemo<ReadonlyArray<CardRecord>>(
    () => data?.pages.flatMap((page) => page.cards) ?? [],
    [data],
  );

  // Public status: the capture/recognise phases map straight through; the
  // `searching` phase reflects the live query (matches vs no-match). Web has no
  // camera or on-device recognizer, so it is always `unsupported`.
  const status = useMemo<ScanStatus>(() => {
    if (Platform.OS === 'web') return 'unsupported';
    if (phase === 'searching') {
      if (isSuccess) return matches.length > 0 ? 'matches' : 'noMatch';
      return 'searching';
    }
    if (phase === 'ready' && permissionStatus === 'denied') return 'permissionDenied';
    return phase;
  }, [phase, permissionStatus, isSuccess, matches.length]);

  const reticleTone = useMemo<ReticleTone>(() => toReticleTone(status), [status]);

  // Shared tail for both capture sources: a typed `CaptureResult` → recognise →
  // set the phase/candidate. Recognition errors surface as `recognitionError`
  // (the service already logged the original cause — Principle VIII), never
  // swallowed.
  const processCapture = useCallback(async (result: CaptureResult): Promise<void> => {
    if (result.kind === 'denied') {
      setPhase('permissionDenied');
      return;
    }
    if (result.kind === 'cancelled') {
      setPhase('ready');
      return;
    }
    if (result.kind === 'unsupported') {
      setPhase('unsupported');
      return;
    }

    setPhase('recognizing');
    try {
      const recognition = await recognizeCardName(result.uri);
      if (recognition.kind === 'unsupported') {
        setPhase('unsupported');
        return;
      }
      if (recognition.kind === 'noText') {
        setCandidateName(undefined);
        setPhase('noText');
        return;
      }
      setCandidateName(recognition.candidateName);
      setPhase('searching');
    } catch {
      setPhase('recognitionError');
    }
  }, []);

  const onCapture = useCallback(async (): Promise<void> => {
    setCandidateName(undefined);
    setPhase('capturing');
    const result = await capture();
    await processCapture(result);
  }, [capture, processCapture]);

  const onPickFromLibrary = useCallback(async (): Promise<void> => {
    setCandidateName(undefined);
    await processCapture(await pickFromLibrary());
  }, [pickFromLibrary, processCapture]);

  const onRequestPermission = useCallback(async (): Promise<void> => {
    await requestPermission();
    setPhase('ready');
  }, [requestPermission]);

  const onRetry = useCallback((): void => {
    setCandidateName(undefined);
    setPhase('ready');
  }, []);

  // FR-006 — open the existing card-detail form sheet for the chosen printing.
  const onSelectMatch = useCallback(
    (printingId: string): void => {
      if (!printingId) return;
      router.navigate({ pathname: CARD_DETAIL_ROUTE, params: { id: printingId } });
    },
    [router],
  );

  // Multi mode is disabled in plan A — selecting it is a no-op (the toggle
  // segment is also rendered disabled).
  const onSelectMode = useCallback((next: ScanMode): void => {
    if (next === 'multi') return;
    setMode(next);
  }, []);

  return useMemo<CardScannerViewProps>(
    () => ({
      error,
      isLoading,
      isSuccess,
      status,
      mode,
      reticleTone,
      candidateName,
      matches,
      cameraRef,
      permissionStatus,
      torchEnabled,
      onCapture,
      onPickFromLibrary,
      onRequestPermission,
      onToggleTorch: toggleTorch,
      onSelectMatch,
      onRetry,
      onSelectMode,
    }),
    [
      error,
      isLoading,
      isSuccess,
      status,
      mode,
      reticleTone,
      candidateName,
      matches,
      cameraRef,
      permissionStatus,
      torchEnabled,
      onCapture,
      onPickFromLibrary,
      onRequestPermission,
      toggleTorch,
      onSelectMatch,
      onRetry,
      onSelectMode,
    ],
  );
};

export default useCardScanner;
