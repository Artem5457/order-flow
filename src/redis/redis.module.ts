import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { redisClientProvider } from './providers/redis-client.provider';
import { REDIS_CLIENT } from './redis.constants';

@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [redisClientProvider()],
      exports: [REDIS_CLIENT],
      global: true,
    };
  }
}
