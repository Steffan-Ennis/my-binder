import type { Card } from '@my-binder/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react-native';
import { FC } from 'react';

import type { MastheadProps } from '@src/components/masthead/types';
import { useSessionStore } from '@src/stores/sessionStore';

import BinderHomeView, { type BinderHomeViewProps } from './BinderHomeView';

jest.mock('@src/hooks/useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

const IMAGES = {
  small: 'https://example/s.jpg',
  medium: 'https://example/m.jpg',
  large: 'https://example/l.jpg',
};

const makeCard = (id: string, name: string, extras: Partial<Card> = {}): Card => ({
  id,
  name,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  ...extras,
});

const defaultMasthead: MastheadProps = {
  subtitle: 'Binder',
  searchPlaceholder: 'Search this binder',
  isSearchActive: false,
  searchQuery: '',
  hasActiveQuery: false,
  onSearchOpen: jest.fn(),
  onSearchChange: jest.fn(),
  onSearchClose: jest.fn(),
  onProfilePress: jest.fn(),
};

const defaults: BinderHomeViewProps = {
  cards: [],
  matchedCards: [],
  currentPage: 1,
  totalPages: 1,
  summaryCaption: '0 CARDS · 1 PAGE',
  noMatches: false,
  isLoading: false,
  isError: false,
  isSearchActive: false,
  searchQuery: '',
  hasActiveQuery: false,
  handlePagerSelected: jest.fn(),
  onRetryPress: jest.fn(),
  onCardPress: jest.fn(),
  mastheadProps: defaultMasthead,
};

let client: QueryClient;

const seedImages = (cards: ReadonlyArray<Card>) => {
  for (const c of cards) {
    client.setQueryData(['cards', 'images', c.id], IMAGES);
  }
};

const BinderViewWithDefaults: FC<Partial<BinderHomeViewProps> & {
  mastheadOverrides?: Partial<MastheadProps>;
}> = ({ mastheadOverrides, ...overrides }) => (
  <QueryClientProvider client={client}>
    <BinderHomeView
      {...defaults}
      {...overrides}
      mastheadProps={{ ...defaultMasthead, ...(mastheadOverrides ?? {}) }}
    />
  </QueryClientProvider>
);

beforeEach(() => {
  useSessionStore.setState({
    jwt: 'tok',
    iat: 1,
    userId: 'u',
    email: 'e@x.com',
    status: 'active',
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('BinderHomeView', () => {
  describe('US1 surface — Masthead adoption (FR-022)', () => {
    it('renders the shared Masthead overline + Binder subtitle', () => {
      seedImages([makeCard('1', 'A')]);
      const screen = render(<BinderViewWithDefaults cards={[makeCard('1', 'A')]} />);
      expect(screen.getByText('MY-BINDER')).toBeTruthy();
      expect(screen.getByText('Binder')).toBeTruthy();
    });

    it('renders search and Profile buttons via the Masthead', () => {
      seedImages([makeCard('1', 'A')]);
      const screen = render(<BinderViewWithDefaults cards={[makeCard('1', 'A')]} />);
      expect(screen.getByLabelText('Search the binder')).toBeTruthy();
      expect(screen.getByLabelText('Open profile')).toBeTruthy();
    });

    it('tapping Profile fires mastheadProps.onProfilePress', () => {
      const onProfilePress = jest.fn();
      seedImages([makeCard('1', 'A')]);
      const screen = render(
        <BinderViewWithDefaults
          cards={[makeCard('1', 'A')]}
          mastheadOverrides={{ onProfilePress }}
        />,
      );
      fireEvent.press(screen.getByLabelText('Open profile'));
      expect(onProfilePress).toHaveBeenCalled();
    });

    it('tapping the binder-search button fires mastheadProps.onSearchOpen', () => {
      const onSearchOpen = jest.fn();
      seedImages([makeCard('1', 'A')]);
      const screen = render(
        <BinderViewWithDefaults
          cards={[makeCard('1', 'A')]}
          mastheadOverrides={{ onSearchOpen }}
        />,
      );
      fireEvent.press(screen.getByLabelText('Search the binder'));
      expect(onSearchOpen).toHaveBeenCalled();
    });

    it('renders the summary caption verbatim below the masthead', () => {
      const screen = render(<BinderViewWithDefaults summaryCaption="7 CARDS · 1 PAGE" />);
      expect(screen.getByText('7 CARDS · 1 PAGE')).toBeTruthy();
    });

    it('renders three ring perforations on the binder page surface', () => {
      seedImages([makeCard('1', 'A')]);
      const screen = render(<BinderViewWithDefaults cards={[makeCard('1', 'A')]} />);
      expect(screen.getAllByTestId('binder-page-ring').length).toBe(3);
    });

    it('renders the dashed-caption + 9 empty pockets on loading state', () => {
      const screen = render(
        <BinderViewWithDefaults isLoading summaryCaption="— CARDS · — PAGE" />,
      );
      expect(screen.getByText('— CARDS · — PAGE')).toBeTruthy();
      expect(screen.getAllByTestId('pocket-empty').length).toBe(9);
    });

    it('renders an inline retry affordance on network error', () => {
      const onRetryPress = jest.fn();
      const screen = render(
        <BinderViewWithDefaults
          isError
          summaryCaption="— CARDS · — PAGE"
          onRetryPress={onRetryPress}
        />,
      );
      const retry = screen.getByLabelText('Retry loading binder');
      expect(retry).toBeTruthy();
      fireEvent.press(retry);
      expect(onRetryPress).toHaveBeenCalled();
    });
  });

  describe('US2 grid + pager', () => {
    const elevenCards = Array.from({ length: 11 }, (_, i) => makeCard(`${i}`, `c${i}`));

    it('renders 9 occupied pockets on page 1 of an 11-card collection', () => {
      seedImages(elevenCards);
      const screen = render(
        <BinderViewWithDefaults
          cards={elevenCards}
          matchedCards={elevenCards}
          currentPage={1}
          totalPages={2}
          summaryCaption="11 CARDS · 2 PAGES"
        />,
      );
      expect(screen.getAllByTestId('pocket-occupied').length).toBe(9);
      expect(screen.queryAllByTestId('pocket-empty').length).toBe(0);
    });


    it('renders the two-line "Page N" / "OF M" indicator (FR-019)', () => {
      seedImages(elevenCards);
      const screen = render(
        <BinderViewWithDefaults
          cards={elevenCards}
          matchedCards={elevenCards}
          currentPage={2}
          totalPages={2}
          summaryCaption="11 CARDS · 2 PAGES"
        />,
      );
      expect(screen.getByText('2 of 2')).toBeTruthy();
    });

    it('the pager fires onPageChange with the 1-based page when scrolled', () => {
      seedImages(elevenCards);
      const handlePagerSelected = jest.fn();
      const screen = render(
        <BinderViewWithDefaults
          cards={elevenCards}
          matchedCards={elevenCards}
          currentPage={1}
          totalPages={2}
          handlePagerSelected={handlePagerSelected}
        />,
      );
      const pager = screen.getByTestId('binder-pager');
      fireEvent(pager, 'pageSelected', { nativeEvent: { position: 1 } });
      expect(handlePagerSelected).toHaveBeenCalledWith({ nativeEvent: { position: 1 } });
    });
  });

  describe('US3 inline search (via Masthead)', () => {
    const tenCards = Array.from({ length: 10 }, (_, i) => makeCard(`${i}`, `c${i}`));

    it('Masthead exposes a TextInput when isSearchActive is true', () => {
      seedImages(tenCards);
      const screen = render(
        <BinderViewWithDefaults
          cards={tenCards}
          matchedCards={tenCards}
          isSearchActive
          searchQuery=""
          currentPage={1}
          totalPages={2}
          summaryCaption="10 CARDS · 2 PAGES"
          mastheadOverrides={{ isSearchActive: true, searchQuery: '' }}
        />,
      );
      expect(screen.getByLabelText('Search this binder')).toBeTruthy();
      expect(screen.getByLabelText('Close search')).toBeTruthy();
    });

    it('typing in the masthead input fires mastheadProps.onSearchChange', () => {
      const onSearchChange = jest.fn();
      seedImages(tenCards);
      const screen = render(
        <BinderViewWithDefaults
          cards={tenCards}
          matchedCards={tenCards}
          isSearchActive
          searchQuery=""
          mastheadOverrides={{ isSearchActive: true, searchQuery: '', onSearchChange }}
        />,
      );
      fireEvent.changeText(screen.getByLabelText('Search this binder'), 'bolt');
      expect(onSearchChange).toHaveBeenCalledWith('bolt');
    });

    it('tapping the close control fires mastheadProps.onSearchClose (FR-005f)', () => {
      const onSearchClose = jest.fn();
      seedImages(tenCards);
      const screen = render(
        <BinderViewWithDefaults
          cards={tenCards}
          matchedCards={tenCards}
          isSearchActive
          searchQuery="bolt"
          mastheadOverrides={{ isSearchActive: true, searchQuery: 'bolt', onSearchClose }}
        />,
      );
      fireEvent.press(screen.getByLabelText('Close search'));
      expect(onSearchClose).toHaveBeenCalled();
    });

    it('shows the no-matches message when noMatches is true (FR-005d)', () => {
      const screen = render(
        <BinderViewWithDefaults
          cards={tenCards}
          matchedCards={[]}
          isSearchActive
          searchQuery="qqzzxx"
          noMatches
          summaryCaption="0 CARDS · 1 PAGE"
          totalPages={1}
          mastheadOverrides={{ isSearchActive: true, searchQuery: 'qqzzxx' }}
        />,
      );
      expect(screen.getByText('no matches in your binder')).toBeTruthy();
    });

    it('renders an active-query visual indicator when hasActiveQuery is true', () => {
      seedImages(tenCards);
      const screen = render(
        <BinderViewWithDefaults
          cards={tenCards}
          matchedCards={tenCards}
          isSearchActive
          searchQuery="bolt"
          hasActiveQuery
          mastheadOverrides={{
            isSearchActive: true,
            searchQuery: 'bolt',
            hasActiveQuery: true,
          }}
        />,
      );
      const indicator = screen.getByTestId('search-active-indicator');
      expect(indicator).toBeTruthy();
    });
  });
});
