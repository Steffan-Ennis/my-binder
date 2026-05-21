import { act, renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { EMPTY_FILTER_SET, type CatalogueFilterSet } from '@src/components/catalogue/types';
import { CatalogueProvider, useCatalogueContext } from '@src/context/catalogue-context';

import { useCatalogueFilterSheet } from './useCatalogueFilterSheet';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: (...args: unknown[]) => mockBack(...args) }),
}));

const COMMITTED: CatalogueFilterSet = {
  ...EMPTY_FILTER_SET,
  formats: ['Modern'],
};

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(CatalogueProvider, null, children);

// Render the sheet hook alongside the context so a test can both drive the
// committed filter set (`ctx.applyFilter`) and read it back (`ctx.filters`).
const renderSheet = () =>
  renderHook(
    () => ({ sheet: useCatalogueFilterSheet(), ctx: useCatalogueContext() }),
    { wrapper },
  );

// Seed the committed filter set to COMMITTED; the sheet's draft re-syncs to it.
const renderSeeded = () => {
  const rendered = renderSheet();
  act(() => rendered.result.current.ctx.applyFilter(COMMITTED));
  return rendered;
};

beforeEach(() => {
  mockBack.mockReset();
});

describe('useCatalogueFilterSheet — working draft (US2)', () => {
  it('seeds the draft from the committed filter set', () => {
    const { result } = renderSeeded();
    expect(result.current.sheet.draft).toEqual(COMMITTED);
  });

  it('toggleFormat mutates only the draft, leaving committed filters untouched', () => {
    const { result } = renderSeeded();
    act(() => result.current.sheet.toggleFormat('Legacy'));
    expect(result.current.sheet.draft.formats).toEqual(['Modern', 'Legacy']);
    expect(result.current.ctx.filters.formats).toEqual(['Modern']);
  });

  it('toggleFormat removes a value that is already selected', () => {
    const { result } = renderSeeded();
    act(() => result.current.sheet.toggleFormat('Modern'));
    expect(result.current.sheet.draft.formats).toEqual([]);
  });

  it('toggleSuperType / toggleSubType / toggleCreatureType each mutate their own dimension', () => {
    const { result } = renderSeeded();
    act(() => result.current.sheet.toggleSuperType('Legendary'));
    act(() => result.current.sheet.toggleSubType('Equipment'));
    act(() => result.current.sheet.toggleCreatureType('Elf'));
    expect(result.current.sheet.draft.superTypes).toEqual(['Legendary']);
    expect(result.current.sheet.draft.subTypes).toEqual(['Equipment']);
    expect(result.current.sheet.draft.creatureTypes).toEqual(['Elf']);
  });

  it('onToggleColor toggles colour-identity chips on the draft', () => {
    const { result } = renderSeeded();
    act(() => result.current.sheet.onToggleColor('R'));
    expect(result.current.sheet.draft.colors).toEqual(['R']);
    act(() => result.current.sheet.onToggleColor('R'));
    expect(result.current.sheet.draft.colors).toEqual([]);
  });

  it('onChangeMin / onChangeMax parse a numeric string into the draft CMC bounds', () => {
    const { result } = renderSeeded();
    act(() => result.current.sheet.onChangeMin('2'));
    act(() => result.current.sheet.onChangeMax('4'));
    expect(result.current.sheet.draft.cmcMin).toBe(2);
    expect(result.current.sheet.draft.cmcMax).toBe(4);
  });

  it('onToggleMissingOnly flips the draft flag', () => {
    const { result } = renderSeeded();
    act(() => result.current.sheet.onToggleMissingOnly());
    expect(result.current.sheet.draft.missingOnly).toBe(true);
    act(() => result.current.sheet.onToggleMissingOnly());
    expect(result.current.sheet.draft.missingOnly).toBe(false);
  });
});

describe('useCatalogueFilterSheet — Apply / Clear all', () => {
  it('onApply commits the draft to the context and dismisses the modal', () => {
    const { result } = renderSeeded();
    act(() => result.current.sheet.toggleFormat('Legacy'));
    act(() => result.current.sheet.onApply());

    expect(result.current.ctx.filters.formats).toEqual(['Modern', 'Legacy']);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('onClearAll resets the draft to EMPTY_FILTER_SET without committing', () => {
    const { result } = renderSeeded();
    act(() => result.current.sheet.toggleFormat('Legacy'));
    act(() => result.current.sheet.onClearAll());

    expect(result.current.sheet.draft).toEqual(EMPTY_FILTER_SET);
    expect(result.current.ctx.filters).toEqual(COMMITTED);
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe('useCatalogueFilterSheet — external committed re-sync', () => {
  it('re-seeds the draft when the committed set changes (pill removed externally)', () => {
    const { result } = renderSeeded();
    expect(result.current.sheet.draft.formats).toEqual(['Modern']);

    act(() => result.current.ctx.removePill('format:Modern'));
    expect(result.current.sheet.draft.formats).toEqual([]);
  });
});
