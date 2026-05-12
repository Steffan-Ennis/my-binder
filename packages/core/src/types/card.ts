// Domain types for the card data provider layer (spec 004).
// Consumed by both apps/server and apps/mobile — no provider-specific or SDK details here.

export type CardRecord = {
  id: string;
  name: string;
  set: string;
  cardNumber: string;
  manaCost: string | null;
  colorIdentity: string[];
  // Optional — may be absent when the provider's legality data is incomplete.
  commanderLegal?: boolean;
  // Optional — may be absent when the provider has no image reference for a printing.
  imageRef?: string | null;
};

export type Printing = {
  name: string;
  set: string;
  cardNumber: string;
  imageRef: string | null;
};

export type LegalityResult = {
  cardName: string;
  legal: boolean;
  reason: string | null;
  colorIdentity: string[];
};

export type SearchQuery = {
  name?: string;
  set?: string;
  colorIdentity?: string[];
  cmcMin?: number;
  cmcMax?: number;
  page?: number;
  limit?: number;
};

export type SearchResult = {
  cards: CardRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ProviderInfo = {
  name: string;
  active: boolean;
  reachable: boolean;
};

// Returned by lookup when the card name has no match. This is a clean result, not an error.
export type CardNotFoundResult = {
  found: false;
  name: string;
};

// Provider-supplied enrichment for a single printing identified by its
// MTGJSON UUID — used to decorate a stored Card with display metadata
// (set name, type line) and the Scryfall id needed to construct an image URL.
export type CardDetails = {
  uuid: string;
  name: string;
  setCode: string;
  setName: string | null;
  cardNumber: string;
  typeLine: string;
  scryfallId: string | null;
};

export type ProviderNotFoundError = {
  type: 'PROVIDER_NOT_FOUND';
  message: string;
};

export type ProviderUnavailableError = {
  type: 'PROVIDER_UNAVAILABLE';
  message: string;
};
