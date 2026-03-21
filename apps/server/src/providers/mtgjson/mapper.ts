import type { CardSet } from 'mtgjson-sdk';
import type { CardRecord } from '@my-binder/core';

// Enrichment data fetched separately — legalities and identifiers are in their
// own Parquet files and are never populated by getByName/search/getPrintings.
export type CardEnrichment = {
  commanderLegal?: boolean;
  scryfallId?: string | null;
};

// Maps an SDK CardSet (a single printing) to our normalised CardRecord.
// SDK field reference: research.md § 4 — Response Mapping.
export function mapCardSetToCardRecord(card: CardSet, enrichment?: CardEnrichment): CardRecord {
  return {
    name: card.name,
    set: card.setCode,
    cardNumber: card.number,
    manaCost: card.manaCost ?? null,
    colorIdentity: card.colorIdentity,
    commanderLegal: enrichment?.commanderLegal,
    imageRef: enrichment?.scryfallId ?? null,
  };
}
