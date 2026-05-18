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

const makeCard = (id: string, name: string): CardRecord => ({
  id,
  name,
  set: 'M11',
  cardNumber: '1',
  manaCost: null,
  colorIdentity: [],
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
  hasNextPage: false,
  isLoading: false,
  isFetchingNextPage: false,
  isError: false,
  isSearchActive: false,
  searchQuery: '',
  hasActiveQuery: false,
  onSearchOpen: jest.fn(),
  onSearchChange: jest.fn(),
  onSearchClose: jest.fn(),
  onProfilePress: jest.fn(),
  onPagerSelected: jest.fn(),
  onRetryPress: jest.fn(),
};

const CatalogueViewWithDefaults: FC<Partial<CatalogueViewProps>> = (overrides) => (
  <CatalogueView {...defaults} {...overrides} />
);

describe('CatalogueView — masthead + canvas (US1)', () => {
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

  it('renders skeleton pockets while isLoading', () => {
    render(<CatalogueViewWithDefaults isLoading />);
    expect(screen.getAllByTestId('catalogue-skeleton-pocket').length).toBe(9);
  });

  it('populated pockets render the Card component; empty pockets show empty marker', () => {
    render(
      <CatalogueViewWithDefaults
        pages={[onePage([makeCard('1', 'a'), makeCard('2', 'b')])]}
      />,
    );
    expect(screen.getByTestId('card-pocket-1')).toBeOnTheScreen();
    expect(screen.getByTestId('card-pocket-2')).toBeOnTheScreen();
    expect(screen.getAllByTestId('catalogue-pocket-empty').length).toBe(7);
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

describe('CatalogueView — page indicator (FR-010, FR-013)', () => {
  it('renders italic "N of many" while hasNextPage=true', () => {
    render(
      <CatalogueViewWithDefaults
        pages={[onePage([makeCard('1', 'a')])]}
        currentPage={1}
        totalPages={null}
        hasNextPage
      />,
    );
    expect(screen.getByTestId('catalogue-page-indicator')).toHaveTextContent('1 of many');
  });

  it('renders italic "N of M" once the result set is exhausted', () => {
    render(
      <CatalogueViewWithDefaults
        pages={[onePage([makeCard('1', 'a')])]}
        currentPage={1}
        totalPages={3}
        hasNextPage={false}
      />,
    );
    expect(screen.getByTestId('catalogue-page-indicator')).toHaveTextContent('1 of 3');
  });
});

describe('CatalogueView — error state', () => {
  it('renders an error message + Retry button when isError', () => {
    const onRetryPress = jest.fn();
    render(<CatalogueViewWithDefaults isError onRetryPress={onRetryPress} />);

    expect(screen.getByText(/couldn.+t load the catalogue/i)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: /retry loading the catalogue/i }));
    expect(onRetryPress).toHaveBeenCalledTimes(1);
  });
});
