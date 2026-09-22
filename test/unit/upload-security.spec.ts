import {
  assertUploadSize,
  findSuspiciousReason,
  uploadMaxBytes,
  DEFAULT_UPLOAD_MAX_BYTES,
} from '../../src/media/upload-security';
import { sniffImage } from '../../src/media/image-sniff';

describe('upload-security', () => {
  const prev = process.env.UPLOAD_MAX_BYTES;

  afterEach(() => {
    if (prev === undefined) delete process.env.UPLOAD_MAX_BYTES;
    else process.env.UPLOAD_MAX_BYTES = prev;
  });

  it('default max bytes is 8 MiB', () => {
    delete process.env.UPLOAD_MAX_BYTES;
    expect(uploadMaxBytes()).toBe(DEFAULT_UPLOAD_MAX_BYTES);
  });

  it('assertUploadSize rejects oversized', () => {
    process.env.UPLOAD_MAX_BYTES = '100';
    expect(() => assertUploadSize(101)).toThrow(/حجم فایل/);
  });

  it('assertUploadSize accepts within limit', () => {
    process.env.UPLOAD_MAX_BYTES = '1000';
    expect(() => assertUploadSize(500)).not.toThrow();
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
