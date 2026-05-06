import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { REDIS_BLOCKING_CLIENT, REDIS_CLIENT } from '../redis.constants';

/**
 * Redis client provider for dependency injection
 */
const buildRedisClientProvider = (
  provideToken: string,
  loggerContext: string,
): Provider => ({
  provide: provideToken,
  useFactory: (configService: ConfigService): Redis => {
    const logger = new Logger(loggerContext);
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

/**
 * Redis client for regular cache/session commands.
 */
export const redisClientProvider = (): Provider =>
  buildRedisClientProvider(REDIS_CLIENT, 'RedisClient');

/**
 * Dedicated Redis client for blocking commands (e.g. BRPOP).
 */
export const redisBlockingClientProvider = (): Provider =>
  buildRedisClientProvider(REDIS_BLOCKING_CLIENT, 'RedisBlockingClient');
