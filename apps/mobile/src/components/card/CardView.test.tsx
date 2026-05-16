import { fireEvent, render } from '@testing-library/react-native';
import { FC } from 'react';

import CardView from './CardView';
import type { CardViewProps } from './types';

const defaults: CardViewProps = {
  state: { kind: 'loading' },
  footprint: 'pocket',
};

const CardViewWithDefaults: FC<Partial<CardViewProps>> = (overrides) => (
  <CardView {...defaults} {...overrides} />
);

describe('CardView — loading state (US1-AS1, FR-002)', () => {
  it('renders the dashed-border-skeleton frame with testID card-loading', () => {
    const screen = render(<CardViewWithDefaults />);
    expect(screen.getByTestId('card-loading')).toBeTruthy();
  });

  it('does not render the loaded testID while in loading state', () => {
    const screen = render(<CardViewWithDefaults />);
    expect(screen.queryByTestId('card-loaded')).toBeNull();
  });
});

describe('CardView — loaded state (US1-AS2, FR-004, R6, SC-006)', () => {
  it('renders the card image with testID card-loaded', () => {
    const screen = render(
      <CardViewWithDefaults
        state={{ kind: 'loaded', imageUrl: 'https://img.example/x.jpg' }}
      />,
    );
    expect(screen.getByTestId('card-loaded')).toBeTruthy();
  });

  it('emits pocket-occupied alongside card-loaded when footprint=pocket (SC-006 backward compat)', () => {
    const screen = render(
      <CardViewWithDefaults
        state={{ kind: 'loaded', imageUrl: 'https://img.example/x.jpg' }}
        footprint="pocket"
      />,
    );
    expect(screen.getByTestId('pocket-occupied')).toBeTruthy();
  });

  it('does NOT emit pocket-occupied when footprint=detail', () => {
    const screen = render(
      <CardViewWithDefaults
        state={{ kind: 'loaded', imageUrl: 'https://img.example/x.jpg' }}
        footprint="detail"
      />,
    );
    expect(screen.queryByTestId('pocket-occupied')).toBeNull();
  });

  it('first-render warm-cache path renders loaded WITHOUT loading skeleton flash (US2)', () => {
    const screen = render(
      <CardViewWithDefaults
        state={{ kind: 'loaded', imageUrl: 'https://img.example/x.jpg' }}
      />,
    );
    expect(screen.getByTestId('card-loaded')).toBeTruthy();
    expect(screen.queryByTestId('card-loading')).toBeNull();
  });
});

describe('CardView — not-found state (FR-005, US3-AS1)', () => {
  it('renders the not-found fallback caption + testID card-not-found', () => {
    const screen = render(
      <CardViewWithDefaults state={{ kind: 'notFound' }} />,
    );
    expect(screen.getByTestId('card-not-found')).toBeTruthy();
    expect(screen.getByText('Card not found')).toBeTruthy();
  });
});

describe('CardView — error state (FR-006, US3-AS2)', () => {
  it('renders the error testID + tappable card-retry pressable', () => {
    const onRetry = jest.fn();
    const screen = render(
      <CardViewWithDefaults state={{ kind: 'error', onRetry }} />,
    );
    expect(screen.getByTestId('card-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('card-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('CardView — outer dimensions invariant (FR-011, SC-004)', () => {
  // The flattened root style must be identical across all 4 states — the
  // theme returns a single `styles.root` object and every branch uses it.
  it('every state uses the same root style object (zero layout shift)', () => {
    const loading = render(<CardViewWithDefaults state={{ kind: 'loading' }} />);
    const loaded = render(
      <CardViewWithDefaults state={{ kind: 'loaded', imageUrl: 'u' }} />,
    );
    const notFound = render(<CardViewWithDefaults state={{ kind: 'notFound' }} />);
    const error = render(
      <CardViewWithDefaults state={{ kind: 'error', onRetry: () => {} }} />,
    );
    const styleOf = (id: string, q: ReturnType<typeof render>) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q.getByTestId(id) as any).props.style;

    expect(styleOf('card-loading', loading)).toEqual(styleOf('card-loaded', loaded));
    expect(styleOf('card-loading', loading)).toEqual(styleOf('card-not-found', notFound));
    expect(styleOf('card-loading', loading)).toEqual(styleOf('card-error', error));
  });
});
