import type {
  Card, CardList, CreateCardBody, UpdateCardBody,
  CardRecord, CardNotFoundResult, LegalityResult,
  SearchQuery, SearchResult,
} from '@my-binder/core';
import { getRepositories } from '@src/db/repositories';
import { registry } from '@src/providers/registry';
import { CardProvider } from "@src/providers/interface";

// Scryfall image CDN convention: paths shard by the first two characters of
// the Scryfall id. Exposed only for tests; not part of the public surface.
function scryfallNormalImageUrl(scryfallId: string): string | undefined {
  if (scryfallId.length < 2) return undefined;
  return `https://cards.scryfall.io/normal/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
}

async function enrichCard(card: Card, provider: CardProvider | null): Promise<Card> {
  if (provider === null) return card;
  try {
    const details = await provider.getByUuid(card.id);
    if (details === null) return card;
    const frontFaceImageUrl = details.scryfallId
      ? scryfallNormalImageUrl(details.scryfallId)
      : undefined;
    return {
      ...card,
      setCode: details.setCode,
      ...(details.setName !== null && { setName: details.setName }),
      typeLine: details.typeLine,
      ...(frontFaceImageUrl !== undefined && { frontFaceImageUrl }),
    };
  } catch (err) {
    console.error(`[cardService] enrichment failed for card id=${card.id}`, err);
    return card;
  }
}

function getProviderOrNull(): CardProvider | null {
  try {
    return registry.getActive();
  } catch {
    return null;
  }
}

/**
 * Thrown by user-collection CRUD when no row matches the supplied id+userId.
 * The HTTP layer maps this to 404.
 *
 * @example
 * ```ts
 * try {
 *   await getCard('missing-id', userId);
 * } catch (err) {
 *   if (err instanceof NotFoundError) reply.code(404).send({ error: 'NOT_FOUND' });
 * }
 * ```
 */
export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Card with id "${id}" not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * List every card in a user's binder. The returned `total` is the array
 * length — there is no pagination at this layer; pagination on the search
 * surface is handled by `searchCards`.
 *
 * @param userId - The signed-in user's id (or guest id) — rows are scoped to this owner.
 * @returns A `CardList` with the cards array and total count.
 *
 * @example
 * ```ts
 * const { cards, total } = await getCards(userId);
 * // { cards: [{ id: '...', name: '...' }, ...], total: 12 }
 * ```
 */
export async function getCards(userId: string): Promise<CardList> {
  const rows = await getRepositories().card.findAll(userId);
  const provider = getProviderOrNull();
  // Sequential enrichment: the MTGJSON SDK shares a DuckDB connection and
  // concurrent access produces "Failed to execute prepared statement" errors.
  const cards: Card[] = [];
  for (const row of rows) {
    cards.push(await enrichCard(row, provider));
  }
  return { cards, total: cards.length };
}

/**
 * Fetch a single card from a user's binder by id. Cards owned by other users
 * are treated as not-found — this is the security boundary for direct fetches.
 *
 * @param id - Card id from the URL.
 * @param userId - Owner constraint.
 * @returns The matching `Card`.
 * @throws NotFoundError when no card with `id` exists for `userId`.
 *
 * @example
 * ```ts
 * const card = await getCard(req.params.id, request.identity.id);
 * ```
 */
export async function getCard(id: string, userId: string): Promise<Card> {
  const card = await getRepositories().card.findById(id, userId);
  if (card === null) throw new NotFoundError(id);
  return enrichCard(card, getProviderOrNull());
}

/**
 * Insert a new card into a user's binder. The repository owns id generation
 * and timestamps.
 *
 * @param body - Validated request body (`{ name }`).
 * @param userId - Owner of the new row.
 * @returns The newly created `Card` including its generated id and timestamps.
 *
 * @example
 * ```ts
 * const created = await createCard({ name: 'Lightning Bolt' }, userId);
 * // { id: '...', name: 'Lightning Bolt', createdAt: '...', updatedAt: '...' }
 * ```
 */
export async function createCard(body: CreateCardBody, userId: string): Promise<Card> {
  return getRepositories().card.create(body, userId);
}

/**
 * Update a card in a user's binder. Cards owned by other users are treated as
 * not-found.
 *
 * @param id - Card id from the URL.
 * @param body - Validated request body (`{ name }`).
 * @param userId - Owner constraint.
 * @returns The updated `Card`.
 * @throws NotFoundError when no card with `id` exists for `userId`.
 *
 * @example
 * ```ts
 * const updated = await updateCard(id, { name: 'Lightning Bolt' }, userId);
 * ```
 */
export async function updateCard(id: string, body: UpdateCardBody, userId: string): Promise<Card> {
  const card = await getRepositories().card.update(id, body, userId);
  if (card === null) throw new NotFoundError(id);
  return card;
}

/**
 * Remove a card from a user's binder. Idempotent at the repository level
 * (returns false when nothing was deleted), but this service treats a
 * missing row as an explicit not-found so callers don't silently no-op a
 * typo'd id.
 *
 * @param id - Card id to delete.
 * @param userId - Owner constraint.
 * @returns Resolves with `void` when the row was deleted.
 * @throws NotFoundError when no card with `id` exists for `userId`.
 *
 * @example
 * ```ts
 * await deleteCard(id, userId);
 * reply.code(204).send();
 * ```
 */
export async function deleteCard(id: string, userId: string): Promise<void> {
  const deleted = await getRepositories().card.remove(id, userId);
  if (!deleted) throw new NotFoundError(id);
}

// ─── Provider-backed card operations (spec 004) ───────────────────────────────

/**
 * Thrown by `checkCommanderLegality` when the active provider reports the
 * named card has no paper printing. The HTTP layer maps this to 404.
 *
 * @example
 * ```ts
 * try {
 *   await checkCommanderLegality('Definitely Not A Card');
 * } catch (err) {
 *   if (err instanceof CardNotFoundError) reply.code(404).send({ error: 'CARD_NOT_FOUND' });
 * }
 * ```
 */
export class CardNotFoundError extends Error {
  constructor(name: string) {
    super(`No card found with name "${name}".`);
    this.name = 'CardNotFoundError';
  }
}

/**
 * Thrown by every provider-backed function in this module when the active
 * provider raises any non-`CARD_NOT_FOUND` error (parquet read failure,
 * unreachable cache, etc.). The HTTP layer maps this to 503.
 *
 * @example
 * ```ts
 * try {
 *   await searchCards({ name: 'bolt' });
 * } catch (err) {
 *   if (err instanceof ProviderUnavailableError) reply.code(503).send({ error: 'PROVIDER_UNAVAILABLE' });
 * }
 * ```
 */
export class ProviderUnavailableError extends Error {
  constructor() {
    super('The card data provider is currently unavailable. Please try again.');
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * Look up paper printings of a card by name via the active provider. The
 * provider's own not-found result (`{ found: false, name }`) is returned
 * verbatim — only non-not-found errors are wrapped in
 * `ProviderUnavailableError` so the HTTP layer can distinguish "no card"
 * (200 + sentinel) from "data layer down" (503).
 *
 * @param name - Card name to look up.
 * @param opts - Optional refinement passed straight through to the provider.
 * @param opts.fuzzy - When `false`, name must match exactly. Defaults to `true`.
 * @param opts.set - Restrict to a specific set code.
 * @param opts.number - Restrict to a specific collector number.
 * @returns Either an array of `CardRecord`s or a `CardNotFoundResult`.
 * @throws ProviderUnavailableError when the active provider raises any error other than `CARD_NOT_FOUND`.
 *
 * @example
 * ```ts
 * const result = await lookupCard('Lightning Bolt');
 * if ('found' in result) reply.send({ error: 'CARD_NOT_FOUND' });
 * else reply.send({ cards: result });
 * ```
 */
export async function lookupCard(
  name: string,
  opts: { fuzzy?: boolean; set?: string; number?: string } = {},
): Promise<CardRecord[] | CardNotFoundResult> {
  try {
    return await registry.getActive().lookup(name, opts);
  } catch (error) {
    console.error(error)
    if (error instanceof Error && (error as NodeJS.ErrnoException).code !== 'CARD_NOT_FOUND') {
      throw new ProviderUnavailableError();
    }
    throw error;
  }
}

/**
 * Check Commander legality for a card via the active provider, optionally
 * constrained by the commander's colour identity.
 *
 * The provider raises a `CARD_NOT_FOUND`-tagged error for unknown names; this
 * function rewrites it to `CardNotFoundError` so the HTTP layer can match a
 * stable type. Any other provider error becomes `ProviderUnavailableError`.
 *
 * @param name - Card name to check.
 * @param commanderColors - Optional commander colour identity (e.g. `['R', 'U']`).
 * @returns A `LegalityResult` from the provider.
 * @throws CardNotFoundError when the provider has no paper printing for `name`.
 * @throws ProviderUnavailableError on any other provider failure.
 *
 * @example
 * ```ts
 * const result = await checkCommanderLegality('Channel');
 * // { cardName: 'Channel', legal: false, reason: 'Banned in Commander', colorIdentity: ['G'] }
 *
 * await checkCommanderLegality('Lightning Bolt', ['U', 'B']);
 * // { cardName: 'Lightning Bolt', legal: false, reason: 'Colour identity conflict', colorIdentity: ['R'] }
 * ```
 */
export async function checkCommanderLegality(
  name: string,
  commanderColors?: string[],
): Promise<LegalityResult> {
  try {
    return await registry.getActive().checkLegality(name, commanderColors);
  } catch (error) {
    console.error(error)
    if (error instanceof Error) {
      const typed = error as NodeJS.ErrnoException;
      if (typed.code === 'CARD_NOT_FOUND') throw new CardNotFoundError(name);
    }
    throw new ProviderUnavailableError();
  }
}

/**
 * Search the active provider's card pool with structured filters and paginate
 * the results in-process.
 *
 * Pagination clamps `page` to `[1, ∞)` and `limit` to `[1, 100]`. The provider
 * is expected to return the full unpaginated set, which is then sliced — that
 * matches the current MTGJSON parquet flow where the SDK has no native paging.
 *
 * If `registry.getActive()` itself throws (no active provider), this surfaces
 * as `ProviderUnavailableError`. Errors raised by `provider.search` propagate
 * unchanged so they can be observed in tests; the HTTP layer catches them and
 * maps to 500.
 *
 * @param query - Structured filters plus `page`/`limit`.
 * @returns A `SearchResult` slice with `total`, `page`, `limit`, `totalPages`.
 * @throws ProviderUnavailableError when no provider is active.
 *
 * @example
 * ```ts
 * const result = await searchCards({ name: 'bolt', page: 1, limit: 20 });
 * // { cards: [...], total: 42, page: 1, limit: 20, totalPages: 3 }
 * ```
 */
export async function searchCards(query: SearchQuery): Promise<SearchResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  let activeProvider: CardProvider
  try {
    activeProvider = registry.getActive()
  } catch (error) {
    console.error(error)
    throw new ProviderUnavailableError();
  }

  const allCards = await activeProvider.search(query)
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