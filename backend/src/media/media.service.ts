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
import { MediaKind, MediaStatus } from '@prisma/client';
import { sniffImage } from './image-sniff';
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
    throw new BadRequestException('\u0641\u0627\u06cc\u0644 \u062e\u0627\u0644\u06cc \u0627\u0633\u062a');
  }

  private async cleanupTemp(file: UploadedBufferFile): Promise<void> {
    if (!file.path) return;
    try {
      await fs.unlink(file.path);
    } catch {
      // ignore
    }
  }

  /**
   * Server-side resize + re-encode (WebP) to keep storage lean without rejecting large uploads.
   * GIF left as-is to preserve animation.
   */
  private async processImage(raw: Buffer): Promise<{ buffer: Buffer; mime: string; ext: string }> {
    const detected = sniffImage(raw);
    if (!detected) {
      throw new BadRequestException(
        '\u0641\u0631\u0645\u062a \u062a\u0635\u0648\u06cc\u0631 \u0645\u062c\u0627\u0632 \u0646\u06cc\u0633\u062a (jpeg/png/webp/gif/heic)',
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

  /** Delete previous assets of the same singular kind (avatar/cover/logo). */
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
        throw new BadRequestException('\u0641\u0627\u06cc\u0644 \u062e\u0627\u0644\u06cc \u0627\u0633\u062a');
      }

      const raw = await this.readFileBytes(file);
      if (!raw.length) {
        throw new BadRequestException('\u0641\u0627\u06cc\u0644 \u062e\u0627\u0644\u06cc \u0627\u0633\u062a');
      }

      const processed = await this.processImage(raw);

      const pro = await this.prisma.professional.findUnique({ where: { userId } });
      if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');

      if (professionalServiceId) {
        const ps = await this.prisma.professionalService.findFirst({
          where: { id: professionalServiceId, professionalId: pro.id },
        });
        if (!ps) throw new ForbiddenException('\u062e\u062f\u0645\u062a \u0645\u062a\u0639\u0644\u0642 \u0628\u0647 \u0634\u0645\u0627 \u0646\u06cc\u0633\u062a');
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

      return asset;
    } finally {
      await this.cleanupTemp(file);
    }
  }

  async listMine(userId: string, kind?: MediaKind) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
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
    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, professionalId: pro.id },
    });
    if (!media) throw new NotFoundException('\u0631\u0633\u0627\u0646\u0647 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    return this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { status: MediaStatus.published },
    });
  }

  async publishAssets(userId: string, ids: string[]) {
    if (!ids?.length) return { updated: 0 };
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
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
    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, professionalId: pro.id },
    });
    if (!media) throw new NotFoundException('\u0631\u0633\u0627\u0646\u0647 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
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
