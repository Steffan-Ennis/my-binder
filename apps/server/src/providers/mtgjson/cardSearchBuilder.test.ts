import type { SearchQuery } from '@my-binder/core';

import { CardSearchBuilder } from './cardSearchBuilder';

const PAGE_COLS = 'uuid, name, setCode, number, manaCost, colorIdentity';
const PAPER = "list_contains(availability, 'paper')";

const count = (q: SearchQuery, opts?: { excludeUuids?: ReadonlyArray<string> }) =>
  CardSearchBuilder.fromQuery(q, opts).toCountQuery();
const page = (
  q: SearchQuery,
  limit: number,
  offset: number,
  opts?: { excludeUuids?: ReadonlyArray<string> },
) => CardSearchBuilder.fromQuery(q, opts).toPageQuery(limit, offset);

describe('CardSearchBuilder', () => {
  test('empty query → paper-only count, no params', () => {
    expect(count({})).toEqual([`SELECT COUNT(*) AS total FROM cards WHERE ${PAPER}`, []]);
  });

  test('empty query → page query orders by name and binds limit/offset last', () => {
    expect(page({}, 20, 40)).toEqual([
      `SELECT ${PAGE_COLS} FROM cards WHERE ${PAPER} ORDER BY name ASC, number ASC LIMIT $1 OFFSET $2`,
      [20, 40],
    ]);
  });

  test('name → fuzzy predicate (count) and fuzzy ordering (page)', () => {
    expect(count({ name: 'bolt' })).toEqual([
      `SELECT COUNT(*) AS total FROM cards WHERE ${PAPER} AND jaro_winkler_similarity(lower(name), lower($1)) > 0.8`,
      ['bolt'],
    ]);
    expect(page({ name: 'bolt' }, 10, 5)).toEqual([
      `SELECT ${PAGE_COLS} FROM cards WHERE ${PAPER} AND jaro_winkler_similarity(lower(name), lower($1)) > 0.8` +
        ` ORDER BY jaro_winkler_similarity(lower(name), lower($2)) DESC, number ASC LIMIT $3 OFFSET $4`,
      ['bolt', 'bolt', 10, 5],
    ]);
  });

  test('set + cmc range', () => {
    expect(count({ set: 'M11', cmcMin: 2, cmcMax: 5 })).toEqual([
      `SELECT COUNT(*) AS total FROM cards WHERE ${PAPER} AND setCode = $1 AND manaValue >= $2 AND manaValue <= $3`,
      ['M11', 2, 5],
    ]);
  });

  test('formats → lowercased IN against card_legalities', () => {
    expect(count({ formats: ['Modern', 'Legacy'] })).toEqual([
      `SELECT COUNT(*) AS total FROM cards WHERE ${PAPER} AND uuid IN (SELECT uuid FROM card_legalities WHERE status = 'Legal' AND format IN ($1, $2))`,
      ['modern', 'legacy'],
    ]);
  });

  test('superTypes → OR-within-dimension list_contains', () => {
    expect(count({ superTypes: ['Legendary', 'Basic'] })).toEqual([
      `SELECT COUNT(*) AS total FROM cards WHERE ${PAPER} AND (list_contains(supertypes, $1) OR list_contains(supertypes, $2))`,
      ['Legendary', 'Basic'],
    ]);
  });

  test('creatureTypes → gated on Creature type', () => {
    expect(count({ creatureTypes: ['Elf'] })).toEqual([
      `SELECT COUNT(*) AS total FROM cards WHERE ${PAPER} AND (list_contains(types, 'Creature') AND (list_contains(subtypes, $1)))`,
      ['Elf'],
    ]);
  });

  test('colorIdentity subset (no colourless) → list_filter leftover = 0', () => {
    expect(count({ colorIdentity: ['W', 'U'] })).toEqual([
      `SELECT COUNT(*) AS total FROM cards WHERE ${PAPER} AND ((len(colorIdentity) > 0 AND len(list_filter(colorIdentity, x -> x NOT IN ($1, $2))) = 0))`,
      ['W', 'U'],
    ]);
  });

  test("colorIdentity with 'C' adds the colourless branch", () => {
    expect(count({ colorIdentity: ['R', 'C'] })).toEqual([
      `SELECT COUNT(*) AS total FROM cards WHERE ${PAPER} AND ((len(colorIdentity) > 0 AND len(list_filter(colorIdentity, x -> x NOT IN ($1))) = 0) OR len(colorIdentity) = 0)`,
      ['R'],
    ]);
  });

  test("colorIdentity ['C'] only → colourless only, no params", () => {
    expect(count({ colorIdentity: ['C'] })).toEqual([
      `SELECT COUNT(*) AS total FROM cards WHERE ${PAPER} AND (len(colorIdentity) = 0)`,
      [],
    ]);
  });

  test('excludeUuids → scalar NOT IN', () => {
    expect(count({}, { excludeUuids: ['u1', 'u2'] })).toEqual([
      `SELECT COUNT(*) AS total FROM cards WHERE ${PAPER} AND uuid NOT IN ($1, $2)`,
      ['u1', 'u2'],
    ]);
  });

  test('combined query renumbers placeholders sequentially across WHERE, ORDER BY, LIMIT/OFFSET', () => {
    const [sql, params] = page(
      { name: 'bolt', formats: ['modern'], colorIdentity: ['R'] },
      9,
      0,
      { excludeUuids: ['u1'] },
    );
    // params, in textual placeholder order (fromQuery applies colourIdentity
    // before formats):
    //   WHERE: name, colour, format, exclude  → ORDER BY: name  → LIMIT, OFFSET
    expect(params).toEqual(['bolt', 'R', 'modern', 'u1', 'bolt', 9, 0]);
    expect(sql).not.toContain('?');
    // highest placeholder equals the param count, and $1 appears
    expect(sql).toContain('$7');
    expect(sql).not.toContain('$8');
    expect(sql).toContain('lower($1)');
  });

  test('withFilter escape hatch appends a raw predicate', () => {
    expect(new CardSearchBuilder().withFilter('manaValue = ?', 3).toCountQuery()).toEqual([
      'SELECT COUNT(*) AS total FROM cards WHERE manaValue = $1',
      [3],
    ]);
  });
});
