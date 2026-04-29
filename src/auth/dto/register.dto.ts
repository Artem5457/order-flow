import {
  IsDefined,
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import {
  PASSWORD_HAS_DIGIT_REGEX,
  PASSWORD_HAS_LATIN_LETTER_REGEX,
  PASSWORD_HAS_SPECIAL_CHAR_REGEX,
} from './constants/dto.constants';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsDefined()
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  readonly email: string;

  @IsDefined()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  @Matches(PASSWORD_HAS_LATIN_LETTER_REGEX, {
    message: 'Password must contain at least one Latin letter',
  })
  @Matches(PASSWORD_HAS_DIGIT_REGEX, {
    message: 'Password must contain at least one number',
  })
  @Matches(PASSWORD_HAS_SPECIAL_CHAR_REGEX, {
    message: 'Password must contain at least one special character',
  })
  readonly password: string;
}
