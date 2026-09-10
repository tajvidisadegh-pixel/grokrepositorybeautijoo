'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import {
  fetchMyWorkingHours, setMyWorkingHours, fetchMyTimeOffs, addTimeOff, removeTimeOff,
  fetchProBookings, type WorkingHourItem, type TimeOffItem, type BookingListItem,
} from '@/lib/schedule-api';
import { friendlyApiError } from '@/lib/api-errors';
import {
  addJalaliMonths, buildJalaliMonthGrid, dayOfWeekFromIso, isoToJalaliLabel,
  jalaliMonthName, pad2, PERSIAN_WEEKDAYS, toJalali, todayIsoTehran, type DayOfWeekValue,
} from '@/lib/jalali';

const DAYS: { value: DayOfWeekValue; label: string; short: string }[] = [
  { value: 'saturday', label: 'شنبه', short: 'ش' },
  { value: 'sunday', label: 'یکشنبه', short: 'ی' },
  { value: 'monday', label: 'دوشنبه', short: 'د' },
  { value: 'tuesday', label: 'سه‌شنبه', short: 'س' },
  { value: 'wednesday', label: 'چهارشنبه', short: 'چ' },
  { value: 'thursday', label: 'پنج‌شنبه', short: 'پ' },
  { value: 'friday', label: 'جمعه', short: 'ج' },
];
const INTERVALS = [15, 30, 45, 60, 90, 120] as const;

const pm = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fm = (mins: number) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
const tehranRange = (iso: string, a: string, b: string) => {
  const [y, mo, d] = iso.split('-').map(Number);
  const [sh, sm] = a.split(':').map(Number);
  const [eh, em] = b.split(':').map(Number);
  const off = 3.5 * 3600000;
  return {
    startAt: new Date(Date.UTC(y, mo - 1, d, sh, sm) - off).toISOString(),
    endAt: new Date(Date.UTC(y, mo - 1, d, eh, em) - off).toISOString(),
  };
};

export default function ZibagarHoursPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHourItem[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOffItem[]>([]);
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const todayIso = todayIsoTehran();
  const todayJ = useMemo(() => {
    const [gy, gm, gd] = todayIso.split('-').map(Number);
    return toJalali(gy, gm, gd);
  }, [todayIso]);
  const [viewJy, setViewJy] = useState(todayJ.jy);
  const [viewJm, setViewJm] = useState(todayJ.jm);
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [dayDrafts, setDayDrafts] = useState<Record<string, { active: boolean; startTime: string; endTime: string }>>(() => {
    const o: Record<string, { active: boolean; startTime: string; endTime: string }> = {};
    DAYS.forEach((d) => {
      o[d.value] = { active: false, startTime: '09:00', endTime: '20:00' };
    });
    return o;
  });
  const [hoursOpen, setHoursOpen] = useState(false);
  const [intervalMin, setIntervalMin] = useState(30);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockDate, setBlockDate] = useState(todayIso);
  const [blockFrom, setBlockFrom] = useState('14:00');
  const [blockTo, setBlockTo] = useState('17:00');
  const [blockReason, setBlockReason] = useState('');

  const applyHours = useCallback((items: WorkingHourItem[]) => {
    const next: Record<string, { active: boolean; startTime: string; endTime: string }> = {};
    DAYS.forEach((d) => {
      const rows = items.filter((h) => String(h.dayOfWeek).toLowerCase() === d.value && h.isActive !== false);
      if (rows.length) {
        const s = [...rows].sort((a, b) => pm(a.startTime) - pm(b.startTime));
        next[d.value] = {
          active: true,
          startTime: s[0].startTime.slice(0, 5),
          endTime: s[s.length - 1].endTime.slice(0, 5),
        };
      } else {
        next[d.value] = { active: false, startTime: '09:00', endTime: '20:00' };
      }
    });
    setDayDrafts(next);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, o, b] = await Promise.all([
        fetchMyWorkingHours(),
        fetchMyTimeOffs().catch(() => [] as TimeOffItem[]),
        fetchProBookings(1, 100).then((r) => r.items).catch(() => [] as BookingListItem[]),
      ]);
      setWorkingHours(h);
      setTimeOffs(o);
      setBookings(b);
      applyHours(h);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [applyHours]);

  useEffect(() => {
    load();
  }, [load]);

  const monthGrid = useMemo(() => buildJalaliMonthGrid(viewJy, viewJm), [viewJy, viewJm]);

  const activeDays = useMemo(() => {
    const s = new Set<string>();
    workingHours.forEach((h) => {
      if (h.isActive !== false) s.add(String(h.dayOfWeek).toLowerCase());
    });
    return s;
  }, [workingHours]);

  const weeklySummary = useMemo(() => {
    return DAYS.filter((d) => dayDrafts[d.value]?.active).map((d) => {
      const x = dayDrafts[d.value];
      return `${d.short} ${x.startTime.slice(0, 5)}–${x.endTime.slice(0, 5)}`;
    });
  }, [dayDrafts]);

  const daySlots = useMemo(() => {
    const dow = dayOfWeekFromIso(selectedIso);
    const draft = dayDrafts[dow];
    if (!draft?.active) return [] as { start: string; end: string; status: string; id?: string; name?: string }[];
    const startM = pm(draft.startTime);
    const endM = pm(draft.endTime);
    if (endM <= startM) return [];
    const off = 3.5 * 3600000;
    const dayBooks = bookings.filter((b) => {
      if (!b.startAt) return false;
      const st = (b.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'rejected') return false;
      const t = new Date(new Date(b.startAt).getTime() + off);
      return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}` === selectedIso;
    });
    const dayOffs = timeOffs.filter((t) => {
      const [y, m, d] = selectedIso.split('-').map(Number);
      const ds = Date.UTC(y, m - 1, d) - off;
      return new Date(t.startAt).getTime() < ds + 86400000 && new Date(t.endAt).getTime() > ds;
    });
    const out: { start: string; end: string; status: string; id?: string; name?: string }[] = [];
    for (let t = startM; t + intervalMin <= endM; t += intervalMin) {
      const se = t + intervalMin;
      const start = fm(t);
      const end = fm(se);
      const booked = dayBooks.find((b) => {
        const s = new Date(b.startAt);
        const e = b.endAt ? new Date(b.endAt) : new Date(s.getTime() + 1800000);
        const th = new Date(s.getTime() + off);
        const ds = Date.UTC(th.getUTCFullYear(), th.getUTCMonth(), th.getUTCDate()) - off;
        const bs = Math.max(0, Math.round((s.getTime() - ds) / 60000));
        const be = Math.max(0, Math.round((e.getTime() - ds) / 60000));
        return t < be && se > bs;
      });
      if (booked) {
        out.push({ start, end, status: 'booked', name: booked.customer?.profile?.displayName || 'مشتری' });
        continue;
      }
      const blk = dayOffs.find((item) => {
        const [y, m, d] = selectedIso.split('-').map(Number);
        const ds = Date.UTC(y, m - 1, d) - off;
        const bs = Math.max(0, Math.round((new Date(item.startAt).getTime() - ds) / 60000));
        const be = Math.min(1440, Math.round((new Date(item.endAt).getTime() - ds) / 60000));
        return t < be && se > bs;
      });
      if (blk) {
        out.push({ start, end, status: 'blocked', id: blk.id });
        continue;
      }
      if (selectedIso < todayIso) {
        out.push({ start, end, status: 'closed' });
        continue;
      }
      out.push({ start, end, status: 'free' });
    }
    return out;
  }, [selectedIso, dayDrafts, intervalMin, bookings, timeOffs, todayIso]);

  if (loading) return <PanelLoading label="در حال بارگذاری زمان‌بندی..." />;
  if (error && !workingHours.length) return <PanelError message={error} onRetry={load} />;

  const dow = dayOfWeekFromIso(selectedIso);
  const dowLabel = DAYS.find((d) => d.value === dow)?.label || '';
  const dayActive = !!dayDrafts[dow]?.active;

  return (
    <div className="mx-auto max-w-lg space-y-3 px-1 pb-24 sm:px-0">
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold sm:text-xl">زمان‌بندی</h1>
          <p className="text-xs text-gray sm:text-sm">تقویم، ساعات هفتگی و اسلات‌ها</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setBlockDate(selectedIso);
            setBlockOpen(true);
          }}
        >
          مسدود کردن
        </Button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 sm:text-sm">{error}</p>}
      {success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 sm:text-sm">{success}</p>}

      <Card className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-sm"
            onClick={() => {
              const n = addJalaliMonths(viewJy, viewJm, -1);
              setViewJy(n.jy);
              setViewJm(n.jm);
            }}
          >
            ‹
          </button>
          <p className="text-sm font-semibold">
            {jalaliMonthName(viewJm)} {viewJy}
          </p>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-sm"
            onClick={() => {
              const n = addJalaliMonths(viewJy, viewJm, 1);
              setViewJy(n.jy);
              setViewJm(n.jm);
            }}
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray sm:text-xs">
          {PERSIAN_WEEKDAYS.map((w) => (
            <div key={w} className="py-0.5">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {monthGrid.map((cell) => {
            const isSel = cell.iso === selectedIso;
            const isToday = cell.iso === todayIso;
            return (
              <button
                key={cell.iso + String(cell.inMonth)}
                type="button"
                disabled={!cell.inMonth}
                onClick={() => {
                  if (cell.inMonth) {
                    setSelectedIso(cell.iso);
                    setSelectedSlots([]);
                  }
                }}
                className={`flex aspect-square max-h-11 flex-col items-center justify-center rounded-lg text-sm transition-colors ${
                  !cell.inMonth ? 'text-gray/25' : 'hover:bg-coral-soft'
                } ${isSel ? 'bg-coral font-semibold text-white' : ''} ${
                  !isSel && isToday ? 'ring-1 ring-coral/50' : ''
                }`}
              >
                <span>{cell.jd}</span>
                {cell.inMonth && activeDays.has(dayOfWeekFromIso(cell.iso)) && (
                  <span className={`mt-0.5 h-1 w-1 rounded-full ${isSel ? 'bg-white' : 'bg-coral'}`} />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-2.5 p-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">اسلات‌های روز</h2>
            <p className="text-xs text-gray">
              {dowLabel} — {isoToJalaliLabel(selectedIso)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray">فاصله:</span>
            <select
              className="h-8 rounded-lg border border-border bg-white px-2 text-xs"
              value={intervalMin}
              onChange={(e) => {
                setIntervalMin(Number(e.target.value));
                setSelectedSlots([]);
              }}
            >
              {INTERVALS.map((n) => (
                <option key={n} value={n}>
                  {n} دقیقه
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray">
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-emerald-500" /> آزاد
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-red-400" /> رزرو
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-orange-400" /> مسدود
          </span>
        </div>

        {!dayActive ? (
          <p className="rounded-xl bg-gray-light/50 px-3 py-5 text-center text-sm text-gray">
            این روز در ساعات هفتگی غیرفعال است.
            <button
              type="button"
              className="mt-1 block w-full text-coral underline"
              onClick={() => setHoursOpen(true)}
            >
              فعال‌سازی از ساعات هفتگی
            </button>
          </p>
        ) : daySlots.length === 0 ? (
          <p className="rounded-xl bg-gray-light/50 px-3 py-5 text-center text-sm text-gray">
            اسلاتی برای این روز ساخته نشد.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {daySlots.map((slot) => {
              const selected = selectedSlots.includes(slot.start);
              const cls =
                slot.status === 'free'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : slot.status === 'booked'
                    ? 'cursor-not-allowed border-red-200 bg-red-50 text-red-800'
                    : slot.status === 'blocked'
                      ? 'border-orange-200 bg-orange-50 text-orange-900'
                      : 'cursor-not-allowed border-border bg-gray-light text-gray';
              return (
                <button
                  key={slot.start}
                  type="button"
                  disabled={slot.status === 'booked' || slot.status === 'closed'}
                  onClick={() => {
                    if (slot.status === 'booked' || slot.status === 'closed') return;
                    setSelectedSlots((p) =>
                      p.includes(slot.start) ? p.filter((x) => x !== slot.start) : [...p, slot.start],
                    );
                  }}
                  className={`rounded-lg border px-1 py-2 text-center text-[11px] leading-tight sm:text-xs ${cls} ${
                    selected ? 'ring-2 ring-coral' : ''
                  }`}
                >
                  <span dir="ltr">
                    {slot.start}–{slot.end}
                  </span>
                  {slot.name && <span className="mt-0.5 block truncate text-[10px]">{slot.name}</span>}
                </button>
              );
            })}
          </div>
        )}

        {selectedSlots.length > 0 && dayActive && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              loading={submitting}
              onClick={async () => {
                setSubmitting(true);
                setError(null);
                try {
                  const sorted = [...selectedSlots].sort((a, b) => pm(a) - pm(b));
                  for (const start of sorted) {
                    const end = fm(pm(start) + intervalMin);
                    await addTimeOff({
                      ...tehranRange(selectedIso, start, end),
                      reason: 'مسدود از اسلات',
                    });
                  }
                  setSelectedSlots([]);
                  setSuccess('اسلات‌های انتخاب‌شده مسدود شد');
                  await load();
                } catch (e) {
                  setError(friendlyApiError(e));
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              مسدود کردن انتخاب‌ها
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              loading={submitting}
              onClick={async () => {
                setSubmitting(true);
                setError(null);
                try {
                  for (const start of selectedSlots) {
                    const end = fm(pm(start) + intervalMin);
                    const match = timeOffs.find((t) => {
                      const [y, m, d] = selectedIso.split('-').map(Number);
                      const off = 3.5 * 3600000;
                      const ds = Date.UTC(y, m - 1, d) - off;
                      const bs = Math.max(0, Math.round((new Date(t.startAt).getTime() - ds) / 60000));
                      const be = Math.min(1440, Math.round((new Date(t.endAt).getTime() - ds) / 60000));
                      return pm(start) < be && pm(end) > bs;
                    });
                    if (match) await removeTimeOff(match.id);
                  }
                  setSelectedSlots([]);
                  setSuccess('اسلات‌های انتخاب‌شده باز شد');
                  await load();
                } catch (e) {
                  setError(friendlyApiError(e));
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              باز کردن انتخاب‌ها
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setHoursOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-start"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray">ساعات کاری هفتگی</p>
            <p className="mt-0.5 truncate text-sm">
              {weeklySummary.length ? weeklySummary.join(' · ') : 'هنوز روزی فعال نشده'}
            </p>
          </div>
          <span className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs text-gray">
            {hoursOpen ? 'بستن' : 'ویرایش'}
          </span>
        </button>

        {hoursOpen && (
          <div className="space-y-1.5 border-t border-border px-3 py-2.5">
            <p className="text-[11px] text-gray">روز را روشن کنید و بازه ساعت را تنظیم کنید.</p>
            {DAYS.map((d) => {
              const draft = dayDrafts[d.value];
              return (
                <div key={d.value} className="flex items-center gap-2 py-1">
                  <button
                    type="button"
                    aria-label={d.label}
                    onClick={() =>
                      setDayDrafts((p) => ({
                        ...p,
                        [d.value]: { ...p[d.value], active: !draft.active },
                      }))
                    }
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                      draft.active ? 'bg-coral' : 'bg-gray-light'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        draft.active ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="w-16 shrink-0 text-sm font-medium">{d.label}</span>
                  <div
                    className={`flex flex-1 items-center gap-1.5 ${
                      draft.active ? '' : 'pointer-events-none opacity-35'
                    }`}
                    dir="ltr"
                  >
                    <Input
                      className="h-8 min-w-0 flex-1 px-1.5 text-center text-sm"
                      type="time"
                      value={draft.startTime}
                      onChange={(e) =>
                        setDayDrafts((p) => ({
                          ...p,
                          [d.value]: { ...p[d.value], startTime: e.target.value },
                        }))
                      }
                    />
                    <span className="text-xs text-gray">–</span>
                    <Input
                      className="h-8 min-w-0 flex-1 px-1.5 text-center text-sm"
                      type="time"
                      value={draft.endTime}
                      onChange={(e) =>
                        setDayDrafts((p) => ({
                          ...p,
                          [d.value]: { ...p[d.value], endTime: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              className="mt-1 w-full"
              size="sm"
              loading={submitting}
              onClick={async () => {
                setSubmitting(true);
                setError(null);
                setSuccess(null);
                try {
                  for (const d of DAYS) {
                    const draft = dayDrafts[d.value];
                    const existing = workingHours.filter(
                      (h) => String(h.dayOfWeek).toLowerCase() === d.value,
                    );
                    if (draft.active) {
                      if (pm(draft.endTime) <= pm(draft.startTime)) throw new Error('ساعت نامعتبر');
                      await setMyWorkingHours({
                        dayOfWeek: d.value,
                        startTime: draft.startTime,
                        endTime: draft.endTime,
                        isActive: true,
                      });
                    } else {
                      for (const row of existing) {
                        await setMyWorkingHours({
                          dayOfWeek: d.value,
                          startTime: row.startTime.slice(0, 5),
                          endTime: row.endTime.slice(0, 5),
                          isActive: false,
                        });
                      }
                    }
                  }
                  setSuccess('ساعات هفتگی ذخیره شد');
                  setHoursOpen(false);
                  await load();
                } catch (e) {
                  setError(friendlyApiError(e));
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              ذخیره ساعات هفتگی
            </Button>
          </div>
        )}
      </Card>

      {blockOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold">مسدود کردن بازه</h3>
            <Input type="date" dir="ltr" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
            <p className="text-xs text-gray">شمسی: {isoToJalaliLabel(blockDate)}</p>
            <div className="grid grid-cols-2 gap-2">
              <Input type="time" dir="ltr" value={blockFrom} onChange={(e) => setBlockFrom(e.target.value)} />
              <Input type="time" dir="ltr" value={blockTo} onChange={(e) => setBlockTo(e.target.value)} />
            </div>
            <Input
              placeholder="دلیل (اختیاری)"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setBlockOpen(false)}>
                انصراف
              </Button>
              <Button
                type="button"
                className="flex-1"
                loading={submitting}
                onClick={async () => {
                  if (pm(blockTo) <= pm(blockFrom)) {
                    setError('ساعت نامعتبر');
                    return;
                  }
                  setSubmitting(true);
                  setError(null);
                  try {
                    await addTimeOff({
                      ...tehranRange(blockDate, blockFrom, blockTo),
                      reason: blockReason.trim() || undefined,
                    });
                    setBlockOpen(false);
                    setSuccess('بازه مسدود شد');
                    await load();
                  } catch (e) {
                    setError(friendlyApiError(e));
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                ذخیره
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
