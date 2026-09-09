import {
  Controller,
  Post,
  Get,
  Delete,
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
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import * as os from 'os';
import { randomBytes } from 'crypto';

/** Broad accept at multer; MediaService sniffs magic bytes. */
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
]);

@ApiTags('media')
@ApiBearerAuth()
@Roles('professional', 'admin')
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
      limits: { fileSize: Number.MAX_SAFE_INTEGER },
      fileFilter: (_req, file, cb) => {
        if (!file) {
          return cb(new BadRequestException('\u0641\u0627\u06cc\u0644 \u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a') as unknown as Error, false);
        }
        const mime = (file.mimetype || '').toLowerCase().trim();
        if (mime && !MULTER_ACCEPT.has(mime) && !mime.startsWith('image/')) {
          return cb(
            new BadRequestException(
              '\u0641\u0631\u0645\u062a \u0627\u06cc\u0646 \u0641\u0627\u06cc\u0644 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0646\u0645\u06cc\u200c\u0634\u0648\u062f. \u0641\u0642\u0637 JPG\u060c PNG\u060c WEBP\u060c GIF \u06cc\u0627 HEIC \u0645\u062c\u0627\u0632 \u0627\u0633\u062a.',
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
      throw new BadRequestException('\u0641\u0627\u06cc\u0644 \u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a');
    }
    if (!kind || typeof kind !== 'string') {
      throw new BadRequestException('\u0646\u0648\u0639 \u062a\u0635\u0648\u06cc\u0631 \u0645\u0634\u062e\u0635 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a');
    }
    const normalizedKind = kind.trim().toLowerCase() as MediaKind;
    const validKinds = Object.values(MediaKind) as string[];
    if (!validKinds.includes(normalizedKind)) {
      throw new BadRequestException('\u0646\u0648\u0639 \u062a\u0635\u0648\u06cc\u0631 \u0646\u0627\u0645\u0639\u062a\u0628\u0631 \u0627\u0633\u062a. \u0644\u0637\u0641\u0627\u064b \u062f\u0648\u0628\u0627\u0631\u0647 \u062a\u0644\u0627\u0634 \u06a9\u0646\u06cc\u062f.');
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

  @Post('publish')
  publish(@CurrentUser('id') userId: string, @Body() body: { ids: string[] }) {
    return this.service.publishAssets(userId, body.ids || []);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.deleteMine(userId, id);
  }
}
