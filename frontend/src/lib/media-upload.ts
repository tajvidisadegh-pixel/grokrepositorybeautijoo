/**
 * Professional media upload with Bearer access token + silent refresh on 401.
 * Uses XMLHttpRequest so the UI can show real upload progress.
 * Images are lightly compressed client-side when large.
 */
import { getAccessToken, setTokens, clearTokens } from './auth-storage';
import { ApiError, tryRefresh } from './api';
import { isAllowedImageFile, resolveMediaUrl, type MediaAssetItem } from './panel-api';
import { compressImageIfNeeded } from './compress-image';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

/** Soft client limits (server enforces hard limits). */
export const CLIENT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const CLIENT_MAX_VIDEO_BYTES = 500 * 1024 * 1024;

type UploadResult = { status: number; body: unknown };

function postUpload(
  token: string,
  form: FormData,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/professionals/me/media/upload`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        // Reserve 0–10% for compress phase; map network to 10–100
        const net = Math.round((event.loaded / event.total) * 90) + 10;
        onProgress(Math.max(10, Math.min(100, net)));
      }
    };

    xhr.onerror = () =>
      reject(new ApiError(0, 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.'));
    xhr.onabort = () => reject(new ApiError(0, 'آپلود لغو شد.'));
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      resolve({ status: xhr.status, body });
    };
    xhr.send(form);
  });
}

function persianUploadError(status: number, body: unknown): string {
  const m = (body as { message?: string | string[] } | null)?.message;
  const raw = Array.isArray(m) ? m.join('، ') : m ? String(m) : '';
  if (status === 413 || /too large|file too large|payload/i.test(raw)) {
    return 'حجم فایل بیش از حد مجاز است. تصویر حداکثر ۱۰ مگابایت و ویدیو حداکثر ۵۰۰ مگابایت.';
  }
  if (status === 415 || /mime|type|format|unsupported/i.test(raw)) {
    return 'فرمت فایل پشتیبانی نمی‌شود. JPG، PNG، WEBP یا MP4 امتحان کنید.';
  }
  if (status === 401) return 'نشست منقضی شده است. دوباره وارد شوید.';
  if (status === 403) return 'اجازه آپلود برای این حساب وجود ندارد.';
  if (raw) return raw;
  return 'آپلود ناموفق بود. دوباره تلاش کنید.';
}

export async function uploadMyMedia(
  file: File,
  kind: string,
  professionalServiceId?: string,
  onProgress?: (percent: number) => void,
): Promise<MediaAssetItem> {
  const isImage = isAllowedImageFile(file);
  const isVideo = (file.type || '').startsWith('video/');
  if (!isImage && !isVideo) {
    throw new ApiError(
      400,
      'این فایل تصویر/ویدیو قابل قبول نیست. JPG، PNG، WEBP یا HEIC (یا ویدیو MP4) امتحان کنید.',
    );
  }
  if (!file.size) throw new ApiError(400, 'فایل خالی است.');
  if (isImage && file.size > CLIENT_MAX_IMAGE_BYTES) {
    throw new ApiError(400, 'حجم تصویر حداکثر ۱۰ مگابایت است.');
  }
  if (isVideo && file.size > CLIENT_MAX_VIDEO_BYTES) {
    throw new ApiError(400, 'حجم ویدیو حداکثر ۵۰۰ مگابایت است.');
  }

  let token = getAccessToken();
  if (!token && typeof window !== 'undefined') token = await tryRefresh();
  if (!token) throw new ApiError(401, 'برای آپلود باید وارد حساب کاربری شوید.');

  let toSend = file;
  if (isImage) {
    onProgress?.(3);
    const { file: compressed } = await compressImageIfNeeded(file);
    toSend = compressed;
    onProgress?.(10);
  } else {
    onProgress?.(10);
  }

  const form = new FormData();
  form.append('file', toSend);
  form.append('kind', kind);
  if (professionalServiceId) form.append('professionalServiceId', professionalServiceId);

  let result = await postUpload(token, form, onProgress);
  if (result.status === 401) {
    const fresh = await tryRefresh();
    if (!fresh) {
      clearTokens();
      throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.');
    }
    setTokens(fresh);
    result = await postUpload(fresh, form, onProgress);
  }

  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(result.status, persianUploadError(result.status, result.body), result.body);
  }

  onProgress?.(100);

  const asset = (result.body || {}) as MediaAssetItem;
  const publicUrl =
    resolveMediaUrl(asset.publicUrl) ||
    resolveMediaUrl((asset as { url?: string }).url) ||
    asset.publicUrl ||
    '';
  return { ...asset, publicUrl };
}
