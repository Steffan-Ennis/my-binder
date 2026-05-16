import 'tsconfig-paths/register';
import { connectTestDatabase } from './testing/testDatabase';

export default async function globalTeardown(): Promise<void> {
  const dataSource = await connectTestDatabase();
  const tables = dataSource.entityMetadatas
    .map((m) => `"${m.tableName}"`)
    .join(', ');
  await dataSource.query(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
}
