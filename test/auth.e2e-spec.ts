import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
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
import cookieParser from 'cookie-parser';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtGuard } from '../src/auth/guards/jwt.guard';

type MockAuthService = {
  register: jest.Mock;
  login: jest.Mock;
  logout: jest.Mock;
  refreshToken: jest.Mock;
};

const tokensResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let authService: MockAuthService;
  let jwtGuardCanActivateSpy: jest.SpyInstance;

  beforeAll(async () => {
    const authServiceMock: MockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
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
              limit: 10,
            },
          ],
        }),
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
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

    authService = moduleFixture.get(AuthService);
  });

  beforeEach(() => {
    const storageSvc =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
    storageSvc.onApplicationShutdown();
    storageSvc.storage.clear();

    authService.register.mockResolvedValue(tokensResponse);
    authService.login.mockResolvedValue(tokensResponse);
    authService.refreshToken.mockResolvedValue(tokensResponse);
  });

  afterEach(() => {
    authService.register.mockClear();
    authService.login.mockClear();
    authService.logout.mockClear();
    authService.refreshToken.mockClear();
  });

  afterAll(async () => {
    await app.close();
    jwtGuardCanActivateSpy.mockRestore();
  });

  describe('Auth endpoints', () => {
    it('POST /auth/register returns tokens and sets refresh cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'TEST@EXAMPLE.COM', password: 'Password123!' })
        .expect(201);

      expect(authService.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
      });
      expect(response.body).toEqual(tokensResponse);
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringContaining('refreshToken=refresh-token'),
        ]),
      );
    });

    it('POST /auth/register returns 400 for invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'invalid-email', password: 'short' })
        .expect(400);

      expect(authService.register).not.toHaveBeenCalled();
    });

    it('POST /auth/logout returns 403 without bearer token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(403);
      expect(authService.logout).not.toHaveBeenCalled();
    });
  });

  describe('Rate limiting', () => {
    it('returns 429 after exceeding limit on POST /auth/register (5/min)', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ email: `rl-reg-${i}@example.com`, password: 'Password123!' })
          .expect(201);
      }

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'rl-reg-429@example.com', password: 'Password123!' })
        .expect(429);

      expect(res.headers['retry-after']).toBeDefined();
      expect(res.body).toMatchObject({
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
      });
    });

    it('returns 429 after exceeding limit on POST /auth/login (5/min)', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: `rl-login-${i}@example.com`,
            password: 'Password123!',
          })
          .expect(200);
      }

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'rl-login-429@example.com',
          password: 'Password123!',
        })
        .expect(429);

      expect(res.headers['retry-after']).toBeDefined();
      expect(res.body).toMatchObject({
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
      });
    });

    it('returns 429 after exceeding limit on POST /auth/refresh-token (10/min)', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/auth/refresh-token')
          .send({ refreshToken: `mock-refresh-${i}` })
          .expect(200);
      }

      const res = await request(app.getHttpServer())
        .post('/auth/refresh-token')
        .send({ refreshToken: 'mock-refresh-429' })
        .expect(429);

      expect(res.headers['retry-after']).toBeDefined();
      expect(res.body).toMatchObject({
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
      });
    });
  });
});
