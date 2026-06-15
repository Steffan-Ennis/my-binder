import { render, screen } from '@testing-library/react-native';

import Catalogue from './catalogue';

jest.mock('@src/components/catalogue/CatalogueContainer', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    CatalogueContainer: () => <View testID="catalogue-container" />,
  };
});

describe('search route shell (spec 018)', () => {
  it('renders <CatalogueContainer />', () => {
    render(<Catalogue />);
    expect(screen.getByTestId('catalogue-container')).toBeOnTheScreen();
  });
});
