import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { OrderResponseDto } from './dto/order-response.dto';
import { OrderService } from './order.service';

@Controller('users')
export class UserOrdersController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':userId/orders')
  @Auth()
  async findOrdersForUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrderResponseDto[]> {
    return this.orderService.findAllForUser(userId, user);
  }
}
