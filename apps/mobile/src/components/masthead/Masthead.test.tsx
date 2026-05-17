import { fireEvent, render, screen } from '@testing-library/react-native';
import type { FC } from 'react';
import { Text } from 'react-native';

import Masthead from './Masthead';
import type { MastheadProps } from './types';

const defaults: MastheadProps = {
  subtitle: 'Catalogue',
  searchPlaceholder: 'Search the catalogue',
  isSearchActive: false,
  searchQuery: '',
  hasActiveQuery: false,
  onSearchOpen: jest.fn(),
  onSearchChange: jest.fn(),
  onSearchClose: jest.fn(),
  onProfilePress: jest.fn(),
};

const MastheadWithDefaults: FC<Partial<MastheadProps>> = (overrides) => (
  <Masthead {...defaults} {...overrides} />
);

describe('Masthead — collapsed state (FR-002)', () => {
  it('renders the overline, subtitle, search button, and profile button when not active', () => {
    render(<MastheadWithDefaults subtitle="Binder" />);

    expect(screen.getByText('MY-BINDER')).toBeOnTheScreen();
    expect(screen.getByText('Binder')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Search the binder' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open profile' })).toBeOnTheScreen();
  });

  it('derives the search-button label from the subtitle (catalogue surface)', () => {
    render(<MastheadWithDefaults subtitle="Catalogue" />);
    expect(screen.getByRole('button', { name: 'Search the catalogue' })).toBeOnTheScreen();
  });

  it('fires onSearchOpen when the search button is pressed', () => {
    const onSearchOpen = jest.fn();
    render(<MastheadWithDefaults onSearchOpen={onSearchOpen} />);
    fireEvent.press(screen.getByRole('button', { name: 'Search the catalogue' }));
    expect(onSearchOpen).toHaveBeenCalledTimes(1);
  });

  it('fires onProfilePress when the profile button is pressed', () => {
    const onProfilePress = jest.fn();
    render(<MastheadWithDefaults onProfilePress={onProfilePress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Open profile' }));
    expect(onProfilePress).toHaveBeenCalledTimes(1);
  });

  it('omits the inline search input when not active', () => {
    render(<MastheadWithDefaults />);
    expect(screen.queryByPlaceholderText('Search the catalogue')).toBeNull();
  });
});

describe('Masthead — expanded search state', () => {
  it('renders the inline search input + close button when isSearchActive', () => {
    render(
      <MastheadWithDefaults isSearchActive searchQuery="bolt" />,
    );

    expect(screen.getByPlaceholderText('Search the catalogue')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Close search' })).toBeOnTheScreen();
  });

  it('hides the search + profile buttons while active', () => {
    render(<MastheadWithDefaults isSearchActive />);
    expect(screen.queryByRole('button', { name: 'Search the catalogue' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open profile' })).toBeNull();
  });

  it('fires onSearchChange when the user types', () => {
    const onSearchChange = jest.fn();
    render(<MastheadWithDefaults isSearchActive onSearchChange={onSearchChange} />);
    fireEvent.changeText(screen.getByPlaceholderText('Search the catalogue'), 'bolt');
    expect(onSearchChange).toHaveBeenCalledWith('bolt');
  });

  it('fires onSearchClose when the close button is pressed', () => {
    const onSearchClose = jest.fn();
    render(<MastheadWithDefaults isSearchActive onSearchClose={onSearchClose} />);
    fireEvent.press(screen.getByRole('button', { name: 'Close search' }));
    expect(onSearchClose).toHaveBeenCalledTimes(1);
  });

  it('renders the gold-dot active-query indicator when hasActiveQuery is true', () => {
    render(<MastheadWithDefaults isSearchActive searchQuery="bolt" hasActiveQuery />);
    expect(screen.getByTestId('search-active-indicator')).toBeOnTheScreen();
  });

  it('omits the active-query indicator when hasActiveQuery is false', () => {
    render(<MastheadWithDefaults isSearchActive />);
    expect(screen.queryByTestId('search-active-indicator')).toBeNull();
  });
});

describe('Masthead — filterPills slot', () => {
  it('renders filterPills below the masthead row when provided', () => {
    render(
      <MastheadWithDefaults
        filterPills={<Text testID="filter-pill-row">pills</Text>}
      />,
    );
    expect(screen.getByTestId('filter-pill-row')).toBeOnTheScreen();
  });

  it('does not render a slot wrapper when filterPills is undefined', () => {
    render(<MastheadWithDefaults />);
    expect(screen.queryByTestId('filter-pill-row')).toBeNull();
  });
});
