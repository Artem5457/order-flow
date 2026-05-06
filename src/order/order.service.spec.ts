import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from '../database/entities/order.entity';
import { OrderItem } from '../database/entities/order-item.entity';
import { Product } from '../database/entities/product.entity';
import { User } from '../database/entities/user.entity';
import { OrderStatus } from '../database/enums';
import { OrderRedisService } from './order-redis.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderItemInputDto } from './dto/order-item-input.dto';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

type MockOrderRepository = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  manager: {
    transaction: jest.Mock;
  };
};

type MockProductRepository = {
  find: jest.Mock;
};

type MockUserRepository = {
  findOne: jest.Mock;
};

type MockOrderRedis = {
  enqueuePayment: jest.Mock;
  getCachedOrder: jest.Mock;
  setCachedOrder: jest.Mock;
  getCachedUserOrders: jest.Mock;
  setCachedUserOrders: jest.Mock;
  invalidateOrder: jest.Mock;
  invalidateUserOrders: jest.Mock;
  invalidateOrderAndUser: jest.Mock;
};

const mockOrder = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  userId: '123e4567-e89b-12d3-a456-426614174001',
  status: OrderStatus.PENDING,
  total: '100.00',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
} as unknown as Order;

const mockProduct = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  price: '50.00',
} as Product;

const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174001',
} as User;

const mockOrderItem = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  orderId: '123e4567-e89b-12d3-a456-426614174000',
  productId: '123e4567-e89b-12d3-a456-426614174002',
  quantity: 2,
  priceAtPurchase: '50.00',
} as OrderItem;

const mockAuthenticatedUser: AuthenticatedUser = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  email: 'test@example.com',
};

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: MockOrderRepository;
  let productRepository: MockProductRepository;
  let userRepository: MockUserRepository;
  let orderRedis: MockOrderRedis;

  beforeEach(async () => {
    const mockOrderRepo: MockOrderRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    };
    const mockProductRepo: MockProductRepository = {
      find: jest.fn(),
    };
    const mockUserRepo: MockUserRepository = {
      findOne: jest.fn(),
    };
    const mockOrderRedisImpl: MockOrderRedis = {
      enqueuePayment: jest.fn(),
      getCachedOrder: jest.fn(),
      setCachedOrder: jest.fn(),
      getCachedUserOrders: jest.fn(),
      setCachedUserOrders: jest.fn(),
      invalidateOrder: jest.fn(),
      invalidateUserOrders: jest.fn(),
      invalidateOrderAndUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepo,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: OrderRedisService,
          useValue: mockOrderRedisImpl,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepository = module.get(getRepositoryToken(Order));
    productRepository = module.get(getRepositoryToken(Product));
    userRepository = module.get(getRepositoryToken(User));
    orderRedis = module.get(OrderRedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createOrderDto: CreateOrderDto = {
      userId: '123e4567-e89b-12d3-a456-426614174001',
      items: [
        {
          productId: '123e4567-e89b-12d3-a456-426614174002',
          quantity: 2,
        } as OrderItemInputDto,
      ],
    };

    it('should create an order successfully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      productRepository.find.mockResolvedValue([mockProduct]);
      orderRepository.manager.transaction.mockImplementation(() =>
        Promise.resolve({
          ...mockOrder,
          items: [mockOrderItem],
        }),
      );

      const result = await service.create(
        createOrderDto,
        mockAuthenticatedUser,
      );

      expect(result).toBeDefined();
      expect(orderRedis.enqueuePayment).toHaveBeenCalledWith(mockOrder.id);
      expect(orderRedis.invalidateUserOrders).toHaveBeenCalledWith(
        createOrderDto.userId,
      );
    });

    it('should throw ForbiddenException if user tries to create order for another user', async () => {
      const otherUser: AuthenticatedUser = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'other@example.com',
      };

      await expect(service.create(createOrderDto, otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(createOrderDto, mockAuthenticatedUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if product not found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      productRepository.find.mockResolvedValue([]);

      await expect(
        service.create(createOrderDto, mockAuthenticatedUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return cached order if found', async () => {
      const cachedOrder = {
        id: mockOrder.id,
        userId: mockOrder.userId,
        status: mockOrder.status,
        total: 100,
        items: [],
        createdAt: mockOrder.createdAt,
        updatedAt: mockOrder.updatedAt,
      };
      orderRedis.getCachedOrder.mockResolvedValue(cachedOrder);

      const result = await service.findOne(mockOrder.id, mockAuthenticatedUser);

      expect(result).toEqual(cachedOrder);
      expect(orderRedis.getCachedOrder).toHaveBeenCalledWith(mockOrder.id);
    });

    it('should find and return order if not cached', async () => {
      orderRedis.getCachedOrder.mockResolvedValue(null);
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const result = await service.findOne(mockOrder.id, mockAuthenticatedUser);

      expect(result).toBeDefined();
      expect(orderRedis.setCachedOrder).toHaveBeenCalledWith(
        mockOrder.id,
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      orderRedis.getCachedOrder.mockResolvedValue(null);
      orderRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(mockOrder.id, mockAuthenticatedUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the order', async () => {
      orderRedis.getCachedOrder.mockResolvedValue(null);
      orderRepository.findOne.mockResolvedValue(mockOrder);

      const otherUser: AuthenticatedUser = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'other@example.com',
      };

      await expect(service.findOne(mockOrder.id, otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAllForUser', () => {
    it('should return cached orders if found', async () => {
      const cachedOrders = [
        {
          id: mockOrder.id,
          userId: mockOrder.userId,
          status: mockOrder.status,
          total: 100,
          items: [],
          createdAt: mockOrder.createdAt,
          updatedAt: mockOrder.updatedAt,
        },
      ];
      orderRedis.getCachedUserOrders.mockResolvedValue(cachedOrders);

      const result = await service.findAllForUser(
        mockOrder.userId,
        mockAuthenticatedUser,
      );

      expect(result).toEqual(cachedOrders);
      expect(orderRedis.getCachedUserOrders).toHaveBeenCalledWith(
        mockOrder.userId,
      );
    });

    it('should find and return orders if not cached', async () => {
      orderRedis.getCachedUserOrders.mockResolvedValue(null);
      orderRepository.find.mockResolvedValue([mockOrder]);

      const result = await service.findAllForUser(
        mockOrder.userId,
        mockAuthenticatedUser,
      );

      expect(result).toBeDefined();
      expect(orderRedis.setCachedUserOrders).toHaveBeenCalledWith(
        mockOrder.userId,
        expect.any(Array),
      );
    });

    it("should throw ForbiddenException if user tries to access another user's orders", async () => {
      const otherUser: AuthenticatedUser = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'other@example.com',
      };

      await expect(
        service.findAllForUser(mockOrder.userId, otherUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    const updateOrderDto: UpdateOrderDto = {
      items: [
        {
          productId: '123e4567-e89b-12d3-a456-426614174002',
          quantity: 3,
        } as OrderItemInputDto,
      ],
    };

    it('should update order successfully', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);
      productRepository.find.mockResolvedValue([mockProduct]);
      orderRepository.manager.transaction.mockImplementation(() =>
        Promise.resolve({
          ...mockOrder,
          total: '150.00',
        }),
      );

      const result = await service.update(
        mockOrder.id,
        updateOrderDto,
        mockAuthenticatedUser,
      );

      expect(result).toBeDefined();
      expect(orderRedis.invalidateOrderAndUser).toHaveBeenCalledWith(
        mockOrder.id,
        mockOrder.userId,
      );
    });

    it('should update total via manager.update instead of saving loaded order entity', async () => {
      const loadedOrderWithItems = {
        ...mockOrder,
        items: [mockOrderItem],
      } as Order;
      const managerDelete = jest.fn().mockResolvedValue(undefined);
      const managerCreate = jest.fn((_: unknown, payload: unknown) => payload);
      const managerSave = jest.fn().mockResolvedValue(undefined);
      const managerUpdate = jest.fn().mockResolvedValue(undefined);
      const managerFindOneOrFail = jest.fn().mockResolvedValue({
        ...loadedOrderWithItems,
        items: [{ ...mockOrderItem, quantity: 3 }],
        total: '150.00',
      });

      orderRepository.findOne.mockResolvedValue(loadedOrderWithItems);
      productRepository.find.mockResolvedValue([mockProduct]);
      orderRepository.manager.transaction.mockImplementation(
        async (handler: (manager: unknown) => Promise<unknown>) =>
          handler({
            delete: managerDelete,
            create: managerCreate,
            save: managerSave,
            update: managerUpdate,
            findOneOrFail: managerFindOneOrFail,
          }),
      );

      await service.update(mockOrder.id, updateOrderDto, mockAuthenticatedUser);

      expect(managerUpdate).toHaveBeenCalledWith(
        Order,
        { id: mockOrder.id },
        { total: '150.00' },
      );
      expect(managerSave).toHaveBeenCalledTimes(updateOrderDto.items.length);
      expect(managerSave).not.toHaveBeenCalledWith(loadedOrderWithItems);
    });

    it('should throw NotFoundException if order not found', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(mockOrder.id, updateOrderDto, mockAuthenticatedUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the order', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);
      const otherUser: AuthenticatedUser = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'other@example.com',
      };

      await expect(
        service.update(mockOrder.id, updateOrderDto, otherUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if order status is not PENDING', async () => {
      const nonPendingOrder = { ...mockOrder, status: OrderStatus.PAID };
      orderRepository.findOne.mockResolvedValue(nonPendingOrder);

      await expect(
        service.update(mockOrder.id, updateOrderDto, mockAuthenticatedUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('should cancel order successfully', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);
      orderRepository.save.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      const result = await service.cancel(mockOrder.id, mockAuthenticatedUser);

      expect(result).toBeDefined();
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(orderRedis.invalidateOrderAndUser).toHaveBeenCalledWith(
        mockOrder.id,
        mockOrder.userId,
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancel(mockOrder.id, mockAuthenticatedUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the order', async () => {
      orderRepository.findOne.mockResolvedValue(mockOrder);
      const otherUser: AuthenticatedUser = {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        email: 'other@example.com',
      };

      await expect(service.cancel(mockOrder.id, otherUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException if order status is not PENDING', async () => {
      const nonPendingOrder = { ...mockOrder, status: OrderStatus.PAID };
      orderRepository.findOne.mockResolvedValue(nonPendingOrder);

      await expect(
        service.cancel(mockOrder.id, mockAuthenticatedUser),
      ).rejects.toThrow(ConflictException);
    });
  });
});
