import { render, screen } from '@testing-library/react-native';

import CatalogueContainer from './CatalogueContainer';
import type { CatalogueViewProps } from './types';

const mockUseCatalogue = jest.fn();
jest.mock('./useCatalogue', () => ({
  __esModule: true,
  default: () => mockUseCatalogue(),
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
  const callbacks = () => ({
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
  });

  it('wires every documented view-prop field to <CatalogueView /> by name (no spread)', () => {
    const cb = callbacks();

    mockUseCatalogue.mockReturnValue({
      pages: [],
      currentPage: 1,
      totalPages: null,
      summaryCaption: 'CAP',
      error: null,
      hasNextPage: false,
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      isEmpty: false,
      isSearchActive: false,
      searchQuery: '',
      hasActiveQuery: false,
      filterPills: [],
      resultsAreStale: false,
      ...cb,
    });

    render(<CatalogueContainer />);

    expect(screen.getByTestId('catalogue-view-stub')).toBeOnTheScreen();
    expect(capturedViewProps).toEqual({
      pages: [],
      currentPage: 1,
      totalPages: null,
      summaryCaption: 'CAP',
      error: null,
      hasNextPage: false,
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      isEmpty: false,
      isSearchActive: false,
      searchQuery: '',
      hasActiveQuery: false,
      filterPills: [],
      resultsAreStale: false,
      onSearchOpen: cb.onSearchOpen,
      onSearchChange: cb.onSearchChange,
      onSearchClose: cb.onSearchClose,
      onProfilePress: cb.onProfilePress,
      onPagerSelected: cb.onPagerSelected,
      onRetryPress: cb.onRetryPress,
      onFilterSheetOpen: cb.onFilterSheetOpen,
      onFilterClear: cb.onFilterClear,
      onFilterPillRemove: cb.onFilterPillRemove,
      onRefreshPress: cb.onRefreshPress,
    });
  });
});
