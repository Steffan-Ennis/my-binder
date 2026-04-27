import type {MtgjsonSDK, CardSet} from 'mtgjson-sdk';
import type { CardRecord, CardNotFoundResult, LegalityResult, SearchQuery } from '@my-binder/core';
import type { CardProvider, LookupOptions } from '@src/providers/interface';
import { mapCardSetToCardRecord } from '@src/providers/mtgjson/mapper';

export class MtgjsonProvider implements CardProvider {
  private readonly sdk: MtgjsonSDK;

  constructor(sdk: MtgjsonSDK) {
    this.sdk = sdk;
  }

  async close(): Promise<void> {
    await this.sdk.close();
  }

  // ─── CardProvider ────────────────────────────────────────────────────────────

  async lookup(name: string, opts: LookupOptions = {}): Promise<CardRecord[] | CardNotFoundResult> {
    const { fuzzy = true, set, number } = opts;

    let cards = set !== undefined
      ? await this.sdk.cards.getByName(name, { setCode: set })
      : fuzzy
        ? await this.sdk.cards.search({ fuzzyName: name, availability: 'paper' })
        : await this.sdk.cards.getByName(name);

    // For getByName results, filter to paper availability in-process.
    if (set !== undefined || !fuzzy) {
      cards = cards.filter((c) => c.availability.includes('paper'));
    }

    // Exact collector number filter (no native SDK param).
    if (number !== undefined) {
      cards = cards.filter((c) => c.number === number);
    }

    if (cards.length === 0) {
      return { found: false, name };
    }

    return cards.map((card) =>
      mapCardSetToCardRecord(card, {
        scryfallId: card.identifiers.scryfallId,
        commanderLegal: card.legalities.commander === 'Legal',
      }),
    );
  }

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

  async search(query: SearchQuery): Promise<CardRecord[]> {
    const cards = await this.sdk.cards.search({
      ...(query.name !== undefined && { fuzzyName: query.name }),
      ...(query.set !== undefined && { setCode: query.set }),
      ...(query.cmcMin !== undefined && { manaValueGte: query.cmcMin }),
      ...(query.cmcMax !== undefined && { manaValueLte: query.cmcMax }),
      ...(query.colorIdentity !== undefined) && { colorIdentity: query.colorIdentity },
      availability: 'paper',
    });

    // TODO: re-enable enrichment after debugging
    return await Promise.all(cards.map(card => this.enrichCard(card)));
    // return enrichedCards.map(card => mapCardSetToCardRecord(card, { scryfallId: null, commanderLegal: false }));
  }

  async isReachable(): Promise<boolean> {
    try {
      const cards = await this.sdk.cards.getByName('Lightning Bolt');
      return cards.length > 0;
    } catch {
      return false;
    }
  }

  // Fetch the enrichment data for a single card that cannot be obtained from the
  // cards Parquet alone — legalities and identifiers live in separate Parquet files.
  private async enrichCard(card: CardSet): Promise<CardRecord> {
    const [ids, commanderLegal = false] = await Promise.all([
      this.sdk.identifiers.getIdentifiers(card.uuid),
      // this.sdk.legalities.isLegal(card.uuid, 'commander'),
    ]);
  const scryfallId = typeof ids?.scryfallId === 'string' ? ids.scryfallId : null;
    return mapCardSetToCardRecord(card, { commanderLegal, scryfallId });
  }
}
