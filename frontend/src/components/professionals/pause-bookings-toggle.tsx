'use client';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';

export function PauseBookingsToggle() {
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const me = await apiClient.get<{ socialLinks?: { _pauseBookings?: boolean } }>('/professionals/me');
        if (!c) setPaused(Boolean(me?.socialLinks?._pauseBookings));
      } catch {} finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, []);
  async function toggle() {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const next = !paused;
      await apiClient.patch('/professionals/me', { socialLinks: { _pauseBookings: next } });
      setPaused(next);
      setMsg(next ? 'خاموش شد' : 'فعال شد');
    } catch (e) { setErr(friendlyApiError(e)); } finally { setBusy(false); }
  }
  if (loading) return null;
  return (
    <div className="rounded-2xl border border-border bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">دریافت نوبت جدید</p>
          <p className="mt-0.5 text-xs text-gray">{paused ? 'موقتاً خاموش' : 'فعال'}</p>
        </div>
        <Button size="sm" variant={paused ? 'secondary' : 'outline'} loading={busy} onClick={() => void toggle()}>
          {paused ? 'فعال‌سازی دوباره' : 'فعلاً نوبت نمی‌گیرم'}
        </Button>
      </div>
      {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
