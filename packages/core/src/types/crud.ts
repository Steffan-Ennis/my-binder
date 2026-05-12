import {CardRecord} from "@root/src";

export interface Card {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // Mobile binder-home additions (spec 016) — all OPTIONAL. Server may begin
  // returning these in a follow-up enrichment; mobile consumers MUST tolerate
  // their absence and degrade gracefully (placeholder image, name-only filter).
  frontFaceImageUrl?: string;
  setName?: string;
  setCode?: string;
  typeLine?: string;
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
