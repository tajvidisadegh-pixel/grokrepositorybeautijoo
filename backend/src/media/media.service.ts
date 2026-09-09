import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.provider';
import { MediaKind, MediaStatus } from '@prisma/client';
import { sniffImageMime } from './image-sniff';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * Upload a media asset for the authenticated professional.
   */
  async upload(
    userId: string,
    file: Express.Multer.File,
    kind: MediaKind = MediaKind.portfolio,
    professionalServiceId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('فایل خالی است');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('حجم فایل بیش از ۵ مگابایت است');
    }

    const sniffed = sniffImageMime(file.buffer);
    const mime = sniffed || file.mimetype;
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('فرمت تصویر مجاز نیست (jpeg/png/webp/gif)');
    }

    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');

    if (professionalServiceId) {
      const ps = await this.prisma.professionalService.findFirst({
        where: { id: professionalServiceId, professionalId: pro.id },
      });
      if (!ps) throw new ForbiddenException('خدمت متعلق به شما نیست');
    }

    const ext =
      mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
          ? 'webp'
          : mime === 'image/gif'
            ? 'gif'
            : 'jpg';

    const key = `professionals/${pro.id}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const stored = await this.storage.put(key, file.buffer, mime);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        professionalId: pro.id,
        professionalServiceId: professionalServiceId || null,
        kind,
        status: MediaStatus.draft,
        url: stored.url,
        storageKey: stored.key,
        mimeType: mime,
        sizeBytes: file.size,
      },
    });

    return asset;
  }

  async listMine(userId: string, kind?: MediaKind) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    return this.prisma.mediaAsset.findMany({
      where: {
        professionalId: pro.id,
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async publish(userId: string, mediaId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, professionalId: pro.id },
    });
    if (!media) throw new NotFoundException('رسانه یافت نشد');
    return this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { status: MediaStatus.published },
    });
  }

  async remove(userId: string, mediaId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, professionalId: pro.id },
    });
    if (!media) throw new NotFoundException('رسانه یافت نشد');
    if (media.storageKey) {
      try {
        await this.storage.delete(media.storageKey);
      } catch {
        // best-effort delete from storage
      }
    }
    await this.prisma.mediaAsset.delete({ where: { id: mediaId } });
    return { id: mediaId, deleted: true };
  }
}
