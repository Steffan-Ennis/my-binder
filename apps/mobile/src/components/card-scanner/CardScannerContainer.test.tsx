import { render, screen } from '@testing-library/react-native';
import type { CameraView } from 'expo-camera';
import type { RefObject } from 'react';

import { CardScannerContainer } from './CardScannerContainer';
import type { CardScannerViewProps } from './types';

const mockUseCardScanner = jest.fn();
jest.mock('./useCardScanner', () => ({
  __esModule: true,
  default: () => mockUseCardScanner(),
}));

let capturedViewProps: CardScannerViewProps | null = null;
jest.mock('./CardScannerView', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: (props: CardScannerViewProps) => {
      capturedViewProps = props;
      return React.createElement(View, { testID: 'card-scanner-view-stub' });
    },
  };
});

beforeEach(() => {
  capturedViewProps = null;
  mockUseCardScanner.mockReset();
});

describe('CardScannerContainer — named-props bridge', () => {
  it('wires every documented view-prop field to <CardScannerView /> by name (no spread)', () => {
    const cameraRef = { current: null } as RefObject<CameraView | null>;
    const hookValue: CardScannerViewProps = {
      error: null,
      isLoading: false,
      isSuccess: true,
      status: 'ready',
      mode: 'single',
      reticleTone: 'idle',
      candidateName: undefined,
      matches: [],
      cameraRef,
      permissionStatus: 'granted',
      torchEnabled: false,
      onCapture: jest.fn(),
      onPickFromLibrary: jest.fn(),
      onRequestPermission: jest.fn(),
      onToggleTorch: jest.fn(),
      onSelectMatch: jest.fn(),
      onRetry: jest.fn(),
      onSelectMode: jest.fn(),
    };
    mockUseCardScanner.mockReturnValue(hookValue);

    render(<CardScannerContainer />);

    expect(screen.getByTestId('card-scanner-view-stub')).toBeOnTheScreen();
    expect(capturedViewProps).toEqual(hookValue);
  });
});
