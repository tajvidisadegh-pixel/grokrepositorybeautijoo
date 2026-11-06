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

/** Default origins only for local development. Never used in production. */
const DEV_CORS_DEFAULTS = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3000',
];

function isWeakSecret(value: string | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v.length < MIN_SECRET_LEN) return true;
  if (BANNED_SECRETS.has(v)) return true;
  if (/^(.)\1+$/.test(v)) return true;
  return false;
}

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

  const generated = randomBytes(48).toString('hex');
  // eslint-disable-next-line no-console
  console.warn(
    `[config] ${label} missing or weak — using ephemeral random secret for this process. ` +
      `Tokens will be invalid after restart. Set a stable secret in .env for persistent sessions.`,
  );
  return generated;
}

/**
 * Resolve allowed CORS origins.
 * - Production: CORS_ORIGINS required (comma-separated absolute origins).
 *   localhost-only values are rejected so a misconfigured deploy fails fast.
 * - Development: CORS_ORIGINS if set, otherwise localhost defaults.
 */
function resolveCorsOrigins(isProd: boolean): string[] {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  const parsed = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (isProd) {
    if (parsed.length === 0) {
      throw new Error(
        'FATAL: CORS_ORIGINS is required in production. ' +
          'Example: CORS_ORIGINS=https://beautijoo.ir,https://www.beautijoo.ir',
      );
    }
    const onlyLocalhost = parsed.every(
      (o) =>
        o.startsWith('http://localhost') ||
        o.startsWith('http://127.0.0.1') ||
        o.startsWith('https://localhost') ||
        o.startsWith('https://127.0.0.1'),
    );
    if (onlyLocalhost) {
      throw new Error(
        'FATAL: CORS_ORIGINS in production must include at least one non-localhost origin. ' +
          `Got: ${parsed.join(', ')}`,
      );
    }
    for (const origin of parsed) {
      if (!/^https?:\/\//i.test(origin)) {
        throw new Error(
          `FATAL: Invalid CORS origin "${origin}". Use absolute URLs (https://example.com).`,
        );
      }
    }
    return parsed;
  }

  return parsed.length > 0 ? parsed : DEV_CORS_DEFAULTS;
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

  const corsOrigins = resolveCorsOrigins(isProd);

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
    corsOrigins,
    smsProvider: process.env.SMS_PROVIDER || 'mock',
    /** When true, allow MockSmsProvider even in production (diagnostics only). */
    allowMockSms: (process.env.ALLOW_MOCK_SMS || '').toLowerCase() === 'true',
    // SMS.ir — never put real keys in source; set on Liara / host env only
    smsIrApiKey: process.env.SMSIR_API_KEY || '',
    smsIrOtpTemplateId: process.env.SMSIR_OTP_TEMPLATE_ID || '',
    smsIrOtpParamName: process.env.SMSIR_OTP_PARAM_NAME || 'CODE',
    smsIrLineNumber: process.env.SMSIR_LINE_NUMBER || '',
    smsIrBaseUrl: process.env.SMSIR_BASE_URL || 'https://api.sms.ir',
    /**
     * Payment gateway key (provider-agnostic).
     * - mock: development/test only (blocked in production)
     * - disabled / empty in production: online payment off
     * - real keys (e.g. zarinpal): optional integrations — not a project lock-in
     */
    paymentProvider: process.env.PAYMENT_PROVIDER || '',
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
    /** Max wrong verify attempts per OTP code (default 3). */
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
    /** Minimum seconds between OTP requests for the same phone+purpose. */
    otpCooldownSeconds: parseInt(process.env.OTP_COOLDOWN_SECONDS || '60', 10),
    /** Max OTP requests per phone+purpose in a rolling 1-hour window. */
    otpMaxPerHour: parseInt(process.env.OTP_MAX_PER_HOUR || '3', 10),
    /** Max OTP requests per phone (all purposes) in a rolling 24-hour window. */
    otpMaxPerDay: parseInt(process.env.OTP_MAX_PER_DAY || '8', 10),
  };
};
