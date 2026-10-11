import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import { randomBytes } from 'crypto';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminSiteCmsController {
  constructor(private readonly service: AdminService) {}

  @Post('site-cms/publish')
  @ApiOperation({ summary: 'Publish site CMS draft (content + sections) to public site' })
  publishSiteCms(@CurrentUser('id') actorId?: string) {
    return this.service.publishSiteCms(actorId);
  }

  @Post('site-cms/upload')
  @ApiOperation({ summary: 'Upload image for site CMS (hero, banners)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        slot: { type: 'string', description: 'desktop | mobile | generic' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, os.tmpdir()),
        filename: (_req, file, cb) => {
          const safe = (file.originalname || 'upload')
            .replace(/[^\w.\-]+/g, '_')
            .slice(0, 80);
          cb(null, `cms-${Date.now()}-${randomBytes(6).toString('hex')}-${safe}`);
        },
      }),
      limits: { fileSize: 12 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (mime && !mime.startsWith('image/')) {
          return cb(new BadRequestException('فقط تصویر مجاز است') as unknown as Error, false);
        }
        cb(null, true);
      },
    }),
  )
  uploadSiteImage(
    @UploadedFile()
    file: {
      buffer?: Buffer;
      path?: string;
      mimetype: string;
      originalname: string;
      size: number;
    },
    @Body('slot') slot: string | undefined,
    @CurrentUser('id') actorId?: string,
  ) {
    if (!file || (!file.path && !file.buffer?.length)) {
      throw new BadRequestException('فایل ارسال نشده است');
    }
    return this.service.uploadSiteCmsImage(file, slot, actorId);
  }
}
