import type {
  Card, CardList, CreateCardBody,
  UpdateCardBody, LegalityResult,
  SearchQuery, SearchResult, CardImages,
  CardDetails, CardPricesResponse, CardPriceHistoryResponse,
} from '@my-binder/core';
import { getRepositories } from '@src/db/repositories';
import type { AdjustNumberOwnedResult } from '@src/repositories/cardRepository';
import { registry } from '@src/providers/registry';
import { CardProvider } from "@src/providers/interface";

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
  const entities = await getRepositories().card.findAll(userId);
  const provider = getProviderOrNull();

  // Sequential enrichment: the MTGJSON SDK shares a DuckDB connection and
  // concurrent access produces "Failed to execute prepared statement" errors.
  const cards = await provider?.getByUuids(entities.map(card => card.id))!
  return { cards: cards ?? [], total: cards?.length ?? 0 };
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
  let activeProvider: CardProvider;
  try {
    activeProvider = registry.getActive();
  } catch (error) {
    console.error(error);
    throw new ProviderUnavailableError();
  }

  // Combine the MTGJSON printing record (display metadata for the detail sheet)
  // with the user's binder row (owned count + timestamps). A failed provider
  // read degrades to the binder row alone rather than failing the request.
  let mtgRecord: CardDetails | null = null;
  try {
    mtgRecord = await activeProvider.getByUuid(id);
  } catch (error) {
    console.error(`[cardService] getByUuid failed for id=${id}`, error);
  }
  const binderRecord = await getRepositories().card.findById(id, userId);

  // Neither the catalogue (MTGJSON) nor the binder knows this id → 404.
  if (mtgRecord === null && binderRecord === null) {
    throw new NotFoundError(id);
  }

  return {
    id,
    name: mtgRecord?.name ?? binderRecord!.name,
    numberOwned: binderRecord?.numberOwned ?? 0,
    // createdAt/updatedAt only exist for owned (binder) rows; omit them
    // entirely for an unowned catalogue printing so the response stays valid
    // against the `date-time` format (an empty string would fail Ajv).
    ...(binderRecord?.createdAt !== undefined && { createdAt: binderRecord.createdAt }),
    ...(binderRecord?.updatedAt !== undefined && { updatedAt: binderRecord.updatedAt }),
    ...(mtgRecord?.setCode !== undefined && { setCode: mtgRecord.setCode }),
    ...(mtgRecord?.setName != null && { setName: mtgRecord.setName }),
    ...(mtgRecord?.typeLine !== undefined && { typeLine: mtgRecord.typeLine }),
    ...(mtgRecord?.oracle != null && { oracle: mtgRecord.oracle }),
  };
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
 * Upsert-and-increment a card into a user's binder (spec 018 / FR-025).
 * A fresh `(id, userId)` pair creates the row at `numberOwned = 1`; a duplicate
 * increments. The route layer maps `wasCreated → 201`, `!wasCreated → 200`.
 *
 * @param body - Validated request body (`{ id, name }`).
 * @param userId - Owner of the row.
 * @returns `{ card, wasCreated }`.
 *
 * @example
 * ```ts
 * const { card, wasCreated } = await upsertCard({ id, name }, userId);
 * reply.code(wasCreated ? 201 : 200).send(card);
 * ```
 */
export async function upsertCard(
  body: CreateCardBody,
  userId: string,
): Promise<{ card: Card; wasCreated: boolean }> {
  return getRepositories().card.upsertIncrement(body.id, body.name, userId);
}

/**
 * Adjust the `numberOwned` of a card already in a user's binder (spec 018 /
 * FR-026, FR-028). `+1` increments; `-1` decrements; a decrement to zero
 * deletes the row in the same atomic step. The route layer maps the three
 * outcomes to 200 / 204 / 404 respectively.
 *
 * @param id - MTGJSON printing UUID.
 * @param userId - Owner constraint.
 * @param delta - `+1` to increment, `-1` to decrement.
 * @returns `{ status: 'updated', card }` | `{ status: 'deleted' }` | `{ status: 'notfound' }`.
 *
 * @example
 * ```ts
 * const r = await adjustCardOwnedCount(id, userId, -1);
 * if (r.status === 'notfound') reply.code(404).send();
 * if (r.status === 'deleted')  reply.code(204).send();
 * if (r.status === 'updated')  reply.code(200).send(r.card);
 * ```
 */
export async function adjustCardOwnedCount(
  id: string,
  userId: string,
  delta: 1 | -1,
): Promise<AdjustNumberOwnedResult> {
  return getRepositories().card.adjustNumberOwned(id, userId, delta);
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
 * Search the active provider's card pool with structured filters, delegating
 * filtering, the total count, and pagination to `provider.searchRaw` (SQL-native).
 *
 * Pagination clamps `page` to `[1, ∞)` and `limit` to `[1, 100]`. For an
 * authenticated request the user's owned printings (Postgres) are projected
 * onto the page as `numberOwned`; when `missingOnly` is set those UUIDs are
 * passed to `searchRaw` as an exclusion list so the SQL `COUNT` and page stay
 * exact.
 *
 * If `registry.getActive()` throws (no active provider), this surfaces as
 * `ProviderUnavailableError`. Errors raised by `provider.searchRaw` propagate
 * unchanged so they can be observed in tests; the HTTP layer catches them and
 * maps to 500.
 *
 * @param query - Structured filters plus `page`/`limit` (and optional `userId`).
 * @returns A `SearchResult` page with `total`, `page`, `limit`, `totalPages`.
 * @throws ProviderUnavailableError when no provider is active.
 *
 * @example
 * ```ts
 * const result = await searchCards({ name: 'bolt', page: 1, limit: 20 });
 * // { cards: [...], total: 42, page: 1, limit: 20, totalPages: 3 }
 * ```
 */
/**
 * Resolve the Scryfall image URLs (`small`, `medium`, `large`) for a single
 * printing by its MTGJSON UUID.
 *
 * Delegates to `provider.getCardImages`. A `null` return is treated as a
 * stable "no such card" signal and mapped to `CardNotFoundError` so the HTTP
 * layer can return 404. Any thrown provider error becomes
 * `ProviderUnavailableError` (503) — including the case where no provider is
 * active (`registry.getActive()` itself throws).
 *
 * @param id - MTGJSON printing UUID.
 * @returns A `CardImages` record with three CDN URLs.
 * @throws CardNotFoundError when the provider has no Scryfall id for the UUID.
 * @throws ProviderUnavailableError on any other provider failure or when no
 *   provider is active.
 *
 * @example
 * ```ts
 * const images = await getCardImagesById('e3285fd6-0000-0000-0000-example00001');
 * // { small: 'https://...', medium: 'https://...', large: 'https://...' }
 * ```
 */
export async function getCardImagesById(id: string): Promise<CardImages> {
  let provider: CardProvider;
  try {
    provider = registry.getActive();
  } catch (error) {
    console.error(error);
    throw new ProviderUnavailableError();
  }

  let images: CardImages | null;
  try {
    images = await provider.getCardImages(id);
  } catch (error) {
    console.error(error);
    throw new ProviderUnavailableError();
  }

  if (images === null) throw new CardNotFoundError(id);
  return images;
}

/**
 * Assert that a printing exists in the active provider's catalogue, raising
 * `NotFoundError` (→ 404) for unknown ids. The price reads use this to
 * distinguish an unknown printing (404) from a known printing that simply has
 * no observation — the latter is a valid 200 with `null` slots / empty series.
 */
async function assertPrintingExists(provider: CardProvider, id: string): Promise<void> {
  let details: CardDetails | null;
  try {
    details = await provider.getByUuid(id);
  } catch (error) {
    console.error(error);
    throw new ProviderUnavailableError();
  }
  if (details === null) throw new NotFoundError(id);
}

/**
 * Latest paper-retail price per source (Card Kingdom, TCG Player) for a single
 * printing (spec 020 / FR-017). An unknown printing is a 404 (`NotFoundError`);
 * a known printing with no observation returns `null` slots (a valid 200,
 * FR-004). Any provider failure — including no active provider — becomes
 * `ProviderUnavailableError` (503).
 *
 * @param id - MTGJSON printing UUID.
 * @returns The per-source `CardPricesResponse`.
 * @throws NotFoundError when the printing id is unknown.
 * @throws ProviderUnavailableError on any provider failure or when no provider is active.
 *
 * @example
 * ```ts
 * const prices = await getPrices('6ca7af0b-…');
 * // { printingId: '6ca7af0b-…', cardKingdom: { … }, tcgPlayer: null }
 * ```
 */
export async function getPrices(id: string): Promise<CardPricesResponse> {
  let provider: CardProvider;
  try {
    provider = registry.getActive();
  } catch (error) {
    console.error(error);
    throw new ProviderUnavailableError();
  }

  await assertPrintingExists(provider, id);

  try {
    return await provider.getPrices(id);
  } catch (error) {
    console.error(error);
    throw new ProviderUnavailableError();
  }
}

/**
 * Per-source paper-retail price series over the last `days` calendar days
 * ending today (default 30) for a single printing (spec 020 / FR-018). Same
 * not-found / unavailable semantics as {@link getPrices}; both series empty is
 * a valid response (FR-004).
 *
 * @param id - MTGJSON printing UUID.
 * @param days - History window length in days (default 30).
 * @returns The per-source `CardPriceHistoryResponse`.
 * @throws NotFoundError when the printing id is unknown.
 * @throws ProviderUnavailableError on any provider failure or when no provider is active.
 *
 * @example
 * ```ts
 * const history = await getPriceHistory('6ca7af0b-…');     // last 30 days
 * const week    = await getPriceHistory('6ca7af0b-…', 7);  // last 7 days
 * ```
 */
export async function getPriceHistory(id: string, days = 30): Promise<CardPriceHistoryResponse> {
  let provider: CardProvider;
  try {
    provider = registry.getActive();
  } catch (error) {
    console.error(error);
    throw new ProviderUnavailableError();
  }

  await assertPrintingExists(provider, id);

  try {
    return await provider.getPriceHistory(id, days);
  } catch (error) {
    console.error(error);
    throw new ProviderUnavailableError();
  }
}

export async function searchCards(query: SearchQuery): Promise<SearchResult> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  let activeProvider: CardProvider;
  try {
    activeProvider = registry.getActive();
  } catch (error) {
    console.error(error);
    throw new ProviderUnavailableError();
  }

  // Spec 018 / FR-024 — the user's binder lives in Postgres, the card pool in
  // DuckDB. Resolve owned printings once: used to project numberOwned onto the
  // returned page and, for missingOnly, to exclude owned UUIDs inside the SQL
  // query so COUNT + paging stay exact. Absent userId → anonymous browse, no
  // numberOwned projection.
  let ownedById: Map<string, number> | null = null;
  let excludeUuids: string[] | undefined;
  if (query.userId !== undefined) {
    const ownedRows = await getRepositories().card.findAll(query.userId);
    ownedById = new Map(ownedRows.map((row) => [row.id, row.numberOwned ?? 0]));
    if (query.missingOnly === true) {
      excludeUuids = [...ownedById.keys()];
    }
  }

  const { cards: pageCards, total } = await activeProvider.searchRaw(
    { ...query, page, limit },
    excludeUuids !== undefined ? { excludeUuids } : undefined,
  );

  const cards =
    ownedById !== null
      ? pageCards.map((card) => ({ ...card, numberOwned: ownedById!.get(card.id) ?? 0 }))
      : pageCards;

  return {
    cards,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
