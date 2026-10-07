'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import {
  resolveMediaUrl,
  isAllowedImageFile,
  fetchMyServices,
  type ProfessionalServiceItem,
} from '@/lib/panel-api';
import { uploadMyMedia } from '@/lib/media-upload';
import { formatPrice, parsePriceInput } from '@/lib/utils';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_SEC = 60;
const MAX_PORTFOLIO = 40;

type MediaItem = {
  id: string;
  kind: string;
  status: string;
  publicUrl?: string | null;
  url?: string | null;
  mimeType?: string | null;
  title?: string | null;
  price?: number | null;
  durationMin?: number | null;
  professionalServiceId?: string | null;
};

function isVideo(mime?: string | null, url?: string | null) {
  if ((mime || '').startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || '');
}

function isAllowedVideoFile(file: File) {
  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v)$/i.test(file.name || '');
}

function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const u = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(u);
      resolve(Number.isFinite(d) ? d : 0);
    };
    v.onerror = () => {
      URL.revokeObjectURL(u);
      reject(new Error('duration'));
    };
    v.src = u;
  });
}

export default function ZibagarPortfolioPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [services, setServices] = useState<ProfessionalServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editServiceId, setEditServiceId] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, svc] = await Promise.all([
        apiClient.get<MediaItem[] | { items?: MediaItem[] }>(
          '/professionals/me/media?kind=portfolio',
        ),
        fetchMyServices().catch(() => [] as ProfessionalServiceItem[]),
      ]);
      const list = Array.isArray(res) ? res : res.items || [];
      setItems(
        list.map((m) => ({
          ...m,
          publicUrl: resolveMediaUrl(m.publicUrl || m.url) || m.publicUrl || m.url,
        })),
      );
      setServices(Array.isArray(svc) ? svc : []);
    } catch (e) {
      setItems([]);
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(file: File) {
    const video = isAllowedVideoFile(file);
    const image = isAllowedImageFile(file);
    if (!video && !image) {
      setMsg('فقط تصویر JPG/PNG/WEBP/GIF/HEIC یا ویدیو MP4/WEBM/MOV مجاز است.');
      return;
    }
    if (image && !video && file.size > MAX_IMAGE_BYTES) {
      setMsg('حجم تصویر حداکثر ۱۰ مگابایت است.');
      return;
    }
    if (video && file.size > MAX_VIDEO_BYTES) {
      setMsg('حجم ویدیو حداکثر ۵۰۰ مگابایت است.');
      return;
    }
    if (video) {
      try {
        const sec = await readVideoDuration(file);
        if (sec > MAX_VIDEO_SEC + 0.5) {
          setMsg(`مدت ویدیو حداکثر ${MAX_VIDEO_SEC} ثانیه است.`);
          return;
        }
      } catch {
        /* continue */
      }
    }
    if (items.length >= MAX_PORTFOLIO) {
      setMsg(`سقف تعداد نمونه‌کار (${MAX_PORTFOLIO}) پر است. ابتدا موردی را حذف کنید.`);
      return;
    }
    setBusy(true);
    setUploadProgress(0);
    setMsg(null);
    try {
      await uploadMyMedia(file, 'portfolio', undefined, setUploadProgress);
      setMsg(video ? 'ویدیو آپلود شد.' : 'تصویر آپلود شد.');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onDelete(id: string) {
    if (!confirm('حذف این مورد؟')) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.delete(`/professionals/me/media/${id}`);
      setMsg('حذف شد.');
      if (editId === id) setEditId(null);
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPublish(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.post('/professionals/me/media/publish', { ids: [id] });
      setMsg('منتشر شد.');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function openEdit(m: MediaItem) {
    setEditId(m.id);
    setEditTitle(m.title || '');
    setEditServiceId(m.professionalServiceId || '');
    setEditPrice(m.price != null ? String(m.price) : '');
    setEditDuration(m.durationMin != null ? String(m.durationMin) : '');
    setMsg(null);
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true);
    setMsg(null);
    try {
      const priceRaw = editPrice.trim();
      const parsedPrice = priceRaw ? parsePriceInput(priceRaw) : null;
      if (priceRaw && (parsedPrice == null || parsedPrice < 10000)) {
        setMsg('قیمت باید حداقل ۱۰٬۰۰۰ تومان باشد.');
        setBusy(false);
        return;
      }
      const durRaw = editDuration.trim();
      const body = {
        title: editTitle.trim() || null,
        professionalServiceId: editServiceId || null,
        price: priceRaw ? parsedPrice : null,
        durationMin: durRaw ? Math.floor(Number(durRaw.replace(/[^\d]/g, ''))) || null : null,
      };
      if (body.durationMin != null && (body.durationMin < 1 || body.durationMin > 1440)) {
        setMsg('مدت باید بین ۱ تا ۱۴۴۰ دقیقه باشد.');
        setBusy(false);
        return;
      }
      await apiClient.patch(`/professionals/me/media/${editId}`, body);
      setMsg('ذخیره شد.');
      setEditId(null);
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">پورتفولیو <span className="text-base font-normal text-gray">({items.length}/{MAX_PORTFOLIO})</span></h1>
          <p className="mt-1 text-sm text-gray">
            تصویر تا ۱۰ مگ · ویدیو تا ۵۰۰ مگ (حداکثر ۱ دقیقه) · حداکثر ۴۰ مورد
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
          <Button size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            آپلود تصویر / ویدیو
          </Button>
        </div>
      </div>

      {uploadProgress != null && (
        <div className="rounded-xl border border-blue/20 bg-blue/5 px-3 py-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>در حال آپلود…</span>
            <span dir="ltr">{uploadProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-light">
            <div className="h-full rounded-full bg-blue transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {msg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>}

      {items.length === 0 ? (
        <PanelEmpty
          title="هنوز موردی نیست"
          description="نمونه‌کارهای خود را آپلود کنید."
          action={
            <Button size="sm" onClick={() => inputRef.current?.click()}>
              اولین آپلود
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => {
            const vid = isVideo(m.mimeType, m.publicUrl);
            const svcName = services.find((s) => s.id === m.professionalServiceId)?.service?.name;
            return (
              <li key={m.id}>
                <Card className="space-y-2 overflow-hidden p-2">
                  {vid ? (
                    <video
                      src={m.publicUrl || ''}
                      className="aspect-square w-full rounded-xl bg-gray-light object-cover"
                      muted
                      playsInline
                      controls
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.publicUrl || ''}
                      alt={m.title || 'portfolio'}
                      className="aspect-square w-full rounded-xl bg-gray-light object-cover"
                    />
                  )}
                  <div className="space-y-1 px-1 pb-1">
                    {m.title && <p className="truncate text-sm font-medium">{m.title}</p>}
                    <div className="flex flex-wrap gap-x-2 text-xs text-gray">
                      <span>{m.status === 'published' ? 'منتشر' : 'پیش‌نویس'}</span>
                      {vid && <span>· ویدیو</span>}
                      {svcName && <span>· {svcName}</span>}
                      {m.price != null && (
                        <span className="text-coral">· {formatPrice(m.price)}</span>
                      )}
                      {m.durationMin != null && <span>· {m.durationMin} دقیقه</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      <Button size="sm" variant="outline" loading={busy} onClick={() => openEdit(m)}>
                        ویرایش
                      </Button>
                      {m.status !== 'published' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busy}
                          onClick={() => onPublish(m.id)}
                        >
                          انتشار
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busy}
                        onClick={() => onDelete(m.id)}
                      >
                        حذف
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => !busy && setEditId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h2 className="text-lg font-bold">ویرایش نمونه‌کار</h2>
            <p className="mt-1 text-xs text-gray">
              اختیاری: تخصص، قیمت و مدت برای «رزرو همین» در پروفایل
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray">عنوان</label>
                <input
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray">تخصص / خدمت</label>
                <select
                  className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
                  value={editServiceId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setEditServiceId(id);
                    const ps = services.find((s) => s.id === id);
                    if (ps) {
                      if (!editPrice.trim()) setEditPrice(String(ps.price ?? ''));
                      if (!editDuration.trim()) setEditDuration(String(ps.durationMin ?? ''));
                    }
                  }}
                >
                  <option value="">بدون اتصال</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.service?.name || 'خدمت'} — {formatPrice(s.price)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray">قیمت (تومان)</label>
                  <input
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray">مدت (دقیقه)</label>
                  <input
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="sm" loading={busy} onClick={() => void saveEdit()}>
                ذخیره
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditId(null)}>
                انصراف
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
