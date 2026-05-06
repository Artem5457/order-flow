import { REDIS_KEY_PREFIX } from '../redis/redis.constants';

/** Redis list: LPUSH / BRPOP (FIFO tail). */
export const ORDER_PAYMENT_QUEUE_KEY = `${REDIS_KEY_PREFIX}:payment_queue`;

export const ORDER_CACHE_TTL_SEC = 30;

export function orderPaymentLockKey(orderId: string): string {
  return `${REDIS_KEY_PREFIX}:payment:lock:${orderId}`;
}

export function orderDetailCacheKey(orderId: string): string {
  return `${REDIS_KEY_PREFIX}:cache:order:${orderId}`;
}

export function userOrdersCacheKey(userId: string): string {
  return `${REDIS_KEY_PREFIX}:cache:user:${userId}:orders`;
}
