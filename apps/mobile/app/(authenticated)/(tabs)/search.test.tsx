import { render, screen } from '@testing-library/react-native';

import Search from './search';

describe('search route shell', () => {
  it('renders <ComingSoonContainer feature="search" />', () => {
    render(<Search />);
    expect(screen.getByText('Search')).toBeTruthy();
  });
});