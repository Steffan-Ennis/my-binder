// Spec 022 — Card Scanner feature hook (Layer = Hook: orchestration + scan
// state). Composes the shared `useCardCapture` hook, the `recognizeCardName`
// service, and the reused `useCatalogueInfiniteQuery`. The capture → recognise →
// search flow lives entirely in handlers (no `useEffect` chain — useEffect
// discipline): recognition yields an ordered list of candidate names and the
// handler probes the catalogue for each (top-most first) until one matches; the
// winning name then drives the reactive `useCatalogueInfiniteQuery` that renders
// the results. Per Principle X v1.16.0 every non-primitive return value is memoised.
import type { CardRecord } from '@my-binder/core';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { apiClient } from '@src/services/api/apiClient';
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

// A probe only needs to know whether a candidate name has ≥1 catalogue card, so
// it pulls a single row (Principle V — no magic literal).
const SCAN_PROBE_LIMIT = 1;
// Upper bound on per-scan catalogue probes — guards against a noisy OCR read
// fanning out into a request storm. Top-most candidates are tried first, so the
// real name is almost always found well within this bound.
const MAX_SCAN_CANDIDATES = 8;
// Probe results are reused across a single scan's retries (matches the catalogue
// query's freshness window).
const PROBE_STALE_MS = 60_000;

// Pull-to-dismiss tuning for the match list (Principle V — no magic literal).
// Treat a near-zero scroll offset as "at the top"; only then may a downward drag
// take over from the scroll, and only a drag past the dismiss distance closes it.
const SCROLL_TOP_EPSILON = 4;
const PULL_ACTIVATE_DISTANCE = 24;
const PULL_DISMISS_DISTANCE = 96;

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
 * one from the gallery), `recognizeCardName` reads its printed text on-device as
 * an ordered list of candidate names, and the handler probes the catalogue for
 * each candidate until one matches — so a card whose largest text block is its
 * rules box (e.g. Mishra's Workshop) still resolves by its title. The matched
 * name then drives `useCatalogueInfiniteQuery({ name })` for the rendered results.
 * Only the recognised text ever crosses the boundary as a search string (SC-004);
 * the image never leaves the device.
 *
 * @returns the documented `CardScannerViewProps` bundle.
 */
const useCardScanner = (): UseCardScannerResult => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { cameraRef, permissionStatus, requestPermission, capture, pickFromLibrary, torchEnabled, toggleTorch } =
    useCardCapture();

  const [phase, setPhase] = useState<ScanPhase>('ready');
  const [candidateName, setCandidateName] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<ScanMode>('single');

  // Live scroll offset of the match list, tracked so the pull-to-dismiss gesture
  // can tell whether the list is at the top. A ref (not state) — it changes every
  // scroll frame and must not re-render.
  const matchScrollOffset = useRef(0);

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

  // Try each recognised candidate (top-most first) against the catalogue and
  // return the first name that has ≥1 card, or `undefined` when none match.
  // Probes go through `queryClient.fetchQuery` so concurrent/repeat reads dedupe
  // and cache; a per-candidate throw (network/4xx) is treated as "not this block"
  // and the loop moves on rather than failing the whole scan.
  const findFirstMatchingName = useCallback(
    async (names: ReadonlyArray<string>): Promise<string | undefined> => {
      for (const name of names.slice(0, MAX_SCAN_CANDIDATES)) {
        try {
          const result = await queryClient.fetchQuery({
            queryKey: ['catalogue', 'scan-probe', name] as const,
            queryFn: () => apiClient.searchCards({ name, page: 1, limit: SCAN_PROBE_LIMIT }),
            staleTime: PROBE_STALE_MS,
          });
          if (result.cards.length > 0) return name;
        } catch {
          // Not a catalogue card (or a transient read failure) — try the next.
        }
      }
      return undefined;
    },
    [queryClient],
  );

  // Shared tail for both capture sources: a typed `CaptureResult` → recognise →
  // probe each candidate → set the matched name (reactive query renders it).
  // Recognition errors surface as `recognitionError` (the service already logged
  // the original cause — Principle VIII), never swallowed.
  const processCapture = useCallback(
    async (result: CaptureResult): Promise<void> => {
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
        // Probe each candidate; the winner feeds the reactive query. With no
        // match we still surface the top candidate so `noMatch` names what we
        // read and the reactive query confirms zero results.
        setPhase('searching');
        const matchedName = await findFirstMatchingName(recognition.candidateNames);
        setCandidateName(matchedName ?? recognition.candidateNames[0]);
      } catch {
        setPhase('recognitionError');
      }
    },
    [findFirstMatchingName],
  );

  const onCapture = useCallback(async (): Promise<void> => {
    matchScrollOffset.current = 0;
    setCandidateName(undefined);
    setPhase('capturing');
    const result = await capture();
    await processCapture(result);
  }, [capture, processCapture]);

  const onPickFromLibrary = useCallback(async (): Promise<void> => {
    matchScrollOffset.current = 0;
    setCandidateName(undefined);
    await processCapture(await pickFromLibrary());
  }, [pickFromLibrary, processCapture]);

  const onRequestPermission = useCallback(async (): Promise<void> => {
    await requestPermission();
    setPhase('ready');
  }, [requestPermission]);

  const onRetry = useCallback((): void => {
    matchScrollOffset.current = 0;
    setCandidateName(undefined);
    setPhase('ready');
  }, []);

  // Track the match list's scroll position so the dismiss gesture knows when it
  // is at the top.
  const onMatchListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      matchScrollOffset.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );

  // Pull-to-dismiss: at the top of the list, a committed downward drag dismisses
  // the results back to the viewfinder (same effect as Retry). The capture gate
  // only steals the touch from the ScrollView when the list is already at the
  // top and the finger is travelling down, so normal scrolling is untouched.
  const matchListPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          matchScrollOffset.current <= SCROLL_TOP_EPSILON &&
          gesture.dy > PULL_ACTIVATE_DISTANCE &&
          gesture.dy > Math.abs(gesture.dx),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > PULL_DISMISS_DISTANCE) onRetry();
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [onRetry],
  );

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
      matchListPanHandlers: matchListPanResponder.panHandlers,
      onMatchListScroll,
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
      matchListPanResponder,
      onMatchListScroll,
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
