/**
 * Client-side image compression (canvas) before upload.
 * Keeps original if already small or compression fails.
 */

const DEFAULT_MAX_EDGE = 1920;
const DEFAULT_QUALITY = 0.82;
const SKIP_UNDER_BYTES = 400_000; // ~400KB

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('خواندن تصویر ناموفق بود'));
    };
    img.src = url;
  });
}

/**
 * Compress JPEG/PNG/WEBP-ish files down to max edge + quality.
 * Returns a new File (image/jpeg) or the original file.
 */
export async function compressImageIfNeeded(
  file: File,
  opts?: { maxEdge?: number; quality?: number; skipUnderBytes?: number },
): Promise<{ file: File; compressed: boolean }> {
  const maxEdge = opts?.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts?.quality ?? DEFAULT_QUALITY;
  const skipUnder = opts?.skipUnderBytes ?? SKIP_UNDER_BYTES;

  const type = (file.type || '').toLowerCase();
  if (!type.startsWith('image/') || type.includes('gif') || type.includes('svg')) {
    return { file, compressed: false };
  }
  if (file.size <= skipUnder) {
    return { file, compressed: false };
  }

  try {
    const img = await loadImage(file);
    let { width, height } = img;
    if (!width || !height) return { file, compressed: false };

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, compressed: false };
    ctx.drawImage(img, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) {
      return { file, compressed: false };
    }

    const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
    return {
      file: new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }),
      compressed: true,
    };
  } catch {
    return { file, compressed: false };
  }
}

/** Object URL for local preview; caller must revoke. */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
