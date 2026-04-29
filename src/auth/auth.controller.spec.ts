import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { AuthenticatedUser } from './strategies/jwt.strategy';

type MockAuthService = {
  register: jest.Mock;
  login: jest.Mock;
  logout: jest.Mock;
  refreshToken: jest.Mock;
};

describe('AuthController', () => {
  let authController: AuthController;
  let authService: MockAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
            refreshToken: jest.fn(),
          },
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const mockResponse = {
      cookie: jest.fn(),
      passthrough: true,
    };

    const mockTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };

    it('should call authService.register and set refresh token cookie', async () => {
      authService.register.mockResolvedValue(mockTokens);

      const result = await authController.register(
        registerDto,
        mockResponse as unknown as Response,
      );

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/auth/refresh-token',
        },
      );
      expect(result).toEqual(mockTokens);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const mockResponse = {
      cookie: jest.fn(),
      passthrough: true,
    };

    const mockTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };

    it('should call authService.login and set refresh token cookie', async () => {
      authService.login.mockResolvedValue(mockTokens);

      const result = await authController.login(
        loginDto,
        mockResponse as unknown as Response,
      );

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/auth/refresh-token',
        },
      );
      expect(result).toEqual(mockTokens);
    });
  });

  describe('logout', () => {
    const mockRequest = {
      user: { id: 'user-123', email: 'test@example.com' },
    } as unknown as Request & { user: AuthenticatedUser };

    const mockResponse = {
      clearCookie: jest.fn(),
      passthrough: true,
    };

    it('should call authService.logout and clear refresh token cookie', async () => {
      await authController.logout(
        mockRequest,
        mockResponse as unknown as Response,
      );

      expect(authService.logout).toHaveBeenCalledWith('user-123');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/auth/refresh-token',
      });
    });
  });

  describe('refreshToken', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    const mockResponse = {
      cookie: jest.fn(),
      passthrough: true,
    };

    const mockTokens = {
      accessToken: 'access-token',
      refreshToken: 'new-refresh-token',
    };

    it('should call authService.refreshToken and set new refresh token cookie', async () => {
      authService.refreshToken.mockResolvedValue(mockTokens);

      const result = await authController.refreshToken(
        refreshTokenDto,
        mockResponse as unknown as Response,
      );

      expect(authService.refreshToken).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh-token',
        {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          path: '/auth/refresh-token',
        },
      );
      expect(result).toEqual(mockTokens);
    });
  });
});
