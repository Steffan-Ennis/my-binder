import { render, screen } from '@testing-library/react-native';

import CatalogueContainer from './CatalogueContainer';
import type { CatalogueViewProps } from './types';

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
    const onSearchOpen = jest.fn();
    const onSearchChange = jest.fn();
    const onSearchClose = jest.fn();
    const onProfilePress = jest.fn();
    const onPagerSelected = jest.fn();
    const onRetryPress = jest.fn();

    mockUseCatalogue.mockReturnValue({
      pages: [],
      currentPage: 1,
      totalPages: null,
      summaryCaption: 'CAP',
      hasNextPage: false,
      isLoading: false,
      isFetchingNextPage: false,
      isError: false,
      isSearchActive: false,
      searchQuery: '',
      hasActiveQuery: false,
      onSearchOpen,
      onSearchChange,
      onSearchClose,
      onProfilePress,
      onPagerSelected,
      onRetryPress,
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
      isSearchActive: false,
      searchQuery: '',
      hasActiveQuery: false,
      onSearchOpen,
      onSearchChange,
      onSearchClose,
      onProfilePress,
      onPagerSelected,
      onRetryPress,
    });
  });
});
