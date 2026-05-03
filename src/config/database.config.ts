import { registerAs } from '@nestjs/config';
import { getTypeOrmRootOptions } from './typeorm-base.config';

export default registerAs('database', () => ({
  ...getTypeOrmRootOptions(),
  migrationsRun: true,
  autoLoadEntities: true,
}));
