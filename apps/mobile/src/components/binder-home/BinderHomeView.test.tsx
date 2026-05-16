import type { Card } from '@my-binder/core';
import { fireEvent, render } from '@testing-library/react-native';
import { FC } from 'react';

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

const BinderViewWithDefaults: FC<Partial<BinderHomeViewProps>> = (overrides) => (
  <BinderHomeView {...defaults} {...overrides} />
);

describe('BinderHomeView — US1 surface', () => {
  it('renders the masthead overline + italic-serif title', () => {
    const screen = render(<BinderViewWithDefaults cards={[makeCard('1', 'A')]} />);
    expect(screen.getByText('MY-BINDER')).toBeTruthy();
  });

  it('renders header binder-search and Profile buttons with the expected labels (FR-003 → FR-004)', () => {
    const screen = render(<BinderViewWithDefaults cards={[makeCard('1', 'A')]} />);
    expect(screen.getByLabelText('Search the binder')).toBeTruthy();
    expect(screen.getByLabelText('Open profile')).toBeTruthy();
  });

  it('tapping Profile fires onProfilePress (FR-006)', () => {
    const onProfilePress = jest.fn();
    const screen = render(
      <BinderViewWithDefaults cards={[makeCard('1', 'A')]} onProfilePress={onProfilePress} />,
    );
    fireEvent.press(screen.getByLabelText('Open profile'));
    expect(onProfilePress).toHaveBeenCalled();
  });

  it('tapping the binder-search button fires onSearchOpen (FR-005)', () => {
    const onSearchOpen = jest.fn();
    const screen = render(
      <BinderViewWithDefaults cards={[makeCard('1', 'A')]} onSearchOpen={onSearchOpen} />,
    );
    fireEvent.press(screen.getByLabelText('Search the binder'));
    expect(onSearchOpen).toHaveBeenCalled();
  });

  it('renders the summary caption verbatim below the header (FR-008/FR-009)', () => {
    const screen = render(<BinderViewWithDefaults summaryCaption="7 CARDS · 1 PAGE" />);
    expect(screen.getByText('7 CARDS · 1 PAGE')).toBeTruthy();
  });

  it('renders three ring perforations on the binder page surface (FR-013)', () => {
    const screen = render(<BinderViewWithDefaults cards={[makeCard('1', 'A')]} />);
    expect(screen.getAllByTestId('binder-page-ring').length).toBe(3);
  });

  it('renders the dashed-caption + 9 empty pockets on loading state (FR-010, Edge Cases: loading)', () => {
    const screen = render(
      <BinderViewWithDefaults isLoading summaryCaption="— CARDS · — PAGE" />,
    );
    expect(screen.getByText('— CARDS · — PAGE')).toBeTruthy();
    expect(screen.getAllByTestId('pocket-empty').length).toBe(9);
  });

  it('renders an inline retry affordance on network error (Edge Cases: network error)', () => {
    const onRetryPress = jest.fn();
    const screen = render(
      <BinderViewWithDefaults
        isError
        summaryCaption="— CARDS · — PAGE"
        onRetryPress={onRetryPress}
      />,
    );
    const retry = screen.getByLabelText('Retry loading binder');
    expect(retry).toBeTruthy();
    fireEvent.press(retry);
    expect(onRetryPress).toHaveBeenCalled();
  });
});

describe('BinderHomeView — US2 grid + pager', () => {
  const elevenCards = Array.from({ length: 11 }, (_, i) => makeCard(`${i}`, `c${i}`));

  it('renders 9 occupied pockets on page 1 of an 11-card collection', () => {
    const screen = render(
      <BinderViewWithDefaults
        cards={elevenCards}
        matchedCards={elevenCards}
        currentPage={1}
        totalPages={2}
        summaryCaption="11 CARDS · 2 PAGES"
      />,
    );
    expect(screen.getAllByTestId('pocket-occupied').length).toBe(9);
    expect(screen.queryAllByTestId('pocket-empty').length).toBe(0);
  });

  it('renders 2 occupied + 7 empty pockets on page 2 of an 11-card collection (FR-014/15/16/22)', () => {
    const screen = render(
      <BinderViewWithDefaults
        cards={elevenCards}
        matchedCards={elevenCards.slice(8, 10)}
        currentPage={2}
        totalPages={2}
        summaryCaption="11 CARDS · 2 PAGES"
      />,
    );
    expect(screen.getAllByTestId('pocket-occupied').length).toBe(2);
    expect(screen.getAllByTestId('pocket-empty').length).toBe(7);
  });

  it('renders the two-line "Page N" / "OF M" indicator (FR-019)', () => {
    const screen = render(
      <BinderViewWithDefaults
        cards={elevenCards}
        matchedCards={elevenCards}
        currentPage={2}
        totalPages={2}
        summaryCaption="11 CARDS · 2 PAGES"
      />,
    );
    expect(screen.getByText('2 of 2')).toBeTruthy();
  });

  it('the pager fires onPageChange with the 1-based page when scrolled', () => {
    const screen = render(
      <BinderViewWithDefaults
        cards={elevenCards}
        matchedCards={elevenCards}
        currentPage={1}
        totalPages={2}
      />,
    );
    const pager = screen.getByTestId('binder-pager');
    fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
    expect(defaults.handlePagerSelected).toHaveBeenCalledWith({ nativeEvent: { position: 1 } });
  });
});

describe('BinderHomeView — US3 inline search', () => {
  const tenCards = Array.from({ length: 10 }, (_, i) => makeCard(`${i}`, `c${i}`));

  it('replaces the masthead with a TextInput when isSearchActive is true', () => {
    const screen = render(
      <BinderViewWithDefaults
        cards={tenCards}
        matchedCards={tenCards}
        isSearchActive
        searchQuery=""
        currentPage={1}
        totalPages={2}
        summaryCaption="10 CARDS · 2 PAGES"
      />,
    );
    expect(screen.getByLabelText('Search this binder')).toBeTruthy();
    expect(screen.getByLabelText('Clear search')).toBeTruthy();
  });

  it('typing in the inline input fires onSearchChange', () => {
    const onSearchChange = jest.fn();
    const screen = render(
      <BinderViewWithDefaults
        cards={tenCards}
        matchedCards={tenCards}
        isSearchActive
        searchQuery=""
        onSearchChange={onSearchChange}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Search this binder'), 'bolt');
    expect(onSearchChange).toHaveBeenCalledWith('bolt');
  });

  it('tapping the cancel control fires onSearchClear (FR-005f)', () => {
    const onSearchClear = jest.fn();
    const screen = render(
      <BinderViewWithDefaults
        cards={tenCards}
        matchedCards={tenCards}
        isSearchActive
        searchQuery="bolt"
        onSearchClear={onSearchClear}
      />,
    );
    fireEvent.press(screen.getByLabelText('Clear search'));
    expect(onSearchClear).toHaveBeenCalled();
  });

  it('shows the no-matches message when noMatches is true (FR-005d)', () => {
    const screen = render(
      <BinderViewWithDefaults
        cards={tenCards}
        matchedCards={[]}
        isSearchActive
        searchQuery="qqzzxx"
        noMatches
        summaryCaption="0 CARDS · 1 PAGE"
        totalPages={1}
      />,
    );
    expect(screen.getByText('no matches in your binder')).toBeTruthy();
  });

  it('renders an active-state visual indicator on the search affordance when query is non-empty (FR-005b)', () => {
    const screen = render(
      <BinderViewWithDefaults
        cards={tenCards}
        matchedCards={tenCards}
        isSearchActive
        searchQuery="bolt"
        hasActiveQuery
      />,
    );
    const indicator = screen.getByTestId('binder-search-active-indicator');
    expect(indicator).toBeTruthy();
  });
});
