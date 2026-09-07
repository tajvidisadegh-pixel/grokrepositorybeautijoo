export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const databaseUrl = process.env.DATABASE_URL;
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (isProd) {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (!accessSecret || accessSecret.length < 32) {
      throw new Error('JWT_ACCESS_SECRET is required in production (min 32 chars)');
    }
    if (!refreshSecret || refreshSecret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET is required in production (min 32 chars)');
    }
  }

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl,
    jwt: {
      accessSecret: accessSecret || 'dev-access-secret-change-in-prod-32',
      refreshSecret: refreshSecret || 'dev-refresh-secret-change-in-prod-32',
      accessTtl: process.env.JWT_ACCESS_TTL || '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
    },
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    smsProvider: process.env.SMS_PROVIDER || 'mock',
    /** Payment gateway: "mock" | "zarinpal" */
    paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
    zarinpalMerchantId: process.env.ZARINPAL_MERCHANT_ID || '',
    zarinpalSandbox: process.env.ZARINPAL_SANDBOX || 'false',
    zarinpalAccessToken: process.env.ZARINPAL_ACCESS_TOKEN || '',
    // Storage: "local" | "s3" | "object" | "liara"
    storageProvider: process.env.STORAGE_PROVIDER || 'local',
    storageLocalPath: process.env.STORAGE_LOCAL_PATH || './uploads',
    // S3-compatible (Liara Object Storage, AWS, MinIO) — values from env only
    s3Endpoint: process.env.S3_ENDPOINT || '',
    s3Region: process.env.S3_REGION || 'default',
    s3AccessKey: process.env.S3_ACCESS_KEY || '',
    s3SecretKey: process.env.S3_SECRET_KEY || '',
    s3Bucket: process.env.S3_BUCKET || '',
    s3PublicUrl: process.env.S3_PUBLIC_URL || process.env.STORAGE_PUBLIC_URL || '',
    // Liara default: true. Only set S3_FORCE_PATH_STYLE=false for pure AWS virtual-host.
    s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() !== 'false',
    otpTtlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300', 10),
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
  };
};
