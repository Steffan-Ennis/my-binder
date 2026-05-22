import type { CardRecord } from '@my-binder/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { FC } from 'react';

import CatalogueView from './CatalogueView';
import type { CataloguePage, CatalogueViewProps } from './types';

jest.mock('@src/components/card', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native') as typeof import('react-native');
  const Card = ({ id }: { id: string; footprint: 'pocket' | 'detail' }) =>
    React.createElement(View, { testID: `card-pocket-${id}` });
  return { Card };
});

const makeCard = (id: string, name: string, numberOwned?: number): CardRecord => ({
  id,
  name,
  set: 'M11',
  cardNumber: '1',
  manaCost: null,
  colorIdentity: [],
  ...(numberOwned !== undefined && { numberOwned }),
});

const onePage = (cards: CardRecord[], pageNumber = 1): CataloguePage => ({
  pageNumber,
  cards,
  isPlaceholder: false,
});

const defaults: CatalogueViewProps = {
  pages: [],
  currentPage: 1,
  totalPages: null,
  summaryCaption: '— MATCHES · — PER PAGE',
  error: null,
  isLoading: false,
  isFetchingNextPage: false,
  isError: false,
  isEmpty: false,
  isSearchActive: false,
  searchQuery: '',
  hasActiveQuery: false,
  resultsAreStale: false,
  onSearchOpen: jest.fn(),
  onSearchChange: jest.fn(),
  onSearchClose: jest.fn(),
  onProfilePress: jest.fn(),
  onPagerSelected: jest.fn(),
  onRetryPress: jest.fn(),
  onFilterSheetOpen: jest.fn(),
  onFilterClear: jest.fn(),
  onFilterPillRemove: jest.fn(),
  onRefreshPress: jest.fn(),
};

const CatalogueViewWithDefaults: FC<Partial<CatalogueViewProps>> = (overrides) => (
  <CatalogueView {...defaults} {...overrides} />
);

describe('CatalogueView', () => {
  describe('masthead + canvas (US1)', () => {
    it('renders the Catalogue subtitle in the masthead', () => {
      render(<CatalogueViewWithDefaults />);
      expect(screen.getByText('Catalogue')).toBeOnTheScreen();
    });

    it('renders the summary caption', () => {
      render(<CatalogueViewWithDefaults summaryCaption="2 MATCHES · 1 PAGE" />);
      expect(screen.getByText('2 MATCHES · 1 PAGE')).toBeOnTheScreen();
    });

    it('renders the binder page surface and the ring column', () => {
      render(<CatalogueViewWithDefaults pages={[onePage([makeCard('1', 'a')])]} />);
      expect(screen.getByTestId('catalogue-page-surface')).toBeOnTheScreen();
      expect(screen.getAllByTestId('catalogue-page-ring').length).toBe(3);
    });


    it('does NOT render flanking arrow buttons (FR-010 / 2026-05-17 Clarification)', () => {
      render(
        <CatalogueViewWithDefaults
          pages={[onePage([makeCard('1', 'a')])]}
          currentPage={1}
          totalPages={1}
        />,
      );
      expect(screen.queryByRole('button', { name: /previous page/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /next page/i })).toBeNull();
    });
  });

  describe('page indicator (FR-010, FR-013)', () => {

    it('renders italic "N of M" once the result set is exhausted', () => {
      render(
        <CatalogueViewWithDefaults
          pages={[onePage([makeCard('1', 'a')])]}
          currentPage={1}
          totalPages={3}
        />,
      );
      expect(screen.getByTestId('catalogue-page-indicator')).toHaveTextContent('1 of 3');
    });
  });

  describe('error state', () => {
    it('renders an error message + Retry button when isError', () => {
      const onRetryPress = jest.fn();
      render(<CatalogueViewWithDefaults isError onRetryPress={onRetryPress} />);

      expect(screen.getByText(/couldn.+t load the catalogue/i)).toBeOnTheScreen();
      fireEvent.press(screen.getByRole('button', { name: /retry loading the catalogue/i }));
      expect(onRetryPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('filter pills + sheet (US2)', () => {
    it('renders the filter pill row with the Filters opener', () => {
      render(<CatalogueViewWithDefaults />);
      expect(screen.getByTestId('catalogue-filter-pill-row')).toBeOnTheScreen();
      expect(screen.getByTestId('filter-opener-pill')).toBeOnTheScreen();
    });
    it('tapping the Filters opener fires onFilterSheetOpen', () => {
      const onFilterSheetOpen = jest.fn();
      render(<CatalogueViewWithDefaults onFilterSheetOpen={onFilterSheetOpen} />);
      fireEvent.press(screen.getByTestId('filter-opener-pill'));
      expect(onFilterSheetOpen).toHaveBeenCalledTimes(1);
    });

    it('renders the empty state with Clear filters affordance when isEmpty (FR-015)', () => {
      const onFilterClear = jest.fn();
      render(
        <CatalogueViewWithDefaults
          isEmpty
          onFilterClear={onFilterClear}
        />,
      );
      expect(screen.getByTestId('catalogue-empty-state')).toBeOnTheScreen();
      expect(screen.getByText(/no cards match these filters/i)).toBeOnTheScreen();
      fireEvent.press(screen.getByRole('button', { name: /clear filters/i }));
      expect(onFilterClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('pocket glyphs + refresh banner (US4)', () => {
    it('renders the refresh banner only when resultsAreStale=true', () => {
      const { rerender } = render(<CatalogueViewWithDefaults resultsAreStale={false} />);
      expect(screen.queryByTestId('catalogue-refresh-hint')).toBeNull();

      rerender(<CatalogueViewWithDefaults resultsAreStale />);
      expect(screen.getByTestId('catalogue-refresh-hint')).toBeOnTheScreen();
    });

    it('tapping the refresh banner fires onRefreshPress (FR-031)', () => {
      const onRefreshPress = jest.fn();
      render(<CatalogueViewWithDefaults resultsAreStale onRefreshPress={onRefreshPress} />);
      fireEvent.press(screen.getByTestId('catalogue-refresh-hint'));
      expect(onRefreshPress).toHaveBeenCalledTimes(1);
    });
  });
});
