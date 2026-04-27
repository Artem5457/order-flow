import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../guards/jwt.guard';

export function Auth() {
  return applyDecorators(UseGuards(JwtGuard), ApiBearerAuth());
}
