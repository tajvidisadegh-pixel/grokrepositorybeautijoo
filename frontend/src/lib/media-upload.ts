/**
 * Professional media upload with Bearer access token + silent refresh on 401.
 * Uses XMLHttpRequest so the UI can show real upload progress.
 */
import { getAccessToken, setTokens, clearTokens } from './auth-storage';
import { ApiError, tryRefresh } from './api';
import { isAllowedImageFile, resolveMediaUrl, type MediaAssetItem } from './panel-api';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

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
        onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
      }
    };

    xhr.onerror = () => reject(new ApiError(0, 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.'));
    xhr.onabort = () => reject(new ApiError(0, 'آپلود لغو شد.'));
    xhr.onload = () => {
      let body: unknown = null;
      try { body = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { body = null; }
      resolve({ status: xhr.status, body });
    };
    xhr.send(form);
  });
}

export async function uploadMyMedia(
  file: File,
  kind: string,
  professionalServiceId?: string,
  onProgress?: (percent: number) => void,
): Promise<MediaAssetItem> {
  if (!isAllowedImageFile(file) && !(file.type || '').startsWith('video/')) {
    throw new ApiError(400, 'این فایل تصویر/ویدیو قابل قبول نیست. JPG، PNG، WEBP یا HEIC امتحان کنید.');
  }
  if (!file.size) throw new ApiError(400, 'فایل خالی است.');

  let token = getAccessToken();
  if (!token && typeof window !== 'undefined') token = await tryRefresh();
  if (!token) throw new ApiError(401, 'برای آپلود باید وارد حساب کاربری شوید.');

  const form = new FormData();
  form.append('file', file);
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
    let msg = 'آپلود ناموفق';
    const m = (result.body as { message?: string | string[] } | null)?.message;
    if (Array.isArray(m)) msg = m.join(', ');
    else if (m) msg = String(m);
    throw new ApiError(result.status, msg, result.body);
  }

  onProgress?.(100);
  const asset = result.body as MediaAssetItem;
  const publicUrl =
    resolveMediaUrl(asset.publicUrl || (asset as { url?: string }).url) ||
    asset.publicUrl ||
    '';
  return { ...asset, publicUrl };
}
