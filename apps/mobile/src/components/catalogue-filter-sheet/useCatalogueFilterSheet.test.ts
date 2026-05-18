import { act, renderHook } from '@testing-library/react-native';

import { EMPTY_FILTER_SET, type CatalogueFilterSet } from '@src/components/catalogue/types';

import { useCatalogueFilterSheet } from './useCatalogueFilterSheet';

const COMMITTED: CatalogueFilterSet = {
  ...EMPTY_FILTER_SET,
  formats: ['Modern'],
};

const baseOptions = () => {
  const onApply = jest.fn();
  const onClear = jest.fn();
  const onClose = jest.fn();
  return {
    onApply,
    onClear,
    onClose,
    options: { open: true, committed: COMMITTED, onApply, onClear, onClose },
  };
};

describe('useCatalogueFilterSheet — working draft (US2)', () => {
  it('initialises the draft from the committed prop', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    expect(result.current.draft).toEqual(COMMITTED);
  });

  it('toggleChip mutates only the draft (no parent callback fired)', () => {
    const { options, onApply } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onToggleChip('formats', 'Legacy'));
    expect(result.current.draft.formats).toEqual(['Modern', 'Legacy']);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('toggleChip removes a value that is already selected', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onToggleChip('formats', 'Modern'));
    expect(result.current.draft.formats).toEqual([]);
  });

  it('onToggleColor toggles colour-identity chips on the draft', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onToggleColor('R'));
    expect(result.current.draft.colors).toEqual(['R']);
    act(() => result.current.onToggleColor('R'));
    expect(result.current.draft.colors).toEqual([]);
  });

  it('onSetCmcRange updates the draft min/max', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onSetCmcRange(1, 4));
    expect(result.current.draft.cmcMin).toBe(1);
    expect(result.current.draft.cmcMax).toBe(4);
  });

  it('onToggleMissingOnly flips the draft flag', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onToggleMissingOnly());
    expect(result.current.draft.missingOnly).toBe(true);
    act(() => result.current.onToggleMissingOnly());
    expect(result.current.draft.missingOnly).toBe(false);
  });
});

describe('useCatalogueFilterSheet — Apply / Clear all / Close', () => {
  it('onApply invokes the consumer with the current draft', () => {
    const { options, onApply } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onToggleChip('formats', 'Legacy'));
    act(() => result.current.onApply());

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ formats: ['Modern', 'Legacy'] }),
    );
  });

  it('onClearAll resets the draft to EMPTY_FILTER_SET and does NOT call consumer onClear', () => {
    const { options, onClear } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onToggleChip('formats', 'Legacy'));
    act(() => result.current.onClearAll());

    expect(result.current.draft).toEqual(EMPTY_FILTER_SET);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('onClose discards local edits and invokes consumer onClose', () => {
    const { options, onClose } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onToggleChip('formats', 'Legacy'));
    act(() => result.current.onClose());

    expect(result.current.draft).toEqual(COMMITTED);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('useCatalogueFilterSheet — external committed-prop re-sync', () => {
  it('re-seeds the draft when the committed prop changes (pill removal)', () => {
    const { onApply, onClear, onClose } = baseOptions();
    const { result, rerender } = renderHook(
      ({ committed }: { committed: CatalogueFilterSet }) =>
        useCatalogueFilterSheet({
          open: true,
          committed,
          onApply,
          onClear,
          onClose,
        }),
      { initialProps: { committed: COMMITTED } },
    );
    expect(result.current.draft.formats).toEqual(['Modern']);

    const next: CatalogueFilterSet = { ...EMPTY_FILTER_SET, formats: [] };
    rerender({ committed: next });
    expect(result.current.draft.formats).toEqual([]);
  });
});
