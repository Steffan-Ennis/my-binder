import type { DataSource, Repository } from 'typeorm';
import type { AuthUser } from '@my-binder/core';
import { UserEntity } from '@src/entities/UserEntity';

export type UpsertUserInput = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

function toAuthUser(entity: UserEntity): AuthUser {
  return {
    id: entity.id,
    email: entity.email,
    displayName: entity.displayName,
    avatarUrl: entity.avatarUrl,
  };
}

export class UserRepository {
  private repo: Repository<UserEntity>;

  constructor(ds: DataSource) {
    this.repo = ds.getRepository(UserEntity);
  }

  /**
   * Insert or update a user keyed on email.
   * Uses TypeORM upsert with conflictPaths: ['email'].
   */
  async upsertUser(input: UpsertUserInput): Promise<AuthUser> {
    await this.repo.upsert(
      { email: input.email, displayName: input.displayName, avatarUrl: input.avatarUrl },
      { conflictPaths: ['email'], skipUpdateIfNoValuesChanged: false },
    );
    const entity = await this.repo.findOneByOrFail({ email: input.email });
    return toAuthUser(entity);
  }

  /**
   * Find a user by their internal UUID. Returns null if not found.
   */
  async findUserById(id: string): Promise<AuthUser | null> {
    const entity = await this.repo.findOneBy({ id });
    return entity ? toAuthUser(entity) : null;
  }
}
