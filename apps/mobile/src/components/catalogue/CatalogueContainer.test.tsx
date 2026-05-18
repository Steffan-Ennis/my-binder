import { render, screen } from '@testing-library/react-native';

import CatalogueContainer from './CatalogueContainer';
import { EMPTY_FILTER_SET, type CatalogueViewProps } from './types';

const mockUseCatalogue = jest.fn();
jest.mock('./useCatalogue', () => ({
  useCatalogue: () => mockUseCatalogue(),
}));

let capturedViewProps: CatalogueViewProps | null = null;
jest.mock('./CatalogueView', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: (props: CatalogueViewProps) => {
      capturedViewProps = props;
      return React.createElement(View, { testID: 'catalogue-view-stub' });
    },
  };
});

beforeEach(() => {
  capturedViewProps = null;
  mockUseCatalogue.mockReset();
});

describe('CatalogueContainer — named-props bridge', () => {
  it('wires every documented hook return field to <CatalogueView /> by name (no spread)', () => {
    const callbacks = {
      onSearchOpen: jest.fn(),
      onSearchChange: jest.fn(),
      onSearchClose: jest.fn(),
      onProfilePress: jest.fn(),
      onPagerSelected: jest.fn(),
      onRetryPress: jest.fn(),
      onFilterSheetOpen: jest.fn(),
      onFilterSheetClose: jest.fn(),
      onFilterApply: jest.fn(),
      onFilterClear: jest.fn(),
      onFilterPillRemove: jest.fn(),
    };

    mockUseCatalogue.mockReturnValue({
      pages: [],
      currentPage: 1,
      totalPages: null,
      summaryCaption: 'CAP',
      hasNextPage: false,
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      isEmpty: false,
      isSearchActive: false,
      searchQuery: '',
      hasActiveQuery: false,
      filters: EMPTY_FILTER_SET,
      filterPills: [],
      filterSheetOpen: false,
      ...callbacks,
    });

    render(<CatalogueContainer />);

    expect(screen.getByTestId('catalogue-view-stub')).toBeOnTheScreen();
    expect(capturedViewProps).toEqual({
      pages: [],
      currentPage: 1,
      totalPages: null,
      summaryCaption: 'CAP',
      hasNextPage: false,
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      isEmpty: false,
      isSearchActive: false,
      searchQuery: '',
      hasActiveQuery: false,
      filters: EMPTY_FILTER_SET,
      filterPills: [],
      filterSheetOpen: false,
      ...callbacks,
    });
  });
});
