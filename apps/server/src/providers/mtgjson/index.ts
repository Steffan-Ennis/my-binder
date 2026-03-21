import { MtgjsonSDK } from 'mtgjson-sdk';
import type { CardSet } from 'mtgjson-sdk';
import type { CardRecord, CardNotFoundResult, LegalityResult, SearchQuery } from '@my-binder/core';
import type { CardProvider, LookupOptions } from '@src/providers/interface';
import { mapCardSetToCardRecord } from './mapper';

// A card is physical if "paper" is in its availability list.
// isOnlineOnly is unreliable (frequently null for physical cards).
const isPhysical = (c: CardSet): boolean =>
  Array.isArray(c.availability) && c.availability.includes('paper');

export class MtgjsonProvider implements CardProvider {
  private readonly sdk: MtgjsonSDK;

  private constructor(sdk: MtgjsonSDK) {
    this.sdk = sdk;
  }

  // Use the factory to ensure the SDK (and its DuckDB) is fully initialised before use.
  static async create(options?: { cacheDir?: string }): Promise<MtgjsonProvider> {
    const sdk = await MtgjsonSDK.create(options);
    return new MtgjsonProvider(sdk);
  }

  async close(): Promise<void> {
    await this.sdk.close();
  }

  // ─── CardProvider ────────────────────────────────────────────────────────────

  async lookup(name: string, opts: LookupOptions = {}): Promise<CardRecord[] | CardNotFoundResult> {
    const { fuzzy = true, set, number } = opts;

    let results: CardSet[];

    if (set !== undefined) {
      // Set-scoped lookup always uses exact name matching (fuzzy flag is irrelevant).
      results = await this.sdk.cards.getByName(name, { setCode: set });
      if (number !== undefined) {
        results = results.filter((c) => c.number === number);
      }
    } else {
      results = fuzzy
        ? await this.sdk.cards.search({ fuzzyName: name })
        : await this.sdk.cards.getPrintings(name);
    }

    const physical = results.filter(isPhysical);
    if (physical.length === 0) {
      return { found: false, name };
    }
    return Promise.all(physical.map((card) => this.enrichCard(card)));
  }

  async checkLegality(name: string, commanderColors?: string[]): Promise<LegalityResult> {
    const cards = await this.sdk.cards.getByName(name);
    const physical = cards.filter(isPhysical);

    if (physical.length === 0) {
      // Propagate as an Error so the service layer can map it to a 404.
      throw Object.assign(new Error(`No card found with name "${name}".`), { code: 'CARD_NOT_FOUND' });
    }

    // Legality is name-level — any printing's UUID gives the same result.
    const { uuid, colorIdentity: cardColorIdentity } = physical[0]!;
    const formats = await this.sdk.legalities.formatsForCard(uuid);

    if (formats['commander'] === 'Banned') {
      return {
        cardName: name,
        legal: false,
        reason: 'Banned in Commander',
        colorIdentity: cardColorIdentity,
      };
    }

    // Check colour identity against the Commander's colours (if provided).
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

    if (formats['commander'] !== 'Legal') {
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
    const results = await this.sdk.cards.search({
      ...(query.name !== undefined && { fuzzyName: query.name }),
      ...(query.set !== undefined && { setCode: query.set }),
      ...(query.colorIdentity !== undefined && { colorIdentity: query.colorIdentity }),
      ...(query.cmcMin !== undefined && { manaValueGte: query.cmcMin }),
      ...(query.cmcMax !== undefined && { manaValueLte: query.cmcMax }),
      availability: 'paper',
    });
    return Promise.all(results.map((card) => this.enrichCard(card)));
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.sdk.cards.getByName('Lightning Bolt');
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  // Fetch the enrichment data for a single card that cannot be obtained from the
  // cards Parquet alone — legalities and identifiers live in separate Parquet files.
  private async enrichCard(card: CardSet): Promise<CardRecord> {
    const [ids, commanderLegal] = await Promise.all([
      this.sdk.identifiers.getIdentifiers(card.uuid),
      this.sdk.legalities.isLegal(card.uuid, 'commander'),
    ]);
    const scryfallId = typeof ids?.scryfallId === 'string' ? ids.scryfallId : null;
    return mapCardSetToCardRecord(card, { commanderLegal, scryfallId });
  }
}
