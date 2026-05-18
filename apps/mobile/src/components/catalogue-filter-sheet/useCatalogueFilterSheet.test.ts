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

  it('toggleFormat mutates only the draft (no parent callback fired)', () => {
    const { options, onApply } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.toggleFormat('Legacy'));
    expect(result.current.draft.formats).toEqual(['Modern', 'Legacy']);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('toggleFormat removes a value that is already selected', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.toggleFormat('Modern'));
    expect(result.current.draft.formats).toEqual([]);
  });

  it('toggleSuperType / toggleSubType / toggleCreatureType each mutate their own dimension', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.toggleSuperType('Legendary'));
    act(() => result.current.toggleSubType('Equipment'));
    act(() => result.current.toggleCreatureType('Elf'));
    expect(result.current.draft.superTypes).toEqual(['Legendary']);
    expect(result.current.draft.subTypes).toEqual(['Equipment']);
    expect(result.current.draft.creatureTypes).toEqual(['Elf']);
  });

  it('onToggleColor toggles colour-identity chips on the draft', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onToggleColor('R'));
    expect(result.current.draft.colors).toEqual(['R']);
    act(() => result.current.onToggleColor('R'));
    expect(result.current.draft.colors).toEqual([]);
  });

  it('onChangeMin / onChangeMax parse a numeric string into the draft CMC bounds', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.onChangeMin('2'));
    act(() => result.current.onChangeMax('4'));
    expect(result.current.draft.cmcMin).toBe(2);
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
    act(() => result.current.toggleFormat('Legacy'));
    act(() => result.current.onApply());

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ formats: ['Modern', 'Legacy'] }),
    );
  });

  it('onClearAll resets the draft to EMPTY_FILTER_SET and does NOT call consumer onClear', () => {
    const { options, onClear } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.toggleFormat('Legacy'));
    act(() => result.current.onClearAll());

    expect(result.current.draft).toEqual(EMPTY_FILTER_SET);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('onClose discards local edits and invokes consumer onClose', () => {
    const { options, onClose } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    act(() => result.current.toggleFormat('Legacy'));
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

describe('useCatalogueFilterSheet — sheet ref + open/dismiss effect (T084)', () => {
  it('exposes a stable sheetRef on the result', () => {
    const { options } = baseOptions();
    const { result } = renderHook(() => useCatalogueFilterSheet(options));
    expect(result.current.sheetRef).toBeDefined();
    expect(result.current.sheetRef).toHaveProperty('current');
  });

  it('calls present() on the sheet ref when open transitions to true', () => {
    const { onApply, onClear, onClose } = baseOptions();
    const present = jest.fn();
    const dismiss = jest.fn();

    const { result, rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useCatalogueFilterSheet({ open, committed: COMMITTED, onApply, onClear, onClose }),
      { initialProps: { open: false } },
    );

    // Stub the imperative methods on the ref.
    Object.assign(result.current.sheetRef, {
      current: { present, dismiss },
    });

    rerender({ open: true });
    expect(present).toHaveBeenCalledTimes(1);

    rerender({ open: false });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
