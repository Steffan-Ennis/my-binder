import type {
  Card, CardList, CreateCardBody, UpdateCardBody,
  CardRecord, CardNotFoundResult, LegalityResult, SearchQuery, SearchResult,
} from '@my-binder/core';
import { getRepositories } from '@src/db/repositories';
import { registry } from '@src/providers/registry';

export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Card with id "${id}" not found`);
    this.name = 'NotFoundError';
  }
}

export async function getCards(userId: string): Promise<CardList> {
  const cards = await getRepositories().card.findAll(userId);
  return { cards, total: cards.length };
}

export async function getCard(id: string, userId: string): Promise<Card> {
  const card = await getRepositories().card.findById(id, userId);
  if (card === null) throw new NotFoundError(id);
  return card;
}

export async function createCard(body: CreateCardBody, userId: string): Promise<Card> {
  return getRepositories().card.create(body, userId);
}

export async function updateCard(id: string, body: UpdateCardBody, userId: string): Promise<Card> {
  const card = await getRepositories().card.update(id, body, userId);
  if (card === null) throw new NotFoundError(id);
  return card;
}

export async function deleteCard(id: string, userId: string): Promise<void> {
  const deleted = await getRepositories().card.remove(id, userId);
  if (!deleted) throw new NotFoundError(id);
}

// ─── Provider-backed card operations (spec 004) ───────────────────────────────

export class CardNotFoundError extends Error {
  constructor(name: string) {
    super(`No card found with name "${name}".`);
    this.name = 'CardNotFoundError';
  }
}

export class ProviderUnavailableError extends Error {
  constructor() {
    super('The card data provider is currently unavailable. Please try again.');
    this.name = 'ProviderUnavailableError';
  }
}

export async function lookupCard(
  name: string,
  opts: { fuzzy?: boolean; set?: string; number?: string } = {},
): Promise<CardRecord[] | CardNotFoundResult> {
  try {
    return await registry.getActive().lookup(name, opts);
  } catch (err) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code !== 'CARD_NOT_FOUND') {
      throw new ProviderUnavailableError();
    }
    throw err;
  }
}

export async function checkCommanderLegality(
  name: string,
  commanderColors?: string[],
): Promise<LegalityResult> {
  try {
    return await registry.getActive().checkLegality(name, commanderColors);
  } catch (err) {
    if (err instanceof Error) {
      const typed = err as NodeJS.ErrnoException;
      if (typed.code === 'CARD_NOT_FOUND') throw new CardNotFoundError(name);
    }
    throw new ProviderUnavailableError();
  }
}

export async function searchCards(query: SearchQuery): Promise<SearchResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  let allCards: CardRecord[];
  try {
    allCards = await registry.getActive().search(query);
  } catch {
    throw new ProviderUnavailableError();
  }

  const total = allCards.length;
  const offset = (page - 1) * limit;
  const cards = allCards.slice(offset, offset + limit);

  return {
    cards,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
