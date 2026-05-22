import { render, screen } from '@testing-library/react-native';

import CardDetailSheetContainer from './CardDetailSheetContainer';
import type { CardDetailSheetViewProps } from './types';

const mockUseCardDetailSheet = jest.fn();
jest.mock('./useCardDetailSheet', () => ({
  __esModule: true,
  default: () => mockUseCardDetailSheet(),
}));

let capturedViewProps: CardDetailSheetViewProps | null = null;
jest.mock('./CardDetailSheetView', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: (props: CardDetailSheetViewProps) => {
      capturedViewProps = props;
      return React.createElement(View, { testID: 'card-detail-sheet-view-stub' });
    },
  };
});

beforeEach(() => {
  capturedViewProps = null;
  mockUseCardDetailSheet.mockReset();
});

describe('CardDetailSheetContainer — named-props bridge', () => {
  it('wires every documented view-prop field to <CardDetailSheetView /> by name (no spread)', () => {
    const props: CardDetailSheetViewProps = {
      id: '6ca7af0b-4b6a-59ba-90be-6da4f62bcff1',
      error: null,
      isLoading: false,
      isSuccess: true,
      name: 'Bloodthirsty Conqueror',
      setLabel: 'The Lost Caverns of Ixalan · LCI',
      typeLine: 'Legendary Creature — Demon',
      oracle: 'Whenever an opponent loses life, you gain that much life.',
      numberOwned: 2,
      canDecrement: true,
      onIncrement: jest.fn(),
      onDecrement: jest.fn(),
      priceRows: [
        { key: 'cardKingdom', label: 'Card Kingdom', display: '$17.23', swatchColor: '#c9a86b', disabled: false },
        { key: 'mtgGoldfish', label: 'MTG Goldfish', display: 'Coming soon', swatchColor: '#a6797a', disabled: true },
        { key: 'tcgPlayer', label: 'TCG Player', display: '$16.38', swatchColor: '#e9b5b5', disabled: false },
      ],
      pricesStatus: 'ready',
      onRetryPrices: jest.fn(),
      chartSeries: [{ key: 'cardKingdom', label: 'Card Kingdom', color: '#c9a86b', data: [{ value: 17.23 }] }],
      chartLegend: [{ label: 'Card Kingdom', color: '#c9a86b', disabled: false }],
      historyStatus: 'ready',
      onRetryHistory: jest.fn(),
      onClose: jest.fn(),
    };
    mockUseCardDetailSheet.mockReturnValue(props);

    render(<CardDetailSheetContainer printingId="6ca7af0b-4b6a-59ba-90be-6da4f62bcff1" />);

    expect(screen.getByTestId('card-detail-sheet-view-stub')).toBeOnTheScreen();
    expect(capturedViewProps).toEqual(props);
  });
});
