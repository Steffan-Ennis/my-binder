import { filtersToQuery } from './catalogueFilters';
import { EMPTY_FILTER_SET, type CatalogueFilterSet } from './types';

const SEEDED: CatalogueFilterSet = {
  ...EMPTY_FILTER_SET,
  name: '  bolt  ',
  formats: ['Modern', 'Legacy'],
  superTypes: ['Legendary'],
  subTypes: ['Aura'],
  creatureTypes: ['Elf'],
  colors: ['R'],
  cmcMin: 1,
  cmcMax: 4,
  missingOnly: true,
};

describe('catalogueFilters.filtersToQuery', () => {
  it('returns an empty wire shape for the empty filter set', () => {
    expect(filtersToQuery(EMPTY_FILTER_SET)).toEqual({});
  });

  it('trims the name and drops it when empty after trim', () => {
    expect(filtersToQuery({ ...EMPTY_FILTER_SET, name: '   ' })).toEqual({});
    expect(filtersToQuery({ ...EMPTY_FILTER_SET, name: '  bolt  ' })).toEqual({ name: 'bolt' });
  });

  it('serialises every array dimension', () => {
    const out = filtersToQuery(SEEDED);
    expect(out).toEqual({
      name: 'bolt',
      formats: ['Modern', 'Legacy'],
      superTypes: ['Legendary'],
      subTypes: ['Aura'],
      creatureTypes: ['Elf'],
      colorIdentity: ['R'],
      cmcMin: 1,
      cmcMax: 4,
      missingOnly: true,
    });
  });

  it('omits cmcMin when 0 and cmcMax when 20 (unconstrained sentinel)', () => {
    const out = filtersToQuery({ ...EMPTY_FILTER_SET, cmcMin: 0, cmcMax: 20 });
    expect(out.cmcMin).toBeUndefined();
    expect(out.cmcMax).toBeUndefined();
  });

  it('omits missingOnly when false', () => {
    const out = filtersToQuery({ ...EMPTY_FILTER_SET, missingOnly: false });
    expect(out.missingOnly).toBeUndefined();
  });
});
