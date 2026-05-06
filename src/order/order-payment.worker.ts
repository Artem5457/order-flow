import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { Order } from '../database/entities/order.entity';
import { OrderStatus } from '../database/enums';
import { REDIS_BLOCKING_CLIENT } from '../redis/redis.constants';
import {
  ORDER_PAYMENT_QUEUE_KEY,
  orderPaymentLockKey,
} from './order.constants';
import { OrderRedisService } from './order-redis.service';

const BRPOP_TIMEOUT_SEC = 5;
const LOCK_TTL_SEC = 120;

@Injectable()
export class OrderPaymentWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OrderPaymentWorkerService.name);
  private stopping = false;

  constructor(
    @Inject(REDIS_BLOCKING_CLIENT)
    private readonly redis: Redis,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderRedis: OrderRedisService,
  ) {}

  onModuleInit(): void {
    void this.runLoop();
  }

  onModuleDestroy(): void {
    this.stopping = true;
  }

  private async runLoop(): Promise<void> {
    while (!this.stopping) {
      try {
        const popped = await this.redis.brpop(
          ORDER_PAYMENT_QUEUE_KEY,
          BRPOP_TIMEOUT_SEC,
        );
        if (!popped) {
          continue;
        }
        const orderId = popped[1];
        if (!orderId) {
          continue;
        }
        await this.processOrderId(orderId.trim());
      } catch (err) {
        if (this.isRedisCommandTimeout(err)) {
          // BRPOP can hit client command timeout during idle polling.
          continue;
        }
        this.logger.error(
          err instanceof Error ? err.stack : String(err),
          'Payment worker loop',
        );
        await this.sleep(1000);
      }
    }
  }

  private async processOrderId(orderId: string): Promise<void> {
    const lockKey = orderPaymentLockKey(orderId);
    const locked = await this.redis.set(lockKey, '1', 'EX', LOCK_TTL_SEC, 'NX');
    if (locked !== 'OK') {
      await this.redis.rpush(ORDER_PAYMENT_QUEUE_KEY, orderId);
      await this.sleep(100);
      return;
    }

    try {
      const snapshot = await this.orderRepository.findOne({
        where: { id: orderId },
        select: { id: true, userId: true, status: true },
      });

      if (!snapshot || snapshot.status !== OrderStatus.PENDING) {
        return;
      }

      const delayMs = 1000 + Math.floor(Math.random() * 1000);
      await this.sleep(delayMs);

      const result = await this.orderRepository.update(
        { id: orderId, status: OrderStatus.PENDING },
        { status: OrderStatus.PAID },
      );

      if (result.affected && result.affected > 0) {
        await this.orderRedis.invalidateOrderAndUser(orderId, snapshot.userId);
      }
    } finally {
      await this.redis.del(lockKey).catch(() => undefined);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isRedisCommandTimeout(err: unknown): boolean {
    return err instanceof Error && err.message.includes('Command timed out');
  }
}
