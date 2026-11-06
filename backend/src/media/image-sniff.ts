/**
 * Detect image type from magic bytes (not client-supplied MIME).
 * Prevents MIME spoofing and handles empty/wrong mobile Content-Type.
 */

export type DetectedImage =
  | { kind: 'jpeg' | 'png' | 'webp' | 'gif'; mime: string; ext: string }
  | { kind: 'heic'; mime: string; ext: string }
  | null;

function headerMatches(buf: Buffer, sig: number[], offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  return sig.every((b, i) => buf[offset + i] === b);
}

export function sniffImage(buf: Buffer): DetectedImage {
  if (!buf?.length || buf.length < 12) return null;

  if (headerMatches(buf, [0xff, 0xd8, 0xff])) {
    return { kind: 'jpeg', mime: 'image/jpeg', ext: 'jpg' };
  }
  if (headerMatches(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: 'png', mime: 'image/png', ext: 'png' };
  }
  if (
    headerMatches(buf, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    headerMatches(buf, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return { kind: 'gif', mime: 'image/gif', ext: 'gif' };
  }
  if (
    headerMatches(buf, [0x52, 0x49, 0x46, 0x46]) &&
    buf.length >= 12 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { kind: 'webp', mime: 'image/webp', ext: 'webp' };
  }
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = buf.slice(8, 12).toString('ascii').toLowerCase();
    const heicBrands = new Set([
      'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs',
      'mif1', 'msf1', 'heif',
    ]);
    if (heicBrands.has(brand)) {
      return { kind: 'heic', mime: 'image/heic', ext: 'heic' };
    }
    const head = buf.slice(0, Math.min(buf.length, 64)).toString('ascii').toLowerCase();
    if (/(heic|heif|mif1|msf1|hevx)/.test(head)) {
      return { kind: 'heic', mime: 'image/heic', ext: 'heic' };
    }
  }
  return null;
}
