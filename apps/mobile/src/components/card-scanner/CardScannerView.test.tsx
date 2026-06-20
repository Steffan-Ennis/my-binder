import type { CardRecord } from '@my-binder/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { CameraView } from 'expo-camera';
import type { ComponentRef, FC, RefObject } from 'react';
import { Gesture, type ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import CardScannerView from './CardScannerView';
import type { CardScannerViewProps } from './types';

const makeCard = (id: string, name: string): CardRecord => ({
  id,
  name,
  set: 'M11',
  cardNumber: '7',
  manaCost: null,
  colorIdentity: [],
});

const defaults: CardScannerViewProps = {
  error: null,
  isLoading: false,
  isSuccess: false,
  status: 'ready',
  mode: 'single',
  reticleTone: 'idle',
  candidateName: undefined,
  matches: [],
  matchListDismissGesture: Gesture.Pan(),
  matchScrollRef: { current: null } as RefObject<ComponentRef<typeof GestureScrollView> | null>,
  onMatchListScroll: jest.fn(),
  cameraRef: { current: null } as RefObject<CameraView | null>,
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

const CardScannerViewWithDefaults: FC<Partial<CardScannerViewProps>> = (overrides) => (
  <CardScannerView {...defaults} {...overrides} />
);

describe('CardScannerView', () => {
  describe('viewfinder chrome (ready)', () => {
    it('renders the camera, framing reticle, mode toggle and control bar', () => {
      render(<CardScannerViewWithDefaults />);
      expect(screen.getByTestId('camera-view')).toBeOnTheScreen();
      expect(screen.getByTestId('scan-reticle')).toBeOnTheScreen();
      expect(screen.getByTestId('scan-mode-toggle')).toBeOnTheScreen();
      expect(screen.getByTestId('scan-control-bar')).toBeOnTheScreen();
    });

    it('renders Single and a disabled Multi segment (Multi deferred to plan B)', () => {
      render(<CardScannerViewWithDefaults />);
      expect(screen.getByTestId('scan-mode-single')).toBeOnTheScreen();
      expect(screen.getByTestId('scan-mode-multi').props.accessibilityState).toMatchObject({
        disabled: true,
      });
    });

    it('forwards the requested reticle tone to <ScanReticle>', () => {
      render(<CardScannerViewWithDefaults reticleTone="aligned" />);
      // The reticle resolves tone → palette token (asserted in ScanReticle.test);
      // here we only confirm the live overlay is mounted in the viewfinder.
      expect(screen.getByTestId('scan-reticle')).toBeOnTheScreen();
    });
  });

  describe('status branches (FR-007)', () => {
    it.each([
      ['capturing', 'scan-status-capturing'],
      ['recognizing', 'scan-status-recognizing'],
      ['searching', 'scan-status-searching'],
      ['noText', 'scan-status-noText'],
      ['recognitionError', 'scan-status-recognitionError'],
      ['noMatch', 'scan-status-noMatch'],
    ] as const)('renders the %s banner over the viewfinder', (status, testID) => {
      render(<CardScannerViewWithDefaults status={status} candidateName="Lightning Bolt" />);
      expect(screen.getByTestId(testID)).toBeOnTheScreen();
      // viewfinder stays mounted underneath
      expect(screen.getByTestId('camera-view')).toBeOnTheScreen();
    });

    it('renders the catalogue matches as selectable rows (FR-006)', () => {
      render(
        <CardScannerViewWithDefaults
          status="matches"
          matches={[makeCard('a1', 'Lightning Bolt'), makeCard('b2', 'Counterspell')]}
        />,
      );
      expect(screen.getByTestId('scan-status-matches')).toBeOnTheScreen();
      expect(screen.getByTestId('scan-match-a1')).toBeOnTheScreen();
      expect(screen.getByText('Lightning Bolt')).toBeOnTheScreen();
      expect(screen.getByText('Counterspell')).toBeOnTheScreen();
    });

    it('shows the recognised name in the no-match message', () => {
      render(<CardScannerViewWithDefaults status="noMatch" candidateName="Black Lotus" />);
      expect(screen.getByText(/Black Lotus/)).toBeOnTheScreen();
    });

    it('renders the permission-denied prompt without a camera preview (FR-001)', () => {
      render(<CardScannerViewWithDefaults status="permissionDenied" />);
      expect(screen.getByTestId('scan-permission-denied')).toBeOnTheScreen();
      expect(screen.queryByTestId('camera-view')).toBeNull();
    });

    it('renders the unsupported state without a camera preview (FR-008)', () => {
      render(<CardScannerViewWithDefaults status="unsupported" />);
      expect(screen.getByTestId('scan-unsupported')).toBeOnTheScreen();
      expect(screen.queryByTestId('camera-view')).toBeNull();
    });
  });

  describe('interactions', () => {
    it('shutter press fires onCapture', () => {
      const onCapture = jest.fn();
      render(<CardScannerViewWithDefaults onCapture={onCapture} />);
      fireEvent.press(screen.getByTestId('scan-capture-button'));
      expect(onCapture).toHaveBeenCalledTimes(1);
    });

    it('does not fire onCapture while a capture is already in flight', () => {
      const onCapture = jest.fn();
      render(<CardScannerViewWithDefaults status="recognizing" onCapture={onCapture} />);
      fireEvent.press(screen.getByTestId('scan-capture-button'));
      expect(onCapture).not.toHaveBeenCalled();
    });

    it('gallery press fires onPickFromLibrary', () => {
      const onPickFromLibrary = jest.fn();
      render(<CardScannerViewWithDefaults onPickFromLibrary={onPickFromLibrary} />);
      fireEvent.press(screen.getByTestId('scan-gallery-button'));
      expect(onPickFromLibrary).toHaveBeenCalledTimes(1);
    });

    it('flash press fires onToggleTorch', () => {
      const onToggleTorch = jest.fn();
      render(<CardScannerViewWithDefaults onToggleTorch={onToggleTorch} />);
      fireEvent.press(screen.getByTestId('scan-flash-button'));
      expect(onToggleTorch).toHaveBeenCalledTimes(1);
    });

    it('selecting a match fires onSelectMatch with its printing id (FR-006)', () => {
      const onSelectMatch = jest.fn();
      render(
        <CardScannerViewWithDefaults
          status="matches"
          matches={[makeCard('a1', 'Lightning Bolt')]}
          onSelectMatch={onSelectMatch}
        />,
      );
      fireEvent.press(screen.getByTestId('scan-match-a1'));
      expect(onSelectMatch).toHaveBeenCalledWith('a1');
    });

    it('Retry fires onRetry from an error banner', () => {
      const onRetry = jest.fn();
      render(<CardScannerViewWithDefaults status="noMatch" onRetry={onRetry} />);
      fireEvent.press(screen.getByTestId('scan-retry-button'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('Allow camera fires onRequestPermission', () => {
      const onRequestPermission = jest.fn();
      render(
        <CardScannerViewWithDefaults status="permissionDenied" onRequestPermission={onRequestPermission} />,
      );
      fireEvent.press(screen.getByTestId('scan-grant-permission'));
      expect(onRequestPermission).toHaveBeenCalledTimes(1);
    });

    it('selecting Single fires onSelectMode', () => {
      const onSelectMode = jest.fn();
      render(<CardScannerViewWithDefaults onSelectMode={onSelectMode} />);
      fireEvent.press(screen.getByTestId('scan-mode-single'));
      expect(onSelectMode).toHaveBeenCalledWith('single');
    });
  });
});
