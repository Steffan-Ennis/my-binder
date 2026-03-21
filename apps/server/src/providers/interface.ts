import type { CardRecord, CardNotFoundResult, LegalityResult, SearchQuery } from '@my-binder/core';

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
  isReachable(): Promise<boolean>;
};
