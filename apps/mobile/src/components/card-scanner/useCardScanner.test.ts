import type { CardRecord, SearchResult } from '@my-binder/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { PanResponder } from 'react-native';
import type {
  GestureResponderEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponderCallbacks,
  PanResponderGestureState,
} from 'react-native';

import * as apiModule from '@src/services/api/apiClient';
import * as captureModule from '@src/hooks/useCardCapture';
import type { CameraPermissionStatus, CaptureResult } from '@src/hooks/useCardCapture';
import * as recognitionModule from '@src/services/scan/cardTextRecognition';
import { useSessionStore } from '@src/stores/sessionStore';

import useCardScanner from './useCardScanner';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => {
  const router = { navigate: (...args: unknown[]) => mockNavigate(...args) };
  return { useRouter: () => router };
});

jest.mock('@src/hooks/useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

const makeCard = (id: string, name: string): CardRecord => ({
  id,
  name,
  set: 'M11',
  cardNumber: '1',
  manaCost: null,
  colorIdentity: [],
});

const makePage = (cards: CardRecord[]): SearchResult => ({
  cards,
  total: cards.length,
  page: 1,
  limit: 9,
  totalPages: 1,
});

// A reference-stable capture value so the hook's `cameraRef`/handlers stay
// stable across renders (the shared hook is mocked, not exercised here — its
// own behaviour is covered by useCardCapture.test.ts).
let captureValue: captureModule.UseCardCaptureResult;
let captureSpy: jest.SpyInstance<captureModule.UseCardCaptureResult>;
let recognizeSpy: jest.SpyInstance<ReturnType<typeof recognitionModule.recognizeCardName>>;

const setCapture = (overrides: Partial<captureModule.UseCardCaptureResult>) => {
  captureValue = { ...captureValue, ...overrides };
  captureSpy.mockReturnValue(captureValue);
};

const captured = (uri = 'file:///shot.jpg'): CaptureResult => ({ kind: 'captured', uri });

const gesture = (dy: number, dx = 0): PanResponderGestureState =>
  ({
    stateID: 1,
    moveX: 0,
    moveY: 0,
    x0: 0,
    y0: 0,
    dx,
    dy,
    vx: 0,
    vy: 0,
    numberActiveTouches: 1,
  }) as unknown as PanResponderGestureState;

const scrollTo = (y: number): NativeSyntheticEvent<NativeScrollEvent> =>
  ({ nativeEvent: { contentOffset: { y } } }) as unknown as NativeSyntheticEvent<NativeScrollEvent>;

const noEvent = {} as GestureResponderEvent;

beforeEach(() => {
  mockNavigate.mockReset();
  useSessionStore.setState({ jwt: 'tok', iat: 1, userId: 'u', email: 'e@x.com', status: 'active' });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  captureValue = {
    cameraRef: { current: null },
    permissionStatus: 'granted' as CameraPermissionStatus,
    requestPermission: jest.fn(async () => {}),
    capture: jest.fn(async () => captured()),
    pickFromLibrary: jest.fn(async () => captured('file:///pick.jpg')),
    torchEnabled: false,
    toggleTorch: jest.fn(),
  };
  captureSpy = jest.spyOn(captureModule, 'useCardCapture').mockReturnValue(captureValue);
  recognizeSpy = jest
    .spyOn(recognitionModule, 'recognizeCardName')
    .mockResolvedValue({ kind: 'recognized', candidateNames: ['Lightning Bolt'] });
  jest.spyOn(apiModule.apiClient, 'searchCards').mockResolvedValue(makePage([makeCard('1', 'Lightning Bolt')]));
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
});

describe('useCardScanner', () => {
  describe('capture → recognise → search (US1)', () => {
    it('drives the happy path to matches and derives the catalogue cards (FR-004/FR-005)', async () => {
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onCapture();
      });

      expect(captureValue.capture).toHaveBeenCalledTimes(1);
      expect(recognizeSpy).toHaveBeenCalledWith('file:///shot.jpg');
      expect(result.current.candidateName).toBe('Lightning Bolt');

      await waitFor(() => expect(result.current.status).toBe('matches'));
      expect(apiModule.apiClient.searchCards).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Lightning Bolt' }),
      );
      expect(result.current.matches).toEqual([makeCard('1', 'Lightning Bolt')]);
      expect(result.current.reticleTone).toBe('aligned');
    });

    it('probes each recognised block and matches on a later candidate when the first misses', async () => {
      // The OCR's top line is the rules/type text; the real card name is a later
      // candidate. Each block is searched until one hits (the Mishra's Workshop /
      // Survival of the Fittest bug).
      recognizeSpy.mockResolvedValue({
        kind: 'recognized',
        candidateNames: ['Enchantment', 'Survival of the Fittest'],
      });
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockImplementation(async (query) =>
          query.name === 'Survival of the Fittest'
            ? makePage([makeCard('9', 'Survival of the Fittest')])
            : makePage([]),
        );

      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onCapture();
      });

      await waitFor(() => expect(result.current.status).toBe('matches'));
      expect(result.current.candidateName).toBe('Survival of the Fittest');
      expect(result.current.matches).toEqual([makeCard('9', 'Survival of the Fittest')]);
    });

    it('imports from the gallery through the same recognise → search tail', async () => {
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onPickFromLibrary();
      });

      expect(captureValue.pickFromLibrary).toHaveBeenCalledTimes(1);
      expect(recognizeSpy).toHaveBeenCalledWith('file:///pick.jpg');
      await waitFor(() => expect(result.current.status).toBe('matches'));
    });

    it('does not search until a name is recognised (empty filter ⇒ query disabled)', () => {
      const searchSpy = jest.spyOn(apiModule.apiClient, 'searchCards');
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      expect(result.current.status).toBe('ready');
      expect(result.current.candidateName).toBeUndefined();
      expect(searchSpy).not.toHaveBeenCalled();
    });
  });

  describe('non-happy outcomes (FR-007)', () => {
    it('maps a permission-denied capture to permissionDenied', async () => {
      captureValue.capture = jest.fn(async () => ({ kind: 'denied' }) as CaptureResult);
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onCapture();
      });

      expect(result.current.status).toBe('permissionDenied');
      expect(result.current.reticleTone).toBe('error');
    });

    it('renders permissionDenied at rest when the camera permission is denied', () => {
      setCapture({ permissionStatus: 'denied' });
      const { result } = renderHook(() => useCardScanner(), { wrapper });
      expect(result.current.status).toBe('permissionDenied');
    });

    it('maps a no-text recognition to noText', async () => {
      recognizeSpy.mockResolvedValue({ kind: 'noText' });
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onCapture();
      });

      expect(result.current.status).toBe('noText');
      expect(result.current.candidateName).toBeUndefined();
    });

    it('maps a recognition throw to recognitionError (does not crash)', async () => {
      recognizeSpy.mockRejectedValue(new recognitionModule.TextRecognitionError('boom'));
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onCapture();
      });

      expect(result.current.status).toBe('recognitionError');
    });

    it('maps a zero-result search to noMatch (FR-007)', async () => {
      jest.spyOn(apiModule.apiClient, 'searchCards').mockResolvedValue(makePage([]));
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onCapture();
      });

      await waitFor(() => expect(result.current.status).toBe('noMatch'));
      expect(result.current.matches).toEqual([]);
    });

    it('returns to ready when a gallery import is cancelled', async () => {
      captureValue.pickFromLibrary = jest.fn(async () => ({ kind: 'cancelled' }) as CaptureResult);
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onPickFromLibrary();
      });

      expect(result.current.status).toBe('ready');
      expect(recognizeSpy).not.toHaveBeenCalled();
    });

    it('maps an unsupported recognition result to unsupported', async () => {
      recognizeSpy.mockResolvedValue({ kind: 'unsupported' });
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onCapture();
      });

      expect(result.current.status).toBe('unsupported');
    });

    it('onRetry returns to the ready viewfinder and clears the candidate', async () => {
      recognizeSpy.mockResolvedValue({ kind: 'noText' });
      const { result } = renderHook(() => useCardScanner(), { wrapper });

      await act(async () => {
        await result.current.onCapture();
      });
      expect(result.current.status).toBe('noText');

      act(() => result.current.onRetry());
      expect(result.current.status).toBe('ready');
      expect(result.current.candidateName).toBeUndefined();
    });
  });

  describe('pull-to-dismiss the match list', () => {
    const driveToMatches = async () => {
      const createSpy = jest.spyOn(PanResponder, 'create');
      const rendered = renderHook(() => useCardScanner(), { wrapper });
      await act(async () => {
        await rendered.result.current.onCapture();
      });
      await waitFor(() => expect(rendered.result.current.status).toBe('matches'));
      const config = createSpy.mock.calls.at(-1)![0] as PanResponderCallbacks;
      return { ...rendered, config };
    };

    it('captures a downward pull only when scrolled to the top', async () => {
      const { result, config } = await driveToMatches();
      const pull = gesture(120, 4);

      // Scrolled down into the list → the ScrollView keeps the gesture.
      act(() => result.current.onMatchListScroll(scrollTo(500)));
      expect(config.onMoveShouldSetPanResponderCapture!(noEvent, pull)).toBe(false);

      // At the top → the downward drag is taken over for dismissal.
      act(() => result.current.onMatchListScroll(scrollTo(0)));
      expect(config.onMoveShouldSetPanResponderCapture!(noEvent, pull)).toBe(true);
    });

    it('does not capture a mostly-horizontal drag at the top', async () => {
      const { result, config } = await driveToMatches();
      act(() => result.current.onMatchListScroll(scrollTo(0)));
      // dx dominates dy → a horizontal swipe, not a pull-down.
      expect(config.onMoveShouldSetPanResponderCapture!(noEvent, gesture(30, 80))).toBe(false);
    });

    it('dismisses to the viewfinder when a committed pull is released', async () => {
      const { result, config } = await driveToMatches();
      act(() => result.current.onMatchListScroll(scrollTo(0)));

      act(() => {
        config.onPanResponderRelease!(noEvent, gesture(120));
      });

      expect(result.current.status).toBe('ready');
      expect(result.current.candidateName).toBeUndefined();
    });

    it('keeps the results when the pull is too short to dismiss', async () => {
      const { result, config } = await driveToMatches();
      act(() => result.current.onMatchListScroll(scrollTo(0)));

      act(() => {
        config.onPanResponderRelease!(noEvent, gesture(40));
      });

      expect(result.current.status).toBe('matches');
      expect(result.current.candidateName).toBe('Lightning Bolt');
    });
  });

  describe('navigation + mode + torch', () => {
    it('onSelectMatch navigates to the scan card-detail route with the printing id (FR-006)', () => {
      const { result } = renderHook(() => useCardScanner(), { wrapper });
      act(() => result.current.onSelectMatch('6ca7af0b-4b6a-59ba-90be-6da4f62bcff1'));
      expect(mockNavigate).toHaveBeenCalledWith({
        pathname: '/scan/card-detail',
        params: { id: '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1' },
      });
    });

    it('onSelectMatch is a no-op for an empty printing id', () => {
      const { result } = renderHook(() => useCardScanner(), { wrapper });
      act(() => result.current.onSelectMatch(''));
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('defaults to single mode and ignores selecting the disabled Multi mode', () => {
      const { result } = renderHook(() => useCardScanner(), { wrapper });
      expect(result.current.mode).toBe('single');
      act(() => result.current.onSelectMode('multi'));
      expect(result.current.mode).toBe('single');
      // Selecting the (already active) Single segment runs the setter path.
      act(() => result.current.onSelectMode('single'));
      expect(result.current.mode).toBe('single');
    });

    it('onRequestPermission delegates to the shared hook', async () => {
      const { result } = renderHook(() => useCardScanner(), { wrapper });
      await act(async () => {
        await result.current.onRequestPermission();
      });
      expect(captureValue.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('onToggleTorch is wired to the shared hook toggle', () => {
      const { result } = renderHook(() => useCardScanner(), { wrapper });
      act(() => result.current.onToggleTorch());
      expect(captureValue.toggleTorch).toHaveBeenCalledTimes(1);
    });
  });

  describe('reference stability (constitution v1.16.0)', () => {
    it('keeps callbacks and cameraRef identity-stable across re-renders', () => {
      const { result, rerender } = renderHook((_k: number) => useCardScanner(), {
        wrapper,
        initialProps: 0,
      });
      const first = result.current;
      rerender(1);
      expect(result.current.onCapture).toBe(first.onCapture);
      expect(result.current.onPickFromLibrary).toBe(first.onPickFromLibrary);
      expect(result.current.onSelectMatch).toBe(first.onSelectMatch);
      expect(result.current.onSelectMode).toBe(first.onSelectMode);
      expect(result.current.cameraRef).toBe(first.cameraRef);
      expect(result.current.matchListPanHandlers).toBe(first.matchListPanHandlers);
      expect(result.current.onMatchListScroll).toBe(first.onMatchListScroll);
    });
  });
});
