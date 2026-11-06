import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage.provider';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync, accessSync, constants } from 'fs';

/**
 * Local filesystem storage.
 * Suitable for development and for production only when a persistent volume
 * is mounted and STORAGE_LOCAL_PATH points at that mount.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;
  private readonly publicBase: string;
  private writable = false;

  constructor(private readonly config: ConfigService) {
    const configured =
      config.get<string>('storageLocalPath') ||
      process.env.STORAGE_LOCAL_PATH ||
      './uploads';

    this.basePath = path.isAbsolute(configured)
      ? path.normalize(configured)
      : path.resolve(process.cwd(), configured);

    this.publicBase = (
      process.env.PUBLIC_API_URL ||
      process.env.API_PUBLIC_URL ||
      ''
    )
      .trim()
      .replace(/\/$/, '')
      .replace(/\/api\/v1$/i, '');
  }

  async onModuleInit() {
    try {
      this.ensureBaseDir();
      const probe = path.join(this.basePath, `.write-probe-${process.pid}`);
      await fs.writeFile(probe, 'ok', { mode: 0o644 });
      await fs.unlink(probe).catch(() => undefined);
      this.writable = true;
      this.logger.log(
        `Local storage ready path=${this.basePath} publicBase=${this.publicBase || '(relative)'}`,
      );
    } catch (err) {
      this.writable = false;
      const e = err as NodeJS.ErrnoException;
      this.logger.error(
        `Local storage NOT writable path=${this.basePath} code=${e.code || 'unknown'} msg=${e.message}. ` +
          'Set STORAGE_PROVIDER=s3 with object-storage credentials, or attach a Liara Disk and set STORAGE_LOCAL_PATH to the mount path.',
      );
    }
  }

  private ensureBaseDir() {
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true, mode: 0o755 });
    }
    accessSync(this.basePath, constants.W_OK);
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const safeKey = key.replace(/^\/+/, '').replace(/\.\./g, '');
    const full = path.join(this.basePath, safeKey);

    if (!full.startsWith(this.basePath)) {
      throw new InternalServerErrorException('مسیر ذخیره‌سازی نامعتبر است.');
    }

    try {
      this.ensureBaseDir();
      await fs.mkdir(path.dirname(full), { recursive: true, mode: 0o755 });
      await fs.writeFile(full, buffer, { mode: 0o644 });
      this.writable = true;
      this.logger.log(
        `stored key=${safeKey} bytes=${buffer.length} type=${contentType} path=${full}`,
      );
      return safeKey;
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      this.logger.error(
        `storage write failed key=${safeKey} path=${full} code=${e.code || 'unknown'} errno=${e.errno ?? ''} msg=${e.message}`,
      );

      let hint = 'ذخیره‌سازی فایل ناموفق بود.';
      if (e.code === 'EROFS') {
        hint =
          'فایل‌سیستم فقط‌خواندنی است. یک Disk پایدار به سرویس وصل کنید یا STORAGE_PROVIDER=s3 تنظیم کنید.';
      } else if (e.code === 'EACCES' || e.code === 'EPERM') {
        hint =
          'دسترسی نوشتن روی مسیر ذخیره‌سازی وجود ندارد. STORAGE_LOCAL_PATH و permission دیسک را بررسی کنید.';
      } else if (e.code === 'ENOSPC') {
        hint = 'فضای دیسک پر است.';
      } else if (e.code === 'ENOENT') {
        hint =
          'مسیر ذخیره‌سازی یافت نشد. STORAGE_LOCAL_PATH را روی mount point دیسک تنظیم کنید.';
      } else {
        hint =
          'ذخیره‌سازی فایل ناموفق بود. فضای دیسک یا دسترسی نوشتن را بررسی کنید.';
      }
      throw new InternalServerErrorException(hint);
    }
  }

  async delete(key: string): Promise<void> {
    const safeKey = key.replace(/^\/+/, '').replace(/\.\./g, '');
    try {
      await fs.unlink(path.join(this.basePath, safeKey));
    } catch {
      /* ignore missing */
    }
  }

  getPublicUrl(key: string): string {
    const safeKey = key.replace(/^\/+/, '');
    if (this.publicBase) {
      return `${this.publicBase}/api/v1/files/${safeKey}`;
    }
    return `/api/v1/files/${safeKey}`;
  }

  async download(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const safeKey = key.replace(/^\/+/, '').replace(/\.\./g, '');
    const full = path.join(this.basePath, safeKey);
    if (!full.startsWith(this.basePath)) return null;
    try {
      const buffer = await fs.readFile(full);
      const lower = safeKey.toLowerCase();
      const contentType = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.gif')
            ? 'image/gif'
            : lower.endsWith('.mp4')
              ? 'video/mp4'
              : 'image/jpeg';
      return { buffer, contentType };
    } catch {
      return null;
    }
  }

  getBasePath(): string {
    return this.basePath;
  }

  isWritable(): boolean {
    return this.writable;
  }
}
