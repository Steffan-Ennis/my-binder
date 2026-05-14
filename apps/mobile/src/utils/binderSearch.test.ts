import type { Card } from '@my-binder/core';

import { binderSearch } from './binderSearch';

const make = (overrides: Partial<Card> & Pick<Card, 'id' | 'name'>): Card => ({
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  ...overrides,
});

const lightningBolt = make({
  id: '1',
  name: 'Lightning Bolt',
  setName: 'Magic 2010',
  setCode: 'M10',
  typeLine: 'Instant',
});
const counterspell = make({
  id: '2',
  name: 'Counterspell',
  setName: 'Modern Masters 2017',
  setCode: 'MM3',
  typeLine: 'Instant',
});
const shivanDragon = make({
  id: '3',
  name: 'Shivan Dragon',
  setName: 'Magic 2010',
  setCode: 'M10',
  typeLine: 'Creature — Dragon',
});
const redElemental = make({
  id: '4',
  name: 'Red Elemental Blast',
  setName: 'Ice Age',
  setCode: 'ICE',
  typeLine: 'Instant',
});
const minimalCard = make({ id: '5', name: 'Black Lotus' });

const corpus: ReadonlyArray<Card> = [
  lightningBolt,
  counterspell,
  shivanDragon,
  redElemental,
  minimalCard,
];

describe('binderSearch', () => {
  it('returns the input array unchanged on an empty query', () => {
    expect(binderSearch(corpus, '')).toBe(corpus);
  });

  it('returns the input array unchanged on a whitespace-only query', () => {
    expect(binderSearch(corpus, '   \t  ')).toBe(corpus);
  });

  it('matches by name (single token, case-insensitive)', () => {
    expect(binderSearch(corpus, 'bolt')).toEqual([lightningBolt]);
    expect(binderSearch(corpus, 'BOLT')).toEqual([lightningBolt]);
  });

  it('matches by setName (single token)', () => {
    expect(binderSearch(corpus, 'modern')).toEqual([counterspell]);
  });

  it('matches by setCode (single token)', () => {
    expect(binderSearch(corpus, 'm10')).toEqual([lightningBolt, shivanDragon]);
  });

  it('matches by typeLine (single token)', () => {
    expect(binderSearch(corpus, 'creature')).toEqual([shivanDragon]);
  });

  it('matches multi-token queries with AND across mixed fields', () => {
    // "red creature" → no card; "red elemental" matches Red Elemental Blast
    expect(binderSearch(corpus, 'red elemental')).toEqual([redElemental]);
  });

  it('returns an empty array for a query that matches no card', () => {
    expect(binderSearch(corpus, 'qqzzxx')).toEqual([]);
  });

  it('multi-token AND across name + type', () => {
    // "shivan dragon" — both tokens hit name + type respectively
    expect(binderSearch(corpus, 'shivan creature')).toEqual([shivanDragon]);
  });

  it('cards missing optional setName/setCode/typeLine still match by name (no false positives)', () => {
    expect(binderSearch(corpus, 'lotus')).toEqual([minimalCard]);
    // No false positive for a token that should miss a partial card
    expect(binderSearch(corpus, 'lotus instant')).toEqual([]);
  });

  it('lowercases tokens and haystack consistently', () => {
    expect(binderSearch(corpus, 'LIGHTNING')).toEqual([lightningBolt]);
    expect(binderSearch(corpus, 'instant')).toEqual([
      lightningBolt,
      counterspell,
      redElemental,
    ]);
  });
});
