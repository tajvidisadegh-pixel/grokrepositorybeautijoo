'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchProBookings,
  transitionBooking,
  rescheduleBooking,
  reportBookingToAdmin,
  setCustomerNote,
  getCustomerNotes,
  type BookingListItem,
} from '@/lib/panel-api';
import { apiClient } from '@/lib/api';
import { shortBookingCode, copyBookingCode } from '@/lib/booking-code';
import { fetchAvailability } from '@/lib/booking-api';
import { persianBookingStatus, effectiveBookingStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice, formatDate, formatTime24 } from '@/lib/utils';
import { tehranDateStr } from '@/lib/jalali';
import { JalaliDateInput } from '@/components/ui/jalali-date-input';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'confirmed', label: 'تأییدشده' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'rejected', label: 'ردشده' },
  { value: 'cancelled', label: 'لغوشده' },
  { value: 'expired', label: 'منقضی' },
];

const TEHRAN_TZ = 'Asia/Tehran';

/** Group header: weekday + full Jalali date (canonical). */
function dateKeyFa(iso: string): string {
  return formatDate(iso, { style: 'long', weekday: true });
}

function timeFa(iso: string): string {
  return formatTime24(iso);
}

function dayKey(d: Date): string {
  return tehranDateStr(d);
}

/** Start of current Persian week (Saturday) in Asia/Tehran calendar. */
function tehranWeekStartSaturday(): Date {
  const now = new Date();
  // Weekday in Tehran: 0=Sun … 6=Sat
  const wdStr = new Intl.DateTimeFormat('en-US', {
    timeZone: TEHRAN_TZ,
    weekday: 'short',
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = map[wdStr] ?? now.getUTCDay();
  const toSat = (day + 1) % 7; // days since Saturday
  // Build noon Tehran on today's Tehran date, then subtract days
  const todayIso = tehranDateStr(now);
  const [y, m, d] = todayIso.split('-').map(Number);
  // Approximate: UTC noon shifted so local Tehran is around noon
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() - toSat);
  return base;
}

export default function ZibagarBookingsPage() {
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerNotes, setCustomerNotes] = useState<Record<string, string>>({});
  const [noteEdit, setNoteEdit] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<{ start: string }[]>([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ q: '', status: '', from: '', to: '' });

  const [reportFor, setReportFor] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list');
  const filteredByDate = (() => {
    if (datePreset === 'all') return items;
    return items.filter((b) => {
      const start = new Date(b.startAt).getTime();
      if (!Number.isFinite(start)) return true;
      const d = new Date(b.startAt);
      const tehran = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
      const startDay = new Date(tehran.getFullYear(), tehran.getMonth(), tehran.getDate()).getTime();
      const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      if (datePreset === 'today') return startDay === todayDay;
      if (datePreset === 'week') {
        const weekAgo = todayDay - 6 * 86400000;
        return startDay >= weekAgo && startDay <= todayDay + 7 * 86400000;
      }
      if (datePreset === 'month') {
        return tehran.getMonth() === today.getMonth() && tehran.getFullYear() === today.getFullYear();
      }
      return true;
    });
  })();
  const [weekStart, setWeekStart] = useState(() => tehranWeekStartSaturday());

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

  
  useEffect(() => { void getCustomerNotes().then(setCustomerNotes).catch(() => undefined); }, []);
  useEffect(() => {
    load();
  }, [load]);

  function applyFilters() {
    setApplied({ q: q.trim(), status, from, to });
  }


  async function loadRescheduleSlots(b: BookingListItem, date: string) {
    const proId = b.professional?.id;
    if (!date || !proId) return;
    setRescheduleLoading(true);
    try {
      const start = b.startAt ? new Date(b.startAt).getTime() : 0;
      const end = b.endAt ? new Date(b.endAt).getTime() : start + 30 * 60_000;
      const durationMin = Math.max(15, Math.round((end - start) / 60_000) || 30);
      const avail = await fetchAvailability(proId, date, durationMin);
      setRescheduleSlots(Array.isArray(avail?.slots) ? avail.slots : []);
    } catch {
      setRescheduleSlots([]);
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function applyReschedule(b: BookingListItem, slotStart: string) {
    if (!rescheduleDate) return;
    setRescheduleLoading(true);
    setError(null);
    try {
      const hh = slotStart.length === 5 ? slotStart + ':00' : slotStart;
      const startAt = `${rescheduleDate}T${hh}.000Z`;
      await rescheduleBooking(b.id, startAt);
      setRescheduleFor(null);
      setRescheduleSlots([]);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function act(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete' | 'no-show') {
    setBusy(`${id}:${action}`);
    setError(null);
    setActionMsg(null);
    try {
      let reason: string | undefined;
      if (action === 'reject') {
        reason = window.prompt('دلیل رد (اختیاری):') || undefined;
      }
      await transitionBooking(id, action, reason);
      const labels: Record<string, string> = {
        'no-show': 'عدم حضور مشتری ثبت شد.',
        confirm: 'رزرو با موفقیت تأیید شد.',
        reject: 'رزرو رد شد.',
        cancel: 'رزرو لغو شد.',
        complete: 'رزرو به عنوان انجام‌شده ثبت شد.',
      };
      setActionMsg(labels[action] || 'عملیات با موفقیت انجام شد.');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(null);
    }
  }

  
  async function blockCustomer(customerId: string) {
    if (!customerId) return;
    if (typeof window !== 'undefined' && !window.confirm('این مشتری دیگر نتواند از شما نوبت بگیرد. ادامه می‌دهید؟')) return;
    setBusy(`${customerId}:block`);
    setError(null);
    try {
      await apiClient.post('/professionals/me/blocked-customers', { customerId });
      setActionMsg('مشتری مسدود شد.');
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

  const weekDays = useMemo(() => {
    const days: { key: string; label: string; date: Date }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setUTCDate(weekStart.getUTCDate() + i);
      days.push({
        key: dayKey(d),
        label: formatDate(d, { style: 'short', weekday: 'short' }),
        date: d,
      });
    }
    return days;
  }, [weekStart]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, BookingListItem[]>();
    for (const b of filteredByDate) {
      const k = dayKey(new Date(b.startAt));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(b);
    }
    return map;
  }, [filteredByDate]);

  const grouped = useMemo(() => {
    const map = new Map<string, BookingListItem[]>();
    for (const b of filteredByDate) {
      const key = dateKeyFa(b.startAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return Array.from(map.entries());
  }, [filteredByDate]);

  function shiftWeek(delta: number) {
    setWeekStart((prev) => {
      const n = new Date(prev);
      n.setUTCDate(n.getUTCDate() + delta * 7);
      return n;
    });
  }

  if (loading && items.length === 0) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">رزروهای زیباگر</h1>
          <p className="mt-1 text-sm text-gray">
            مدیریت نوبت‌ها — نمای لیست یا تقویم هفتگی
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={viewMode === 'list' ? 'primary' : 'outline'} onClick={() => setViewMode('list')}>
            لیست
          </Button>
          <Button size="sm" variant={viewMode === 'week' ? 'primary' : 'outline'} onClick={() => setViewMode('week')}>
            تقویم هفتگی
          </Button>
        </div>
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
            <JalaliDateInput value={from} onChange={setFrom} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">تا تاریخ</label>
            <JalaliDateInput value={to} onChange={setTo} />
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
      
      <div className="flex flex-wrap gap-2" aria-label="date-preset-filter">
        {([
          { v: 'all' as const, l: 'هر تاریخ' },
          { v: 'today' as const, l: 'فقط امروز' },
          { v: 'week' as const, l: 'این هفته' },
          { v: 'month' as const, l: 'این ماه' },
        ]).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setDatePreset(o.v)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              datePreset === o.v
                ? 'border-coral bg-coral text-white'
                : 'border-border bg-white hover:border-coral'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>

      {actionMsg && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{actionMsg}</p>
      )}
      {reportMsg && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{reportMsg}</p>
      )}

      {viewMode === 'week' && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="outline" onClick={() => shiftWeek(-1)}>
              هفته قبل
            </Button>
            <p className="text-sm font-medium">
              {weekDays[0]?.label} — {weekDays[6]?.label}
            </p>
            <Button size="sm" variant="outline" onClick={() => shiftWeek(1)}>
              هفته بعد
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {weekDays.map((day) => {
              const dayItems = itemsByDay.get(day.key) || [];
              const isToday = day.key === dayKey(new Date());
              return (
                <div
                  key={day.key}
                  className={`rounded-xl border p-2 min-h-[120px] ${
                    isToday ? 'border-coral bg-coral-soft/30' : 'border-border'
                  }`}
                >
                  <p className={`mb-2 text-xs font-bold ${isToday ? 'text-coral' : 'text-gray'}`}>
                    {day.label}
                    {dayItems.length > 0 && (
                      <span className="mr-1 font-normal">({dayItems.length})</span>
                    )}
                  </p>
                  <ul className="space-y-1.5">
                    {dayItems.length === 0 ? (
                      <li className="text-[10px] text-gray">—</li>
                    ) : (
                      dayItems.map((b) => (
                        <li key={b.id} className="rounded-lg bg-white/80 px-1.5 py-1 text-[11px] shadow-sm">
                          <span className="font-medium">{timeFa(b.startAt)}</span>
                          <span className="mx-1 text-gray">·</span>
                          <span>{b.customer?.profile?.displayName || b.customer?.phone || 'مشتری'}</span>
                          <div className="mt-0.5 text-[10px] text-coral">{persianBookingStatus(effectiveBookingStatus(b))}</div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {viewMode === 'list' && (filteredByDate.length === 0 ? (
        <PanelEmpty
        title="رزروی یافت نشد"
        description="هنوز نوبتی برای شما ثبت نشده یا با فیلتر فعلی نتیجه‌ای نیست."
        icon="📅"
      />
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
                    <div className="mb-1 flex items-center gap-2 text-xs text-gray-muted" dir="ltr"><span>#{shortBookingCode(b.id)}</span><button type="button" className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-gray-light" onClick={() => void copyBookingCode(b.id)}>کپی</button></div>
                    {b.customer?.id && (
                      <div className="mt-1 text-xs">
                        {noteEdit === b.customer.id ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <input className="h-8 flex-1 rounded-lg border border-border px-2 text-xs" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="یادداشت خصوصی..." maxLength={500} />
                            <button type="button" className="rounded bg-coral px-2 py-1 text-[10px] text-white" onClick={() => { void (async () => { try { await setCustomerNote(b.customer!.id, noteText); setCustomerNotes((prev) => { const n = { ...prev }; if (noteText.trim()) n[b.customer!.id] = noteText.trim(); else delete n[b.customer!.id]; return n; }); setNoteEdit(null); } catch { /* ignore */ } })(); }}>ذخیره</button>
                          </div>
                        ) : (
                          <button type="button" className="text-gray-muted hover:text-coral" onClick={() => { setNoteEdit(b.customer!.id); setNoteText(customerNotes[b.customer!.id] || ''); }}>
                            {customerNotes[b.customer.id] ? `یادداشت: ${customerNotes[b.customer.id].slice(0, 40)}` : 'یادداشت خصوصی'}
                          </button>
                        )}
                      </div>
                    )}

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
                            {persianBookingStatus(effectiveBookingStatus(b))}
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
                                variant="outline"
                                onClick={() => {
                                  setRescheduleFor(b.id);
                                  setRescheduleDate('');
                                  setRescheduleSlots([]);
                                }}
                              >
                                تغییر زمان
                              </Button>
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
                              {b.status === 'confirmed' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={busy === `${b.id}:no-show`}
                                  onClick={() => {
                                    if (typeof window !== 'undefined' && !window.confirm('مشتری حضور نداشته؟ ثبت عدم حضور؟')) return;
                                    void act(b.id, 'no-show');
                                  }}
                                >
                                  عدم حضور
                                </Button>
                              )}
                            </>
                          )}

                          {rescheduleFor === b.id && (
                            <div className="mt-2 space-y-2 rounded-xl border border-border bg-gray-light/50 p-3">
                              <p className="text-xs font-medium">زمان جدید برای این نوبت</p>
                              <input
                                type="date"
                                className="h-9 w-full max-w-xs rounded-lg border border-border px-2 text-sm"
                                value={rescheduleDate}
                                min={new Date().toISOString().slice(0, 10)}
                                onChange={(e) => {
                                  const d = e.target.value;
                                  setRescheduleDate(d);
                                  void loadRescheduleSlots(b, d);
                                }}
                              />
                              {rescheduleLoading && (
                                <p className="text-xs text-gray">بارگذاری ساعات…</p>
                              )}
                              <div className="flex flex-wrap gap-1.5">
                                {rescheduleSlots.map((sl) => (
                                  <button
                                    key={sl.start}
                                    type="button"
                                    disabled={rescheduleLoading}
                                    className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs hover:border-coral hover:text-coral"
                                    onClick={() => void applyReschedule(b, sl.start)}
                                  >
                                    {sl.start}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="text-xs text-gray underline"
                                onClick={() => setRescheduleFor(null)}
                              >
                                انصراف
                              </button>
                            </div>
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
                          {b.customer?.id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              loading={busy === `${b.customer.id}:block`}
                              onClick={() => void blockCustomer(b.customer!.id)}
                            >
                              مسدود کردن مشتری
                            </Button>
                          ) : null}
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
      ))}
    </div>
  );
}
