import type { MtgjsonSDK, CardSet} from 'mtgjson-sdk';
import type { CardDetails, CardImages, CardRecord, LegalityResult, SearchQuery } from '@my-binder/core';
import type { CardProvider } from '@src/providers/interface';
import mapCardSetToCardRecord  from './mapper';
import buildScryfallImageUrls from './scryfallImages';

class MtgjsonProvider implements CardProvider {
  private readonly sdk: MtgjsonSDK;

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
    const commanderStatus = card.legalities.commander;

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

  /**
   * Search the paper card pool with structured filters and return enriched records.
   *
   * Each result is enriched with the Scryfall identifier and Commander legality
   * via sequential per-card SDK calls (see `enrichCards` for the rationale).
   *
   * @param query - Structured filters. Any combination may be supplied.
   * @param query.name - Fuzzy name match.
   * @param query.set - Restrict to a specific set code.
   * @param query.cmcMin - Minimum mana value (inclusive).
   * @param query.cmcMax - Maximum mana value (inclusive).
   * @param query.colorIdentity - Restrict to cards within this colour identity (e.g. `['R', 'G']`).
   * @returns An array of `CardRecord`s in SDK order. Empty if no card matches.
   *
   * @example
   * ```ts
   * const cheapReds = await provider.search({ colorIdentity: ['R'], cmcMax: 3 });
   *
   * const bolts = await provider.search({ name: 'bolt' });
   *
   * const m11Set = await provider.search({ set: 'M11' });
   * ```
   */
  async search(query: SearchQuery): Promise<CardRecord[]> {
    const cards = await this.sdk.cards.search({
      ...(query.name !== undefined && { fuzzyName: query.name }),
      ...(query.set !== undefined && { setCode: query.set }),
      ...(query.cmcMin !== undefined && { manaValueGte: query.cmcMin }),
      ...(query.cmcMax !== undefined && { manaValueLte: query.cmcMax }),
      ...(query.colorIdentity !== undefined) && { colorIdentity: query.colorIdentity },
      availability: 'paper',
    });

    return this.collectCards(cards);
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

  private async collectCards(cards: CardSet[]): Promise<CardRecord[]> {
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
  private async *enrichCards(cards: CardSet[]): AsyncGenerator<CardRecord> {
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
  private async enrichCard(card: CardSet): Promise<CardRecord> {
    const ids = await this.sdk.identifiers.getIdentifiers(card.uuid);
    const commanderLegal = await this.sdk.legalities.isLegal(card.uuid, 'commander');
    const scryfallId = typeof ids?.scryfallId === 'string' ? ids.scryfallId : null;
    return mapCardSetToCardRecord(card, { commanderLegal, scryfallId });
  }
}

export default MtgjsonProvider
