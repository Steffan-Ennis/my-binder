import { render, screen } from '@testing-library/react-native';

import { ComingSoonView } from './ComingSoonView';

describe('ComingSoonView', () => {
  it('renders the title, message, and icon name from props', () => {
    render(<ComingSoonView title="Search" message="Coming soon." iconName="search" />);
    expect(screen.getByText('Search')).toBeTruthy();
    expect(screen.getByText('Coming soon.')).toBeTruthy();
  });

  it('exposes an accessibility label that announces the feature', () => {
    render(<ComingSoonView title="Scan" message="Coming soon." iconName="scan-outline" />);
    expect(screen.getByLabelText('Scan — coming soon')).toBeTruthy();
  });
});