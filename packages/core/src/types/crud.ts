import {CardRecord} from "@root/src";

export interface Card {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // Mobile binder-home additions (spec 016) — all OPTIONAL. Server may begin
  // returning these in a follow-up enrichment; mobile consumers MUST tolerate
  // their absence and degrade gracefully (name-only filter).
  setName?: string;
  setCode?: string;
  typeLine?: string;
  oracle?: string;
  // Spec 018 / FR-023: physical copies the signed-in user owns for this
  // printing. Present on all /cards responses (always >= 1 — the binder never
  // returns zero-count rows). May be absent on legacy fixtures.
  numberOwned?: number;
}

export interface CardList {
  cards: CardRecord[];
  total: number;
  // Optional cursor for forward-compatible cursor pagination consumed by
  // useCardsInfiniteQuery on mobile. Undefined / null today; populated when
  // the server adopts cursor pagination.
  nextCursor?: string | null;
}

export interface CreateCardBody {
  // MTGJSON printing UUID — becomes the card's primary key (composite with userId).
  id: string;
  name: string;
}

export interface UpdateCardBody {
  name: string;
}

export interface CardIdParams {
  id: string;
}

// Spec 018 / FR-028 — PATCH /cards/:id request body. `+1` increments
// numberOwned; `-1` decrements (and deletes the row at 0). Any other value
// is rejected with VALIDATION_ERROR by the Ajv schema.
export interface PatchCardBody {
  delta: 1 | -1;
}
