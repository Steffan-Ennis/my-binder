import { DuckDBConnection } from '@duckdb/node-api';
import type { DuckDBValue } from '@duckdb/node-api';
import type { CardRecord, CardNotFoundResult, LegalityResult, SearchQuery } from '@my-binder/core';
import type { CardProvider, LookupOptions } from '@src/providers/interface';
import { fetchRows } from '@src/db/client';

// ---------------------------------------------------------------------------
// Internal row type returned from mtgjson_cards queries
// ---------------------------------------------------------------------------

type CardRow = {
  uuid: string;
  name: string;
  setCode: string;
  number: string;
  availability: string; // comma-space separated, e.g. "paper" or "mtgo, paper"
  colorIdentity: string; // comma-space separated, e.g. "R" or "B, G"
  manaCost: string | null;
  manaValue: number | null;
};

function parseCommaSeparated(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function rowToCardRecord(
  row: CardRow,
  scryfallId: string | null,
  commanderLegal: boolean,
): CardRecord {
  return {
    name: row.name,
    set: row.setCode,
    cardNumber: row.number,
    manaCost: row.manaCost ?? null,
    colorIdentity: parseCommaSeparated(row.colorIdentity),
    commanderLegal,
    imageRef: scryfallId,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class MtgjsonProvider implements CardProvider {
  private readonly db: DuckDBConnection;

  private constructor(db: DuckDBConnection) {
    this.db = db;
  }

  /**
   * Create a provider backed by an already-open DuckDB connection.
   * The connection must have the mtgjson_cards, mtgjson_card_identifiers, and
   * mtgjson_card_legalities tables available (populated by the card importer).
   */
  static create(db: DuckDBConnection): MtgjsonProvider {
    return new MtgjsonProvider(db);
  }

  async close(): Promise<void> {
    // DuckDB connection is managed externally — nothing to close here.
  }

  // ─── CardProvider ────────────────────────────────────────────────────────────

  async lookup(name: string, opts: LookupOptions = {}): Promise<CardRecord[] | CardNotFoundResult> {
    const { fuzzy = true, set, number } = opts;

    let rows: CardRow[];

    if (set !== undefined) {
      if (number !== undefined) {
        rows = await this.queryCards(
          `WHERE LOWER(name) = LOWER(?) AND setCode = ? AND number = ? AND availability LIKE '%paper%'`,
          [name, set, number],
        );
      } else {
        rows = await this.queryCards(
          `WHERE LOWER(name) = LOWER(?) AND setCode = ? AND availability LIKE '%paper%'`,
          [name, set],
        );
      }
    } else if (fuzzy) {
      rows = await this.queryCards(
        `WHERE LOWER(name) LIKE LOWER(?) AND availability LIKE '%paper%'`,
        [`%${name}%`],
      );
    } else {
      rows = await this.queryCards(
        `WHERE LOWER(name) = LOWER(?) AND availability LIKE '%paper%'`,
        [name],
      );
    }

    if (rows.length === 0) {
      return { found: false, name };
    }
    return Promise.all(rows.map((row) => this.enrichRow(row)));
  }

  async checkLegality(name: string, commanderColors?: string[]): Promise<LegalityResult> {
    const rows = await this.queryCards(
      `WHERE LOWER(name) = LOWER(?) AND availability LIKE '%paper%' LIMIT 1`,
      [name],
    );

    if (rows.length === 0) {
      throw Object.assign(new Error(`No card found with name "${name}".`), {
        code: 'CARD_NOT_FOUND',
      });
    }

    const row = rows[0]!;
    const cardColorIdentity = parseCommaSeparated(row.colorIdentity);

    const legalitiesResult = await this.db.run(
      `SELECT commander FROM mtgjson_card_legalities WHERE uuid = ?`,
      [row.uuid],
    );
    const legalitiesRows = await fetchRows(legalitiesResult);
    const commanderStatus = String(legalitiesRows[0]?.['commander'] ?? '');

    if (commanderStatus === 'Banned') {
      return {
        cardName: name,
        legal: false,
        reason: 'Banned in Commander',
        colorIdentity: cardColorIdentity,
      };
    }

    if (commanderColors !== undefined && commanderColors.length > 0) {
      const commanderColorSet = new Set(commanderColors.map((c) => c.toUpperCase()));
      const conflict = cardColorIdentity.some((c) => !commanderColorSet.has(c));
      if (conflict) {
        return {
          cardName: name,
          legal: false,
          reason: 'Colour identity conflict',
          colorIdentity: cardColorIdentity,
        };
      }
    }

    if (commanderStatus !== 'Legal') {
      return {
        cardName: name,
        legal: false,
        reason: 'Not legal in Commander',
        colorIdentity: cardColorIdentity,
      };
    }

    return { cardName: name, legal: true, reason: null, colorIdentity: cardColorIdentity };
  }

  async search(query: SearchQuery): Promise<CardRecord[]> {
    const conditions: string[] = ["availability LIKE '%paper%'"];
    const params: DuckDBValue[] = [];

    if (query.name !== undefined) {
      conditions.push('LOWER(name) LIKE LOWER(?)');
      params.push(`%${query.name}%`);
    }
    if (query.set !== undefined) {
      conditions.push('setCode = ?');
      params.push(query.set);
    }
    if (query.cmcMin !== undefined) {
      conditions.push('manaValue >= ?');
      params.push(query.cmcMin);
    }
    if (query.cmcMax !== undefined) {
      conditions.push('manaValue <= ?');
      params.push(query.cmcMax);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    let rows = await this.queryCards(where, params);

    // colorIdentity filter: card's identity must be a subset of the allowed colors.
    if (query.colorIdentity !== undefined && query.colorIdentity.length > 0) {
      const allowed = new Set(query.colorIdentity.map((c) => c.toUpperCase()));
      rows = rows.filter((row) => {
        const cardColors = parseCommaSeparated(row.colorIdentity);
        return cardColors.every((c) => allowed.has(c));
      });
    }

    return Promise.all(rows.map((row) => this.enrichRow(row)));
  }

  async isReachable(): Promise<boolean> {
    try {
      const result = await this.db.run(
        `SELECT 1 FROM mtgjson_cards WHERE name = 'Lightning Bolt' LIMIT 1`,
      );
      const rows = await fetchRows(result);
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async queryCards(whereClause: string, params: DuckDBValue[]): Promise<CardRow[]> {
    const result = await this.db.run(
      `SELECT uuid, name, setCode, number, availability, colorIdentity, manaCost, manaValue
       FROM mtgjson_cards ${whereClause}`,
      params,
    );
    const rows = await fetchRows(result);
    return rows as unknown as CardRow[];
  }

  private async enrichRow(row: CardRow): Promise<CardRecord> {
    const [identifierRows, legalityRows] = await Promise.all([
      fetchRows(
        await this.db.run(
          `SELECT scryfallId FROM mtgjson_card_identifiers WHERE uuid = ?`,
          [row.uuid],
        ),
      ),
      fetchRows(
        await this.db.run(
          `SELECT commander FROM mtgjson_card_legalities WHERE uuid = ?`,
          [row.uuid],
        ),
      ),
    ]);

    const scryfallId =
      typeof identifierRows[0]?.['scryfallId'] === 'string'
        ? identifierRows[0]['scryfallId']
        : null;
    const commanderLegal = String(legalityRows[0]?.['commander'] ?? '') === 'Legal';

    return rowToCardRecord(row, scryfallId, commanderLegal);
  }
}
