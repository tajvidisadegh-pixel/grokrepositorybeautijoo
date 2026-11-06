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
import { ImageLightbox } from '@/components/media/image-lightbox';
import { useToast } from '@/components/ui/app-toast';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_SEC = 60;
/** Free portfolio limit (#65.11) — matches backend DEFAULT_MAX_PORTFOLIO */
const MAX_PORTFOLIO = 100;

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
  const { success: toastSuccess } = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [services, setServices] = useState<ProfessionalServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editServiceId, setEditServiceId] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const atLimit = items.length >= MAX_PORTFOLIO;

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
      setMsg(
        'سقف رایگان نمونه‌کار پر است. برای آپلود بیشتر از ۱۰۰ مورد می‌توانید نسخه ویژه را تهیه کنید.',
      );
      return;
    }
    setBusy(true);
    setUploadProgress(0);
    setMsg(null);
    try {
      const url = URL.createObjectURL(file);
      setLocalPreview(url);
    } catch { /* ignore */ }
    try {
      await uploadMyMedia(file, 'portfolio', undefined, setUploadProgress);
      setMsg(video ? 'ویدیو آپلود شد.' : 'تصویر آپلود شد.');
      try { toastSuccess(video ? 'ویدیو آپلود شد' : 'تصویر آپلود شد'); } catch { /* */ }
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
      setUploadProgress(null);
      if (localPreview) { try { URL.revokeObjectURL(localPreview); } catch { /* */ } }
      setLocalPreview(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onDelete(id: string) {
    if (!id || deletingId) return;
    setDeletingId(id);
    setMsg(null);
    setError(null);
    const prev = items;
    setItems((list) => list.filter((x) => x.id !== id));
    setDeleteId(null);
    if (editId === id) setEditId(null);
    try {
      await apiClient.delete(`/professionals/me/media/${id}`);
      setMsg('نمونه‌کار حذف شد.');
      toastSuccess('نمونه‌کار حذف شد');
      void load();
    } catch (e) {
      setItems(prev);
      setMsg(friendlyApiError(e));
      setError(friendlyApiError(e));
    } finally {
      setDeletingId(null);
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
          <h1 className="text-2xl font-bold">پورتفولیو</h1>
          <p className="mt-1 text-sm text-gray">
            تصویر تا ۱۰ مگ · ویدیو تا ۵۰۰ مگ (حداکثر ۱ دقیقه)
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            className="hidden"
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length) return;
              void (async () => {
                const files = Array.from(list);
                for (const f of files) {
                  await onUpload(f);
                }
              })();
            }}
          />
          <Button type="button" size="sm" loading={busy} disabled={atLimit} onClick={() => inputRef.current?.click()}>
            آپلود تصویر / ویدیو
          </Button>
        </div>
      </div>

      {atLimit && (
        <div className="rounded-2xl border border-coral/30 bg-coral/5 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            سقف رایگان نمونه‌کار ({MAX_PORTFOLIO.toLocaleString('fa-IR')} مورد) پر است.
          </p>
          <p className="mt-1 text-gray">
            برای آپلود بیشتر می‌توانید نسخه ویژه را با پرداخت ۳٬۰۰۰٬۰۰۰ تومان تهیه کنید تا این محدودیت برایتان باز شود.
          </p>
          <a
            href="/zibagar/support"
            className="mt-2 inline-block text-sm font-medium text-coral underline"
          >
            درخواست نسخه ویژه از پشتیبانی
          </a>
        </div>
      )}

      {localPreview && (
        <div className="overflow-hidden rounded-xl border border-border bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={localPreview} alt="پیش‌نمایش" className="mx-auto max-h-40 rounded-lg object-contain" />
          <p className="mt-1 text-center text-xs text-gray">پیش‌نمایش قبل از اتمام آپلود</p>
        </div>
      )}
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
            <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
              اولین آپلود
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {items.map((m) => {
            const vid = isVideo(m.mimeType, m.publicUrl);
            const svcName = services.find((s) => s.id === m.professionalServiceId)?.service?.name;
            return (
              <li key={m.id}>
                <Card className="space-y-2 overflow-hidden p-2">
                  {vid ? (
                    <button
                      type="button"
                      className="block w-full"
                      onClick={() => setLightboxIndex(items.findIndex((x) => x.id === m.id))}
                    >
                      <video
                        src={m.publicUrl || ''}
                        className="aspect-square w-full rounded-xl bg-gray-light object-cover"
                        muted
                        playsInline
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="block w-full"
                      onClick={() => setLightboxIndex(items.findIndex((x) => x.id === m.id))}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.publicUrl || ''}
                        alt={m.title || 'portfolio'}
                        className="aspect-square w-full rounded-xl bg-gray-light object-cover"
                      />
                    </button>
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || deletingId === m.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openEdit(m);
                        }}
                      >
                        ویرایش
                      </Button>
                      {m.status !== 'published' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy || deletingId === m.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            void onPublish(m.id);
                          }}
                        >
                          انتشار
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={busy || !!deletingId}
                        loading={deletingId === m.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteId(m.id);
                        }}
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

      {deleteId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deletingId && setDeleteId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-portfolio-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-portfolio-title" className="text-lg font-bold">حذف نمونه‌کار</h2>
            <p className="mt-2 text-sm text-gray">از حذف این نمونه‌کار مطمئن هستید؟ این عمل قابل بازگشت نیست.</p>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="danger"
                loading={!!deletingId}
                disabled={!!deletingId}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void onDelete(deleteId);
                }}
              >
                بله، حذف شود
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!!deletingId}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeleteId(null);
                }}
              >
                انصراف
              </Button>
            </div>
          </div>
        </div>
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
            <div className="mt-5 flex gap-2">
              <Button type="button" size="sm" loading={busy} onClick={() => void saveEdit()}>
                ذخیره
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditId(null)}>
                انصراف
              </Button>
            </div>
          </div>
        </div>
      )}

      {lightboxIndex != null && items[lightboxIndex] && (
        <ImageLightbox
          items={items.map((m) => ({
            src: m.publicUrl || '',
            alt: m.title || 'portfolio',
            isVideo: isVideo(m.mimeType, m.publicUrl),
          }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}
