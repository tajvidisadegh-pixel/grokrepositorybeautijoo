'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { resolveMediaUrl, isAllowedImageFile, uploadMyMedia } from '@/lib/panel-api';

type MediaItem = {
  id: string;
  kind: string;
  status: string;
  publicUrl?: string | null;
  url?: string | null;
  mimeType?: string;
  sortOrder?: number;
};

export default function ZibagarPortfolioPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<MediaItem[] | { items?: MediaItem[] }>(
        '/professionals/me/media?kind=portfolio',
      );
      const list = Array.isArray(res) ? res : res.items || [];
      setItems(
        list.map((m) => ({
          ...m,
          publicUrl: resolveMediaUrl(m.publicUrl || m.url) || m.publicUrl || m.url,
        })),
      );
    } catch (e) {
      setItems([]);
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onUpload(file: File) {
    if (!isAllowedImageFile(file)) {
      setMsg('فقط تصویر JPG/PNG/WEBP/GIF/HEIC مجاز است.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await uploadMyMedia(file, 'portfolio');
      setMsg('تصویر آپلود شد.');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onDelete(id: string) {
    if (!confirm('حذف این تصویر؟')) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.delete(`/professionals/me/media/${id}`);
      setMsg('حذف شد.');
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

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">پورتفولیو</h1>
          <p className="mt-1 text-sm text-gray">گالری کارهای شما برای نمایش در پروفایل عمومی</p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
          <Button size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            آپلود تصویر
          </Button>
        </div>
      </div>

      {msg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>}

      {items.length === 0 ? (
        <PanelEmpty
          title="هنوز تصویری نیست"
          description="نمونه‌کارهای خود را آپلود کنید تا در پروفایل دیده شوند."
          action={
            <Button size="sm" onClick={() => inputRef.current?.click()}>
              اولین تصویر
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <li key={m.id}>
              <Card className="space-y-2 overflow-hidden p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.publicUrl || ''}
                  alt="portfolio"
                  className="aspect-square w-full rounded-xl object-cover bg-gray-light"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
                  <span className="text-xs text-gray">
                    {m.status === 'published' ? 'منتشر' : 'پیش‌نویس'}
                  </span>
                  <div className="flex gap-1">
                    {m.status !== 'published' && (
                      <Button size="sm" variant="secondary" loading={busy} onClick={() => onPublish(m.id)}>
                        انتشار
                      </Button>
                    )}
                    <Button size="sm" variant="outline" loading={busy} onClick={() => onDelete(m.id)}>
                      حذف
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
