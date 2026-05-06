import { OrderStatus } from '../../database/enums';
import { OrderItemResponseDto } from './order-item-response.dto';

export class OrderResponseDto {
  readonly id: string;
  readonly userId: string;
  readonly status: OrderStatus;
  readonly total: number;
  readonly items: OrderItemResponseDto[];
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly cancelledAt?: Date;
}
