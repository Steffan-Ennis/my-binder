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

let capturedFilterSheetOpen: boolean | null = null;
jest.mock(
  '@src/components/catalogue-filter-sheet/CatalogueFilterSheetContainer',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react') as typeof import('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native') as typeof import('react-native');
    return {
      CatalogueFilterSheetContainer: ({ open }: { open: boolean }) => {
        capturedFilterSheetOpen = open;
        return React.createElement(View, {
          testID: `filter-sheet-${open ? 'open' : 'closed'}`,
        });
      },
    };
  },
);

beforeEach(() => {
  capturedViewProps = null;
  capturedFilterSheetOpen = null;
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
    onFilterSheetClose: jest.fn(),
    onFilterApply: jest.fn(),
    onFilterClear: jest.fn(),
    onFilterPillRemove: jest.fn(),
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
      filters: EMPTY_FILTER_SET,
      filterPills: [],
      filterSheetOpen: false,
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
      onSearchOpen: cb.onSearchOpen,
      onSearchChange: cb.onSearchChange,
      onSearchClose: cb.onSearchClose,
      onProfilePress: cb.onProfilePress,
      onPagerSelected: cb.onPagerSelected,
      onRetryPress: cb.onRetryPress,
      onFilterSheetOpen: cb.onFilterSheetOpen,
      onFilterClear: cb.onFilterClear,
      onFilterPillRemove: cb.onFilterPillRemove,
    });
  });

  it('mounts <CatalogueFilterSheetContainer /> as a sibling reflecting filterSheetOpen', () => {
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
      filters: EMPTY_FILTER_SET,
      filterPills: [],
      filterSheetOpen: true,
      ...callbacks(),
    });

    render(<CatalogueContainer />);

    expect(screen.getByTestId('filter-sheet-open')).toBeOnTheScreen();
    expect(capturedFilterSheetOpen).toBe(true);
  });
});
