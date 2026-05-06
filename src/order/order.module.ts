import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Product } from '../database/entities/product.entity';
import { User } from '../database/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { OrderController } from './order.controller';
import { UserOrdersController } from './user-orders.controller';
import { OrderService } from './order.service';
import { OrderRedisService } from './order-redis.service';
import { OrderPaymentWorkerService } from './order-payment.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, User]),
    AuthModule,
  ],
  controllers: [OrderController, UserOrdersController],
  providers: [OrderService, OrderRedisService, OrderPaymentWorkerService],
})
export class OrderModule {}
