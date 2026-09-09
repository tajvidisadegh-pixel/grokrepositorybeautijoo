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
import { sniffImage } from './image-sniff';

const MAX_BYTES = 50 * 1024 * 1024;

/** Minimal file shape from multer memoryStorage (controller does not pass full Express.Multer.File). */
export type UploadedBufferFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async upload(
    userId: string,
    file: UploadedBufferFile,
    kind: MediaKind = MediaKind.portfolio,
    professionalServiceId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('فایل خالی است');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('حجم فایل بیش از حد مجاز است');
    }

    const detected = sniffImage(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        'فرمت تصویر مجاز نیست (jpeg/png/webp/gif/heic)',
      );
    }

    const mime = detected.mime;
    const ext = detected.ext;

    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');

    if (professionalServiceId) {
      const ps = await this.prisma.professionalService.findFirst({
        where: { id: professionalServiceId, professionalId: pro.id },
      });
      if (!ps) throw new ForbiddenException('خدمت متعلق به شما نیست');
    }

    const key = `professionals/${pro.id}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storageKey = await this.storage.upload(key, file.buffer, mime);
    const url = this.storage.getPublicUrl(storageKey);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        professionalId: pro.id,
        professionalServiceId: professionalServiceId || null,
        kind,
        status: MediaStatus.draft,
        url,
        storageKey,
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

  async publishAssets(userId: string, ids: string[]) {
    if (!ids?.length) return { updated: 0 };
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const result = await this.prisma.mediaAsset.updateMany({
      where: {
        professionalId: pro.id,
        id: { in: ids },
      },
      data: { status: MediaStatus.published },
    });
    return { updated: result.count };
  }

  async deleteMine(userId: string, mediaId: string) {
    return this.remove(userId, mediaId);
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
        // best-effort
      }
    }
    await this.prisma.mediaAsset.delete({ where: { id: mediaId } });
    return { id: mediaId, deleted: true };
  }
}
