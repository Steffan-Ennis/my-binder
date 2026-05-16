import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { UserEntity } from '@src/entities/UserEntity';
import { AllowedUserEntity } from "@src/entities/AllowedUserEntity";

type UserEntityState = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isAllowed?: boolean
};

/**
 * Fluent builder for `UserEntity` test fixtures. Construct via {@link aUser},
 * chain `withX()` overrides, and finish with either `build()` (in-memory only)
 * or `persist(dataSource)` (writes through the TypeORM repository and returns
 * the saved entity).
 *
 * Defaults produce a fully-valid entity: a fresh UUID id, a unique email keyed
 * off that id, a deterministic display name, and a null avatar URL. Every
 * `aUser()` call is independent — two calls produce two distinct users with no
 * collisions on the `email` unique index.
 *
 * @example
 * ```ts
 * const ds = await connectTestDatabase();
 * const user = await aUser()
 *   .withEmail('alice@test.local')
 *   .withDisplayName('Alice')
 *   .persist(ds);
 * ```
 */
export class UserEntityBuilder {
  private readonly state: UserEntityState;

  constructor() {
    const id = randomUUID();
    this.state = {
      id,
      email: `user-${id}@test.local`,
      displayName: `Test User ${id.slice(0, 8)}`,
      avatarUrl: null,
    };
  }

  withId(id: string): this {
    this.state.id = id;
    return this;
  }

  withEmail(email: string): this {
    this.state.email = email;
    return this;
  }

  withDisplayName(displayName: string): this {
    this.state.displayName = displayName;
    return this;
  }

  withAvatarUrl(avatarUrl: string | null): this {
    this.state.avatarUrl = avatarUrl;
    return this;
  }

  isAllowed(): this {
    this.state.isAllowed = true
    return this
  }

  /**
   * Return an unsaved `UserEntity` populated from the current builder state.
   * `createdAt` / `updatedAt` are left undefined — TypeORM populates them on
   * `save()`. Use `persist()` when the test needs a row in the database.
   */
  build(): UserEntity {
    const entity = new UserEntity();
    entity.id = this.state.id;
    entity.email = this.state.email;
    entity.displayName = this.state.displayName;
    entity.avatarUrl = this.state.avatarUrl;
    return entity;
  }

  /**
   * Save the built entity through the TypeORM repository on the supplied
   * `DataSource` and return the persisted row (with `createdAt`/`updatedAt`
   * populated by Postgres).
   */
  async persist(dataSource: DataSource): Promise<UserEntity> {

    if(this.state.isAllowed){
      await dataSource.getRepository(AllowedUserEntity).save({
        email: this.state.email
      })
    }

    const repo = dataSource.getRepository(UserEntity);
    return repo.save(this.build());
  }
}

/**
 * Convenience constructor — `aUser().withEmail(...).persist(ds)` reads more
 * fluently than `new UserEntityBuilder().withEmail(...).persist(ds)`.
 */
export const aUser = (): UserEntityBuilder => new UserEntityBuilder();
