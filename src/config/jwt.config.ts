import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY,
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY,
}));
