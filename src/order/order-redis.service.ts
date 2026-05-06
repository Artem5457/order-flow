import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  ORDER_CACHE_TTL_SEC,
  ORDER_PAYMENT_QUEUE_KEY,
  orderDetailCacheKey,
  userOrdersCacheKey,
} from './order.constants';
import type { OrderResponseDto } from './dto/order-response.dto';

@Injectable()
export class OrderRedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async enqueuePayment(orderId: string): Promise<void> {
    await this.redis.lpush(ORDER_PAYMENT_QUEUE_KEY, orderId);
  }

  async getCachedOrder(orderId: string): Promise<OrderResponseDto | null> {
    const raw = await this.redis.get(orderDetailCacheKey(orderId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as OrderResponseDto;
  }

  async setCachedOrder(
    orderId: string,
    payload: OrderResponseDto,
  ): Promise<void> {
    await this.redis.setex(
      orderDetailCacheKey(orderId),
      ORDER_CACHE_TTL_SEC,
      JSON.stringify(payload),
    );
  }

  async getCachedUserOrders(
    userId: string,
  ): Promise<OrderResponseDto[] | null> {
    const raw = await this.redis.get(userOrdersCacheKey(userId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as OrderResponseDto[];
  }

  async setCachedUserOrders(
    userId: string,
    payload: OrderResponseDto[],
  ): Promise<void> {
    await this.redis.setex(
      userOrdersCacheKey(userId),
      ORDER_CACHE_TTL_SEC,
      JSON.stringify(payload),
    );
  }

  async invalidateOrder(orderId: string): Promise<void> {
    await this.redis.del(orderDetailCacheKey(orderId));
  }

  async invalidateUserOrders(userId: string): Promise<void> {
    await this.redis.del(userOrdersCacheKey(userId));
  }

  async invalidateOrderAndUser(orderId: string, userId: string): Promise<void> {
    await Promise.all([
      this.invalidateOrder(orderId),
      this.invalidateUserOrders(userId),
    ]);
  }
}
