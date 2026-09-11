'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchProBookings,
  transitionBooking,
  reportBookingToAdmin,
  type BookingListItem,
} from '@/lib/panel-api';
import { persianBookingStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'confirmed', label: 'تأییدشده' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'rejected', label: 'ردشده' },
  { value: 'cancelled', label: 'لغوشده' },
  { value: 'expired', label: 'منقضی' },
];

function dateKeyFa(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fa-IR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function timeFa(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export default function ZibagarBookingsPage() {
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ q: '', status: '', from: '', to: '' });

  const [reportFor, setReportFor] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProBookings(1, 80, {
        q: applied.q || undefined,
        status: applied.status || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
      });
      setItems(res.items);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters() {
    setApplied({ q: q.trim(), status, from, to });
  }

  async function act(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete') {
    setBusy(`${id}:${action}`);
    setError(null);
    try {
      let reason: string | undefined;
      if (action === 'reject') {
        reason = window.prompt('دلیل رد (اختیاری):') || undefined;
      }
      await transitionBooking(id, action, reason);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function submitReport(id: string) {
    setBusy(`${id}:report`);
    setReportMsg(null);
    setError(null);
    try {
      await reportBookingToAdmin(id, reportText.trim());
      setReportMsg('گزارش برای سوپرادمین ارسال شد.');
      setReportFor(null);
      setReportText('');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(null);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, BookingListItem[]>();
    for (const b of items) {
      const key = dateKeyFa(b.startAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return Array.from(map.entries());
  }, [items]);

  if (loading && items.length === 0) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">رزروهای زیباگر</h1>
        <p className="mt-1 text-sm text-gray">
          جستجو، فیلتر و مدیریت نوبت‌ها — رزروها به‌صورت پیش‌فرض ثبت می‌شوند و نیازی به تأیید ندارند
        </p>
      </div>

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">جستجو (نام / شماره)</label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="نام یا ۰۹..."
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">وضعیت</label>
            <select
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">از تاریخ</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">تا تاریخ</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={applyFilters} loading={loading}>
            اعمال فیلتر
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQ('');
              setStatus('');
              setFrom('');
              setTo('');
              setApplied({ q: '', status: '', from: '', to: '' });
            }}
          >
            پاک کردن
          </Button>
        </div>
      </Card>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {reportMsg && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{reportMsg}</p>
      )}

      {items.length === 0 ? (
        <PanelEmpty title="رزروی یافت نشد" />
      ) : (
        <div className="space-y-8">
          {grouped.map(([dayLabel, list]) => (
            <section key={dayLabel} className="space-y-3">
              <h2 className="sticky top-0 z-10 border-b border-border bg-white/90 py-2 text-sm font-bold text-foreground backdrop-blur">
                {dayLabel}
                <span className="mr-2 font-normal text-gray">({list.length})</span>
              </h2>
              <ul className="space-y-3">
                {list.map((b) => {
                  const customer =
                    b.customer?.profile?.displayName || b.customer?.phone || 'مشتری';
                  const phone = b.customer?.phone || null;
                  const services =
                    (b as BookingListItem & { items?: { service?: { name?: string } }[] }).items
                      ?.map((it) => it.service?.name)
                      .filter(Boolean)
                      .join('، ') ||
                    b.services?.map((s) => s.name).filter(Boolean).join('، ') ||
                    null;

                  return (
                    <li key={b.id}>
                      <Card className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{customer}</p>
                            {phone && (
                              <p className="mt-0.5 text-sm text-coral" dir="ltr">
                                {phone}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-gray">
                              ساعت {timeFa(b.startAt)}
                              {b.endAt ? ` تا ${timeFa(b.endAt)}` : ''}
                            </p>
                            {services && (
                              <p className="mt-1 text-xs text-gray">خدمت: {services}</p>
                            )}
                          </div>
                          <span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-medium text-coral">
                            {persianBookingStatus(b.status)}
                          </span>
                        </div>

                        {b.totalPrice != null && (
                          <p className="text-sm text-gray">{formatPrice(b.totalPrice)}</p>
                        )}
                        {b.notes && (
                          <p className="text-xs text-gray">یادداشت: {b.notes}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {b.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                loading={busy === `${b.id}:confirm`}
                                onClick={() => act(b.id, 'confirm')}
                              >
                                تأیید
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>
                            </>
                          )}
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                loading={busy === `${b.id}:cancel`}
                                onClick={() => act(b.id, 'cancel')}
                              >
                                لغو
                              </Button>
                              <Button
                                size="sm"
                                loading={busy === `${b.id}:complete`}
                                onClick={() => act(b.id, 'complete')}
                              >
                                تکمیل
                              </Button>
                            </>
                          )}
                          {(b.status === 'completed' || b.status === 'expired') && (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busy === `${b.id}:complete`}
                              onClick={() => act(b.id, 'complete')}
                            >
                              ثبت مجدد تکمیل
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReportFor(reportFor === b.id ? null : b.id);
                              setReportText('');
                              setReportMsg(null);
                            }}
                          >
                            گزارش به سوپرادمین
                          </Button>
                        </div>

                        {reportFor === b.id && (
                          <div className="space-y-2 rounded-xl border border-border bg-gray-light/40 p-3">
                            <label className="block text-xs font-medium">توضیح مشکل</label>
                            <textarea
                              className="min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm"
                              value={reportText}
                              onChange={(e) => setReportText(e.target.value)}
                              placeholder="مشکل این رزرو را بنویسید..."
                            />
                            <Button
                              size="sm"
                              loading={busy === `${b.id}:report`}
                              disabled={reportText.trim().length < 5}
                              onClick={() => submitReport(b.id)}
                            >
                              ارسال گزارش
                            </Button>
                          </div>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
