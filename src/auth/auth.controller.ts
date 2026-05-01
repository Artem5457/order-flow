import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, AuthResponseDto, RefreshTokenDto } from './dto';
import { Auth } from './decorators/auth.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return tokens;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return tokens;
  }

  @Post('logout')
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request & { user: AuthenticatedUser },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(request.user.id);
    res.clearCookie('refreshToken', {
      path: '/auth/refresh-token',
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const tokens = await this.authService.refreshToken(dto.refreshToken);
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return tokens;
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth/refresh-token',
    });
  }
}
