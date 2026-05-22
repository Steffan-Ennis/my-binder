import type { MtgjsonSDK } from 'mtgjson-sdk';
import type {
  CardDetails,
  CardImages,
  CardPriceHistoryResponse,
  CardPricesResponse,
  CardRecord,
  LegalityResult,
  SearchQuery,
} from '@my-binder/core';
import type { CardProvider } from '@src/providers/interface';
import { CardSearchBuilder } from './cardSearchBuilder';
import mapCardSetToCardRecord, { mapRowToCardRecord, type MappableCard } from './mapper';
import buildScryfallImageUrls from './scryfallImages';

// Dummy UUID used only to trigger registration of the `card_legalities` view
// (the SDK registers views lazily via its typed API, not via raw `sql()`).
const VIEW_REGISTRATION_UUID = '00000000-0000-0000-0000-000000000000';

// Project a raw DuckDB row (from `sdk.sql`) to the subset the record mapper
// needs. DuckDB returns list columns as JS arrays and nullable text as null.
const toMappableRow = (row: Record<string, unknown>): MappableCard => ({
  uuid: String(row.uuid),
  name: String(row.name),
  setCode: String(row.setCode),
  number: String(row.number),
  manaCost: row.manaCost == null ? undefined : String(row.manaCost),
  colorIdentity: Array.isArray(row.colorIdentity) ? row.colorIdentity.map(String) : [],
});

class MtgjsonProvider implements CardProvider {
  private readonly sdk: MtgjsonSDK;
  // Memoised one-time registration of the DuckDB views `searchRaw` queries.
  private viewsReady: Promise<void> | null = null;

  /**
   * Construct a card provider backed by an MTGJSON SDK instance.
   *
   * The SDK is expected to be already initialised — the provider does not own
   * its lifecycle beyond closing it on shutdown.
   *
   * @param sdk - A live `MtgjsonSDK` instance.
   *
   * @example
   * ```ts
   * import { createSdk } from 'mtgjson-sdk';
   * const sdk = await createSdk({ cacheDir: '/mnt/efs/mtgjson-cache' });
   * const provider = new MtgjsonProvider(sdk);
   * ```
   */
  constructor(sdk: MtgjsonSDK) {
    this.sdk = sdk;
  }

  /**
   * Register the `cards` and `card_legalities` views before issuing raw SQL.
   * The SDK registers views lazily through its typed API, not through `sql()`,
   * so a raw query referencing an unregistered view fails. `cards.count()`
   * registers `cards`; a throwaway `legalities.isLegal` registers
   * `card_legalities`. Memoised so it runs once per provider instance.
   */
  private ensureViews(): Promise<void> {
    if (this.viewsReady === null) {
      this.viewsReady = (async () => {
        await this.sdk.cards.count();
        await this.sdk.legalities.isLegal(VIEW_REGISTRATION_UUID, 'commander');
      })();
    }
    return this.viewsReady;
  }

  /**
   * Spec 018 — SQL-native catalogue search. Builds one parameterised query per
   * the supplied filter set (via {@link CardSearchBuilder}), runs a COUNT and a
   * paged SELECT against the `cards` view, and enriches only the returned page.
   *
   * Returns the page plus the total match count so the caller can paginate.
   * `options.excludeUuids` drops printings the caller already owns (missingOnly)
   * inside the SQL, keeping COUNT + paging exact.
   *
   * @param query - Catalogue filters plus `page`/`limit`.
   * @param options.excludeUuids - Printing UUIDs to exclude from results.
   * @returns `{ cards, total }` — one page of enriched records and the total count.
   *
   * @example
   * ```ts
   * const { cards, total } = await provider.searchRaw(
   *   { name: 'bolt', colorIdentity: ['R'], page: 1, limit: 20 },
   *   { excludeUuids: ownedUuids },
   * );
   * ```
   */
  async searchRaw(
    query: SearchQuery,
    options?: { excludeUuids?: ReadonlyArray<string> },
  ): Promise<{ cards: CardRecord[]; total: number }> {
    await this.ensureViews();

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const builder = CardSearchBuilder.fromQuery(query, options);

    const [countSql, countParams] = builder.toCountQuery();
    const countRows = await this.sdk.sql(countSql, countParams);
    const total = Number(countRows[0]?.total ?? 0);

    const [pageSql, pageParams] = builder.toPageQuery(limit, offset);
    const rows = await this.sdk.sql(pageSql, pageParams);

    const cards = await this.collectCards(rows.map(toMappableRow));
    return { cards, total };
  }

  async getByUuids (uuids: string[]): Promise<CardRecord[]> {
    const cards = await this.sdk.cards.getByUuids(uuids)
    return cards.map<CardRecord>((card) => mapCardSetToCardRecord(card))
  }

  /**
   * Release SDK resources (open DuckDB connections, parquet readers).
   * Call once on server shutdown.
   *
   * @returns Resolves when the SDK has fully closed.
   *
   * @example
   * ```ts
   * await provider.close();
   * ```
   */
  async close(): Promise<void> {
    await this.sdk.close();
  }

  // ─── CardProvider ────────────────────────────────────────────────────────────


  /**
   * Check whether a card is legal in the Commander format, optionally constrained
   * by the commander's colour identity.
   *
   * Throws an error tagged `code: 'CARD_NOT_FOUND'` if the name does not resolve
   * to any paper printing.
   *
   * @param name - The card name to check.
   * @param commanderColors - Optional commander colour identity (e.g. `['R', 'U']`). When provided, cards whose colour identity contains any colour outside this set are reported as illegal with reason `'Colour identity conflict'`.
   * @returns A `LegalityResult` describing legality, the reason if illegal, and the card's colour identity.
   * @throws Error with `code: 'CARD_NOT_FOUND'` when the name has no paper printing.
   *
   * @example
   * ```ts
   * await provider.checkLegality('Channel');
   * // { cardName: 'Channel', legal: false, reason: 'Banned in Commander', colorIdentity: ['G'] }
   *
   * await provider.checkLegality('Lightning Bolt', ['U', 'B']);
   * // { cardName: 'Lightning Bolt', legal: false, reason: 'Colour identity conflict', colorIdentity: ['R'] }
   *
   * await provider.checkLegality('Sol Ring');
   * // { cardName: 'Sol Ring', legal: true, reason: null, colorIdentity: [] }
   * ```
   */
  async checkLegality(name: string, commanderColors?: string[]): Promise<LegalityResult> {
    const cards = await this.sdk.cards.getByName(name);
    const paperCards = cards.filter((c) => c.availability.includes('paper'));

    if (paperCards.length === 0) {
      throw Object.assign(new Error(`No card found with name "${name}".`), {
        code: 'CARD_NOT_FOUND',
      });
    }

    const card = paperCards[0]!;
    const cardColorIdentity = card.colorIdentity;

    const commanderStatus = await this.sdk.legalities.isLegal(card.uuid, 'commander')

    if (!commanderStatus) {
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

    if (commanderStatus) {
      return {
        cardName: name,
        legal: false,
        reason: 'Not legal in Commander',
        colorIdentity: cardColorIdentity,
      };
    }

    return { cardName: name, legal: true, reason: null, colorIdentity: cardColorIdentity };
  }

  /**
   * Resolve a single printing by its MTGJSON UUID and return display-ready
   * details (name, set, type line, scryfall id) used to decorate stored
   * `Card` rows.
   *
   * Performs three sequential SDK calls (cards, identifiers, sets) — concurrent
   * access to the SDK's underlying DuckDB connection produces a "Failed to
   * execute prepared statement" race condition (see `enrichCard`).
   *
   * @param uuid - MTGJSON printing UUID.
   * @returns A `CardDetails` record, or `null` if the UUID is unknown.
   *
   * @example
   * ```ts
   * const details = await provider.getByUuid('e3285fd6-0000-0000-0000-example00001');
   * // { uuid, name: 'Lightning Bolt', setCode: 'M11', setName: 'Magic 2011', ... }
   * ```
   */
  async getByUuid(uuid: string): Promise<CardDetails | null> {
    const card = await this.sdk.cards.getByUuid(uuid);
    if (!card) return null;

    const ids = await this.sdk.identifiers.getIdentifiers(uuid);
    const scryfallId = typeof ids?.scryfallId === 'string' ? ids.scryfallId : null;

    const setInfo = await this.sdk.sets.get(card.setCode);

    return {
      uuid,
      name: card.name,
      setCode: card.setCode,
      setName: setInfo?.name ?? null,
      cardNumber: card.number,
      typeLine: card.type,
      oracle: card.originalText!,
      scryfallId,
    };
  }

  /**
   * Resolve the Scryfall image URLs (`small`, `medium`, `large`) for a single
   * printing by its MTGJSON UUID.
   *
   * Reads only the identifiers Parquet — significantly cheaper than `getByUuid`,
   * which additionally reads the cards and sets Parquets to populate display
   * metadata.
   *
   * @param uuid - MTGJSON printing UUID.
   * @returns A `CardImages` record, or `null` when the UUID is unknown OR the
   *   printing has no Scryfall identifier on file.
   *
   * @example
   * ```ts
   * const images = await provider.getCardImages('e3285fd6-0000-0000-0000-example00001');
   * // { small: 'https://...', medium: 'https://...', large: 'https://...' }
   * ```
   */
  async getCardImages(uuid: string): Promise<CardImages | null> {
    const ids = await this.sdk.identifiers.getIdentifiers(uuid);
    const scryfallId = typeof ids?.scryfallId === 'string' ? ids.scryfallId : null;
    if (scryfallId === null) return null;
    return buildScryfallImageUrls(scryfallId);
  }

  /**
   * Lightweight liveness probe that issues a single SDK call.
   *
   * Used by `/health` to verify that the underlying parquet cache is readable.
   * Swallows all errors and reports `false`; never throws.
   *
   * @returns `true` if a known card (`Lightning Bolt`) was retrieved, `false` otherwise.
   *
   * @example
   * ```ts
   * if (!(await provider.isReachable())) {
   *   throw new Error('Card data unavailable');
   * }
   * ```
   */
  async isReachable(): Promise<boolean> {
    try {
      const cards = await this.sdk.cards.getByName('Lightning Bolt');
      return cards.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Spec 018 / FR-017 — latest observation per source for a single printing.
   *
   * Stub: real implementation lands in spec 018 / US3 (task T057) and fans
   * out to `sdk.prices.today` per source. Until then this method throws so
   * the price routes (also gated on US3) fail loudly if wired prematurely.
   *
   * @param uuid - MTGJSON printing UUID.
   * @returns the latest per-source `CardPricesResponse`.
   *
   * @example
   *   const prices = await provider.getPrices('6ca7af0b-…');
   */
  async getPrices(uuid: string): Promise<CardPricesResponse> {
    throw new Error(`MtgjsonProvider.getPrices not implemented (pending spec 018 US3) — uuid=${uuid}`);
  }

  /**
   * Spec 018 / FR-018 — per-source 30-day price series for a single printing.
   *
   * Stub: real implementation lands in spec 018 / US3 (task T057).
   *
   * @param uuid - MTGJSON printing UUID.
   * @param days - history window length in days (1..365).
   * @returns the per-source `CardPriceHistoryResponse`.
   *
   * @example
   *   const history = await provider.getPriceHistory('6ca7af0b-…', 30);
   */
  async getPriceHistory(uuid: string, days: number): Promise<CardPriceHistoryResponse> {
    throw new Error(
      `MtgjsonProvider.getPriceHistory not implemented (pending spec 018 US3) — uuid=${uuid} days=${days}`,
    );
  }

  private async collectCards(cards: MappableCard[]): Promise<CardRecord[]> {
    const results: CardRecord[] = [];
    for await (const record of this.enrichCards(cards)) {
      results.push(record);
    }
    return results;
  }

  /**
   * Yields enriched cards one at a time to prevent concurrent parquet file downloads.
   * The SDK lazily downloads parquet files on first access — parallel fan-out causes
   * a race condition. Sequential iteration lets the first card warm the cache.
   */
  private async *enrichCards(cards: MappableCard[]): AsyncGenerator<CardRecord> {
    for (const card of cards) {
      console.log(
        `[MtgjsonProvider] enriching card uuid=${card.uuid} name="${card.name}" set=${card.setCode} number=${card.number}`,
      );
      try {
        yield await this.enrichCard(card);
      } catch (err) {
        console.error(
          `[MtgjsonProvider] failed to enrich card uuid=${card.uuid} name="${card.name}" set=${card.setCode}`,
          err,
        );
      }
    }
  }

  /**
   * Fetch the enrichment data for a single card that cannot be obtained from the
   * cards Parquet alone — legalities and identifiers live in separate Parquet files.
   *
   * The two SDK calls are awaited sequentially rather than wrapped in `Promise.all`:
   * concurrent access to the SDK's underlying DuckDB connection produces a
   * "Failed to execute prepared statement" race condition.
   */
  private async enrichCard(card: MappableCard): Promise<CardRecord> {
    // const ids = await this.sdk.identifiers.getIdentifiers(card.uuid);
    const commanderLegal = await this.sdk.legalities.isLegal(card.uuid, 'commander');
    // const scryfallId = typeof ids?.scryfallId === 'string' ? ids.scryfallId : null;
    return mapRowToCardRecord(card, { commanderLegal });
  }
}

export default MtgjsonProvider
