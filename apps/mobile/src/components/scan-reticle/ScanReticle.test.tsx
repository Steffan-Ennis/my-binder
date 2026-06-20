import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Colors } from '@src/constants/theme';

import ScanReticle, { type ReticleTone } from './ScanReticle';

const bracketColor = (testID: string): unknown => {
  const node = screen.getByTestId(testID);
  return StyleSheet.flatten(node.props.style).borderColor;
};

describe('ScanReticle', () => {
  it('renders four corner brackets', () => {
    render(<ScanReticle tone="idle" />);
    expect(screen.getByTestId('scan-reticle-topLeft')).toBeOnTheScreen();
    expect(screen.getByTestId('scan-reticle-topRight')).toBeOnTheScreen();
    expect(screen.getByTestId('scan-reticle-bottomLeft')).toBeOnTheScreen();
    expect(screen.getByTestId('scan-reticle-bottomRight')).toBeOnTheScreen();
  });

  // FR-002 / SC-005 — asserts the resolved bracket colour equals the palette
  // token, proving no hard-coded hex slipped in.
  const cases: ReadonlyArray<[ReticleTone, string]> = [
    ['idle', Colors.dark.accent],
    ['aligned', Colors.dark.accentPressed],
    ['error', Colors.dark.error],
  ];

  it.each(cases)('maps tone=%s to its palette token on every corner', (tone, token) => {
    render(<ScanReticle tone={tone} />);
    expect(bracketColor('scan-reticle-topLeft')).toBe(token);
    expect(bracketColor('scan-reticle-topRight')).toBe(token);
    expect(bracketColor('scan-reticle-bottomLeft')).toBe(token);
    expect(bracketColor('scan-reticle-bottomRight')).toBe(token);
  });
});
