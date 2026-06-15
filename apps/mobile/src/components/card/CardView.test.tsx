import { fireEvent, render } from '@testing-library/react-native';
import { type FC, type RefObject } from 'react';
import { Animated } from 'react-native';

import { ApiError } from '@src/services/api/ApiError';

import CardView from './CardView';
import type { CardViewProps } from './types';

const makePulseRef = (): RefObject<Animated.Value> => ({
  current: new Animated.Value(0.6),
});

const noopRetry = async () => {};

type CardViewOverrides = {
  isLoading?: boolean;
  isSuccess?: boolean;
  error?: ApiError | null;
  imageUrl?: string;
  onRetry?: () => Promise<void>;
  pulseRef?: RefObject<Animated.Value>;
};

const CardViewWithDefaults: FC<CardViewOverrides> = (overrides) => {
  const props = {
    isLoading: true,
    isSuccess: false,
    error: null,
    onRetry: noopRetry,
    pulseRef: makePulseRef(),
    ...overrides,
  } as CardViewProps;
  return <CardView {...props} />;
};

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
  it('renders the card image with testID card-loaded when isSuccess is true', () => {
    const screen = render(
      <CardViewWithDefaults
        isLoading={false}
        isSuccess={true}
        imageUrl="https://img.example/x.jpg"
      />,
    );
    expect(screen.getByTestId('card-loaded')).toBeTruthy();
  });

  it('emits pocket-occupied alongside card-loaded in the success branch (SC-006 backward compat)', () => {
    const screen = render(
      <CardViewWithDefaults
        isLoading={false}
        isSuccess={true}
        imageUrl="https://img.example/x.jpg"
      />,
    );
    expect(screen.getByTestId('pocket-occupied')).toBeTruthy();
  });

  it('first-render warm-cache path renders loaded WITHOUT loading skeleton flash (US2)', () => {
    const screen = render(
      <CardViewWithDefaults
        isLoading={false}
        isSuccess={true}
        imageUrl="https://img.example/x.jpg"
      />,
    );
    expect(screen.getByTestId('card-loaded')).toBeTruthy();
    expect(screen.queryByTestId('card-loading')).toBeNull();
  });
});

describe('CardView — not-found state (FR-005, US3-AS1)', () => {
  it('renders the not-found fallback caption + testID card-not-found when error.status === 404', () => {
    const screen = render(
      <CardViewWithDefaults
        isLoading={false}
        isSuccess={false}
        error={new ApiError({ message: 'nf', status: 404, kind: 'NOT_FOUND' })}
      />,
    );
    expect(screen.getByTestId('card-not-found')).toBeTruthy();
    expect(screen.getByText('Card not found')).toBeTruthy();
  });
});

describe('CardView — error state (FR-006, US3-AS2)', () => {
  it('renders the error testID + tappable card-retry pressable for non-404 errors', () => {
    const onRetry = jest.fn(async () => {});
    const screen = render(
      <CardViewWithDefaults
        isLoading={false}
        isSuccess={false}
        error={new ApiError({ message: 'down', status: 503, kind: 'PROVIDER_UNAVAILABLE' })}
        onRetry={onRetry}
      />,
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
    const loading = render(<CardViewWithDefaults />);
    const loaded = render(
      <CardViewWithDefaults
        isLoading={false}
        isSuccess={true}
        imageUrl="https://img.example/x.jpg"
      />,
    );
    const notFound = render(
      <CardViewWithDefaults
        isLoading={false}
        isSuccess={false}
        error={new ApiError({ message: 'nf', status: 404, kind: 'NOT_FOUND' })}
      />,
    );
    const errorView = render(
      <CardViewWithDefaults
        isLoading={false}
        isSuccess={false}
        error={new ApiError({ message: 'er', status: 503, kind: 'PROVIDER_UNAVAILABLE' })}
      />,
    );
    const styleOf = (id: string, query: ReturnType<typeof render>) =>
       
      (query.getByTestId(id) as any).props.style;

    expect(styleOf('card-loading', loading)).toEqual(styleOf('card-loaded', loaded));
    expect(styleOf('card-loading', loading)).toEqual(styleOf('card-not-found', notFound));
    expect(styleOf('card-loading', loading)).toEqual(styleOf('card-error', errorView));
  });
});
