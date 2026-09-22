import { sniffImage } from '../../src/media/image-sniff';

describe('sniffImage', () => {
  it('detects jpeg', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(sniffImage(buf)?.kind).toBe('jpeg');
  });

  it('detects png', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(sniffImage(buf)?.kind).toBe('png');
  });

  it('detects gif87a / gif89a', () => {
    expect(sniffImage(Buffer.from('GIF87a......'))?.kind).toBe('gif');
    expect(sniffImage(Buffer.from('GIF89a......'))?.kind).toBe('gif');
  });

  it('detects webp', () => {
    const buf = Buffer.alloc(12);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(100, 4);
    buf.write('WEBP', 8);
    expect(sniffImage(buf)?.kind).toBe('webp');
  });

  it('rejects too short / empty', () => {
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
    expect(sniffImage(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it('rejects random binary', () => {
    expect(sniffImage(Buffer.from('not an image!!!!'))).toBeNull();
  });
});
