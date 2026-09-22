import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.provider';
import { MediaKind, MediaStatus, type MediaAsset } from '@prisma/client';
import { sniffImage } from './image-sniff';
import {
  assertNotSuspicious,
  assertUploadSize,
  uploadMaxPortfolio,
} from './upload-security';
import * as fs from 'fs/promises';
import sharp from 'sharp';

/** Kinds where only one active asset should remain per professional. */
const REPLACE_KINDS: ReadonlySet<MediaKind> = new Set([
  MediaKind.avatar,
  MediaKind.cover,
  MediaKind.logo,
]);

const MAX_EDGE_PX = Number(process.env.UPLOAD_MAX_EDGE_PX || 2048);
const WEBP_QUALITY = Number(process.env.UPLOAD_WEBP_QUALITY || 82);

export type UploadedBufferFile = {
  buffer?: Buffer;
  path?: string;
  mimetype: string;
  originalname: string;
  size: number;
};

function withPublicUrl<T extends { url?: string | null }>(
  row: T,
): T & { publicUrl: string | null } {
  return { ...row, publicUrl: row?.url ?? null };
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  private async readFileBytes(file: UploadedBufferFile): Promise<Buffer> {
    if (file.buffer?.length) return file.buffer;
    if (file.path) {
      return fs.readFile(file.path);
    }
    throw new BadRequestException('فایل خالی است');
  }

  private async cleanupTemp(file: UploadedBufferFile): Promise<void> {
    if (!file.path) return;
    try {
      await fs.unlink(file.path);
    } catch {
      // ignore
    }
  }

  private async processImage(raw: Buffer): Promise<{ buffer: Buffer; mime: string; ext: string }> {
    const detected = sniffImage(raw);
    if (!detected) {
      throw new BadRequestException(
        'فرمت تصویر مجاز نیست (jpeg/png/webp/gif/heic)',
      );
    }

    if (detected.kind === 'gif') {
      return { buffer: raw, mime: detected.mime, ext: detected.ext };
    }

    try {
      let pipeline = sharp(raw, { failOn: 'none' }).rotate();
      const meta = await pipeline.metadata();
      const w = meta.width || 0;
      const h = meta.height || 0;
      if (MAX_EDGE_PX > 0 && (w > MAX_EDGE_PX || h > MAX_EDGE_PX)) {
        pipeline = pipeline.resize({
          width: MAX_EDGE_PX,
          height: MAX_EDGE_PX,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
      const buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
      return { buffer, mime: 'image/webp', ext: 'webp' };
    } catch (err) {
      this.logger.warn(`sharp process failed, storing original: ${(err as Error)?.message}`);
      return { buffer: raw, mime: detected.mime, ext: detected.ext };
    }
  }

  private async replaceOldAssets(professionalId: string, kind: MediaKind): Promise<void> {
    if (!REPLACE_KINDS.has(kind)) return;
    const old = await this.prisma.mediaAsset.findMany({
      where: { professionalId, kind },
      select: { id: true, storageKey: true },
    });
    for (const asset of old) {
      if (asset.storageKey) {
        try {
          await this.storage.delete(asset.storageKey);
        } catch {
          // best-effort
        }
      }
      await this.prisma.mediaAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
    }
  }

  async upload(
    userId: string,
    file: UploadedBufferFile,
    kind: MediaKind = MediaKind.portfolio,
    professionalServiceId?: string,
  ) {
    try {
      if (!file || (!file.buffer?.length && !file.path)) {
        throw new BadRequestException('فایل خالی است');
      }

      const raw = await this.readFileBytes(file);
      if (!raw.length) {
        throw new BadRequestException('فایل خالی است');
      }

      assertUploadSize(raw.length);
      assertNotSuspicious(raw);

      const processed = await this.processImage(raw);

      let pro = await this.prisma.professional.findUnique({ where: { userId } });
      if (!pro) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: { profile: true },
        });
        if (!user) throw new NotFoundException('کاربر یافت نشد');
        const baseSlug = (user.profile?.displayName || user.phone || 'pro')
          .toString()
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w\u0600-\u06FF-]+/g, '')
          .slice(0, 40) || 'pro';
        let slug = baseSlug;
        for (let i = 0; i < 5; i++) {
          const taken = await this.prisma.professional.findUnique({ where: { slug } });
          if (!taken) break;
          slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
        }
        pro = await this.prisma.professional.create({
          data: {
            userId,
            slug,
            title: user.profile?.displayName || 'زیباگر',
            status: 'draft' as any,
          },
        });
      }

      if (professionalServiceId) {
        const ps = await this.prisma.professionalService.findFirst({
          where: { id: professionalServiceId, professionalId: pro.id },
        });
        if (!ps) throw new ForbiddenException('خدمت متعلق به شما نیست');
      }

      if (kind === MediaKind.portfolio) {
        const count = await this.prisma.mediaAsset.count({
          where: { professionalId: pro.id, kind: MediaKind.portfolio },
        });
        if (count >= uploadMaxPortfolio()) {
          throw new BadRequestException(
            `تعداد تصاویر نمونه کار به سقف مجاز (${uploadMaxPortfolio()}) رسیده است`,
          );
        }
      }

      await this.replaceOldAssets(pro.id, kind);

      const key = `professionals/${pro.id}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${processed.ext}`;
      const storageKey = await this.storage.upload(key, processed.buffer, processed.mime);
      const url = this.storage.getPublicUrl(storageKey);

      const asset = await this.prisma.mediaAsset.create({
        data: {
          professionalId: pro.id,
          professionalServiceId: professionalServiceId || null,
          kind,
          status: MediaStatus.draft,
          url,
          storageKey,
          mimeType: processed.mime,
          sizeBytes: processed.buffer.length,
        },
      });

      if (kind === MediaKind.logo) {
        await this.prisma.professional
          .update({ where: { id: pro.id }, data: { logoUrl: url } })
          .catch(() => undefined);
      }
      if (kind === MediaKind.cover) {
        await this.prisma.professional
          .update({ where: { id: pro.id }, data: { coverImageUrl: url } })
          .catch(() => undefined);
      }
      if (kind === MediaKind.avatar) {
        await this.prisma.profile
          .updateMany({ where: { userId }, data: { avatarUrl: url } })
          .catch(() => undefined);
      }

      return withPublicUrl(asset);
    } finally {
      await this.cleanupTemp(file);
    }
  }

  async listMine(userId: string, kind?: MediaKind) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const rows = await this.prisma.mediaAsset.findMany({
      where: {
        professionalId: pro.id,
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map(withPublicUrl);
  }

  async publish(userId: string, mediaId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('پروفایل زیباگر یافت نشد');
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, professionalId: pro.id },
    });
    if (!media) throw new NotFoundException('رسانه یافت نشد');
    const updated = await this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { status: MediaStatus.published },
    });
    return withPublicUrl(updated);
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
