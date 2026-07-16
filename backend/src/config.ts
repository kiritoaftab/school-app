import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES ?? 5),
  devFixedOtp: process.env.DEV_FIXED_OTP || null,
  // Comma-separated list of allowed origins, e.g.
  // "http://localhost:5173,https://superadmin.shopyoume.in"
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProd: process.env.NODE_ENV === 'production',
};
