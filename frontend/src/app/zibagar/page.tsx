'use client';
import { PauseBookingsToggle } from '@/components/professionals/pause-bookings-toggle';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { CompletionBar } from '@/components/profile/completion-bar';
import {
  fetchProBookings,
  fetchMyProfessional,
  fetchUnreadCount,
  type BookingListItem,
  type OwnProfessional,
} from '@/lib/panel-api';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDate, formatPrice, formatTime24 } from '@/lib/utils';
import { persianProfessionalStatus } from '@/lib/persian-status';

type EarningsPeriods = {
  today?: { earned: number; count: number };
  week?: { earned: number; count: number };
  month?: { earned: number; count: number };
};

type ReviewRow = {
  id: string;
  rating: number;
  professionalReply?: string | null;
  createdAt: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function serviceName(b: BookingListItem) {
  const fromItems = b.items?.[0]?.service?.name;
  const fromServices = b.services?.[0]?.name;
  return fromItems || fromServices || 'نوبت';
}

function customerName(b: BookingListItem) {
  return b.customer?.profile?.displayName || b.customer?.phone || 'مشتری';
}

function customerKey(b: BookingListItem) {
  return b.customer?.id || b.customer?.phone || customerName(b);
}

function statusDot(status?: string | null) {
  if (status === 'approved') return { label: 'فعال', className: 'bg-emerald-500' };
  if (status === 'pending_review') return { label: 'در انتظار بررسی', className: 'bg-amber-400' };
  if (status === 'draft') return { label: 'پیش‌نویس', className: 'bg-gray-400' };
  if (status === 'suspended') return { label: 'معلق', className: 'bg-red-500' };
  return { label: status ? persianProfessionalStatus(status) : '—', className: 'bg-gray-400' };
}

function weekdayLabel(d: Date) {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      weekday: 'narrow',
      timeZone: 'Asia/Tehran',
    }).format(d);
  } catch {
    return '';
  }
}

function bookingStatusFa(status?: string | null) {
  if (status === 'pending') return 'در انتظار';
  if (status === 'confirmed') return 'تأیید شده';
  if (status === 'completed') return 'انجام شده';
  if (status === 'cancelled') return 'لغو شده';
  if (status === 'rejected') return 'رد شده';
  return status || '—';
}

export default function ZibagarDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pro, setPro] = useState<OwnProfessional | null>(null);
  const [weekBookings, setWeekBookings] = useState<BookingListItem[]>([]);
  const [pendingBookings, setPendingBookings] = useState<BookingListItem[]>([]);
  const [periods, setPeriods] = useState<EarningsPeriods | null>(null);
  const [weekSeries, setWeekSeries] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [newReviews, setNewReviews] = useState(0);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date();
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);

      const [proRes, weekRes, pendingRes, earningsRes, reviewsRes, unreadRes] =
        await Promise.all([
          fetchMyProfessional().catch(() => null),
          fetchProBookings(1, 80, {
            from: from.toISOString(),
            to: endOfDay(today).toISOString(),
          }).catch(() => ({ items: [] as BookingListItem[] })),
          fetchProBookings(1, 30, { status: 'pending' }).catch(() => ({
            items: [] as BookingListItem[],
          })),
          apiClient
            .get<{ periods?: EarningsPeriods }>('/professionals/me/earnings?page=1&limit=1')
            .catch(() => null),
          apiClient
            .get<{ items?: ReviewRow[]; summary?: { ratingAvg?: number | string } }>(
              '/reviews/professional?page=1&limit=30',
            )
            .catch(() => null),
          fetchUnreadCount().catch(() => ({ count: 0 })),
        ]);

      setPro(proRes);
      setWeekBookings(weekRes.items || []);
      setPendingBookings(pendingRes.items || []);
      setPeriods(earningsRes?.periods || null);
      setUnreadNotifs(Number(unreadRes?.count) || 0);

      const series = [0, 0, 0, 0, 0, 0, 0];
      for (const b of weekRes.items || []) {
        if (!b.startAt) continue;
        if (['cancelled', 'rejected', 'expired'].includes(b.status)) continue;
        const d = new Date(b.startAt);
        const dayIdx = Math.floor(
          (startOfDay(d).getTime() - startOfDay(from).getTime()) / 86400000,
        );
        if (dayIdx >= 0 && dayIdx < 7) series[dayIdx] += 1;
      }
      setWeekSeries(series);

      const reviewItems = reviewsRes?.items || [];
      setNewReviews(reviewItems.filter((r) => !r.professionalReply).length);
      const avg = reviewsRes?.summary?.ratingAvg;
      setRatingAvg(avg != null && avg !== '' ? Number(avg) : null);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const name =
    user?.profile?.displayName ||
    pro?.user?.profile?.displayName ||
    pro?.title ||
    'زیباگر';

  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd = endOfDay(new Date()).getTime();

  const todayBookings = useMemo(() => {
    return weekBookings
      .filter((b) => {
        if (!b.startAt) return false;
        if (['cancelled', 'rejected', 'expired'].includes(b.status)) return false;
        const t = new Date(b.startAt).getTime();
        return t >= todayStart && t <= todayEnd;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [weekBookings, todayStart, todayEnd]);

  const pendingCount = pendingBookings.length;

  const nextBooking = useMemo(() => {
    const now = Date.now();
    const upcoming = weekBookings
      .filter((b) => {
        if (!b.startAt) return false;
        if (['cancelled', 'rejected', 'expired'].includes(b.status)) return false;
        return new Date(b.startAt).getTime() >= now;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return upcoming[0] || null;
  }, [weekBookings]);

  const weekBookingCount = useMemo(
    () => weekSeries.reduce((a, n) => a + n, 0),
    [weekSeries],
  );

  const uniqueCustomersWeek = useMemo(() => {
    const keys = new Set<string>();
    for (const b of weekBookings) {
      if (['cancelled', 'rejected', 'expired'].includes(b.status)) continue;
      keys.add(customerKey(b));
    }
    return keys.size;
  }, [weekBookings]);

  const maxSeries = Math.max(1, ...weekSeries);
  const statusInfo = statusDot(pro?.status);

  const pendingReviewBanner =
    pro?.status === 'pending_review' ? (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
        <p className="font-bold">پروفایل شما در حال بررسی است</p>
        <p className="mt-1 text-xs leading-6 text-amber-900/90">
          درخواست تأیید برای ادمین ارسال شده. معمولاً بررسی بین ۲۴ تا ۷۲ ساعت طول می‌کشد.
          تا زمان تأیید، پروفایل در جستجوی عمومی نمایش داده نمی‌شود.
        </p>
      </div>
    ) : pro?.status === 'draft' ? (
      <div className="mb-4 rounded-2xl border border-border bg-gray-light/50 px-4 py-3 text-sm" role="status">
        <p className="font-medium">پروفایل هنوز پیش‌نویس است</p>
        <p className="mt-1 text-xs text-gray">پس از تکمیل اطلاعات، آن را برای بررسی ادمین ارسال کنید.</p>
      </div>
    ) : null;
  const published = pro?.status === 'approved';
  const percent = pro?.completion?.percent ?? 0;
  const complete = pro?.completion?.complete ?? false;
  const attentionCount = pendingCount + newReviews + (unreadNotifs > 0 ? 1 : 0);

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="mb-4"><PauseBookingsToggle /></div>

      {pendingReviewBanner}

      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-coral px-5 py-5 text-white shadow-sm sm:rounded-3xl sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">سلام {name} 👋</h1>
            <p className="mt-1 text-sm text-white/90">
              {todayBookings.length > 0
                ? `امروز ${todayBookings.length.toLocaleString('fa-IR')} نوبت داری`
                : 'امروز نوبتی در برنامه نیست'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusInfo.className}`} />
              <span>پروفایل: {statusInfo.label}</span>
            </div>
            {published && pro?.slug && (
              <Link
                href={`/professionals/${pro.slug}`}
                className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30"
              >
                مشاهده صفحه عمومی
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Profile completion */}
      {!published && (
        <Card className="space-y-3">
          <h2 className="font-semibold">
            {complete || percent >= 100
              ? 'آماده انتشار'
              : `تکمیل پروفایل — ${percent.toLocaleString('fa-IR')}٪`}
          </h2>
          <CompletionBar percent={percent} fields={pro?.completion?.fields} showFields={!complete} />
          <div className="flex flex-wrap gap-2">
            <Link href="/zibagar/profile">
              <Button size="sm">مدیریت پروفایل</Button>
            </Link>
            {percent < 100 && (
              <Link href="/zibagar/profile/complete">
                <Button size="sm" variant="outline">
                  ادامه تکمیل
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="space-y-1 text-center">
          <p className="text-2xl font-bold text-coral">
            {todayBookings.length.toLocaleString('fa-IR')}
          </p>
          <p className="text-xs text-gray">نوبت امروز</p>
        </Card>
        <Card className="space-y-1 text-center">
          <p className="text-2xl font-bold text-amber-600">
            {pendingCount.toLocaleString('fa-IR')}
          </p>
          <p className="text-xs text-gray">در انتظار تأیید</p>
        </Card>
        <Card className="space-y-1 text-center">
          <p className="text-2xl font-bold text-blue">
            {periods?.today?.earned != null
              ? formatPrice(periods.today.earned).replace(/\s*تومان\s*$/, '')
              : '—'}
          </p>
          <p className="text-xs text-gray">درآمد امروز</p>
        </Card>
        <Card className="space-y-1 text-center">
          <p className="text-2xl font-bold">
            ⭐{' '}
            {ratingAvg != null && Number.isFinite(ratingAvg)
              ? ratingAvg.toLocaleString('fa-IR', { maximumFractionDigits: 1 })
              : '—'}
          </p>
          <p className="text-xs text-gray">امتیاز</p>
        </Card>
      </div>

      {/* Next + Attention */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold">🔥 نوبت بعدی</h2>
          {nextBooking ? (
            <>
              <p className="text-lg font-bold">
                {formatDate(nextBooking.startAt, { style: 'short', includeTime: true })}
              </p>
              <p className="text-sm">
                {serviceName(nextBooking)} · {customerName(nextBooking)}
              </p>
              <p className="text-xs text-gray">{bookingStatusFa(nextBooking.status)}</p>
              <Link href="/zibagar/bookings">
                <Button size="sm">مشاهده نوبت</Button>
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray">نوبت فعالی در روزهای آینده نیست.</p>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">🔔 نیاز به توجه</h2>
            {attentionCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {attentionCount.toLocaleString('fa-IR')}
              </span>
            )}
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>{pendingCount.toLocaleString('fa-IR')} رزرو در انتظار</span>
              {pendingCount > 0 && (
                <Link href="/zibagar/bookings?status=pending" className="text-blue hover:underline">
                  مشاهده
                </Link>
              )}
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>{newReviews.toLocaleString('fa-IR')} نظر بدون پاسخ</span>
              {newReviews > 0 && (
                <Link href="/zibagar/reviews" className="text-blue hover:underline">
                  مشاهده
                </Link>
              )}
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>{unreadNotifs.toLocaleString('fa-IR')} اعلان خوانده‌نشده</span>
              {unreadNotifs > 0 && (
                <Link href="/zibagar/notifications" className="text-blue hover:underline">
                  مشاهده
                </Link>
              )}
            </li>
          </ul>
          {attentionCount === 0 && (
            <p className="text-sm text-emerald-700">همه‌چیز به‌روز است ✓</p>
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <Card className="space-y-3">
        <h2 className="font-semibold">⚡ دسترسی سریع</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/zibagar/bookings">
            <Button size="sm" variant="outline">
              رزروها
            </Button>
          </Link>
          <Link href="/zibagar/hours">
            <Button size="sm" variant="outline">
              ساعات کاری
            </Button>
          </Link>
          <Link href="/zibagar/services">
            <Button size="sm" variant="outline">
              منوی قیمت
            </Button>
          </Link>
          <Link href="/zibagar/portfolio">
            <Button size="sm" variant="outline">
              نمونه‌کار
            </Button>
          </Link>
          <Link href="/zibagar/earnings">
            <Button size="sm" variant="secondary">
              درآمد
            </Button>
          </Link>
        </div>
      </Card>

      {/* Today's schedule */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">📅 برنامه امروز</h2>
          <Link href="/zibagar/bookings" className="text-sm text-blue hover:underline">
            همه رزروها
          </Link>
        </div>
        {todayBookings.length === 0 ? (
          <p className="text-sm text-gray">برای امروز نوبتی ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-border">
            {todayBookings.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[3.5rem] font-medium tabular-nums" dir="ltr">
                    {formatTime24(b.startAt)}
                  </span>
                  <span className="font-medium">{serviceName(b)}</span>
                  <span className="text-gray">{customerName(b)}</span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    b.status === 'pending'
                      ? 'bg-amber-50 text-amber-800'
                      : b.status === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-gray-light text-gray'
                  }`}
                >
                  {bookingStatusFa(b.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Pending queue preview */}
      {pendingCount > 0 && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">⏳ رزروهای در انتظار تأیید</h2>
            <Link
              href="/zibagar/bookings?status=pending"
              className="text-sm text-blue hover:underline"
            >
              مدیریت همه
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {pendingBookings.slice(0, 5).map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {serviceName(b)} · {customerName(b)}
                  </p>
                  <p className="text-xs text-gray">
                    {formatDate(b.startAt, { style: 'short', includeTime: true })}
                    {b.totalPrice != null && <> · {formatPrice(b.totalPrice)}</>}
                  </p>
                </div>
                <Link href="/zibagar/bookings">
                  <Button size="sm" variant="outline">
                    بررسی
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Week performance */}
      <Card className="space-y-4">
        <h2 className="font-semibold">📊 عملکرد این هفته</h2>
        <p className="text-sm text-gray">
          {weekBookingCount.toLocaleString('fa-IR')} نوبت
          {uniqueCustomersWeek > 0 && (
            <> · {uniqueCustomersWeek.toLocaleString('fa-IR')} مشتری</>
          )}
          {periods?.week?.earned != null && <> · {formatPrice(periods.week.earned)} درآمد</>}
        </p>
        <div className="flex h-28 items-end gap-1.5 sm:gap-2">
          {weekSeries.map((n, i) => {
            const h = Math.max(4, Math.round((n / maxSeries) * 100));
            const day = new Date();
            day.setDate(day.getDate() - (6 - i));
            const label = weekdayLabel(day);
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-gray">{n || ''}</span>
                <div
                  className="w-full max-w-[2rem] rounded-t-md bg-coral/80 transition-all"
                  style={{ height: `${h}%` }}
                  title={`${label}: ${n} نوبت`}
                />
                <span className="text-[10px] text-gray">{label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/zibagar/earnings">
            <Button size="sm" variant="secondary">
              درآمد و تسویه
            </Button>
          </Link>
          <Link href="/zibagar/bookings">
            <Button size="sm" variant="outline">
              همه رزروها
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
