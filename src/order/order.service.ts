import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Product } from '../database/entities/product.entity';
import { User } from '../database/entities/user.entity';
import { OrderStatus } from '../database/enums';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import type { OrderResponseDto } from './dto/order-response.dto';
import type { OrderItemInputDto } from './dto/order-item-input.dto';
import { OrderRedisService } from './order-redis.service';

const ORDER_RELATIONS = ['items', 'items.product'] as const;

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly orderRedis: OrderRedisService,
  ) {}

  async create(
    dto: CreateOrderDto,
    currentUser: AuthenticatedUser,
  ): Promise<OrderResponseDto> {
    if (dto.userId !== currentUser.id) {
      this.logger.error('You can only create orders for yourself');
      throw new ForbiddenException('You can only create orders for yourself');
    }

    const user = await this.userRepository.findOne({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(`User with id "${dto.userId}" not found`);
    }

    const productMap = await this.resolveProductsForOrderLines(dto.items);
    const total = this.computeTotal(dto.items, productMap);

    const saved = await this.orderRepository.manager.transaction(
      async (manager) => {
        const order = manager.create(Order, {
          userId: dto.userId,
          status: OrderStatus.PENDING,
          total,
        });
        await manager.save(order);

        for (const line of dto.items) {
          const product = productMap.get(line.productId)!;
          const item = manager.create(OrderItem, {
            orderId: order.id,
            productId: line.productId,
            quantity: line.quantity,
            priceAtPurchase: product.price,
          });
          await manager.save(item);
        }

        return manager.findOneOrFail(Order, {
          where: { id: order.id },
          relations: [...ORDER_RELATIONS],
        });
      },
    );

    this.logger.log(
      `Order created successfully - ID: ${saved.id}, User: ${saved.userId}`,
    );

    await this.orderRedis.enqueuePayment(saved.id);
    await this.orderRedis.invalidateUserOrders(dto.userId);

    return this.toDto(saved);
  }

  async findOne(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<OrderResponseDto> {
    const cached = await this.orderRedis.getCachedOrder(id);
    if (cached) {
      this.assertOrderOwner(cached.userId, currentUser);
      this.logger.debug('Order cache hit', { orderId: id });
      return cached;
    }

    this.logger.debug('Order cache miss', { orderId: id });

    const order = await this.orderRepository.findOne({
      where: { id },
      relations: [...ORDER_RELATIONS],
    });

    if (!order) {
      this.logger.error(`Order with id "${id}" not found`);
      throw new NotFoundException(`Order with id "${id}" not found`);
    }

    this.assertOrderOwner(order.userId, currentUser);

    const dto = this.toDto(order);
    await this.orderRedis.setCachedOrder(id, dto);
    return dto;
  }

  async findAllForUser(
    userId: string,
    currentUser: AuthenticatedUser,
  ): Promise<OrderResponseDto[]> {
    if (userId !== currentUser.id) {
      this.logger.error('You can only list your own orders');
      throw new ForbiddenException('You can only list your own orders');
    }

    const cached = await this.orderRedis.getCachedUserOrders(userId);
    if (cached) {
      this.logger.debug('User orders cache hit', { userId });
      return cached;
    }

    this.logger.debug('User orders cache miss', { userId });

    const orders = await this.orderRepository.find({
      where: { userId },
      relations: [...ORDER_RELATIONS],
      order: { createdAt: 'DESC' },
    });

    const list = orders.map((o) => this.toDto(o));
    await this.orderRedis.setCachedUserOrders(userId, list);
    return list;
  }

  async update(
    id: string,
    dto: UpdateOrderDto,
    currentUser: AuthenticatedUser,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: [...ORDER_RELATIONS],
    });

    if (!order) {
      this.logger.error(`Order with id "${id}" not found`);
      throw new NotFoundException(`Order with id "${id}" not found`);
    }

    this.assertOrderOwner(order.userId, currentUser);

    if (order.status !== OrderStatus.PENDING) {
      this.logger.error('Order can only be updated while status is pending');
      throw new ConflictException(
        'Order can only be updated while status is pending',
      );
    }

    const productMap = await this.resolveProductsForOrderLines(dto.items);
    const total = this.computeTotal(dto.items, productMap);

    const updated = await this.orderRepository.manager.transaction(
      async (manager) => {
        await manager.delete(OrderItem, { orderId: order.id });

        for (const line of dto.items) {
          const product = productMap.get(line.productId)!;
          const item = manager.create(OrderItem, {
            orderId: order.id,
            productId: line.productId,
            quantity: line.quantity,
            priceAtPurchase: product.price,
          });
          await manager.save(item);
        }

        await manager.update(Order, { id: order.id }, { total });

        return manager.findOneOrFail(Order, {
          where: { id: order.id },
          relations: [...ORDER_RELATIONS],
        });
      },
    );

    this.logger.log(
      `Order updated successfully - ID: ${updated.id}, User: ${updated.userId}`,
    );

    await this.orderRedis.invalidateOrderAndUser(updated.id, updated.userId);

    const response = this.toDto(updated);
    await this.orderRedis.setCachedOrder(updated.id, response);
    return response;
  }

  async cancel(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<OrderResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: [...ORDER_RELATIONS],
    });

    if (!order) {
      this.logger.error(`Order with id "${id}" not found`);
      throw new NotFoundException(`Order with id "${id}" not found`);
    }

    this.assertOrderOwner(order.userId, currentUser);

    if (order.status !== OrderStatus.PENDING) {
      this.logger.error('Order can only be cancelled while status is pending');
      throw new ConflictException(
        'Order can only be cancelled while status is pending',
      );
    }

    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    const saved = await this.orderRepository.save(order);

    this.logger.log(
      `Order cancelled successfully - ID: ${saved.id}, User: ${saved.userId}`,
    );

    await this.orderRedis.invalidateOrderAndUser(saved.id, saved.userId);

    const dto = this.toDto(saved);
    await this.orderRedis.setCachedOrder(saved.id, dto);
    return dto;
  }

  private assertOrderOwner(
    orderUserId: string,
    currentUser: AuthenticatedUser,
  ): void {
    if (orderUserId !== currentUser.id) {
      this.logger.error('You can only access your own orders');
      throw new ForbiddenException('You can only access your own orders');
    }
  }

  private async resolveProductsForOrderLines(
    items: readonly OrderItemInputDto[],
  ): Promise<Map<string, Product>> {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await this.productRepository.find({
      where: { id: In(ids) },
    });

    if (products.length !== ids.length) {
      const found = new Set(products.map((p) => p.id));
      const missing = ids.find((pid) => !found.has(pid));
      this.logger.error(`Product with id "${missing ?? 'unknown'}" not found`);
      throw new NotFoundException(
        `Product with id "${missing ?? 'unknown'}" not found`,
      );
    }

    return new Map(products.map((p) => [p.id, p]));
  }

  private computeTotal(
    items: readonly OrderItemInputDto[],
    productMap: Map<string, Product>,
  ): string {
    let sum = 0;
    for (const line of items) {
      const product = productMap.get(line.productId)!;
      sum += parseFloat(product.price) * line.quantity;
    }
    return sum.toFixed(2);
  }

  private toDto(order: Order): OrderResponseDto {
    const items = order.items ?? [];
    return {
      id: order.id,
      userId: order.userId,
      status: order.status,
      total: parseFloat(order.total),
      items: items.map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        priceAtPurchase: parseFloat(i.priceAtPurchase),
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      cancelledAt: order.cancelledAt,
    };
  }
}
