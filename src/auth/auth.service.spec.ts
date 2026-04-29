import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../database/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.constants';

jest.mock('bcryptjs');

const mockHash = jest.fn();
const mockCompare = jest.fn();
type MockUsersRepository = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};
type MockJwtService = {
  signAsync: jest.Mock;
  verifyAsync: jest.Mock;
  verify: jest.Mock;
};
type MockRedisClient = {
  del: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
};

describe('AuthService', () => {
  let authService: AuthService;
  let usersRepository: MockUsersRepository;
  let jwtService: MockJwtService;
  let redisClient: MockRedisClient;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$10$hashedPassword',
    createdAt: new Date(),
  };

  const mockJwtPayload = { sub: 'user-123', email: 'test@example.com' };

  beforeEach(async () => {
    (bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>).mockImplementation(
      mockHash,
    );
    (
      bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>
    ).mockImplementation(mockCompare);

    const mockUsersRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      verify: jest.fn(),
    };

    const mockRedisClient = {
      del: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockConfigService = {
      getOrThrow: jest.fn((key: string) => {
        const config: Record<string, string | number | bigint> = {
          'jwt.secret': 'test-secret',
          'jwt.accessTokenExpiry': 3600,
          'jwt.refreshTokenExpiry': 604800n,
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
    redisClient = module.get(REDIS_CLIENT);
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'Password123!',
    };

    it('should register a new user and return tokens', async () => {
      mockHash.mockResolvedValue('hashed-password');
      mockCompare.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValueOnce('access-token');
      jwtService.signAsync.mockResolvedValueOnce('refresh-token');
      jwtService.verify.mockReturnValue({
        ...mockJwtPayload,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.create.mockReturnValue(mockUser);
      usersRepository.save.mockResolvedValue(mockUser);

      const result = await authService.register(registerDto);

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(usersRepository.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: expect.any(String) as string,
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      usersRepository.findOne.mockResolvedValue(mockUser);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(authService.register(registerDto)).rejects.toThrow(
        'User with this email already exists',
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should login user and return tokens', async () => {
      mockCompare.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValueOnce('access-token');
      jwtService.signAsync.mockResolvedValueOnce('refresh-token');
      jwtService.verify.mockReturnValue({
        ...mockJwtPayload,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      usersRepository.findOne.mockResolvedValue(mockUser);

      const result = await authService.login(loginDto);

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockCompare.mockResolvedValue(false);
      usersRepository.findOne.mockResolvedValue(mockUser);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('logout', () => {
    it('should delete refresh token from Redis', async () => {
      await authService.logout('user-123');

      expect(redisClient.del).toHaveBeenCalledWith(
        'order-flow:auth:refresh:user-123',
      );
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';

    it('should return new tokens with valid refresh token', async () => {
      mockCompare.mockResolvedValue(true);
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);
      jwtService.verify.mockReturnValue({
        ...mockJwtPayload,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      usersRepository.findOne.mockResolvedValue(mockUser);
      redisClient.get.mockResolvedValue('hashed-refresh-token');
      jwtService.signAsync.mockResolvedValueOnce('new-access-token');
      jwtService.signAsync.mockResolvedValueOnce('new-refresh-token');

      const result = await authService.refreshToken(refreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);
      usersRepository.findOne.mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw UnauthorizedException if refresh token not in Redis', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);
      usersRepository.findOne.mockResolvedValue(mockUser);
      redisClient.get.mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'Refresh session expired',
      );
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      mockCompare.mockResolvedValue(false);
      jwtService.verifyAsync.mockResolvedValue(mockJwtPayload);
      usersRepository.findOne.mockResolvedValue(mockUser);
      redisClient.get.mockResolvedValue('hashed-refresh-token');

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });
});
