import type { SearchQuery } from '@my-binder/core';

// Spec 018 — parameterised SQL builder for the MTGJSON `cards` DuckDB view,
// driven by the catalogue `SearchQuery`. Produces a COUNT query and a paged
// SELECT that share one WHERE clause, so pagination (LIMIT/OFFSET) and the
// total count come from the data layer rather than in-memory slicing.
//
// Binding: the SDK's `sql()` does NOT accept a JS array bound to a single
// `$n::VARCHAR[]` param (it coerces the array to a scalar and the cast fails),
// so every list filter expands to individual scalar placeholders. Fragments
// are accumulated with `?` markers and a flat params array; `build()` rewrites
// `?` → `$1..$n` left-to-right, which is why the params array MUST be assembled
// in the same textual order the placeholders appear (WHERE, then ORDER BY, then
// LIMIT/OFFSET).

const CARDS_VIEW = 'cards';
const LEGALITIES_VIEW = 'card_legalities';
const PAGE_COLUMNS = 'uuid, name, setCode, number, manaCost, colorIdentity';
// Jaro-Winkler cutoff — matches the SDK's own `whereFuzzy` default (0.8).
const NAME_FUZZY_THRESHOLD = 0.8;
const DEFAULT_ORDER = 'name ASC, number ASC';

const renumber = (sql: string): string => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

export class CardSearchBuilder {
  private readonly wheres: string[] = [];
  private readonly whereParams: unknown[] = [];
  private orderSql: string = DEFAULT_ORDER;
  private orderParams: unknown[] = [];

  /**
   * Low-level escape hatch: append one WHERE fragment (using `?` placeholders)
   * and its bound values. Every `with*` method below delegates here.
   */
  withFilter(fragment: string, ...values: unknown[]): this {
    this.wheres.push(fragment);
    this.whereParams.push(...values);
    return this;
  }

  // FR-021 — paper printings only.
  withPaperOnly(): this {
    return this.withFilter(`list_contains(availability, 'paper')`);
  }

  // Fuzzy name match (Jaro-Winkler). When present it also drives ordering by
  // descending similarity — mirroring the SDK's `search()` behaviour.
  withName(name?: string): this {
    const trimmed = name?.trim();
    if (!trimmed) return this;
    this.withFilter(`jaro_winkler_similarity(lower(name), lower(?)) > ${NAME_FUZZY_THRESHOLD}`, trimmed);
    this.orderSql = 'jaro_winkler_similarity(lower(name), lower(?)) DESC, number ASC';
    this.orderParams = [trimmed];
    return this;
  }

  withSet(set?: string): this {
    if (!set) return this;
    return this.withFilter('setCode = ?', set);
  }

  withCmcRange(min?: number, max?: number): this {
    if (min !== undefined) this.withFilter('manaValue >= ?', min);
    if (max !== undefined) this.withFilter('manaValue <= ?', max);
    return this;
  }

  // Subset semantics: a card matches when its colour identity contains no
  // colour outside the selected set. `'C'` is the colourless bucket — it has
  // no real identity letter, so it matches the empty colour identity only.
  withColorIdentity(colors?: ReadonlyArray<string>): this {
    if (!colors?.length) return this;
    const includeColorless = colors.includes('C');
    const real = colors.filter((c) => c !== 'C');

    const branches: string[] = [];
    const params: unknown[] = [];
    if (real.length > 0) {
      const placeholders = real.map(() => '?').join(', ');
      branches.push(
        `(len(colorIdentity) > 0 AND len(list_filter(colorIdentity, x -> x NOT IN (${placeholders}))) = 0)`,
      );
      params.push(...real);
    }
    if (includeColorless) branches.push('len(colorIdentity) = 0');
    if (branches.length === 0) return this;
    return this.withFilter(`(${branches.join(' OR ')})`, ...params);
  }

  // OR-within-dimension: legal in at least one requested format. Subquery (not
  // a JOIN) so it can't multiply rows and break COUNT(*). Formats are lowercased
  // to match `card_legalities.format`.
  withFormats(formats?: ReadonlyArray<string>): this {
    if (!formats?.length) return this;
    const lowered = formats.map((f) => f.toLowerCase());
    const placeholders = lowered.map(() => '?').join(', ');
    return this.withFilter(
      `uuid IN (SELECT uuid FROM ${LEGALITIES_VIEW} WHERE status = 'Legal' AND format IN (${placeholders}))`,
      ...lowered,
    );
  }

  withSuperTypes(values?: ReadonlyArray<string>): this {
    return this.withListContainsAny('supertypes', values);
  }

  withSubTypes(values?: ReadonlyArray<string>): this {
    return this.withListContainsAny('subtypes', values);
  }

  // Creature subtype filter: a Creature whose subtypes intersect the requested set.
  withCreatureTypes(values?: ReadonlyArray<string>): this {
    if (!values?.length) return this;
    const ors = values.map(() => 'list_contains(subtypes, ?)').join(' OR ');
    return this.withFilter(`(list_contains(types, 'Creature') AND (${ors}))`, ...values);
  }

  // Drop printings the caller already owns (missingOnly). Scalar `NOT IN` list
  // — fine for typical binder sizes.
  withExcludedUuids(uuids?: ReadonlyArray<string>): this {
    if (!uuids?.length) return this;
    const placeholders = uuids.map(() => '?').join(', ');
    return this.withFilter(`uuid NOT IN (${placeholders})`, ...uuids);
  }

  toCountQuery(): [string, unknown[]] {
    const sql = `SELECT COUNT(*) AS total FROM ${CARDS_VIEW}${this.whereClause()}`;
    return [renumber(sql), [...this.whereParams]];
  }

  toPageQuery(limit: number, offset: number): [string, unknown[]] {
    const sql =
      `SELECT ${PAGE_COLUMNS} FROM ${CARDS_VIEW}${this.whereClause()}` +
      ` ORDER BY ${this.orderSql} LIMIT ? OFFSET ?`;
    return [renumber(sql), [...this.whereParams, ...this.orderParams, limit, offset]];
  }

  static fromQuery(query: SearchQuery, options?: { excludeUuids?: ReadonlyArray<string> }): CardSearchBuilder {
    return new CardSearchBuilder()
      .withPaperOnly()
      .withName(query.name)
      .withSet(query.set)
      .withColorIdentity(query.colorIdentity)
      .withCmcRange(query.cmcMin, query.cmcMax)
      .withFormats(query.formats)
      .withSuperTypes(query.superTypes)
      .withSubTypes(query.subTypes)
      .withCreatureTypes(query.creatureTypes)
      .withExcludedUuids(options?.excludeUuids);
  }

  private withListContainsAny(column: string, values?: ReadonlyArray<string>): this {
    if (!values?.length) return this;
    const ors = values.map(() => `list_contains(${column}, ?)`).join(' OR ');
    return this.withFilter(`(${ors})`, ...values);
  }

  private whereClause(): string {
    return this.wheres.length ? ` WHERE ${this.wheres.join(' AND ')}` : '';
  }
}
