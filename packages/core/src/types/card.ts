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
  // Spec 018 / FR-024: the signed-in user's owned count for this printing.
  // Always populated on catalogue search responses for authenticated requests
  // (0 when unowned). Allows the catalogue glyph to render from the cell
  // payload alone — no second request. Absent for unauthenticated callers.
  numberOwned?: number;
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
  // Spec 018 / FR-005 catalogue filter dimensions. OR within each dimension,
  // AND across dimensions. Case-sensitive match against the provider's vocab.
  formats?: string[];
  superTypes?: string[];
  subTypes?: string[];
  creatureTypes?: string[];
  // Restricts results to printings the signed-in user does NOT own
  // (numberOwned === 0). Requires the request to carry a user identity.
  missingOnly?: boolean;
  // Internal — populated by the route handler from `request.identity`. The
  // service layer joins on this to project numberOwned and to satisfy
  // missingOnly. Mobile clients MUST NOT set this; the field is not part of
  // the wire shape.
  userId?: string;
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
  oracle: string | null;
};

// Scryfall CDN image URLs for a single printing at three sizes.
// `medium` maps to Scryfall's `normal` (488×680 JPG) at the URL-builder seam.
export type CardImages = {
  small: string;
  medium: string;
  large: string;
};

export type ProviderNotFoundError = {
  type: 'PROVIDER_NOT_FOUND';
  message: string;
};

export type ProviderUnavailableError = {
  type: 'PROVIDER_UNAVAILABLE';
  message: string;
};

// ─── Spec 018: price observations (FR-017, FR-018, FR-019) ───────────────
// In-scope sources for this spec are Card Kingdom and TCG Player. MTG
// Goldfish was named in the original spec input but deferred to a follow-up
// per the spec's 2026-05-18 Clarifications entry — MTGJSON does not publish
// that dataset. The wire shapes (CardPricesResponse, CardPriceHistoryResponse)
// are designed additively so a follow-up spec can add a third slot without
// breaking existing consumers.

export const PRICE_SOURCES = ['CARD_KINGDOM', 'TCG_PLAYER'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

// Latest observation per source for a single printing. `null` per slot when
// MTGJSON has no observation for the (printing, source) pair.
export type PriceQuote = {
  source: PriceSource;
  amountCents: number;
  currency: string;       // ISO 4217
  observedOn: string;     // ISO date (YYYY-MM-DD)
} | null;

export type CardPricesResponse = {
  printingId: string;
  cardKingdom: PriceQuote;
  tcgPlayer: PriceQuote;
};

// One point on a per-source price series.
export type PricePoint = {
  observedOn: string;     // ISO date
  amountCents: number;
};

// Per-source series over the last `days` calendar days ending today.
export type CardPriceHistoryResponse = {
  printingId: string;
  days: number;
  cardKingdom: PricePoint[];
  tcgPlayer: PricePoint[];
};
