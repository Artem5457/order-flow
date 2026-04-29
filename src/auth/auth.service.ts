import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';
import Redis from 'ioredis';
import { StringValue } from 'ms';
import { User } from '../database/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { REDIS_CLIENT, REDIS_KEY_PREFIX } from '../redis/redis.constants';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private static readonly PASSWORD_SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const user = this.usersRepository.create({
      email: dto.email,
      password: await hash(dto.password, AuthService.PASSWORD_SALT_ROUNDS),
    });

    const savedUser = await this.usersRepository.save(user);

    return this.issueTokens(savedUser);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.redisClient.del(this.getRefreshTokenStorageKey(userId));
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const storedTokenHash = await this.redisClient.get(
      this.getRefreshTokenStorageKey(user.id),
    );
    if (!storedTokenHash) {
      throw new UnauthorizedException('Refresh session expired');
    }

    const isRefreshTokenValid = await compare(refreshToken, storedTokenHash);
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user);
  }

  private async issueTokens(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.configService.getOrThrow<StringValue>(
        'jwt.refreshTokenExpiry',
      ),
    });

    const refreshTokenHash = await hash(
      refreshToken,
      AuthService.PASSWORD_SALT_ROUNDS,
    );

    await this.redisClient.set(
      this.getRefreshTokenStorageKey(user.id),
      refreshTokenHash,
      'EX',
      this.getRefreshTokenTtlSeconds(refreshToken),
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private getRefreshTokenStorageKey(this: void, userId: string): string {
    return `${REDIS_KEY_PREFIX}:auth:refresh:${userId}`;
  }

  private getRefreshTokenTtlSeconds(token: string): number {
    let decoded: JwtPayload & { exp?: number };
    try {
      decoded = this.jwtService.verify<JwtPayload & { exp?: number }>(token, {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
        ignoreExpiration: true,
      });
    } catch {
      return 60;
    }

    if (typeof decoded.exp !== 'number') {
      return 60;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return Math.max(1, decoded.exp - nowInSeconds);
  }
}
