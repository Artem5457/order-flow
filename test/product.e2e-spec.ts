import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { ProductController } from '../src/product/product.controller';
import { ProductService } from '../src/product/product.service';
import { JwtGuard } from '../src/auth/guards/jwt.guard';

type MockProductService = {
  create: jest.Mock;
  findOne: jest.Mock;
  findAll: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
  removeMany: jest.Mock;
};

describe('Product (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let productService: MockProductService;
  let jwtGuardCanActivateSpy: jest.SpyInstance;

  beforeAll(async () => {
    const productServiceMock: MockProductService = {
      create: jest.fn(),
      findOne: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      removeMany: jest.fn(),
    };

    jwtGuardCanActivateSpy = jest
      .spyOn(JwtGuard.prototype, 'canActivate')
      .mockImplementation((context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<{
          headers: Record<string, string>;
          user?: { id: string; email: string };
        }>();
        const authHeader = req.headers.authorization;
        if (authHeader === 'Bearer valid-token') {
          req.user = { id: 'user-123', email: 'test@example.com' };
          return true;
        }
        return false;
      });

    moduleFixture = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            {
              ttl: 60000,
              limit: 120,
            },
          ],
        }),
      ],
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: productServiceMock },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    productService = moduleFixture.get(ProductService);
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

  describe('Product endpoints', () => {
    it('GET /products returns 403 without bearer token', async () => {
      await request(app.getHttpServer()).get('/products').expect(403);
      expect(productService.findAll).not.toHaveBeenCalled();
    });

    it('POST /products creates product for authenticated user', async () => {
      productService.create.mockResolvedValue({
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        name: 'Coffee',
        price: 199.99,
        createdAt: new Date('2026-04-28T12:00:00.000Z'),
      });

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Coffee', price: 199.99 })
        .expect(201);

      expect(productService.create).toHaveBeenCalledWith({
        name: 'Coffee',
        price: 199.99,
      });
      expect(response.body).toMatchObject({
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        name: 'Coffee',
        price: 199.99,
      });
    });

    it('GET /products/:id returns 400 for non-uuid id', async () => {
      await request(app.getHttpServer())
        .get('/products/not-uuid')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);

      expect(productService.findOne).not.toHaveBeenCalled();
    });

    it('DELETE /products returns 400 for invalid ids payload', async () => {
      await request(app.getHttpServer())
        .delete('/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ ids: ['not-a-uuid'] })
        .expect(400);

      expect(productService.removeMany).not.toHaveBeenCalled();
    });
  });

  describe('Rate limiting', () => {
    it('returns 429 after exceeding limit on GET /products (10/min)', async () => {
      for (let i = 0; i < 120; i++) {
        await request(app.getHttpServer())
          .get('/products')
          .set('Authorization', 'Bearer valid-token')
          .expect(200);
      }

      const res = await request(app.getHttpServer())
        .get('/products')
        .set('Authorization', 'Bearer valid-token')
        .expect(429);

      expect(res.headers['retry-after']).toBeDefined();
      expect(res.body).toMatchObject({
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
      });
    });

    it('returns 429 after exceeding limit on POST /products (10/min)', async () => {
      for (let i = 0; i < 120; i++) {
        await request(app.getHttpServer())
          .post('/products')
          .set('Authorization', 'Bearer valid-token')
          .send({ name: `Product ${i}`, price: 99.99 })
          .expect(201);
      }

      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Product 429', price: 99.99 })
        .expect(429);

      expect(res.headers['retry-after']).toBeDefined();
      expect(res.body).toMatchObject({
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
      });
    });
  });
});
