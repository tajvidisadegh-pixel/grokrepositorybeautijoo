import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { StorageProvider } from './storage.provider';

/**
 * S3-compatible object storage for Liara Object Storage (and AWS/MinIO).
 *
 * Official Liara Node/Next sample (docs.liara.ir):
 *   endpoint: from console "دسترسی با SDK" (e.g. https://storage.iran.liara.site)
 *   region: "default"
 *   forcePathStyle: true
 *   credentials: Access Key + Secret Key of the bucket
 *
 * Public object URLs (public buckets):
 *   Preferred: S3_PUBLIC_URL (custom domain e.g. https://media.beautijoo.ir)
 *   Fallback: {S3_ENDPOINT}/{S3_BUCKET}/{key}
 *     e.g. https://storage.iran.liara.site/beautijoo-media/professionals/...
 *
 * AWS SDK JS v3 flexible checksums are disabled (WHEN_REQUIRED) for Liara.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly forcePathStyle: boolean;
  private readonly endpointHost: string;
  private readonly region: string;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    this.endpoint = this.cleanEndpoint(
      process.env.S3_ENDPOINT || config.get<string>('s3Endpoint') || '',
    );
    this.region = (
      process.env.S3_REGION ||
      config.get<string>('s3Region') ||
      'default'
    ).trim();
    const accessKeyId = (
      process.env.S3_ACCESS_KEY ||
      config.get<string>('s3AccessKey') ||
      ''
    ).trim();
    const secretAccessKey = (
      process.env.S3_SECRET_KEY ||
      config.get<string>('s3SecretKey') ||
      ''
    ).trim();
    this.bucket = (
      process.env.S3_BUCKET ||
      config.get<string>('s3Bucket') ||
      ''
    ).trim();

    const fpsRaw = (
      process.env.S3_FORCE_PATH_STYLE ||
      String(config.get('s3ForcePathStyle') ?? 'true') ||
      'true'
    )
      .trim()
      .toLowerCase();
    this.forcePathStyle = fpsRaw !== 'false' && fpsRaw !== '0';

    this.endpointHost = this.safeHost(this.endpoint);

    if (!this.endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.logger.error(
        'S3 config incomplete: need S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET (secrets not logged).',
      );
    }

    this.client = new S3Client({
      region: this.region,
      endpoint: this.endpoint || undefined,
      forcePathStyle: this.forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    this.stripChecksumMiddleware(this.client);

    this.publicBase = (
      process.env.S3_PUBLIC_URL ||
      process.env.STORAGE_PUBLIC_URL ||
      config.get<string>('s3PublicUrl') ||
      ''
    )
      .trim()
      .replace(/\/$/, '');

    if (!this.publicBase) {
      this.logger.warn(
        'S3_PUBLIC_URL not set — getPublicUrl will use path-style {S3_ENDPOINT}/{S3_BUCKET}/{key} ' +
          '(works for public Liara buckets). Prefer binding media.beautijoo.ir and setting S3_PUBLIC_URL.',
      );
    } else if (
      /\.storage\.iran\.liara\.(site|space)$/i.test(
        this.publicBase.replace(/^https?:\/\//, '').split('/')[0] || '',
      )
    ) {
      this.logger.log(
        'S3_PUBLIC_URL uses Liara storage host. Ensure the bucket is public. ' +
          'Optional: bind media.beautijoo.ir for a custom domain.',
      );
    }

    this.logger.log(
      `S3 ready bucket=${this.bucket || '(empty)'} endpointHost=${this.endpointHost || '(empty)'} ` +
        `forcePathStyle=${this.forcePathStyle} region=${this.region} ` +
        `publicBase=${this.publicBase || '(path-style fallback)'} checksums=WHEN_REQUIRED ` +
        `hasAccessKey=${Boolean(accessKeyId)} hasSecret=${Boolean(secretAccessKey)}`,
    );
  }

  private cleanEndpoint(raw: string): string {
    return raw.trim().replace(/\/+$/, '');
  }

  private safeHost(endpoint: string): string {
    try {
      return endpoint ? new URL(endpoint).host : '';
    } catch {
      return '(invalid-endpoint)';
    }
  }

  private stripChecksumMiddleware(client: S3Client): void {
    try {
      const stack = (client as unknown as { middlewareStack?: { remove?: (n: string) => void } })
        .middlewareStack;
      if (!stack?.remove) return;
      for (const name of ['flexibleChecksumsMiddleware', 'flexibleChecksums']) {
        try {
          stack.remove(name);
        } catch {
          /* middleware may not exist */
        }
      }
    } catch {
      /* ignore */
    }
  }

  private describeError(err: unknown): string {
    if (!err || typeof err !== 'object') return String(err);
    const e = err as Record<string, unknown> & {
      name?: string;
      message?: string;
      Code?: string;
      code?: string;
      $metadata?: { httpStatusCode?: number; requestId?: string };
      $response?: { statusCode?: number };
    };
    const code = e.Code || e.code || e.name || 'Error';
    const status =
      e.$metadata?.httpStatusCode ?? e.$response?.statusCode ?? undefined;
    const requestId = e.$metadata?.requestId;
    const msg = e.message ? String(e.message).slice(0, 400) : '';
    const scrubbed = msg
      .replace(/AKIA[0-9A-Z]{16}/gi, '[REDACTED]')
      .replace(/secret[^,\s]*/gi, 'secret=[REDACTED]')
      .replace(/Credential=[^,\s/]+/gi, 'Credential=[REDACTED]');
    const parts = [
      `name=${code}`,
      status != null ? `status=${status}` : null,
      requestId ? `requestId=${requestId}` : null,
      scrubbed ? `msg=${scrubbed}` : null,
    ].filter(Boolean);
    return parts.join(' ');
  }

  private userMessageForError(err: unknown): string {
    if (!err || typeof err !== 'object') {
      return 'ذخیره‌سازی فایل در Object Storage ناموفق بود. تنظیمات S3 را بررسی کنید.';
    }
    const e = err as Record<string, unknown> & {
      name?: string;
      Code?: string;
      code?: string;
      message?: string;
    };
    const code = String(e.Code || e.code || e.name || '').toLowerCase();
    const msg = String(e.message || '').toLowerCase();

    if (
      code.includes('signaturedoesnotmatch') ||
      msg.includes('signature does not match')
    ) {
      return 'احراز هویت S3 ناموفق بود (SignatureDoesNotMatch). Access Key و Secret Key و Endpoint را در پنل Liara بررسی کنید.';
    }
    if (code.includes('accessdenied') || msg.includes('access denied')) {
      return 'دسترسی به باکت رد شد (AccessDenied). مجوزهای کلید و نام باکت را بررسی کنید.';
    }
    if (code.includes('nosuchbucket') || msg.includes('no such bucket')) {
      return 'باکت یافت نشد (NoSuchBucket). نام S3_BUCKET را با نام باکت در پنل Liara یکسان کنید.';
    }
    if (
      code.includes('invalidaccesskeyid') ||
      msg.includes('invalid access key')
    ) {
      return 'Access Key نامعتبر است. کلید جدید از پنل Object Storage بسازید.';
    }
    if (
      code.includes('permanentredirect') ||
      code.includes('authorizationheadermalformed') ||
      (msg.includes('endpoint') && msg.includes('region'))
    ) {
      return 'Endpoint یا Region نادرست است. مقدار رسمی از بخش «دسترسی با SDK» را برای S3_ENDPOINT استفاده کنید.';
    }
    if (
      code.includes('xamzcontentsha256mismatch') ||
      code.includes('baddigest') ||
      msg.includes('checksum') ||
      msg.includes('content-md5')
    ) {
      return 'خطای checksum/digest با Object Storage.';
    }
    if (
      code.includes('networkingerror') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound')
    ) {
      return 'اتصال به Endpoint فضای ذخیره‌سازی برقرار نشد.';
    }
    return 'ذخیره‌سازی فایل در Object Storage ناموفق بود. تنظیمات S3 را بررسی کنید.';
  }

  async onModuleInit() {
    if (!this.bucket) {
      this.logger.error('S3_BUCKET is empty — uploads will fail.');
      return;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 HeadBucket OK bucket=${this.bucket}`);
    } catch (err) {
      this.logger.warn(
        `S3 HeadBucket failed (PutObject may still work): ${this.describeError(err)}`,
      );
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const safeKey = key.replace(/^\/+/, '');
    if (!this.bucket) {
      throw new InternalServerErrorException(
        'پیکربندی ذخیره‌سازی شیء ناقص است (S3_BUCKET).',
      );
    }
    if (!buffer?.length) {
      throw new InternalServerErrorException('محتوای فایل خالی است.');
    }

    const mime = contentType || 'application/octet-stream';
    const body = Uint8Array.from(buffer);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: safeKey,
          Body: body,
          ContentType: mime,
          CacheControl: 'public, max-age=86400',
        }),
      );
      this.logger.log(
        `s3 put OK key=${safeKey} bytes=${buffer.length} type=${mime} bucket=${this.bucket}`,
      );
      return safeKey;
    } catch (err) {
      this.logger.error(
        `s3 put FAILED key=${safeKey} bucket=${this.bucket} endpointHost=${this.endpointHost} ` +
          `region=${this.region} forcePathStyle=${this.forcePathStyle} ${this.describeError(err)}`,
      );
      throw new InternalServerErrorException(this.userMessageForError(err));
    }
  }

  async delete(key: string): Promise<void> {
    const safeKey = key.replace(/^\/+/, '');
    if (!this.bucket) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey }),
      );
      this.logger.log(`s3 delete OK key=${safeKey}`);
    } catch (err) {
      this.logger.warn(`s3 delete key=${safeKey}: ${this.describeError(err)}`);
    }
  }

  getPublicUrl(key: string): string {
    const safeKey = key.replace(/^\/+/, '');
    // Preferred: custom domain or explicit public base (S3_PUBLIC_URL).
    if (this.publicBase) {
      return `${this.publicBase}/${safeKey}`;
    }
    // Liara public-bucket permanent URL: {endpoint}/{bucket}/{key}
    if (this.endpoint && this.bucket) {
      return `${this.endpoint}/${this.bucket}/${safeKey}`;
    }
    throw new InternalServerErrorException(
      'S3_PUBLIC_URL یا (S3_ENDPOINT + S3_BUCKET) برای ساخت URL عمومی تنظیم نشده است.',
    );
  }

  async exists(key: string): Promise<boolean> {
    const safeKey = key.replace(/^\/+/, '');
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: safeKey }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
