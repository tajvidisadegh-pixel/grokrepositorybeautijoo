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
 */
@ApiTags('files')
@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

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
    if (!key) {
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

    res.setHeader('Content-Type', obj.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(obj.buffer);
  }
}
