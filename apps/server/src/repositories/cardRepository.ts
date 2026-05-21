import type { DataSource, Repository } from 'typeorm';
import type { Card, CreateCardBody, UpdateCardBody } from '@my-binder/core';
import { CardEntity } from '@src/entities/CardEntity';

function toCard(entity: CardEntity): Card {
  return {
    id: entity.id,
    name: entity.name,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    numberOwned: entity.numberOwned,
  };
}

/**
 * Outcome of an `adjustNumberOwned(...)` call. Distinguishes the three terminal
 * states the route layer cares about: the row was decremented/incremented and
 * persisted (`updated`), the row hit zero and was deleted in the same atomic
 * step (`deleted`), or no row matched the (id, userId) tuple (`notfound`).
 */
export type AdjustNumberOwnedResult =
  | { status: 'updated'; card: Card }
  | { status: 'deleted' }
  | { status: 'notfound' };

export class CardRepository {
  private repo: Repository<CardEntity>;

  constructor(ds: DataSource) {
    this.repo = ds.getRepository(CardEntity);
  }

  async findAll(userId: string): Promise<Card[]> {
    const entities = await this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return entities.map(toCard);
  }

  async findById(id: string, userId: string): Promise<Card | null> {
    const entity = await this.repo.findOne({ where: { id, userId } });
    return entity ? toCard(entity) : null;
  }

  async create(body: CreateCardBody, userId: string): Promise<Card> {
    const entity = await this.repo.save({ id: body.id, name: body.name, userId });
    return toCard(entity);
  }

  async update(id: string, body: UpdateCardBody, userId: string): Promise<Card | null> {
    const entity = await this.repo.findOne({ where: { id, userId } });
    if (!entity) return null;
    entity.name = body.name;
    const updated = await this.repo.save(entity);
    return toCard(updated);
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const result = await this.repo.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Upsert-and-increment (spec 018 / FR-025). A fresh `(id, userId)` pair
   * creates the row at `numberOwned = 1`; a duplicate increments
   * `numberOwned` by 1. The caller distinguishes the two cases via the
   * returned `wasCreated` flag — POST /cards maps `true → 201`, `false → 200`.
   *
   * @param id     - MTGJSON printing UUID (the row's PK is `(id, userId)`).
   * @param name   - Card name to persist on the first insert; ignored on
   *                 increment (the existing row's name is preserved).
   * @param userId - Owner constraint.
   * @returns      - The persisted Card and whether the row was freshly
   *                 created (`wasCreated: true`) or incremented (`false`).
   *
   * @example
   * ```ts
   * const { card, wasCreated } = await repo.upsertIncrement(uuid, 'Lightning Bolt', userId);
   * reply.code(wasCreated ? 201 : 200).send(card);
   * ```
   */
  async upsertIncrement(
    id: string,
    name: string,
    userId: string,
  ): Promise<{ card: Card; wasCreated: boolean }> {
    const existing = await this.repo.findOne({ where: { id, userId } });
    if (existing) {
      existing.numberOwned = (existing.numberOwned ?? 0) + 1;
      const saved = await this.repo.save(existing);
      return { card: toCard(saved), wasCreated: false };
    }
    const saved = await this.repo.save({ id, name, userId, numberOwned: 1 });
    return { card: toCard(saved), wasCreated: true };
  }

  /**
   * Adjust `numberOwned` by `delta` (spec 018 / FR-026, FR-028). A `+1` delta
   * increments the row; a `-1` delta decrements. When a decrement would push
   * `numberOwned` to zero the row is deleted in the same atomic step (the
   * binder invariant is `numberOwned >= 1` for any persisted row).
   *
   * @param id     - MTGJSON printing UUID.
   * @param userId - Owner constraint.
   * @param delta  - `+1` to increment, `-1` to decrement.
   * @returns      - `{status:'updated', card}` after a successful adjust,
   *                 `{status:'deleted'}` when a `-1` brought the row to zero,
   *                 `{status:'notfound'}` when no row matched `(id, userId)`.
   *
   * @example
   * ```ts
   * const result = await repo.adjustNumberOwned(id, userId, -1);
   * if (result.status === 'notfound') reply.code(404).send({ error: 'NOT_FOUND' });
   * if (result.status === 'deleted')  reply.code(204).send();
   * if (result.status === 'updated')  reply.code(200).send(result.card);
   * ```
   */
  async adjustNumberOwned(
    id: string,
    userId: string,
    delta: 1 | -1,
  ): Promise<AdjustNumberOwnedResult> {
    const existing = await this.repo.findOne({ where: { id, userId } });
    if (!existing) return { status: 'notfound' };
    const next = (existing.numberOwned ?? 0) + delta;
    if (next <= 0) {
      await this.repo.delete({ id, userId });
      return { status: 'deleted' };
    }
    existing.numberOwned = next;
    const saved = await this.repo.save(existing);
    return { status: 'updated', card: toCard(saved) };
  }
}
