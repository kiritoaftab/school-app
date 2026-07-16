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

  // --- S3 (school logo uploads) ---
  s3: {
    region: process.env.AWS_REGION ?? '',
    bucket: process.env.AWS_S3_BUCKET ?? '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    // Prefix (folder) uploaded logos are stored under.
    prefix: process.env.AWS_S3_PREFIX ?? 'school-logos',
    // Public base URL for reading objects. Defaults to the standard S3 URL;
    // set to a CloudFront/custom domain if you serve logos through one.
    publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL ?? '',
  },
};

export const isS3Configured = Boolean(
  config.s3.region && config.s3.bucket && config.s3.accessKeyId && config.s3.secretAccessKey,
);
