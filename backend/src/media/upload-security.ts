/**
 * Upload security helpers (Beautijoo 18.12 + issue #31).
 * - size / count limits (image 10MB, video 500MB)
 * - reject polyglot / executable magic (beyond image sniff)
 * Magic-byte image detection remains in image-sniff.ts.
 */

import { BadRequestException } from '@nestjs/common';

/** Image max: 10 MiB (issue #31). Override with UPLOAD_MAX_IMAGE_BYTES. */
export const DEFAULT_UPLOAD_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Video max: 500 MiB (issue #31). Override with UPLOAD_MAX_VIDEO_BYTES. */
export const DEFAULT_UPLOAD_MAX_VIDEO_BYTES = 500 * 1024 * 1024;

/** Legacy single limit (images) — kept for multer default. */
export const DEFAULT_UPLOAD_MAX_BYTES = DEFAULT_UPLOAD_MAX_IMAGE_BYTES;

/** Max portfolio assets per professional (#65.11). */
export const DEFAULT_MAX_PORTFOLIO = 100;

/** Max video duration seconds (issue #31 comment). */
export const DEFAULT_MAX_VIDEO_DURATION_SEC = 60;

export function uploadMaxBytes(): number {
  const n = Number(process.env.UPLOAD_MAX_BYTES || DEFAULT_UPLOAD_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_UPLOAD_MAX_BYTES;
}

export function uploadMaxImageBytes(): number {
  const n = Number(process.env.UPLOAD_MAX_IMAGE_BYTES || DEFAULT_UPLOAD_MAX_IMAGE_BYTES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_UPLOAD_MAX_IMAGE_BYTES;
}

export function uploadMaxVideoBytes(): number {
  const n = Number(process.env.UPLOAD_MAX_VIDEO_BYTES || DEFAULT_UPLOAD_MAX_VIDEO_BYTES);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_UPLOAD_MAX_VIDEO_BYTES;
}

/** Multer limit must cover the larger of image/video. */
export function uploadMaxBytesMulter(): number {
  return Math.max(uploadMaxImageBytes(), uploadMaxVideoBytes());
}

export function uploadMaxPortfolio(): number {
  const n = Number(process.env.UPLOAD_MAX_PORTFOLIO || DEFAULT_MAX_PORTFOLIO);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_PORTFOLIO;
}

export function isVideoMime(mime?: string | null): boolean {
  return (mime || '').toLowerCase().startsWith('video/');
}

export function assertUploadSize(sizeBytes: number, mime?: string | null): void {
  const video = isVideoMime(mime);
  const max = video ? uploadMaxVideoBytes() : uploadMaxImageBytes();
  if (sizeBytes > max) {
    throw new BadRequestException(
      `حجم فایل بیش از حد مجاز است (حداکثر ${Math.round(max / (1024 * 1024))} مگابایت برای ${video ? 'ویدیو' : 'تصویر'})`,
    );
  }
}

/** Reject common executable / script polyglots by magic bytes. */
export function assertNotExecutableMagic(buf: Buffer): void {
  if (!buf || buf.length < 4) return;
  // MZ (Windows PE)
  if (buf[0] === 0x4d && buf[1] === 0x5a) {
    throw new BadRequestException('نوع فایل مجاز نیست');
  }
  // ELF
  if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
    throw new BadRequestException('نوع فایل مجاز نیست');
  }
  // Shebang scripts
  if (buf[0] === 0x23 && buf[1] === 0x21) {
    throw new BadRequestException('نوع فایل مجاز نیست');
  }
}

export function maxVideoDurationSec(): number {
  const n = Number(process.env.UPLOAD_MAX_VIDEO_DURATION_SEC || DEFAULT_MAX_VIDEO_DURATION_SEC);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_VIDEO_DURATION_SEC;
}
