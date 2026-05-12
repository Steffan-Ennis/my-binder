import type { CardDetails, CardRecord, CardNotFoundResult, LegalityResult, SearchQuery } from '@my-binder/core';

// The contract every card data provider must satisfy.
// Add a new provider by implementing this type and registering it in the registry.
export type LookupOptions = {
  fuzzy?: boolean;
  set?: string;
  number?: string;
};

export type CardProvider = {
  lookup(name: string, opts?: LookupOptions): Promise<CardRecord[] | CardNotFoundResult>;
  checkLegality(name: string, commanderColors?: string[]): Promise<LegalityResult>;
  search(query: SearchQuery): Promise<CardRecord[]>;
  // Resolve a single printing by its MTGJSON UUID. Returns null when the UUID
  // does not resolve to a card. Used by the user-collection layer to enrich
  // stored Card rows with display metadata (set name, type line, image).
  getByUuid(uuid: string): Promise<CardDetails | null>;
  getByUuids(uuid: string[]): Promise<CardRecord[]>
  isReachable(): Promise<boolean>;
};
