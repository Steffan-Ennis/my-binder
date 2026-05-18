import { buildPills, filtersToQuery, removePillFromFilters } from './catalogueFilters';
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

describe('catalogueFilters.buildPills', () => {
  it('returns no pills for the empty filter set', () => {
    expect(buildPills(EMPTY_FILTER_SET)).toEqual([]);
  });

  it('emits one pill per array-dimension value', () => {
    const pills = buildPills({
      ...EMPTY_FILTER_SET,
      formats: ['Modern', 'Legacy'],
      colors: ['R', 'G'],
    });
    expect(pills).toEqual([
      { id: 'format:Modern', label: 'Format: Modern' },
      { id: 'format:Legacy', label: 'Format: Legacy' },
      { id: 'color:R', label: 'Colour: R' },
      { id: 'color:G', label: 'Colour: G' },
    ]);
  });

  it('emits a combined cmc pill when the range is constrained', () => {
    const pills = buildPills({ ...EMPTY_FILTER_SET, cmcMin: 2, cmcMax: 4 });
    expect(pills).toEqual([{ id: 'cmc', label: 'CMC: 2–4' }]);
  });

  it('emits a missingOnly pill when the toggle is on', () => {
    const pills = buildPills({ ...EMPTY_FILTER_SET, missingOnly: true });
    expect(pills).toEqual([{ id: 'missingOnly', label: 'Missing only' }]);
  });
});

describe('catalogueFilters.removePillFromFilters', () => {
  it('drops one array-dimension value', () => {
    const next = removePillFromFilters(
      { ...EMPTY_FILTER_SET, formats: ['Modern', 'Legacy'] },
      'format:Modern',
    );
    expect(next.formats).toEqual(['Legacy']);
  });

  it('resets the cmc range', () => {
    const next = removePillFromFilters(
      { ...EMPTY_FILTER_SET, cmcMin: 2, cmcMax: 4 },
      'cmc',
    );
    expect(next.cmcMin).toBe(0);
    expect(next.cmcMax).toBe(20);
  });

  it('clears the missingOnly toggle', () => {
    const next = removePillFromFilters({ ...EMPTY_FILTER_SET, missingOnly: true }, 'missingOnly');
    expect(next.missingOnly).toBe(false);
  });

  it('returns the input unchanged for an unknown pill id', () => {
    const next = removePillFromFilters(EMPTY_FILTER_SET, 'unknown:value');
    expect(next).toEqual(EMPTY_FILTER_SET);
  });

  it('returns the input unchanged for a pill id missing the separator', () => {
    const next = removePillFromFilters(EMPTY_FILTER_SET, 'bogus');
    expect(next).toEqual(EMPTY_FILTER_SET);
  });
});
