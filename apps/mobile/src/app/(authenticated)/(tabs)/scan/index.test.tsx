import { render, screen } from '@testing-library/react-native';

import ScanIndex from './index';

jest.mock('@src/components/card-scanner', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    CardScannerContainer: () => <View testID="card-scanner-container" />,
  };
});

describe('scan route shell (spec 022)', () => {
  it('renders <CardScannerContainer />', () => {
    render(<ScanIndex />);
    expect(screen.getByTestId('card-scanner-container')).toBeOnTheScreen();
  });
});
