'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';

type EventItem = {
  id: string;
  kind: string;
  title: string;
  body?: string;
  active?: boolean;
  href?: string;
  startsAt?: string;
  endsAt?: string;
};

const KINDS = [
  { id: 'discount', label: 'تخفیف' },
  { id: 'new_pro', label: 'زیباگر جدید' },
  { id: 'suggestion', label: 'پیشنهاد ما' },
  { id: 'campaign', label: 'کمپین' },
  { id: 'other', label: 'سایر' },
] as const;

function newId() {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminEventsPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<EventItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items?: EventItem[] }>('/admin/events');
      setItems(Array.isArray(res.items) ? (res.items as EventItem[]) : []);
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

  async function saveAll(next: EventItem[]) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient.put<{ items?: EventItem[] }>('/admin/events', { items: next });
      setItems(Array.isArray(res.items) ? (res.items as EventItem[]) : next);
      setMsg('ذخیره شد.');
      setEditing(null);
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    setEditing({
      id: newId(),
      kind: 'discount',
      title: '',
      body: '',
      active: true,
      href: '',
    });
    setMsg(null);
  }

  function startEdit(it: EventItem) {
    setEditing({ ...it });
    setMsg(null);
  }

  async function persistEdit() {
    if (!editing) return;
    const title = (editing.title || '').trim();
    if (title.length < 2) {
      setMsg('عنوان حداقل ۲ کاراکتر باشد.');
      return;
    }
    const cleaned: EventItem = {
      ...editing,
      title,
      body: (editing.body || '').trim() || undefined,
      href: (editing.href || '').trim() || undefined,
      active: editing.active !== false,
    };
    const idx = items.findIndex((x) => x.id === cleaned.id);
    const next =
      idx >= 0
        ? items.map((x) => (x.id === cleaned.id ? cleaned : x))
        : [cleaned, ...items];
    await saveAll(next);
  }

  async function remove(id: string) {
    if (!confirm('حذف این رویداد؟')) return;
    await saveAll(items.filter((x) => x.id !== id));
  }

  async function toggleActive(it: EventItem) {
    const next = items.map((x) =>
      x.id === it.id ? { ...x, active: !x.active } : x,
    );
    await saveAll(next);
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">رویدادها</h1>
          <p className="mt-1 text-sm text-gray">
            تخفیف‌ها، زیباگران جدید، پیشنهادها و کمپین‌ها را اینجا مدیریت کنید.
          </p>
        </div>
        <Button size="sm" onClick={startNew}>
          رویداد جدید
        </Button>
      </div>

      {msg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>}

      {editing && (
        <Card className="space-y-3">
          <h2 className="font-bold">{items.some((x) => x.id === editing.id) ? 'ویرایش رویداد' : 'رویداد جدید'}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray">نوع</label>
              <select
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
                value={editing.kind}
                onChange={(e) => setEditing({ ...editing, kind: e.target.value })}
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray">عنوان</label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                maxLength={120}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-gray">متن</label>
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={editing.body || ''}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                maxLength={500}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray">لینک (اختیاری)</label>
              <input
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={editing.href || ''}
                onChange={(e) => setEditing({ ...editing, href: e.target.value })}
                placeholder="/professionals یا https://..."
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.active !== false}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                />
                فعال
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy} onClick={() => void persistEdit()}>
              ذخیره
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(null)}>
              انصراف
            </Button>
          </div>
        </Card>
      )}

      {items.length === 0 && !editing ? (
        <PanelEmpty
          title="رویدادی ثبت نشده"
          description="اولین رویداد را اضافه کنید."
          action={
            <Button size="sm" onClick={startNew}>
              افزودن
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const kindLabel = KINDS.find((k) => k.id === it.kind)?.label || it.kind;
            return (
              <li key={it.id}>
                <Card className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-light px-2 py-0.5 text-[11px] text-gray">
                        {kindLabel}
                      </span>
                      <span
                        className={`text-[11px] ${it.active !== false ? 'text-emerald-600' : 'text-gray'}`}
                      >
                        {it.active !== false ? 'فعال' : 'غیرفعال'}
                      </span>
                    </div>
                    <p className="font-semibold">{it.title}</p>
                    {it.body && <p className="text-sm text-gray line-clamp-2">{it.body}</p>}
                    {it.href && (
                      <p className="text-xs text-coral truncate" dir="ltr">
                        {it.href}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" loading={busy} onClick={() => startEdit(it)}>
                      ویرایش
                    </Button>
                    <Button size="sm" variant="outline" loading={busy} onClick={() => void toggleActive(it)}>
                      {it.active !== false ? 'غیرفعال' : 'فعال'}
                    </Button>
                    <Button size="sm" variant="outline" loading={busy} onClick={() => void remove(it.id)}>
                      حذف
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
