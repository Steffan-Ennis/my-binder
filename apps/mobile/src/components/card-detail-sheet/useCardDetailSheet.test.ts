import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import { ApiError } from '@src/services/api/ApiError';
import * as apiModule from '@src/services/api/apiClient';
import { useSessionStore } from '@src/stores/sessionStore';

import {
  CARD_FIXTURE,
  CARD_FIXTURE_UNOWNED,
  FIXTURE_PRINTING_ID,
  HISTORY_ALL_EMPTY,
  HISTORY_BOTH_SERIES,
  PRICES_ALL_EMPTY,
  PRICES_BOTH_PRESENT,
  PRICES_ONE_SOURCE_NULL,
} from './fixtures';
import useCardDetailSheet from './useCardDetailSheet';

jest.mock('@src/hooks/useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

const ID = FIXTURE_PRINTING_ID;

let client: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client }, children);

const mockRouter = (overrides: Record<string, jest.Mock> = {}) => {
  const router = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), ...overrides };
  (useRouter as jest.Mock).mockReturnValue(router);
  return router;
};

beforeEach(() => {
  useSessionStore.setState({ jwt: 'tok', iat: 1, userId: 'u', email: 'e@x.com', status: 'active' });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mockRouter();
  jest.spyOn(apiModule.apiClient, 'getCard').mockResolvedValue(CARD_FIXTURE);
  jest.spyOn(apiModule.apiClient, 'getCardPrices').mockResolvedValue(PRICES_BOTH_PRESENT);
  jest.spyOn(apiModule.apiClient, 'getCardPriceHistory').mockResolvedValue(HISTORY_BOTH_SERIES);
  jest.spyOn(apiModule.apiClient, 'patchCard').mockResolvedValue({ status: 200, card: CARD_FIXTURE });
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
  jest.restoreAllMocks();
});

describe('useCardDetailSheet', () => {
  describe('price rows (FR-002)', () => {
    it('derives three rows — CK + TCGP live values and a disabled Goldfish placeholder', async () => {
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.pricesStatus).toBe('ready'));

      const byKey = Object.fromEntries(result.current.priceRows.map((row) => [row.key, row]));
      expect(byKey.cardKingdom.display).toBe('$17.23');
      expect(byKey.tcgPlayer.display).toBe('$16.38');
      expect(byKey.mtgGoldfish.display).toBe('Coming soon');
      expect(byKey.mtgGoldfish.disabled).toBe(true);
      expect(byKey.cardKingdom.disabled).toBe(false);
      // Always exactly three rows, in CK / Goldfish / TCGP order.
      expect(result.current.priceRows.map((row) => row.key)).toEqual([
        'cardKingdom',
        'mtgGoldfish',
        'tcgPlayer',
      ]);
    });

    it("renders '—' for a missing live quote (FR-004)", async () => {
      jest.spyOn(apiModule.apiClient, 'getCardPrices').mockResolvedValue(PRICES_ONE_SOURCE_NULL);
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.pricesStatus).toBe('ready'));

      const tcgp = result.current.priceRows.find((row) => row.key === 'tcgPlayer');
      expect(tcgp?.display).toBe('—');
    });

    it("maps both-null prices to pricesStatus 'empty'", async () => {
      jest.spyOn(apiModule.apiClient, 'getCardPrices').mockResolvedValue(PRICES_ALL_EMPTY);
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.pricesStatus).toBe('empty'));
    });
  });

  describe('chart series (FR-003 — Goldfish is never a series)', () => {
    it('derives exactly the two live series from the history', async () => {
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.historyStatus).toBe('ready'));

      expect(result.current.chartSeries.map((series) => series.key)).toEqual([
        'cardKingdom',
        'tcgPlayer',
      ]);
      expect(result.current.chartSeries.every((series) => series.data.length > 0)).toBe(true);
    });

    it('always exposes a three-entry legend with the Goldfish entry disabled', async () => {
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.historyStatus).toBe('ready'));

      expect(result.current.chartLegend).toHaveLength(3);
      const goldfish = result.current.chartLegend.find((entry) => entry.label === 'MTG Goldfish');
      expect(goldfish?.disabled).toBe(true);
    });

    it("maps both-empty history to historyStatus 'empty' with no series", async () => {
      jest.spyOn(apiModule.apiClient, 'getCardPriceHistory').mockResolvedValue(HISTORY_ALL_EMPTY);
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.historyStatus).toBe('empty'));
      expect(result.current.chartSeries).toEqual([]);
    });
  });

  describe('identity (FR-001)', () => {
    it('derives name, set label, and type line from the detail query', async () => {
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.name).toBe('Bloodthirsty Conqueror');
      expect(result.current.setLabel).toBe('The Lost Caverns of Ixalan · LCI');
      expect(result.current.typeLine).toBe('Legendary Creature — Demon');
    });
  });

  describe('section status mapping (FR-008 / FR-009)', () => {
    it("maps a pending prices query to 'loading'", () => {
      jest
        .spyOn(apiModule.apiClient, 'getCardPrices')
        .mockReturnValue(new Promise(() => {}) as Promise<never>);
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      expect(result.current.pricesStatus).toBe('loading');
    });

    it("maps a failed history query to 'error'", async () => {
      jest.spyOn(apiModule.apiClient, 'getCardPriceHistory').mockRejectedValue(
        new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' }),
      );
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.historyStatus).toBe('error'));
    });
  });

  describe('ownership stepper (FR-007 / FR-011)', () => {
    it('increments via the binder mutation and invalidates only the detail key', async () => {
      const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
      const patchSpy = jest.spyOn(apiModule.apiClient, 'patchCard');
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      act(() => {
        result.current.onIncrement();
      });

      await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(ID, { delta: 1 }));
      await waitFor(() =>
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cards', 'detail', ID] }),
      );
    });

    it('decrements when copies are owned', async () => {
      const patchSpy = jest.spyOn(apiModule.apiClient, 'patchCard');
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.canDecrement).toBe(true));

      act(() => {
        result.current.onDecrement();
      });
      await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(ID, { delta: -1 }));
    });

    it('treats − as a no-op at a count of 0', async () => {
      jest.spyOn(apiModule.apiClient, 'getCard').mockResolvedValue(CARD_FIXTURE_UNOWNED);
      const patchSpy = jest.spyOn(apiModule.apiClient, 'patchCard');
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.canDecrement).toBe(false);

      act(() => {
        result.current.onDecrement();
      });
      expect(patchSpy).not.toHaveBeenCalled();
    });
  });

  describe('handlers', () => {
    it('onClose pops the sheet route via router.back()', () => {
      const back = jest.fn();
      mockRouter({ back });
      const { result } = renderHook(() => useCardDetailSheet({ printingId: ID }), { wrapper });
      act(() => {
        result.current.onClose();
      });
      expect(back).toHaveBeenCalledTimes(1);
    });
  });

  describe('reference stability (Principle X v1.16.0)', () => {
    it('keeps derived non-primitives and callbacks stable across a no-op rerender', async () => {
      const { result, rerender } = renderHook(() => useCardDetailSheet({ printingId: ID }), {
        wrapper,
      });
      await waitFor(() => expect(result.current.pricesStatus).toBe('ready'));

      const before = {
        priceRows: result.current.priceRows,
        chartSeries: result.current.chartSeries,
        chartLegend: result.current.chartLegend,
        onIncrement: result.current.onIncrement,
        onClose: result.current.onClose,
      };
      rerender({});

      expect(result.current.priceRows).toBe(before.priceRows);
      expect(result.current.chartSeries).toBe(before.chartSeries);
      expect(result.current.chartLegend).toBe(before.chartLegend);
      expect(result.current.onIncrement).toBe(before.onIncrement);
      expect(result.current.onClose).toBe(before.onClose);
    });
  });
});
