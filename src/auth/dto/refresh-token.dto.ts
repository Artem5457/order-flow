import { IsDefined, IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  readonly refreshToken: string;
}
