import type { Card } from '@my-binder/core';
import { act, renderHook } from '@testing-library/react-native';

import * as cardsHookModule from '@src/hooks/useCardsInfiniteQuery';

import { useBinderHome } from './useBinderHome';

const mockNavigate = jest.fn();
const mockRouter = {
  navigate: mockNavigate,
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

const makeCard = (id: string, name: string, extras: Partial<Card> = {}): Card => ({
  id,
  name,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  ...extras,
});

type MockQueryState = {
  cards: Card[];
  isLoading?: boolean;
  isError?: boolean;
  refetch?: jest.Mock;
};

const setQueryMock = ({ cards, isLoading = false, isError = false, refetch }: MockQueryState): jest.Mock => {
  const refetchFn = refetch ?? jest.fn();
  jest.spyOn(cardsHookModule, 'useCardsInfiniteQuery').mockReturnValue({
    data: { pages: [{ cards, total: cards.length, nextCursor: null }], pageParams: [undefined] },
    isLoading,
    isError,
    error: isError ? new Error('boom') : null,
    refetch: refetchFn,
  } as unknown as ReturnType<typeof cardsHookModule.useCardsInfiniteQuery>);
  return refetchFn;
};

const pagerEvent = (zeroBasedPosition: number) =>
  ({ nativeEvent: { position: zeroBasedPosition } }) as Parameters<
    ReturnType<typeof useBinderHome>['handlePagerSelected']
  >[0];

beforeEach(() => {
  mockNavigate.mockReset();
  jest.spyOn(cardsHookModule, 'useCardsInfiniteQuery').mockReset();
});

describe('useBinderHome — US1 surface', () => {
  it('returns the documented shape with stable references across re-renders', () => {
    setQueryMock({ cards: [makeCard('1', 'A'), makeCard('2', 'B')] });
    const { result, rerender } = renderHook(() => useBinderHome());

    const first = result.current;
    expect(first).toEqual(
      expect.objectContaining({
        cards: expect.any(Array),
        matchedCards: expect.any(Array),
        currentPage: expect.any(Number),
        totalPages: expect.any(Number),
        summaryCaption: expect.any(String),
        noMatches: expect.any(Boolean),
        isLoading: expect.any(Boolean),
        isError: expect.any(Boolean),
        isSearchActive: expect.any(Boolean),
        searchQuery: expect.any(String),
        onSearchOpen: expect.any(Function),
        onSearchChange: expect.any(Function),
        onSearchClear: expect.any(Function),
        handlePagerSelected: expect.any(Function),
        onProfilePress: expect.any(Function),
        onRetryPress: expect.any(Function),
      }),
    );

    rerender({});
    const second = result.current;
    // Functions and arrays must be reference-stable per Principle X v1.16.0
    expect(second.onProfilePress).toBe(first.onProfilePress);
    expect(second.onRetryPress).toBe(first.onRetryPress);
    expect(second.handlePagerSelected).toBe(first.handlePagerSelected);
    expect(second.onSearchOpen).toBe(first.onSearchOpen);
    expect(second.onSearchChange).toBe(first.onSearchChange);
    expect(second.onSearchClear).toBe(first.onSearchClear);
    expect(second.cards).toBe(first.cards);
    expect(second.matchedCards).toBe(first.matchedCards);
  });

  it('renders the dashes summary while loading (FR-010)', () => {
    setQueryMock({ cards: [], isLoading: true });
    const { result } = renderHook(() => useBinderHome());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.summaryCaption).toBe('— CARDS · — PAGE');
  });

  it('renders the dashes summary on error and sets isError true', () => {
    setQueryMock({ cards: [], isError: true });
    const { result } = renderHook(() => useBinderHome());
    expect(result.current.isError).toBe(true);
    expect(result.current.summaryCaption).toBe('— CARDS · — PAGE');
  });

  it('formats the summary caption — 0 cards', () => {
    setQueryMock({ cards: [] });
    const { result } = renderHook(() => useBinderHome());
    expect(result.current.summaryCaption).toBe('0 CARDS · 1 PAGE');
  });

  it('formats the summary caption — 1 card / 1 page', () => {
    setQueryMock({ cards: [makeCard('1', 'A')] });
    const { result } = renderHook(() => useBinderHome());
    expect(result.current.summaryCaption).toBe('1 CARD · 1 PAGE');
  });

  it('formats the summary caption — 7 cards / 1 page', () => {
    setQueryMock({ cards: Array.from({ length: 7 }, (_, i) => makeCard(`${i}`, `c${i}`)) });
    const { result } = renderHook(() => useBinderHome());
    expect(result.current.summaryCaption).toBe('7 CARDS · 1 PAGE');
  });

  it('formats the summary caption — 11 cards / 2 pages (plural pages)', () => {
    setQueryMock({ cards: Array.from({ length: 11 }, (_, i) => makeCard(`${i}`, `c${i}`)) });
    const { result } = renderHook(() => useBinderHome());
    expect(result.current.summaryCaption).toBe('11 CARDS · 2 PAGES');
  });

  it('onProfilePress calls router.navigate with /profile (FR-006)', () => {
    setQueryMock({ cards: [makeCard('1', 'A')] });
    const { result } = renderHook(() => useBinderHome());
    act(() => result.current.onProfilePress());
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('onRetryPress calls the underlying refetch', () => {
    const refetch = setQueryMock({ cards: [], isError: true });
    const { result } = renderHook(() => useBinderHome());
    act(() => result.current.onRetryPress());
    expect(refetch).toHaveBeenCalled();
  });
});

describe('useBinderHome — US2 paging surface', () => {
  it('starts on page 1', () => {
    setQueryMock({ cards: Array.from({ length: 11 }, (_, i) => makeCard(`${i}`, `c${i}`)) });
    const { result } = renderHook(() => useBinderHome());
    expect(result.current.currentPage).toBe(1);
  });

  it('totalPages is ceil(cards.length/9) against the unfiltered set', () => {
    setQueryMock({ cards: Array.from({ length: 11 }, (_, i) => makeCard(`${i}`, `c${i}`)) });
    const { result } = renderHook(() => useBinderHome());
    expect(result.current.totalPages).toBe(2);
  });

  it('handlePagerSelected updates currentPage to position+1', () => {
    setQueryMock({ cards: Array.from({ length: 30 }, (_, i) => makeCard(`${i}`, `c${i}`)) });
    const { result } = renderHook(() => useBinderHome());
    act(() => result.current.handlePagerSelected(pagerEvent(2)));
    expect(result.current.currentPage).toBe(3);
  });

  it('handlePagerSelected clamps to totalPages', () => {
    setQueryMock({ cards: Array.from({ length: 11 }, (_, i) => makeCard(`${i}`, `c${i}`)) });
    const { result } = renderHook(() => useBinderHome());
    act(() => result.current.handlePagerSelected(pagerEvent(99)));
    expect(result.current.currentPage).toBe(2);
  });

  it('handlePagerSelected clamps to 1 on negative position', () => {
    setQueryMock({ cards: Array.from({ length: 30 }, (_, i) => makeCard(`${i}`, `c${i}`)) });
    const { result } = renderHook(() => useBinderHome());
    act(() => result.current.handlePagerSelected(pagerEvent(-5)));
    expect(result.current.currentPage).toBe(1);
  });

  it('currentPage retains its value across re-renders (background-survival proxy)', () => {
    setQueryMock({ cards: Array.from({ length: 30 }, (_, i) => makeCard(`${i}`, `c${i}`)) });
    const { result, rerender } = renderHook(() => useBinderHome());
    act(() => result.current.handlePagerSelected(pagerEvent(1)));
    expect(result.current.currentPage).toBe(2);
    rerender({});
    expect(result.current.currentPage).toBe(2);
  });
});

describe('useBinderHome — US3 search surface', () => {
  const corpus = [
    makeCard('1', 'Lightning Bolt', { setName: 'M10', setCode: 'M10', typeLine: 'Instant' }),
    makeCard('2', 'Counterspell', { setName: 'MM3', setCode: 'MM3', typeLine: 'Instant' }),
    makeCard('3', 'Shivan Dragon', { setName: 'M10', setCode: 'M10', typeLine: 'Creature' }),
  ];

  it('onSearchOpen sets isSearchActive=true with empty query and snaps currentPage to 1', () => {
    setQueryMock({ cards: corpus });
    const { result } = renderHook(() => useBinderHome());

    act(() => result.current.onSearchOpen());

    expect(result.current.isSearchActive).toBe(true);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.currentPage).toBe(1);
  });

  it('onSearchChange recomputes matchedCards via the binderSearch filter (FR-005a/e)', () => {
    setQueryMock({ cards: corpus });
    const { result } = renderHook(() => useBinderHome());

    act(() => result.current.onSearchOpen());
    act(() => result.current.onSearchChange('bolt'));

    expect(result.current.searchQuery).toBe('bolt');
    expect(result.current.matchedCards.map((c) => c.id)).toEqual(['1']);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.summaryCaption).toBe('1 CARD · 1 PAGE');
  });

  it('zero-match query yields noMatches=true and the 0 CARDS · 1 PAGE caption (FR-005d)', () => {
    setQueryMock({ cards: corpus });
    const { result } = renderHook(() => useBinderHome());
    act(() => result.current.onSearchOpen());
    act(() => result.current.onSearchChange('qqzzxx'));

    expect(result.current.matchedCards.length).toBe(0);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.noMatches).toBe(true);
    expect(result.current.summaryCaption).toBe('0 CARDS · 1 PAGE');
  });

  it('whitespace-only query is treated as inactive (no filter, noMatches=false)', () => {
    setQueryMock({ cards: corpus });
    const { result } = renderHook(() => useBinderHome());
    act(() => result.current.onSearchOpen());
    act(() => result.current.onSearchChange('   '));

    expect(result.current.matchedCards.length).toBe(corpus.length);
    expect(result.current.noMatches).toBe(false);
  });

  it('onSearchClear restores currentPage to the page captured on open (FR-005c/f)', () => {
    setQueryMock({ cards: Array.from({ length: 30 }, (_, i) => makeCard(`${i}`, `c${i}`)) });
    const { result } = renderHook(() => useBinderHome());

    act(() => result.current.handlePagerSelected(pagerEvent(2))); // page 3
    expect(result.current.currentPage).toBe(3);

    act(() => result.current.onSearchOpen());
    expect(result.current.currentPage).toBe(1);

    act(() => result.current.onSearchChange('something'));
    act(() => result.current.onSearchClear());

    expect(result.current.isSearchActive).toBe(false);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.currentPage).toBe(3);
  });
});
