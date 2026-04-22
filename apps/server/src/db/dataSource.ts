import {DataSource} from 'typeorm';
import type { Config } from '@src/config';
import { UserEntity } from '@src/entities/UserEntity';
import { CardEntity } from '@src/entities/CardEntity';
import { AllowedUserEntity } from '@src/entities/AllowedUserEntity';


const dataSource = new DataSource({
  type: 'postgres',
  entities: [UserEntity, CardEntity, AllowedUserEntity],
  migrations: [__dirname + '/migrations/*.ts'],
  migrationsRun: false,
  synchronize: false,
  extra: {
    max: 2,
    min: 0,
    idleTimeoutMillis: 10000,
  },
});

type DataInitialiseOptions = Pick<Config, 'pgHost' | 'pgPort' | 'pgUser' | 'pgPassword' | 'pgDatabase'> & {
  ssl?:  {
    rejectUnauthorized: boolean
  }
}


export async function initDataSource(config: DataInitialiseOptions): Promise<void> {
  if (dataSource.isInitialized) return;
  dataSource.setOptions({
    host: config.pgHost,
    port: config.pgPort,
    ssl : config.ssl,
    username: config.pgUser,
    password: config.pgPassword,
    database: config.pgDatabase,
  });
  await dataSource.initialize();
}

export function getDataSource(): DataSource {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource not initialised. Call initDataSource() first.');
  }
  return dataSource;
}
