import type { CardDetails, CardImages, CardRecord, LegalityResult, SearchQuery } from '@my-binder/core';

// The contract every card data provider must satisfy.
// Add a new provider by implementing this type and registering it in the registry.
export type LookupOptions = {
  fuzzy?: boolean;
  set?: string;
  number?: string;
};

export type CardProvider = {
  checkLegality(name: string, commanderColors?: string[]): Promise<LegalityResult>;
  search(query: SearchQuery): Promise<CardRecord[]>;
  // Resolve a single printing by its MTGJSON UUID. Returns null when the UUID
  // does not resolve to a card. Used by the user-collection layer to enrich
  // stored Card rows with display metadata (set name, type line, image).
  getByUuid(uuid: string): Promise<CardDetails | null>;
  getByUuids(uuid: string[]): Promise<CardRecord[]>
  // Resolve a single printing's Scryfall image URLs (small/medium/large) by
  // its MTGJSON UUID. Returns null when the UUID is unknown OR the printing
  // has no Scryfall identifier on file. The HTTP layer maps null → 404.
  getCardImages(uuid: string): Promise<CardImages | null>;
  isReachable(): Promise<boolean>;
};
