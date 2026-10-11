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

/** Max portfolio assets per professional. */
export const DEFAULT_MAX_PORTFOLIO = 40;

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
  if (sizeBytes <= 0) {
    throw new BadRequestException('فایل خالی است');
  }
}

function headerMatches(buf: Buffer, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  return sig.every((b, i) => buf[offset + i] === b);
}

/**
 * Heuristic quarantine gate: reject payloads that look like scripts,
 * archives disguised as images, or native executables.
 * Returns a short reason or null if OK.
 */
export function findSuspiciousReason(buf: Buffer): string | null {
  if (!buf?.length) return 'empty';
  const head = buf.subarray(0, Math.min(buf.length, 512));
  const ascii = head.toString('latin1').toLowerCase();

  // SVG first (XML-based; not in allowed raster set)
  if (ascii.includes('<svg') || (ascii.includes('<?xml') && ascii.includes('svg'))) {
    return 'svg';
  }

  // HTML / script polyglot (svg excluded — handled above)
  if (/<\s*(html|script|iframe|embed|object|link|meta)\b/.test(ascii)) {
    return 'html_or_script';
  }
  if (ascii.includes('<?php') || ascii.includes('<%=') || ascii.includes('<jsp:')) {
    return 'server_script';
  }

  // Windows PE
  if (headerMatches(buf, [0x4d, 0x5a])) return 'pe_executable';
  // ELF
  if (headerMatches(buf, [0x7f, 0x45, 0x4c, 0x46])) return 'elf_executable';
  // Mach-O
  if (
    headerMatches(buf, [0xfe, 0xed, 0xfa, 0xce]) ||
    headerMatches(buf, [0xfe, 0xed, 0xfa, 0xcf]) ||
    headerMatches(buf, [0xcf, 0xfa, 0xed, 0xfe]) ||
    headerMatches(buf, [0xce, 0xfa, 0xed, 0xfe])
  ) {
    return 'macho_executable';
  }
  // ZIP / JAR / APK / DOCX (often used to smuggle)
  if (headerMatches(buf, [0x50, 0x4b, 0x03, 0x04]) || headerMatches(buf, [0x50, 0x4b, 0x05, 0x06])) {
    return 'zip_archive';
  }
  // PDF
  if (headerMatches(buf, [0x25, 0x50, 0x44, 0x46])) return 'pdf';

  return null;
}

export function assertNotSuspicious(buf: Buffer, mime?: string | null): void {
  // Skip polyglot checks for known video containers (mp4/webm/mov)
  if (isVideoMime(mime)) return;
  const reason = findSuspiciousReason(buf);
  if (reason) {
    throw new BadRequestException(
      'فایل مشکوک شناسایی شد و رد شد (فرمت یا محتوای غیرمجاز)',
    );
  }
}
