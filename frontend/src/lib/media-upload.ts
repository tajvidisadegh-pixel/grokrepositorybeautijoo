/**
 * Professional media upload with Bearer access token + silent refresh on 401.
 * credentials:include keeps the httpOnly refresh cookie available for tryRefresh.
 */
import { getAccessToken, setTokens, clearTokens } from './auth-storage';
import { ApiError, tryRefresh } from './api';
import { isAllowedImageFile, resolveMediaUrl, type MediaAssetItem } from './panel-api';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(
  /\/$/,
  '',
);

async function postUpload(
  token: string,
  form: FormData,
): Promise<{ res: Response; body: unknown }> {
  const res = await fetch(`${API_URL}/professionals/me/media/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: form,
    credentials: 'include',
  });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

export async function uploadMyMedia(
  file: File,
  kind: string,
  professionalServiceId?: string,
): Promise<MediaAssetItem> {
  if (!isAllowedImageFile(file) && !(file.type || '').startsWith('video/')) {
    throw new ApiError(
      400,
      'این فایل تصویر/ویدیو قابل قبول نیست. JPG، PNG، WEBP یا HEIC امتحان کنید.',
    );
  }
  if (!file.size) {
    throw new ApiError(400, 'فایل خالی است.');
  }

  let token = getAccessToken();
  if (!token && typeof window !== 'undefined') {
    token = await tryRefresh();
  }
  if (!token) {
    throw new ApiError(401, 'برای آپلود باید وارد حساب کاربری شوید.');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  if (professionalServiceId) form.append('professionalServiceId', professionalServiceId);

  let res: Response;
  let body: unknown;
  try {
    ({ res, body } = await postUpload(token, form));
  } catch {
    throw new ApiError(0, 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.');
  }

  if (res.status === 401) {
    const fresh = await tryRefresh();
    if (!fresh) {
      clearTokens();
      throw new ApiError(401, 'نشست منقضی شده است. دوباره وارد شوید.');
    }
    setTokens(fresh);
    try {
      ({ res, body } = await postUpload(fresh, form));
    } catch {
      throw new ApiError(0, 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.');
    }
  }

  if (!res.ok) {
    let msg = 'آپلود ناموفق';
    const m = (body as { message?: string | string[] } | null)?.message;
    if (Array.isArray(m)) msg = m.join(', ');
    else if (m) msg = String(m);
    throw new ApiError(res.status, msg, body);
  }

  const asset = body as MediaAssetItem;
  const publicUrl =
    resolveMediaUrl(asset.publicUrl || (asset as { url?: string }).url) ||
    asset.publicUrl ||
    '';
  return { ...asset, publicUrl };
}
