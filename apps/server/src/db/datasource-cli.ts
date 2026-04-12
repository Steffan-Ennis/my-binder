// Dev-only: used by the TypeORM CLI (migration:generate, migration:run, migration:revert).
// This file is NOT compiled to dist/ — it is run via tsx directly.
// Connection config is read from process.env (no Secrets Manager).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from '@src/entities/UserEntity';
import { CardEntity } from '@src/entities/CardEntity';
import { AllowedUserEntity } from '@src/entities/AllowedUserEntity';

export default new DataSource({
  type: 'postgres',
  host: process.env['DATABASE_URL'],
  port: parseInt(process.env['DATABASE_PORT'] ?? '5432', 10),
  username: process.env['DATABASE_USER'],
  password: process.env['DATABASE_PASSWORD'],
  database: process.env['DATABASE_NAME'] ?? 'my_binder',
  entities: [UserEntity, CardEntity, AllowedUserEntity],
  migrations: ['src/db/migrations/*.ts'],
  migrationsRun: false,
  synchronize: false,
});
