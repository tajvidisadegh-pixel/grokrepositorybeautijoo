import {
  assertUploadSize,
  findSuspiciousReason,
  uploadMaxBytes,
  uploadMaxImageBytes,
  uploadMaxVideoBytes,
  DEFAULT_UPLOAD_MAX_BYTES,
  DEFAULT_UPLOAD_MAX_IMAGE_BYTES,
  DEFAULT_UPLOAD_MAX_VIDEO_BYTES,
  isVideoMime,
} from '../../src/media/upload-security';
import { sniffImage } from '../../src/media/image-sniff';

describe('upload-security', () => {
  const prevBytes = process.env.UPLOAD_MAX_BYTES;
  const prevImage = process.env.UPLOAD_MAX_IMAGE_BYTES;
  const prevVideo = process.env.UPLOAD_MAX_VIDEO_BYTES;

  afterEach(() => {
    if (prevBytes === undefined) delete process.env.UPLOAD_MAX_BYTES;
    else process.env.UPLOAD_MAX_BYTES = prevBytes;
    if (prevImage === undefined) delete process.env.UPLOAD_MAX_IMAGE_BYTES;
    else process.env.UPLOAD_MAX_IMAGE_BYTES = prevImage;
    if (prevVideo === undefined) delete process.env.UPLOAD_MAX_VIDEO_BYTES;
    else process.env.UPLOAD_MAX_VIDEO_BYTES = prevVideo;
  });

  it('default image max is 10 MiB (issue #31)', () => {
    delete process.env.UPLOAD_MAX_BYTES;
    delete process.env.UPLOAD_MAX_IMAGE_BYTES;
    expect(DEFAULT_UPLOAD_MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(uploadMaxBytes()).toBe(DEFAULT_UPLOAD_MAX_BYTES);
    expect(uploadMaxImageBytes()).toBe(DEFAULT_UPLOAD_MAX_IMAGE_BYTES);
  });

  it('default video max is 500 MiB (issue #31)', () => {
    delete process.env.UPLOAD_MAX_VIDEO_BYTES;
    expect(DEFAULT_UPLOAD_MAX_VIDEO_BYTES).toBe(500 * 1024 * 1024);
    expect(uploadMaxVideoBytes()).toBe(DEFAULT_UPLOAD_MAX_VIDEO_BYTES);
  });

  it('assertUploadSize rejects oversized image', () => {
    process.env.UPLOAD_MAX_IMAGE_BYTES = '100';
    expect(() => assertUploadSize(101)).toThrow(/حجم فایل/);
    expect(() => assertUploadSize(101, 'image/jpeg')).toThrow(/حجم فایل/);
  });

  it('assertUploadSize rejects oversized video', () => {
    process.env.UPLOAD_MAX_VIDEO_BYTES = '200';
    expect(() => assertUploadSize(201, 'video/mp4')).toThrow(/حجم فایل/);
  });

  it('assertUploadSize accepts image within limit', () => {
    process.env.UPLOAD_MAX_IMAGE_BYTES = '1000';
    expect(() => assertUploadSize(500)).not.toThrow();
    expect(() => assertUploadSize(500, 'image/png')).not.toThrow();
  });

  it('assertUploadSize accepts video within limit', () => {
    process.env.UPLOAD_MAX_VIDEO_BYTES = '5000';
    expect(() => assertUploadSize(4000, 'video/webm')).not.toThrow();
  });

  it('assertUploadSize rejects empty file', () => {
    expect(() => assertUploadSize(0)).toThrow(/خالی/);
  });

  it('isVideoMime detects video types', () => {
    expect(isVideoMime('video/mp4')).toBe(true);
    expect(isVideoMime('image/jpeg')).toBe(false);
    expect(isVideoMime(null)).toBe(false);
  });

  it('flags HTML polyglot', () => {
    const buf = Buffer.from('<html><script>alert(1)</script></html>');
    expect(findSuspiciousReason(buf)).toBe('html_or_script');
  });

  it('flags SVG', () => {
    const buf = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(findSuspiciousReason(buf)).toBe('svg');
  });

  it('flags PE executable', () => {
    const buf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    expect(findSuspiciousReason(buf)).toBe('pe_executable');
  });

  it('flags ZIP', () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(findSuspiciousReason(buf)).toBe('zip_archive');
  });

  it('allows clean JPEG magic', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(findSuspiciousReason(jpeg)).toBeNull();
    expect(sniffImage(jpeg)?.kind).toBe('jpeg');
  });

  it('allows clean PNG magic', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(findSuspiciousReason(png)).toBeNull();
    expect(sniffImage(png)?.kind).toBe('png');
  });
});
