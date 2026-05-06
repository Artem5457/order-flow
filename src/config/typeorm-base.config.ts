import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

const entitiesGlob = join(
  __dirname,
  '..',
  'database',
  'entities',
  '*.entity.{ts,js}',
);
const migrationsGlob = join(
  __dirname,
  '..',
  'database',
  'migrations',
  '*.{ts,js}',
);

/**
 * Shared TypeORM options for Nest (`database.config`) and CLI (`data-source`).
 * Keep DB-related env vars aligned with `.env.example`.
 */
export function getTypeOrmRootOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [entitiesGlob],
    migrations: [migrationsGlob],
    synchronize: false,
    migrationsTransactionMode: 'each',
    logging: ['error'],
  };
}

// process.env.NODE_ENV === 'development'
//   ? ['query', 'error', 'warn']
//   : ['error'],
