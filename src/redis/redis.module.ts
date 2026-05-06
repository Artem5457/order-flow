import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  redisBlockingClientProvider,
  redisClientProvider,
} from './providers/redis-client.provider';
import { REDIS_BLOCKING_CLIENT, REDIS_CLIENT } from './redis.constants';

@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [redisClientProvider(), redisBlockingClientProvider()],
      exports: [REDIS_CLIENT, REDIS_BLOCKING_CLIENT],
      global: true,
    };
  }
}
