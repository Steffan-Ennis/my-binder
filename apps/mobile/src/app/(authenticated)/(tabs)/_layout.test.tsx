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
      expect(calls).toEqual(['binder', 'catalogue', 'scan', 'profile']);
    } finally {
      (Tabs as unknown as { Screen: typeof original }).Screen = original;
    }
  });

  it('opts the binder and search tabs out of the default header (spec 016 + spec 018)', () => {
    type ScreenOptions = NonNullable<ComponentProps<typeof Tabs.Screen>['options']>;
    const captured: Record<string, ScreenOptions> = {};
    const spy = jest.fn((props: ComponentProps<typeof Tabs.Screen>) => {
      captured[props.name as string] = (props.options ?? {}) as ScreenOptions;
      return null;
    });
    const original = Tabs.Screen;
    (Tabs as unknown as { Screen: typeof spy }).Screen = spy;

    try {
      render(<TabsLayout />);
      expect((captured.binder as { headerShown?: boolean }).headerShown).toBe(false);
      // Spec 018 T033 — Catalogue renders its own crimson masthead edge-to-edge.
      expect((captured.catalogue as { headerShown?: boolean }).headerShown).toBe(false);
      // Spec 022 T031 — Scan hosts a full-bleed camera viewfinder via its own stack.
      expect((captured.scan as { headerShown?: boolean }).headerShown).toBe(false);
      expect((captured.profile as { headerShown?: boolean }).headerShown).toBeUndefined();
    } finally {
      (Tabs as unknown as { Screen: typeof original }).Screen = original;
    }
  });
});
