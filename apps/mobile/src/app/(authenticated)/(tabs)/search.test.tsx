import { render, screen } from '@testing-library/react-native';

import Search from './search';

jest.mock('@src/components/catalogue/CatalogueContainer', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native') as typeof import('react-native');
  return {
    CatalogueContainer: () => React.createElement(View, { testID: 'catalogue-container' }),
  };
});

describe('search route shell (spec 018)', () => {
  it('renders <CatalogueContainer />', () => {
    render(<Search />);
    expect(screen.getByTestId('catalogue-container')).toBeOnTheScreen();
  });
});
