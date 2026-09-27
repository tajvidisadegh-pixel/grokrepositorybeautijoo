import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { MediaKind } from '@prisma/client';
import { MediaService } from './media.service';
import { uploadMaxBytesMulter } from './upload-security';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import * as os from 'os';
import { randomBytes } from 'crypto';

const MULTER_ACCEPT = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'application/octet-stream',
  '',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
]);

@ApiTags('media')
@ApiBearerAuth()
@Roles('professional', 'admin', 'SUPER_ADMIN')
@Controller('professionals/me/media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly service: MediaService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query('kind') kind?: MediaKind) {
    return this.service.listMine(userId, kind);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string', enum: Object.values(MediaKind) },
        professionalServiceId: { type: 'string' },
      },
      required: ['file', 'kind'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) => {
          const safe = (file.originalname || 'upload').replace(/[^\w.\-]+/g, '_').slice(0, 80);
          cb(null, `bj-${Date.now()}-${randomBytes(6).toString('hex')}-${safe}`);
        },
      }),
      limits: { fileSize: uploadMaxBytesMulter(), files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!file) {
          return cb(new BadRequestException('فایل ارسال نشده است') as unknown as Error, false);
        }
        const mime = (file.mimetype || '').toLowerCase().trim();
        if (
          mime &&
          !MULTER_ACCEPT.has(mime) &&
          !mime.startsWith('image/') &&
          !mime.startsWith('video/')
        ) {
          return cb(
            new BadRequestException(
              'فرمت این فایل پشتیبانی نمی‌شود. فقط JPG، PNG، WEBP، GIF، HEIC یا ویدیو MP4/WEBM/MOV مجاز است.',
            ) as unknown as Error,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @CurrentUser('id') userId: string,
    @UploadedFile()
    file: {
      buffer?: Buffer;
      path?: string;
      mimetype: string;
      originalname: string;
      size: number;
    },
    @Body('kind') kind: string,
    @Body('professionalServiceId') professionalServiceId?: string,
  ) {
    if (!file || (!file.path && !file.buffer?.length)) {
      throw new BadRequestException('فایل ارسال نشده است');
    }
    if (!kind || typeof kind !== 'string') {
      throw new BadRequestException('نوع تصویر مشخص نشده است');
    }
    const normalizedKind = kind.trim().toLowerCase() as MediaKind;
    const validKinds = Object.values(MediaKind) as string[];
    if (!validKinds.includes(normalizedKind)) {
      throw new BadRequestException('نوع تصویر نامعتبر است. لطفاً دوباره تلاش کنید.');
    }

    this.logger.log(
      `upload user=${userId} kind=${normalizedKind} mime=${file.mimetype || '(empty)'} size=${file.size} disk=${Boolean(file.path)}`,
    );

    try {
      return await this.service.upload(userId, file, normalizedKind, professionalServiceId);
    } catch (err) {
      if (err && typeof err === 'object' && 'getStatus' in err) throw err;
      this.logger.error(`upload failed user=${userId}: ${(err as Error)?.message}`);
      throw err;
    }
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string | null;
      price?: number | null;
      durationMin?: number | null;
      professionalServiceId?: string | null;
      sortOrder?: number;
    },
  ) {
    return this.service.updateMine(userId, id, body || {});
  }

  @Post('publish')
  publish(@CurrentUser('id') userId: string, @Body() body: { ids: string[] }) {
    return this.service.publishAssets(userId, body.ids || []);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.deleteMine(userId, id);
  }
}
