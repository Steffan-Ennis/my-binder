import type { MtgjsonSDK } from 'mtgjson-sdk';
import type {
  CardDetails,
  CardImages,
  CardPriceHistoryResponse,
  CardPricesResponse,
  CardRecord,
  LegalityResult,
  PricePoint,
  PriceQuote,
  PriceSource,
  SearchQuery,
} from '@my-binder/core';
import type { CardProvider } from '@src/providers/interface';
import { CardSearchBuilder } from './cardSearchBuilder';
import mapCardSetToCardRecord, { mapRowToCardRecord, type MappableCard } from './mapper';
import buildScryfallImageUrls from './scryfallImages';

// Dummy UUID used only to trigger registration of the `card_legalities` view
// (the SDK registers views lazily via its typed API, not via raw `sql()`).
const VIEW_REGISTRATION_UUID = '00000000-0000-0000-0000-000000000000';

// Spec 020 — map each in-scope wire price source to the MTGJSON SDK provider
// key. MTG Goldfish is intentionally absent (MTGJSON does not publish it).
const SOURCE_PROVIDER_KEY: Record<PriceSource, string> = {
  CARD_KINGDOM: 'cardkingdom',
  TCG_PLAYER: 'tcgplayer',
};

// Paper-retail only: the `source` (format) column is 'paper' for physical
// printings and 'mtgo'/'arena' for digital. Filtering to 'paper' enforces the
// physical-only contract (FR-006/SC-003).
const PAPER_FORMAT = 'paper';
const NORMAL_FINISH = 'normal';
const RETAIL_PRICE_TYPE = 'retail';

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
      oracle: card.text!,
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
    } catch (error) {
      console.error(error)
      return false;
    }
  }

  /**
   * Spec 020 / FR-017 — latest paper-retail observation per source for a
   * single printing. Fans out one `sdk.prices.today` call per in-scope source
   * (Card Kingdom, TCG Player), keeping the queries sequential because
   * concurrent access to the SDK's shared DuckDB connection races. Only the
   * `normal` finish, `retail` price type and `paper` format are kept (digital
   * observations are excluded — FR-006/SC-003). A source with no observation
   * yields `null`; MTG Goldfish is never emitted.
   *
   * @param uuid - MTGJSON printing UUID.
   * @returns The latest per-source `CardPricesResponse` (`amountCents` wire unit).
   *
   * @example
   * ```ts
   * await provider.getPrices('6ca7af0b-…');
   * // { printingId: '6ca7af0b-…',
   * //   cardKingdom: { source: 'CARD_KINGDOM', amountCents: 1723, currency: 'USD', observedOn: '2026-05-22' },
   * //   tcgPlayer:   { source: 'TCG_PLAYER',  amountCents: 1638, currency: 'USD', observedOn: '2026-05-22' } }
   * ```
   */
  async getPrices(uuid: string): Promise<CardPricesResponse> {
    const cardKingdom = await this.latestQuote(uuid, 'CARD_KINGDOM');
    const tcgPlayer = await this.latestQuote(uuid, 'TCG_PLAYER');
    return { printingId: uuid, cardKingdom, tcgPlayer };
  }

  /**
   * Spec 020 / FR-018 — per-source paper-retail price series over the last
   * `days` calendar days ending today. Fans out one `sdk.prices.history` call
   * per in-scope source (sequential — see {@link getPrices}); keeps the
   * `normal`/`retail`/`paper` slice only. Missing days are simply absent
   * points (the mobile layer renders them as gaps). A source with no paper
   * observation yields `[]`; MTG Goldfish is never emitted.
   *
   * @param uuid - MTGJSON printing UUID.
   * @param days - History window length in days (1..365).
   * @returns The per-source `CardPriceHistoryResponse` (`amountCents` wire unit).
   *
   * @example
   * ```ts
   * await provider.getPriceHistory('6ca7af0b-…', 30);
   * // { printingId: '6ca7af0b-…', days: 30,
   * //   cardKingdom: [{ observedOn: '2026-04-23', amountCents: 1699 }, …],
   * //   tcgPlayer:   [{ observedOn: '2026-04-23', amountCents: 1610 }, …] }
   * ```
   */
  async getPriceHistory(uuid: string, days: number): Promise<CardPriceHistoryResponse> {
    const { dateFrom, dateTo } = MtgjsonProvider.windowEndingToday(days);
    const cardKingdom = await this.seriesFor(uuid, 'CARD_KINGDOM', dateFrom, dateTo);
    const tcgPlayer = await this.seriesFor(uuid, 'TCG_PLAYER', dateFrom, dateTo);
    return { printingId: uuid, days, cardKingdom, tcgPlayer };
  }

  /** Latest paper-retail/normal quote for one source, or `null` if absent. */
  private async latestQuote(uuid: string, source: PriceSource): Promise<PriceQuote> {
    const rows = await this.sdk.prices.today(uuid, {
      provider: SOURCE_PROVIDER_KEY[source],
      finish: NORMAL_FINISH,
      priceType: RETAIL_PRICE_TYPE,
    });
    const row = rows.find((r) => r['source'] === PAPER_FORMAT && r['price'] != null);
    if (row === undefined) return null;
    return {
      source,
      amountCents: Math.round(Number(row['price']) * 100),
      currency: typeof row['currency'] === 'string' ? row['currency'] : 'USD',
      observedOn: String(row['date']),
    };
  }

  /** Paper-retail/normal series for one source over the window. */
  private async seriesFor(
    uuid: string,
    source: PriceSource,
    dateFrom: string,
    dateTo: string,
  ): Promise<PricePoint[]> {
    const rows = await this.sdk.prices.history(uuid, {
      provider: SOURCE_PROVIDER_KEY[source],
      finish: NORMAL_FINISH,
      priceType: RETAIL_PRICE_TYPE,
      dateFrom,
      dateTo,
    });
    return rows
      .filter((r) => r['source'] === PAPER_FORMAT && r['price'] != null)
      .map((r) => ({
        observedOn: String(r['date']),
        amountCents: Math.round(Number(r['price']) * 100),
      }));
  }

  /** Inclusive `[today - (days - 1), today]` window as `YYYY-MM-DD` strings. */
  private static windowEndingToday(days: number): { dateFrom: string; dateTo: string } {
    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const iso = (d: Date): string => d.toISOString().slice(0, 10);
    return { dateFrom: iso(from), dateTo: iso(to) };
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
