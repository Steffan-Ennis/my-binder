import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { CardEntity } from '@src/entities/CardEntity';

type CardEntityState = {
  id: string;
  name: string;
  userId: string;
};

/**
 * Fluent builder for `CardEntity` test fixtures. Construct via {@link aCard},
 * chain `withX()` / `forUser()` overrides, and finish with either `build()`
 * (in-memory only) or `persist(dataSource)` (writes through the TypeORM
 * repository and returns the saved entity).
 *
 * Defaults produce an entity with a fresh UUID `id` (mimicking an MTGJSON
 * printing UUID), a deterministic `name`, and a fresh UUID `userId`. **The
 * default `userId` does NOT correspond to a real `users` row** — `persist()`
 * will fail the foreign-key constraint unless either (a) the user already
 * exists, or (b) the test calls `forUser(...)` / `withUserId(...)` to bind the
 * card to a persisted user.
 *
 * @example
 * ```ts
 * const ds = await connectTestDatabase();
 * const user = await aUser().persist(ds);
 * const card = await aCard()
 *   .forUser(user)
 *   .withName('Lightning Bolt')
 *   .persist(ds);
 * ```
 */
export class CardEntityBuilder {
  private readonly state: CardEntityState;

  constructor() {
    this.state = {
      id: randomUUID(),
      name: 'Test Card',
      userId: randomUUID(),
    };
  }

  withId(id: string): this {
    this.state.id = id;
    return this;
  }

  withName(name: string): this {
    this.state.name = name;
    return this;
  }

  withUserId(userId: string): this {
    this.state.userId = userId;
    return this;
  }

  /**
   * Bind the card to an existing user fixture by copying its `id` into the
   * `userId` foreign-key column. Accepts any object with an `id` field so a
   * persisted `UserEntity`, a builder result, or a plain `{ id }` literal all
   * work.
   */
  forUser(user: { id: string }): this {
    this.state.userId = user.id;
    return this;
  }

  /**
   * Return an unsaved `CardEntity` populated from the current builder state.
   * `createdAt` / `updatedAt` are left undefined — TypeORM populates them on
   * `save()`. Use `persist()` when the test needs a row in the database.
   */
  build(): CardEntity {
    const entity = new CardEntity();
    entity.id = this.state.id;
    entity.name = this.state.name;
    entity.userId = this.state.userId;
    return entity;
  }

  /**
   * Save the built entity through the TypeORM repository on the supplied
   * `DataSource` and return the persisted row. The owning user MUST exist —
   * call `forUser()` or `withUserId()` first, or persist a user with `aUser()`
   * in the same test.
   */
  async persist(dataSource: DataSource): Promise<CardEntity> {
    const repo = dataSource.getRepository(CardEntity);
    return repo.save(this.build());
  }
}

/**
 * Convenience constructor — `aCard().forUser(user).persist(ds)` reads more
 * fluently than `new CardEntityBuilder().forUser(user).persist(ds)`.
 */
export const aCard = (): CardEntityBuilder => new CardEntityBuilder();
