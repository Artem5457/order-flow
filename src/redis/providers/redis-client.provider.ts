import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_CLIENT } from '../redis.constants';

/**
 * Redis client provider for dependency injection
 */
export const redisClientProvider = (): Provider => ({
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService): Redis => {
    const logger = new Logger('RedisClient');
    const redisConfig = configService.getOrThrow<RedisOptions>('redis');

    const client = new Redis(redisConfig);

    client.on('error', (error: Error) => {
      logger.error(`Redis error: ${error.message}`);
    });

    client.on('connect', () => {
      logger.log('Redis connected');
    });

    return client;
  },
  inject: [ConfigService],
});
