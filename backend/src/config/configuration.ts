import { randomBytes } from 'crypto';

/** Known weak / placeholder secrets that must never be used. */
const BANNED_SECRETS = new Set([
  'dev-access-secret-change-in-prod-32',
  'dev-refresh-secret-change-in-prod-32',
  'secret',
  'changeme',
  'change-me',
  'jwt-secret',
  'your-secret-key',
  'your-super-secret-jwt-key-change-this-min-32-chars',
]);

const MIN_SECRET_LEN = 32;

function isWeakSecret(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v.length < MIN_SECRET_LEN) return true;
  if (BANNED_SECRETS.has(v)) return true;
  // Reject all-same-character or obvious sequential placeholders
  if (/^(.)\1+$/.test(v)) return true;
  return false;
}

/**
 * Resolve a JWT secret.
 * - Production: required from env, min 32 chars, not in ban list.
 * - Development/test: use env if strong; otherwise generate a per-process random secret
 *   (tokens do not survive restart — acceptable for local dev only).
 */
function resolveJwtSecret(
  envValue: string | undefined,
  label: string,
  isProd: boolean,
): string {
  if (envValue && !isWeakSecret(envValue)) {
    return envValue.trim();
  }

  if (isProd) {
    throw new Error(
      `FATAL: ${label} must be set to a strong secret (min ${MIN_SECRET_LEN} chars). ` +
        `Generate with: openssl rand -hex 32. Weak/placeholder values are rejected.`,
    );
  }

  // Dev/test only: ephemeral random secret
  const generated = randomBytes(48).toString('hex');
  // eslint-disable-next-line no-console
  console.warn(
    `[config] ${label} missing or weak — using ephemeral random secret for this process. ` +
      `Tokens will be invalid after restart. Set a stable secret in .env for persistent sessions.`,
  );
  return generated;
}

export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const databaseUrl = process.env.DATABASE_URL;

  if (isProd) {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required in production');
    }
  }

  const accessSecret = resolveJwtSecret(
    process.env.JWT_ACCESS_SECRET,
    'JWT_ACCESS_SECRET',
    isProd,
  );
  const refreshSecret = resolveJwtSecret(
    process.env.JWT_REFRESH_SECRET,
    'JWT_REFRESH_SECRET',
    isProd,
  );

  if (accessSecret === refreshSecret) {
    throw new Error(
      'FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.',
    );
  }

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl,
    jwt: {
      accessSecret,
      refreshSecret,
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
