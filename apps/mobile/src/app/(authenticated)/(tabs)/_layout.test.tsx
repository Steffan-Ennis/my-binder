import { render } from '@testing-library/react-native';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import TabsLayout from './_layout';

describe('(tabs) layout', () => {
  beforeEach(() => {
    (Tabs.Screen as unknown as jest.Mock).mockClear?.();
  });

  it('renders without throwing under the jest-expo Tabs mock', () => {
    expect(() => render(<TabsLayout />)).not.toThrow();
  });

  it('declares the four wireframe tabs in order with Binder first', () => {
    // Replace Tabs.Screen with a spy so we can capture each Screen's `name`.
    const calls: string[] = [];
    const spy = jest.fn((props: ComponentProps<typeof Tabs.Screen>) => {
      calls.push(props.name as string);
      return null;
    });
    const original = Tabs.Screen;
    (Tabs as unknown as { Screen: typeof spy }).Screen = spy;

    try {
      render(<TabsLayout />);
      expect(calls).toEqual(['binder', 'search', 'scan', 'profile']);
    } finally {
      (Tabs as unknown as { Screen: typeof original }).Screen = original;
    }
  });
});
