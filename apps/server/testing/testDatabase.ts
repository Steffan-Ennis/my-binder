import 'reflect-metadata';
import type {DataSource } from 'typeorm';
import {initDataSource, getDataSource, entities} from '@src/db/dataSource';
import { initRepositories } from '@src/db/repositories';

// Shared local Postgres database used by integration tests.
// Connects via libpq defaults (empty host/user/password → PGHOST/PGUSER/PGPASSWORD env or unix socket).
const TEST_DATABASE_NAME = 'MY-BINDER-UNIT-TEST';

/**
 * Initialise the TypeORM DataSource against the local test database, run any
 * pending migrations, and wire up the repository singletons.
 *
 * Idempotent — safe to call once per test file in `beforeAll`.
 *
 * @returns The initialised `DataSource` for direct entity access in tests.
 */
export async function connectTestDatabase(): Promise<DataSource> {
  await initDataSource({
    pgDatabase: TEST_DATABASE_NAME,
    pgHost: '',
    pgUser: '',
    pgPassword: '',
    pgPort: 5432,
  });

  const dataSource = getDataSource();
  await dataSource.runMigrations({ transaction: 'all' });
  initRepositories(dataSource);
  return dataSource;
}

/**
 * Call from `afterAll` to leave the test database empty for the next run.
 *
 * @param _entities the entities to clear before disconnecting
 */
export async function disconnectTestDatabase(
  _entities = entities,
): Promise<void> {
  const dataSource = getDataSource()
  for (const entity of _entities){
    await dataSource.getRepository(entity).deleteAll()
  }

  await dataSource.destroy();
}
