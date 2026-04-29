import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
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

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
    jwtGuardCanActivateSpy.mockRestore();
  });

  describe('Auth endpoints', () => {
    it('POST /auth/register returns tokens and sets refresh cookie', async () => {
      authService.register.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'TEST@EXAMPLE.COM', password: 'Password123!' })
        .expect(201);

      expect(authService.register).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
      });
      expect(response.body).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
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
});
