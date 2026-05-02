import { renderHook } from '@testing-library/react-native';

import { useComingSoon } from './useComingSoon';

describe('useComingSoon', () => {
  it.each(['search', 'scan', 'profile'] as const)(
    'returns a wireframe-aligned title/message/icon for %s',
    (feature) => {
      const { result } = renderHook(() => useComingSoon({ feature }));
      expect(result.current.title).toBeTruthy();
      expect(result.current.message).toBeTruthy();
      expect(result.current.iconName).toBeTruthy();
    },
  );

  it('throws for unrecognised features', () => {
    expect(() =>
      renderHook(() =>
        // @ts-expect-error — exercising defensive runtime check
        useComingSoon({ feature: 'unknown' }),
      ),
    ).toThrow();
  });
});