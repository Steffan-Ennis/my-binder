import { act, renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { EMPTY_FILTER_SET, type CatalogueFilterSet } from '@src/components/catalogue/types';

import { CatalogueProvider } from './CatalogueProvider';
import { useCatalogueContext } from './useCatalogueContext';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(CatalogueProvider, null, children);

const renderContext = () => renderHook(() => useCatalogueContext(), { wrapper });

describe('CatalogueProvider', () => {
  it('starts with the empty filter set', () => {
    const { result } = renderContext();
    expect(result.current.filters).toEqual(EMPTY_FILTER_SET);
  });

  it('applyFilter replaces the committed filter set wholesale', () => {
    const { result } = renderContext();
    const next: CatalogueFilterSet = {
      ...EMPTY_FILTER_SET,
      formats: ['Modern'],
      colors: ['R'],
    };
    act(() => result.current.applyFilter(next));
    expect(result.current.filters).toEqual(next);
  });

  it('clearFilters resets back to the empty filter set', () => {
    const { result } = renderContext();
    act(() =>
      result.current.applyFilter({ ...EMPTY_FILTER_SET, formats: ['Modern'] }),
    );
    act(() => result.current.clearFilters());
    expect(result.current.filters).toEqual(EMPTY_FILTER_SET);
  });

  it('throws when used outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useCatalogueContext())).toThrow(
      /must be used within a <CatalogueProvider>/,
    );
    spy.mockRestore();
  });
});
