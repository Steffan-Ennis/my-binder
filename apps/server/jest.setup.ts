import 'tsconfig-paths/register';
import { connectTestDatabase } from './testing/testDatabase';

export default async function globalSetup(): Promise<void> {
  const datasource = await connectTestDatabase();
  await datasource.runMigrations({
    transaction: 'all'
  })
}
