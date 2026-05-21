import type { CardSet } from 'mtgjson-sdk';
import type { CardRecord } from '@my-binder/core';

// Enrichment data fetched separately — legalities and identifiers are in their
// own Parquet files and are never populated by getByName/search/getPrintings.
export type CardEnrichment = {
  commanderLegal?: boolean;
  scryfallId?: string | null;
};

// The subset of `CardSet` fields the record mapping actually reads. `searchRaw`
// projects exactly these columns from raw SQL rows, so it can feed the mapper
// without materialising a full `CardSet`. A full `CardSet` also satisfies this.
export type MappableCard = Pick<
  CardSet,
  'uuid' | 'name' | 'setCode' | 'number' | 'manaCost' | 'colorIdentity'
>;

// Scryfall image CDN convention: paths shard by the first two characters of
// the Scryfall id. Exposed only for tests; not part of the public surface.
function scryfallNormalImageUrl(scryfallId: string): string | undefined {
  if (scryfallId.length < 2) return undefined;
  return `https://cards.scryfall.io/normal/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
}

// Maps a single printing (full CardSet or a projected row) to our normalised
// CardRecord. SDK field reference: research.md § 4 — Response Mapping.
export const mapRowToCardRecord = (card: MappableCard, enrichment?: CardEnrichment): CardRecord => {
  return {
    id: card.uuid,
    name: card.name,
    set: card.setCode,
    cardNumber: card.number,
    manaCost: card.manaCost ?? null,
    colorIdentity: card.colorIdentity,
    commanderLegal: enrichment?.commanderLegal,
    imageRef: enrichment?.scryfallId ? scryfallNormalImageUrl(enrichment?.scryfallId!) : '',
  };
}

const mapCardSetToCardRecord = (card: CardSet, enrichment?: CardEnrichment): CardRecord =>
  mapRowToCardRecord(card, enrichment);

export default mapCardSetToCardRecord
