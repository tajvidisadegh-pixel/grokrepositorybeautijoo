import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';

/**
 * Public media proxy — used when object storage is private or S3_PUBLIC_URL is unset.
 * URL shape: GET /api/v1/files/professionals/{id}/{kind}/{uuid}.jpg
 *
 * #82.r2.2 — only public portfolio/avatar-like prefixes; block private doc keys.
 */
@ApiTags('files')
@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /** Paths that may be served without auth. */
  private isPublicKey(key: string): boolean {
    const k = key.toLowerCase();
    // Deny obvious private/sensitive folders
    if (
      k.includes('/private/') ||
      k.includes('/id-') ||
      k.includes('/identity') ||
      k.includes('/kyc') ||
      k.includes('/document') ||
      k.includes('/docs/') ||
      k.includes('/national') ||
      k.includes('/verification')
    ) {
      return false;
    }
    // Allow only known public media trees
    if (
      k.startsWith('professionals/') ||
      k.startsWith('portfolio/') ||
      k.startsWith('avatars/') ||
      k.startsWith('public/') ||
      k.startsWith('site/') ||
      k.startsWith('cms/')
    ) {
      return /\.(jpe?g|png|gif|webp|avif|mp4|webm|mov)$/i.test(k);
    }
    return false;
  }

  @Public()
  @Get('*key')
  async serve(@Param('key') keyParam: string, @Res() res: Response) {
    let key = String(keyParam || '')
      .replace(/^\/+/, '')
      .replace(/\.\./g, '')
      .split('?')[0];
    try {
      key = decodeURIComponent(key);
    } catch {
      /* keep raw */
    }
    key = key.replace(/^\/+/, '');
    if (!key || !this.isPublicKey(key)) {
      throw new NotFoundException();
    }

    if (!this.storage.download) {
      this.logger.warn('storage.download not implemented');
      throw new NotFoundException();
    }

    const obj = await this.storage.download(key);
    if (!obj?.buffer?.length) {
      throw new NotFoundException();
    }

    // Never trust client-provided content type; use storage sniff or extension
    const lower = key.toLowerCase();
    let contentType = obj.contentType || 'application/octet-stream';
    if (contentType.includes('html') || contentType.includes('javascript')) {
      throw new NotFoundException();
    }
    if (/\.jpe?g$/i.test(lower)) contentType = 'image/jpeg';
    else if (/\.png$/i.test(lower)) contentType = 'image/png';
    else if (/\.gif$/i.test(lower)) contentType = 'image/gif';
    else if (/\.webp$/i.test(lower)) contentType = 'image/webp';
    else if (/\.avif$/i.test(lower)) contentType = 'image/avif';
    else if (/\.mp4$/i.test(lower)) contentType = 'video/mp4';
    else if (/\.webm$/i.test(lower)) contentType = 'video/webm';
    else if (/\.mov$/i.test(lower)) contentType = 'video/quicktime';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(obj.buffer);
  }
}
