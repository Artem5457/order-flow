import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { OrderController } from '../src/order/order.controller';
import { UserOrdersController } from '../src/order/user-orders.controller';
import { OrderService } from '../src/order/order.service';
import { JwtGuard } from '../src/auth/guards/jwt.guard';
import { OrderStatus } from '../src/database/enums';
import type { OrderResponseDto } from '../src/order/dto/order-response.dto';
import type { AuthenticatedUser } from '../src/auth/strategies/jwt.strategy';

type MockOrderService = {
  create: jest.Mock;
  findOne: jest.Mock;
  findAllForUser: jest.Mock;
  update: jest.Mock;
  cancel: jest.Mock;
};

const USER_ID = '123e4567-e89b-12d3-a456-426614174001';
const OTHER_USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PRODUCT_ID = '123e4567-e89b-12d3-a456-426614174002';
const ORDER_ID = '123e4567-e89b-12d3-a456-426614174003';
const UNKNOWN_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const authenticatedUser: AuthenticatedUser = {
  id: USER_ID,
  email: 'test@example.com',
};

const otherAuthenticatedUser: AuthenticatedUser = {
  id: OTHER_USER_ID,
  email: 'other@example.com',
};

function sampleOrderResponse(
  overrides: Partial<OrderResponseDto> = {},
): OrderResponseDto {
  const createdAt = new Date('2026-01-01T12:00:00.000Z');
  return {
    id: ORDER_ID,
    userId: USER_ID,
    status: OrderStatus.PENDING,
    total: 50,
    items: [
      {
        id: '123e4567-e89b-12d3-a456-426614174004',
        productId: PRODUCT_ID,
        quantity: 2,
        priceAtPurchase: 25,
      },
    ],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function orderBody(res: { body: unknown }): OrderResponseDto {
  return res.body as OrderResponseDto;
}

function orderListBody(res: { body: unknown }): OrderResponseDto[] {
  return res.body as OrderResponseDto[];
}

describe('Order (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let orderService: MockOrderService;
  let jwtGuardCanActivateSpy: jest.SpyInstance;

  beforeAll(async () => {
    const orderServiceMock: MockOrderService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAllForUser: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    };

    jwtGuardCanActivateSpy = jest
      .spyOn(JwtGuard.prototype, 'canActivate')
      .mockImplementation((context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{
          headers: { authorization?: string };
          user?: AuthenticatedUser;
        }>();
        const authHeader = req.headers.authorization;
        if (authHeader === 'Bearer valid-token') {
          req.user = authenticatedUser;
          return true;
        }
        if (authHeader === 'Bearer other-token') {
          req.user = otherAuthenticatedUser;
          return true;
        }
        return false;
      });

    moduleFixture = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60000, limit: 120 }],
        }),
      ],
      controllers: [OrderController, UserOrdersController],
      providers: [
        { provide: OrderService, useValue: orderServiceMock },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    orderService = moduleFixture.get(OrderService);
  });

  beforeEach(() => {
    const storageSvc =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
    storageSvc.onApplicationShutdown();
    storageSvc.storage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
    jwtGuardCanActivateSpy.mockRestore();
  });

  describe('/orders (POST)', () => {
    it('should create a new order', async () => {
      const body = sampleOrderResponse({ total: 50 });
      orderService.create.mockResolvedValue(body);

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', 'Bearer valid-token')
        .send({
          userId: USER_ID,
          items: [{ productId: PRODUCT_ID, quantity: 2 }],
        })
        .expect(201);

      expect(orderService.create).toHaveBeenCalledWith(
        {
          userId: USER_ID,
          items: [{ productId: PRODUCT_ID, quantity: 2 }],
        },
        authenticatedUser,
      );
      const resBody = orderBody(response);
      expect(resBody).toMatchObject({
        id: ORDER_ID,
        userId: USER_ID,
        total: 50,
        status: OrderStatus.PENDING,
      });
      expect(resBody.items).toHaveLength(1);
      expect(resBody.items[0]?.productId).toBe(PRODUCT_ID);
    });

    it('should return 403 if user tries to create order for another user', async () => {
      orderService.create.mockRejectedValue(
        new ForbiddenException('You can only create orders for yourself'),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', 'Bearer valid-token')
        .send({
          userId: OTHER_USER_ID,
          items: [{ productId: PRODUCT_ID, quantity: 1 }],
        })
        .expect(403);

      expect(orderService.create).toHaveBeenCalled();
    });

    it('should return 404 if product not found', async () => {
      orderService.create.mockRejectedValue(
        new NotFoundException('Product not found'),
      );

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', 'Bearer valid-token')
        .send({
          userId: USER_ID,
          items: [
            {
              productId: 'a1b2c3d4-e5f6-4a89-b012-3456789abcde',
              quantity: 1,
            },
          ],
        })
        .expect(404);
    });
  });

  describe('/orders/:id (GET)', () => {
    it('should return order by id', async () => {
      const dto = sampleOrderResponse({ total: 25, items: [] });
      orderService.findOne.mockResolvedValue(dto);

      const response = await request(app.getHttpServer())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(orderService.findOne).toHaveBeenCalledWith(
        ORDER_ID,
        authenticatedUser,
      );
      const resBody = orderBody(response);
      expect(resBody.id).toBe(ORDER_ID);
      expect(resBody.total).toBe(25);
      expect(resBody.status).toBe(OrderStatus.PENDING);
    });

    it('should return 404 if order not found', async () => {
      orderService.findOne.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await request(app.getHttpServer())
        .get(`/orders/${UNKNOWN_UUID}`)
        .set('Authorization', 'Bearer valid-token')
        .expect(404);
    });

    it('should return 403 if user does not own the order', async () => {
      orderService.findOne.mockRejectedValue(
        new ForbiddenException('You can only access your own orders'),
      );

      await request(app.getHttpServer())
        .get(`/orders/${ORDER_ID}`)
        .set('Authorization', 'Bearer other-token')
        .expect(403);
    });
  });

  describe('/orders/:id (PATCH)', () => {
    it('should update an order', async () => {
      const updated = sampleOrderResponse({
        total: 75,
        items: [
          {
            id: '123e4567-e89b-12d3-a456-426614174005',
            productId: PRODUCT_ID,
            quantity: 3,
            priceAtPurchase: 25,
          },
        ],
      });
      orderService.update.mockResolvedValue(updated);

      const response = await request(app.getHttpServer())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          items: [{ productId: PRODUCT_ID, quantity: 3 }],
        })
        .expect(200);

      expect(orderService.update).toHaveBeenCalledWith(
        ORDER_ID,
        { items: [{ productId: PRODUCT_ID, quantity: 3 }] },
        authenticatedUser,
      );
      const resBody = orderBody(response);
      expect(resBody.total).toBe(75);
      expect(resBody.items[0]?.quantity).toBe(3);
    });

    it('should return 404 if order not found', async () => {
      orderService.update.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await request(app.getHttpServer())
        .patch(`/orders/${UNKNOWN_UUID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          items: [{ productId: PRODUCT_ID, quantity: 1 }],
        })
        .expect(404);
    });

    it('should return 403 if user does not own the order', async () => {
      orderService.update.mockRejectedValue(
        new ForbiddenException('You can only access your own orders'),
      );

      await request(app.getHttpServer())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', 'Bearer other-token')
        .send({
          items: [{ productId: PRODUCT_ID, quantity: 1 }],
        })
        .expect(403);
    });

    it('should return 409 if order is not in PENDING status', async () => {
      orderService.update.mockRejectedValue(
        new ConflictException(
          'Order can only be updated while status is pending',
        ),
      );

      await request(app.getHttpServer())
        .patch(`/orders/${ORDER_ID}`)
        .set('Authorization', 'Bearer valid-token')
        .send({
          items: [{ productId: PRODUCT_ID, quantity: 1 }],
        })
        .expect(409);
    });
  });

  describe('/orders/:id/cancel (POST)', () => {
    it('should cancel an order', async () => {
      const cancelled = sampleOrderResponse({
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date('2026-01-02T12:00:00.000Z'),
      });
      orderService.cancel.mockResolvedValue(cancelled);

      const response = await request(app.getHttpServer())
        .post(`/orders/${ORDER_ID}/cancel`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(orderService.cancel).toHaveBeenCalledWith(
        ORDER_ID,
        authenticatedUser,
      );
      const resBody = orderBody(response);
      expect(resBody.status).toBe(OrderStatus.CANCELLED);
      expect(resBody.cancelledAt).toBeDefined();
    });

    it('should return 404 if order not found', async () => {
      orderService.cancel.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await request(app.getHttpServer())
        .post(`/orders/${UNKNOWN_UUID}/cancel`)
        .set('Authorization', 'Bearer valid-token')
        .expect(404);
    });

    it('should return 403 if user does not own the order', async () => {
      orderService.cancel.mockRejectedValue(
        new ForbiddenException('You can only access your own orders'),
      );

      await request(app.getHttpServer())
        .post(`/orders/${ORDER_ID}/cancel`)
        .set('Authorization', 'Bearer other-token')
        .expect(403);
    });

    it('should return 409 if order is not in PENDING status', async () => {
      orderService.cancel.mockRejectedValue(
        new ConflictException(
          'Order can only be cancelled while status is pending',
        ),
      );

      await request(app.getHttpServer())
        .post(`/orders/${ORDER_ID}/cancel`)
        .set('Authorization', 'Bearer valid-token')
        .expect(409);
    });
  });

  describe('/users/:userId/orders (GET)', () => {
    it('should return orders for user', async () => {
      const mockOrders = [sampleOrderResponse()];
      orderService.findAllForUser.mockResolvedValue(mockOrders);

      const response = await request(app.getHttpServer())
        .get(`/users/${USER_ID}/orders`)
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(orderService.findAllForUser).toHaveBeenCalledWith(
        USER_ID,
        authenticatedUser,
      );
      const list = orderListBody(response);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(ORDER_ID);
    });

    it('should return 403 if user tries to access another user orders', async () => {
      orderService.findAllForUser.mockRejectedValue(
        new ForbiddenException('You can only list your own orders'),
      );

      await request(app.getHttpServer())
        .get(`/users/${USER_ID}/orders`)
        .set('Authorization', 'Bearer other-token')
        .expect(403);
    });
  });
});
