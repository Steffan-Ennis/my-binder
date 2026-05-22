import type { CardRecord, SearchResult } from '@my-binder/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createElement } from 'react';

import * as apiModule from '@src/services/api/apiClient';
import { CatalogueProvider, useCatalogueContext } from '@src/context/catalogue-context';
import { useSessionStore } from '@src/stores/sessionStore';
import { SLOTS_PER_BINDER_PAGE } from '@src/utils/pageMath';

import useCatalogue from './useCatalogue';

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

// `useCatalogue` now reads the committed filter set from `CatalogueProvider`,
// so every render must be wrapped in it (in addition to the query client).
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client },
    createElement(CatalogueProvider, null, children),
  );

const makeCard = (id: string, name: string, numberOwned?: number): CardRecord => ({
  id,
  name,
  set: 'M11',
  cardNumber: '1',
  manaCost: null,
  colorIdentity: [],
  ...(numberOwned !== undefined && { numberOwned }),
});

const makePage = (page: number, cards: CardRecord[], totalPages: number, total: number): SearchResult => ({
  cards,
  total,
  page,
  limit: SLOTS_PER_BINDER_PAGE,
  totalPages,
});

beforeEach(() => {
  mockNavigate.mockReset();
  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.spyOn(apiModule.apiClient, 'searchCards').mockReset();
  jest.spyOn(apiModule.apiClient, 'upsertCard').mockReset();
  jest.spyOn(apiModule.apiClient, 'patchCard').mockReset();
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

// Helper — type a search query into the hook so it threads through to the
// wire `filters.name` (US1's catalogue fetches only when a name is provided;
// US2 will extend this with chip-driven dimensions).
const typeQuery = (
  result: { current: ReturnType<typeof useCatalogue> },
  text: string,
): void => {
  act(() => result.current.onSearchOpen());
  act(() => result.current.onSearchChange(text));
};

describe('useCatalogue', () => {
  describe('view-prop derivation (US1)', () => {
    it('exposes summaryCaption "N+ MATCHES · 9 PER PAGE" while hasNextPage=true', async () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(
          makePage(1, [makeCard('1', 'a'), makeCard('2', 'b')], 5, 45),
        );
      const { result } = renderHook(() => useCatalogue(), { wrapper });
      typeQuery(result, 'a');
      await waitFor(() =>
        expect(result.current.summaryCaption).toBe('2+ MATCHES · 9 PER PAGE'),
      );
    });

    it('exposes summaryCaption "N MATCHES · M PAGES" when the result set is exhausted', async () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(
          makePage(1, [makeCard('1', 'a'), makeCard('2', 'b')], 1, 2),
        );
      const { result } = renderHook(() => useCatalogue(), { wrapper });
      typeQuery(result, 'a');
      await waitFor(() =>
        expect(result.current.summaryCaption).toBe('2 MATCHES · 1 PAGE'),
      );
    });

    it('singular forms render for total=1 and totalPages=1', async () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [makeCard('1', 'a')], 1, 1));
      const { result } = renderHook(() => useCatalogue(), { wrapper });
      typeQuery(result, 'a');
      await waitFor(() =>
        expect(result.current.summaryCaption).toBe('1 MATCH · 1 PAGE'),
      );
    });

    it('starts in a dashed-caption "awaiting search" state on mount (FR-005 gate)', () => {
      const spy = jest.spyOn(apiModule.apiClient, 'searchCards');
      const { result } = renderHook(() => useCatalogue(), { wrapper });
      expect(result.current.summaryCaption).toBe('— MATCHES · — PER PAGE');
      expect(result.current.pages).toEqual([]);
      expect(spy).not.toHaveBeenCalled();
    });

    it('renders the dashed caption while loading', () => {
      let resolve: (v: SearchResult) => void = () => {};
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockImplementation(() => new Promise((r) => { resolve = r; }));
      const { result } = renderHook(() => useCatalogue(), { wrapper });
      expect(result.current.summaryCaption).toBe('— MATCHES · — PER PAGE');
      resolve(makePage(1, [], 1, 0));
    });

    it('onPagerSelected advances currentPage', async () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [], 1, 0));
      const { result } = renderHook(() => useCatalogue(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.currentPage).toBe(1);
      act(() => result.current.onPagerSelected(2));
      expect(result.current.currentPage).toBe(2);
    });

    it('onProfilePress navigates to /profile', async () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [], 1, 0));
      const { result } = renderHook(() => useCatalogue(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => result.current.onProfilePress());
      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });

    it('search toggle: onSearchOpen → onSearchClose round-trip clears the query', async () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [], 1, 0));
      const { result } = renderHook(() => useCatalogue(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isSearchActive).toBe(false);
      act(() => result.current.onSearchOpen());
      expect(result.current.isSearchActive).toBe(true);

      act(() => result.current.onSearchChange('bolt'));
      expect(result.current.searchQuery).toBe('bolt');
      expect(result.current.hasActiveQuery).toBe(true);

      act(() => result.current.onSearchClose());
      expect(result.current.isSearchActive).toBe(false);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.hasActiveQuery).toBe(false);
    });
  });

  describe('filter sheet + pills (US2)', () => {
    // The committed filter set lives in `CatalogueProvider`; render the hook
    // alongside the context so a test can both seed filters (`ctx.applyFilter`)
    // and read them back (`ctx.filters`).
    const renderWithCtx = () =>
      renderHook(() => ({ cat: useCatalogue(), ctx: useCatalogueContext() }), {
        wrapper,
      });

    it('filterPills derives one pill per active dimension', () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [], 1, 0));
      const { result } = renderWithCtx();


      act(() =>
        result.current.ctx.applyFilter({
          ...result.current.ctx.filters,
          formats: ['Modern'],
          colors: ['R'],
        }),
      );
    });

    it('onFilterClear resets every dimension to EMPTY_FILTER_SET', () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [], 1, 0));
      const { result } = renderWithCtx();

      act(() =>
        result.current.ctx.applyFilter({
          ...result.current.ctx.filters,
          formats: ['Modern'],
          missingOnly: true,
        }),
      );
      act(() => result.current.cat.onFilterClear());

      expect(result.current.ctx.filters.formats).toEqual([]);
      expect(result.current.ctx.filters.missingOnly).toBe(false);
    });

    it('onFilterSheetOpen navigates to the filter-modal route', () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [], 1, 0));
      const { result } = renderHook(() => useCatalogue(), { wrapper });

      act(() => result.current.onFilterSheetOpen());
      expect(mockNavigate).toHaveBeenCalledWith('/catalogue/filter-modal');
    });

    it('resets to page 1 when a non-name filter is applied (e.g. from the modal)', () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [], 1, 0));
      const { result } = renderWithCtx();

      act(() => result.current.cat.onPagerSelected(3));
      expect(result.current.cat.currentPage).toBe(3);

      act(() =>
        result.current.ctx.applyFilter({
          ...result.current.ctx.filters,
          formats: ['Modern'],
        }),
      );
      expect(result.current.cat.currentPage).toBe(1);
    });

    it('preserves the current page when only the search name changes', async () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [], 1, 0));
      const { result } = renderWithCtx();

      act(() => result.current.cat.onPagerSelected(2));
      expect(result.current.cat.currentPage).toBe(2);

      act(() => result.current.cat.onSearchChange('ab'));
      await waitFor(() => expect(result.current.ctx.filters.name).toBe('ab'));
      expect(result.current.cat.currentPage).toBe(2);
    });
  });

  describe('return-value reference stability (constitution v1.16.0)', () => {
    it('returns identity-stable callbacks across re-renders with no input change', async () => {
      jest
        .spyOn(apiModule.apiClient, 'searchCards')
        .mockResolvedValue(makePage(1, [makeCard('1', 'a')], 1, 1));

      const { result, rerender } = renderHook(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (_key: number) => useCatalogue(),
        { wrapper, initialProps: 0 },
      );
      typeQuery(result, 'a');
      // Wait for the underlying query to settle so `pages` derives from `query.data`.
      await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));
      const first = result.current;
      rerender(1);
      expect(result.current.onSearchOpen).toBe(first.onSearchOpen);
      expect(result.current.onProfilePress).toBe(first.onProfilePress);
      expect(result.current.onRefreshPress).toBe(first.onRefreshPress);
      expect(result.current.pages).toBe(first.pages);
    });
  });
});
