// Spec 020 T007 — CardDetailSheetView (mock-first, presentational).
//
// Covers identity (FR-001), three price rows incl. the disabled Goldfish
// placeholder (FR-002), the `− N +` stepper with `−` disabled at 0 (FR-007),
// skeleton placeholders while loading (FR-008), inline error + retry distinct
// from the empty-data annotation (FR-009), and a11y labels (FR-010). The
// 30-day trend chart is deferred (see the view header); the section renders the
// "no recent price data" annotation when empty and a "coming soon" placeholder
// otherwise. Dismissal is the form-sheet's native swipe-down, so there is no
// in-sheet close control to test. `render(...)` is only ever called inside
// `it(...)`; shared defaults live in the module-scope
// `CardDetailSheetViewWithDefaults` wrapper (canonical reference:
// `BinderHomeView.test.tsx`).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react-native';
import { FC } from 'react';

import { useSessionStore } from '@src/stores/sessionStore';

import { CARD_FIXTURE } from './fixtures';
import CardDetailSheetView from './CardDetailSheetView';
import type {
  CardDetailSheetViewProps,
  ChartLegendEntry,
  ChartSeries,
  PriceRowModel,
} from './types';

// The hero embeds <CardContainer />, which fetches its image via
// useCardImagesQuery (TanStack + session). Mirror BinderHomeView.test.tsx:
// drive useSession from the real store and wrap renders in a QueryClient whose
// image data is pre-seeded, so the view stays a pure presentational render.
jest.mock('@src/hooks/useSession', () => {
  const { useSessionStore: store } = jest.requireActual('@src/stores/sessionStore');
  return {
    useSession: () => {
      const s = store.getState();
      return { status: s.status, userId: s.userId, email: s.email, jwt: s.jwt };
    },
  };
});

const CARD_ID = '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1';

const PRICE_ROWS: PriceRowModel[] = [
  { key: 'cardKingdom', label: 'Card Kingdom', display: '$17.23', swatchColor: '#c9a86b', disabled: false },
  { key: 'mtgGoldfish', label: 'MTG Goldfish', display: 'Coming soon', swatchColor: '#a6797a', disabled: true },
  { key: 'tcgPlayer', label: 'TCG Player', display: '$16.38', swatchColor: '#e9b5b5', disabled: false },
];

const CHART_SERIES: ChartSeries[] = [
  { key: 'cardKingdom', label: 'Card Kingdom', color: '#c9a86b', data: [{ value: 17.23 }] },
  { key: 'tcgPlayer', label: 'TCG Player', color: '#e9b5b5', data: [{ value: 16.38 }] },
];

const CHART_LEGEND: ChartLegendEntry[] = [
  { label: 'Card Kingdom', color: '#c9a86b', disabled: false },
  { label: 'MTG Goldfish', color: '#a6797a', disabled: true },
  { label: 'TCG Player', color: '#e9b5b5', disabled: false },
];

const defaults: CardDetailSheetViewProps = {
  id: CARD_ID,
  error: null,
  isLoading: false,
  isSuccess: true,
  name: CARD_FIXTURE.name,
  setLabel: 'The Lost Caverns of Ixalan · LCI',
  typeLine: CARD_FIXTURE.typeLine,
  oracle: 'Whenever an opponent loses life, you gain that much life.',
  numberOwned: 2,
  canDecrement: true,
  onIncrement: jest.fn(),
  onDecrement: jest.fn(),
  priceRows: PRICE_ROWS,
  pricesStatus: 'ready',
  onRetryPrices: jest.fn(),
  chartSeries: CHART_SERIES,
  chartLegend: CHART_LEGEND,
  historyStatus: 'ready',
  onRetryHistory: jest.fn(),
  onClose: jest.fn(),
};

let client: QueryClient;

const CardDetailSheetViewWithDefaults: FC<Partial<CardDetailSheetViewProps>> = (overrides) => (
  <QueryClientProvider client={client}>
    <CardDetailSheetView {...defaults} {...overrides} />
  </QueryClientProvider>
);

beforeEach(() => {
  useSessionStore.setState({ jwt: 'tok', iat: 1, userId: 'u', email: 'e@x.com', status: 'active' });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Pre-seed the hero image so <CardContainer /> resolves without a fetch.
  client.setQueryData(['cards', 'images', CARD_ID], {
    small: 'https://example/s.jpg',
    medium: 'https://example/m.jpg',
    large: 'https://example/l.jpg',
  });
});

afterEach(() => {
  client.cancelQueries();
  client.clear();
  client.unmount();
});

describe('CardDetailSheetView', () => {
  describe('identity header (FR-001)', () => {
    it('renders name, set, type line, and oracle text', () => {
      const screen = render(<CardDetailSheetViewWithDefaults />);
      expect(screen.getByText('Bloodthirsty Conqueror')).toBeTruthy();
      expect(screen.getByText('The Lost Caverns of Ixalan · LCI')).toBeTruthy();
      expect(screen.getByText('Legendary Creature — Demon')).toBeTruthy();
      expect(
        screen.getByText('Whenever an opponent loses life, you gain that much life.'),
      ).toBeTruthy();
    });
  });

  describe('price rows (FR-002)', () => {
    it('renders three rows — Card Kingdom, MTG Goldfish, TCG Player', () => {
      const screen = render(<CardDetailSheetViewWithDefaults />);
      expect(screen.getByTestId('price-row-cardKingdom')).toBeTruthy();
      expect(screen.getByTestId('price-row-mtgGoldfish')).toBeTruthy();
      expect(screen.getByTestId('price-row-tcgPlayer')).toBeTruthy();
    });

    it('renders the live quote values and the Goldfish "coming soon" placeholder', () => {
      const screen = render(<CardDetailSheetViewWithDefaults />);
      expect(screen.getByText('$17.23')).toBeTruthy();
      expect(screen.getByText('$16.38')).toBeTruthy();
      expect(screen.getByText('Coming soon')).toBeTruthy();
    });

    it('marks only the MTG Goldfish row disabled for screen readers (FR-010)', () => {
      const screen = render(<CardDetailSheetViewWithDefaults />);
      expect(
        screen.getByLabelText('MTG Goldfish: Coming soon').props.accessibilityState,
      ).toEqual({ disabled: true });
      expect(
        screen.getByLabelText('Card Kingdom: $17.23').props.accessibilityState,
      ).toEqual({ disabled: false });
    });

    it('renders an em dash for a missing live quote', () => {
      const rows: PriceRowModel[] = [
        { key: 'cardKingdom', label: 'Card Kingdom', display: '—', swatchColor: '#c9a86b', disabled: false },
        { key: 'mtgGoldfish', label: 'MTG Goldfish', display: 'Coming soon', swatchColor: '#a6797a', disabled: true },
        { key: 'tcgPlayer', label: 'TCG Player', display: '$16.38', swatchColor: '#e9b5b5', disabled: false },
      ];
      const screen = render(<CardDetailSheetViewWithDefaults priceRows={rows} />);
      expect(screen.getByLabelText('Card Kingdom: —')).toBeTruthy();
    });
  });

  describe('ownership stepper (FR-007)', () => {
    it('renders the current count', () => {
      const screen = render(<CardDetailSheetViewWithDefaults numberOwned={2} />);
      expect(screen.getByTestId('stepper-count')).toHaveTextContent('2');
    });

    it('fires onIncrement when + is pressed', () => {
      const onIncrement = jest.fn();
      const screen = render(<CardDetailSheetViewWithDefaults onIncrement={onIncrement} />);
      fireEvent.press(screen.getByLabelText('Add one copy'));
      expect(onIncrement).toHaveBeenCalledTimes(1);
    });

    it('fires onDecrement when − is pressed and decrement is allowed', () => {
      const onDecrement = jest.fn();
      const screen = render(
        <CardDetailSheetViewWithDefaults numberOwned={2} canDecrement onDecrement={onDecrement} />,
      );
      fireEvent.press(screen.getByLabelText('Remove one copy'));
      expect(onDecrement).toHaveBeenCalledTimes(1);
    });

    it('disables − at a count of 0', () => {
      const screen = render(
        <CardDetailSheetViewWithDefaults numberOwned={0} canDecrement={false} />,
      );
      expect(screen.getByLabelText('Remove one copy').props.accessibilityState).toEqual({
        disabled: true,
      });
    });
  });

  describe('loading state (FR-008 — skeletons)', () => {
    it('renders price + chart skeleton placeholders and no rows/chart', () => {
      const screen = render(
        <CardDetailSheetViewWithDefaults pricesStatus="loading" historyStatus="loading" />,
      );
      expect(screen.getByTestId('prices-skeleton')).toBeTruthy();
      expect(screen.getByTestId('chart-skeleton')).toBeTruthy();
      expect(screen.queryByTestId('price-row-cardKingdom')).toBeNull();
      expect(screen.queryByTestId('line-chart')).toBeNull();
    });
  });

  describe('error state (FR-009 — inline error + retry, distinct from empty)', () => {
    it('renders a price retry control that fires onRetryPrices', () => {
      const onRetryPrices = jest.fn();
      const screen = render(
        <CardDetailSheetViewWithDefaults pricesStatus="error" onRetryPrices={onRetryPrices} />,
      );
      const retry = screen.getByLabelText('Retry loading prices');
      fireEvent.press(retry);
      expect(onRetryPrices).toHaveBeenCalledTimes(1);
    });

    it('renders a chart retry control that fires onRetryHistory', () => {
      const onRetryHistory = jest.fn();
      const screen = render(
        <CardDetailSheetViewWithDefaults historyStatus="error" onRetryHistory={onRetryHistory} />,
      );
      const retry = screen.getByLabelText('Retry loading price history');
      fireEvent.press(retry);
      expect(onRetryHistory).toHaveBeenCalledTimes(1);
    });

    it('keeps the error state visually distinct from the empty-data annotation', () => {
      const errorScreen = render(<CardDetailSheetViewWithDefaults historyStatus="error" />);
      expect(errorScreen.getByLabelText('Retry loading price history')).toBeTruthy();
      expect(errorScreen.queryByText('no recent price data')).toBeNull();

      const emptyScreen = render(<CardDetailSheetViewWithDefaults historyStatus="empty" chartSeries={[]} />);
      expect(emptyScreen.getByText('no recent price data')).toBeTruthy();
      expect(emptyScreen.queryByLabelText('Retry loading price history')).toBeNull();
    });
  });

  describe('trend chart (FR-001)', () => {
    it('renders the price-trend chart (not the "coming soon" placeholder) when history is ready', () => {
      const screen = render(<CardDetailSheetViewWithDefaults historyStatus="ready" />);
      expect(screen.getByTestId('line-chart')).toBeTruthy();
      expect(screen.queryByText('Price trend chart coming soon')).toBeNull();
    });
  });
});
