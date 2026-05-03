import 'dotenv/config';
import { DataSource } from 'typeorm';
import { getTypeOrmRootOptions } from '../config/typeorm-base.config';

/**
 * TypeORM CLI entry (`-d src/database/data-source.ts`).
 * `migrationsRun` must stay false so `migration:generate` / `show` do not apply migrations implicitly.
 */
export default new DataSource({
  ...getTypeOrmRootOptions(),
  migrationsRun: false,
});
