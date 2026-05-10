import type { Card } from '@my-binder/core';
import { fireEvent, render } from '@testing-library/react-native';

import BinderHomeView, { type BinderHomeViewProps } from './BinderHomeView';

const makeCard = (id: string, name: string): Card => ({
  id,
  name,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  frontFaceImageUrl: `https://img/${id}.png`,
});

const defaults: BinderHomeViewProps = {
  cards: [],
  matchedCards: [],
  currentPage: 1,
  totalPages: 1,
  summaryCaption: '0 CARDS · 1 PAGE',
  noMatches: false,
  isLoading: false,
  isError: false,
  isSearchActive: false,
  searchQuery: '',
  hasActiveQuery: false,
  handlePagerSelected: jest.fn(),
  onSearchOpen: jest.fn(),
  onSearchChange: jest.fn(),
  onSearchClear: jest.fn(),
  onProfilePress: jest.fn(),
  onRetryPress: jest.fn(),
};

const renderView = (overrides: Partial<BinderHomeViewProps> = {}) =>
  render(<BinderHomeView {...defaults} {...overrides} />);

describe('BinderHomeView — US1 surface', () => {
  it('renders the masthead overline + italic-serif title', () => {
    const screen = renderView({ cards: [makeCard('1', 'A')] });
    expect(screen.getByText('MY-BINDER')).toBeTruthy();
    expect(screen.getByText('My Binder')).toBeTruthy();
  });

  it('renders header binder-search and Profile buttons with the expected labels (FR-003 → FR-004)', () => {
    const screen = renderView({ cards: [makeCard('1', 'A')] });
    expect(screen.getByLabelText('Search the binder')).toBeTruthy();
    expect(screen.getByLabelText('Open profile')).toBeTruthy();
  });

  it('tapping Profile fires onProfilePress (FR-006)', () => {
    const onProfilePress = jest.fn();
    const screen = renderView({ cards: [makeCard('1', 'A')], onProfilePress });
    fireEvent.press(screen.getByLabelText('Open profile'));
    expect(onProfilePress).toHaveBeenCalled();
  });

  it('tapping the binder-search button fires onSearchOpen (FR-005)', () => {
    const onSearchOpen = jest.fn();
    const screen = renderView({ cards: [makeCard('1', 'A')], onSearchOpen });
    fireEvent.press(screen.getByLabelText('Search the binder'));
    expect(onSearchOpen).toHaveBeenCalled();
  });

  it('renders the summary caption verbatim below the header (FR-008/FR-009)', () => {
    const screen = renderView({ summaryCaption: '7 CARDS · 1 PAGE' });
    expect(screen.getByText('7 CARDS · 1 PAGE')).toBeTruthy();
  });

  it('renders three ring perforations on the binder page surface (FR-013)', () => {
    const screen = renderView({ cards: [makeCard('1', 'A')] });
    expect(screen.getAllByTestId('binder-page-ring').length).toBe(3);
  });

  it('renders the dashed-caption + 9 empty pockets on loading state (FR-010, Edge Cases: loading)', () => {
    const screen = renderView({ isLoading: true, summaryCaption: '— CARDS · — PAGE' });
    expect(screen.getByText('— CARDS · — PAGE')).toBeTruthy();
    expect(screen.getAllByTestId('pocket-empty').length).toBe(9);
  });

  it('renders an inline retry affordance on network error (Edge Cases: network error)', () => {
    const onRetryPress = jest.fn();
    const screen = renderView({
      isError: true,
      summaryCaption: '— CARDS · — PAGE',
      onRetryPress,
    });
    const retry = screen.getByLabelText('Retry loading binder');
    expect(retry).toBeTruthy();
    fireEvent.press(retry);
    expect(onRetryPress).toHaveBeenCalled();
  });
});

describe('BinderHomeView — US2 grid + pager', () => {
  const elevenCards = Array.from({ length: 11 }, (_, i) => makeCard(`${i}`, `c${i}`));

  it('renders 9 occupied pockets on page 1 of an 11-card collection', () => {
    const screen = renderView({
      cards: elevenCards,
      matchedCards: elevenCards,
      currentPage: 1,
      totalPages: 2,
      summaryCaption: '11 CARDS · 2 PAGES',
    });
    expect(screen.getAllByTestId('pocket-occupied').length).toBe(9);
    expect(screen.queryAllByTestId('pocket-empty').length).toBe(0);
  });

  it('renders 2 occupied + 7 empty pockets on page 2 of an 11-card collection (FR-014/15/16/22)', () => {
    const screen = renderView({
      cards: elevenCards,
      matchedCards: elevenCards,
      currentPage: 2,
      totalPages: 2,
      summaryCaption: '11 CARDS · 2 PAGES',
    });
    expect(screen.getAllByTestId('pocket-occupied').length).toBe(2);
    expect(screen.getAllByTestId('pocket-empty').length).toBe(7);
  });

  it('renders the two-line "Page N" / "OF M" indicator (FR-019)', () => {
    const screen = renderView({
      cards: elevenCards,
      matchedCards: elevenCards,
      currentPage: 2,
      totalPages: 2,
      summaryCaption: '11 CARDS · 2 PAGES',
    });
    expect(screen.getByText('Page 2')).toBeTruthy();
    expect(screen.getByText('OF 2')).toBeTruthy();
  });

  it('disables prev on first page (no-op, FR-020)', () => {
    const onPrevPage = jest.fn();
    const screen = renderView({
      cards: elevenCards,
      matchedCards: elevenCards,
      currentPage: 1,
      totalPages: 2,
      onPrevPage,
    });
    const prev = screen.getByLabelText('Previous page');
    expect(prev.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(prev);
    expect(onPrevPage).not.toHaveBeenCalled();
  });

  it('disables next on last page (no-op, FR-020)', () => {
    const onNextPage = jest.fn();
    const screen = renderView({
      cards: elevenCards,
      matchedCards: elevenCards,
      currentPage: 2,
      totalPages: 2,
      onNextPage,
    });
    const next = screen.getByLabelText('Next page');
    expect(next.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(next);
    expect(onNextPage).not.toHaveBeenCalled();
  });

  it('next button fires onNextPage when not on the last page', () => {
    const onNextPage = jest.fn();
    const screen = renderView({
      cards: elevenCards,
      matchedCards: elevenCards,
      currentPage: 1,
      totalPages: 2,
      onNextPage,
    });
    fireEvent.press(screen.getByLabelText('Next page'));
    expect(onNextPage).toHaveBeenCalled();
  });

  it('prev button fires onPrevPage when not on the first page', () => {
    const onPrevPage = jest.fn();
    const screen = renderView({
      cards: elevenCards,
      matchedCards: elevenCards,
      currentPage: 2,
      totalPages: 2,
      onPrevPage,
    });
    fireEvent.press(screen.getByLabelText('Previous page'));
    expect(onPrevPage).toHaveBeenCalled();
  });

  it('the pager fires onPageChange with the 1-based page when scrolled', () => {
    const onPageChange = jest.fn();
    const screen = renderView({
      cards: elevenCards,
      matchedCards: elevenCards,
      currentPage: 1,
      totalPages: 2,
      onPageChange,
    });
    const pager = screen.getByTestId('binder-pager');
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe('BinderHomeView — US3 inline search', () => {
  const tenCards = Array.from({ length: 10 }, (_, i) => makeCard(`${i}`, `c${i}`));

  it('replaces the masthead with a TextInput when isSearchActive is true', () => {
    const screen = renderView({
      cards: tenCards,
      matchedCards: tenCards,
      isSearchActive: true,
      searchQuery: '',
      currentPage: 1,
      totalPages: 2,
      summaryCaption: '10 CARDS · 2 PAGES',
    });
    expect(screen.getByLabelText('Search this binder')).toBeTruthy();
    expect(screen.getByLabelText('Clear search')).toBeTruthy();
  });

  it('typing in the inline input fires onSearchChange', () => {
    const onSearchChange = jest.fn();
    const screen = renderView({
      cards: tenCards,
      matchedCards: tenCards,
      isSearchActive: true,
      searchQuery: '',
      onSearchChange,
    });
    fireEvent.changeText(screen.getByLabelText('Search this binder'), 'bolt');
    expect(onSearchChange).toHaveBeenCalledWith('bolt');
  });

  it('tapping the cancel control fires onSearchClear (FR-005f)', () => {
    const onSearchClear = jest.fn();
    const screen = renderView({
      cards: tenCards,
      matchedCards: tenCards,
      isSearchActive: true,
      searchQuery: 'bolt',
      onSearchClear,
    });
    fireEvent.press(screen.getByLabelText('Clear search'));
    expect(onSearchClear).toHaveBeenCalled();
  });

  it('shows the no-matches message when noMatches is true (FR-005d)', () => {
    const screen = renderView({
      cards: tenCards,
      matchedCards: [],
      isSearchActive: true,
      searchQuery: 'qqzzxx',
      noMatches: true,
      summaryCaption: '0 CARDS · 1 PAGE',
      totalPages: 1,
    });
    expect(screen.getByText('no matches in your binder')).toBeTruthy();
  });

  it('renders an active-state visual indicator on the search affordance when query is non-empty (FR-005b)', () => {
    const screen = renderView({
      cards: tenCards,
      matchedCards: tenCards,
      isSearchActive: true,
      searchQuery: 'bolt',
    });
    const indicator = screen.getByTestId('binder-search-active-indicator');
    expect(indicator).toBeTruthy();
  });
});
