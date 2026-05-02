import { render, screen } from '@testing-library/react-native';

import Scan from './scan';

describe('scan route shell', () => {
  it('renders <ComingSoonContainer feature="scan" />', () => {
    render(<Scan />);
    expect(screen.getByText('Scan')).toBeTruthy();
  });
});