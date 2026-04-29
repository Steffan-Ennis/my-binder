import type { DataSource, Repository } from 'typeorm';
import { AllowedUserEntity } from '@src/entities/AllowedUserEntity';

export class AllowedUserRepository {
  private repo: Repository<AllowedUserEntity>;

  constructor(ds: DataSource) {
    this.repo = ds.getRepository(AllowedUserEntity);
  }

  findByEmail(email: string): Promise<AllowedUserEntity | null> {
    return this.repo.findOneBy({ email });
  }
}
