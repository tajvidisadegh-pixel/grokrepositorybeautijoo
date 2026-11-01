'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { MiniBarChart, MiniStackedBarChart } from '@/components/panel/mini-chart';
import { fetchAdminDashboard, type AdminDashboard, type AdminWindowStats } from '@/lib/admin-dashboard-api';
import { friendlyApiError } from '@/lib/api-errors';
import { apiClient } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/utils';
import { persianBookingStatus, persianProfessionalStatus } from '@/lib/persian-status';

type WindowKey = 'last1Hour' | 'today' | 'last24Hours' | 'last7Days' | 'last30Days' | 'thisMonth';
const WINDOW_TABS: { key: WindowKey; label: string }[] = [
  { key: 'last1Hour', label: '۱ ساعت اخیر' },
  { key: 'today', label: 'امروز' },
  { key: 'last24Hours', label: '۲۴ ساعت اخیر' },
  { key: 'last7Days', label: '۷ روز اخیر' },
  { key: 'last30Days', label: '۳۰ روز اخیر' },
  { key: 'thisMonth', label: 'این ماه' },
];

const EMPTY_WINDOW: AdminWindowStats = {
  newUsers: 0,
  newProfessionals: 0,
  newBookings: 0,
  completedBookings: 0,
  cancelledBookings: 0,
};

function normalizeDashboard(raw: Partial<AdminDashboard> | null | undefined): AdminDashboard {
  const overview = raw?.overview ?? {
    totalUsers: 0,
    totalProfessionals: 0,
    pendingProfessionals: 0,
    totalBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    totalReviews: 0,
    revenue: { available: false },
  };
  const timeStats = raw?.timeStats ?? {
    last1Hour: EMPTY_WINDOW,
    today: EMPTY_WINDOW,
    last24Hours: EMPTY_WINDOW,
    last7Days: EMPTY_WINDOW,
    last30Days: EMPTY_WINDOW,
    thisMonth: EMPTY_WINDOW,
  };
  return {
    overview: {
      totalUsers: overview.totalUsers ?? 0,
      totalProfessionals: overview.totalProfessionals ?? 0,
      pendingProfessionals: overview.pendingProfessionals ?? 0,
      totalBookings: overview.totalBookings ?? 0,
      completedBookings: overview.completedBookings ?? 0,
      cancelledBookings: overview.cancelledBookings ?? 0,
      totalReviews: overview.totalReviews ?? 0,
      revenue: overview.revenue ?? { available: false },
    },
    timeStats: {
      last1Hour: timeStats.last1Hour ?? EMPTY_WINDOW,
      today: timeStats.today ?? EMPTY_WINDOW,
      last24Hours: timeStats.last24Hours ?? EMPTY_WINDOW,
      last7Days: timeStats.last7Days ?? EMPTY_WINDOW,
      last30Days: timeStats.last30Days ?? EMPTY_WINDOW,
      thisMonth: timeStats.thisMonth ?? EMPTY_WINDOW,
    },
    trends: {
      userGrowth: raw?.trends?.userGrowth ?? [],
      professionalGrowth: raw?.trends?.professionalGrowth ?? [],
      bookingActivity: raw?.trends?.bookingActivity ?? [],
      revenue: raw?.trends?.revenue ?? null,
    },
    pending: {
      professionalsAwaitingReview: raw?.pending?.professionalsAwaitingReview ?? 0,
      pendingPayments: raw?.pending?.pendingPayments ?? 0,
      failedPayments: raw?.pending?.failedPayments ?? 0,
    },
    recentActivity: raw?.recentActivity ?? [],
    recent: {
      professionals: raw?.recent?.professionals ?? [],
      users: raw?.recent?.users ?? [],
      bookings: raw?.recent?.bookings ?? [],
      reviews: raw?.recent?.reviews ?? [],
    },
  };
}

function fmt(n: number) {
  return new Intl.NumberFormat('fa-IR').format(n || 0);
}

function KpiCard({ label, value, accent = 'text-foreground', href }: { label: string; value: string; accent?: string; href?: string }) {
  const body = (
    <Card className="space-y-1">
      <p className="text-xs text-gray">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </Card>
  );
  return href ? <Link href={href} className="block transition hover:opacity-90">{body}</Link> : body;
}

function WindowStatsGrid({ stats }: { stats: AdminWindowStats }) {
  const items: { label: string; value: number }[] = [
    { label: 'کاربر جدید', value: stats.newUsers },
    { label: 'زیباگر جدید', value: stats.newProfessionals },
    { label: 'رزرو جدید', value: stats.newBookings },
    { label: 'رزرو انجام‌شده', value: stats.completedBookings },
    { label: 'رزرو لغوشده', value: stats.cancelledBookings },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl bg-gray-light/60 px-3 py-3 text-center">
          <p className="text-lg font-bold text-foreground">{fmt(it.value)}</p>
          <p className="mt-0.5 text-[11px] text-gray">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<WindowKey>('last7Days');
  const [reviewQueue, setReviewQueue] = useState({ professionals: 0, bookings: 0, reviews: 0, support: 0, media: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [res, badges] = await Promise.all([
          fetchAdminDashboard(),
          apiClient.get<{ professionals?: number; bookings?: number; reviews?: number; support?: number; media?: number }>('/admin/nav-badges').catch(() => null),
        ]);
        if (!cancelled) {
          setData(normalizeDashboard(res));
          if (badges) setReviewQueue({ professionals: badges.professionals ?? 0, bookings: badges.bookings ?? 0, reviews: badges.reviews ?? 0, support: badges.support ?? 0, media: badges.media ?? 0 });
        }
      } catch (e) {
        if (!cancelled) setError(friendlyApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const userGrowthPoints = useMemo(
    () => (data?.trends.userGrowth || []).map((d) => ({ label: d.date.slice(5), value: d.count })),
    [data],
  );
  const proGrowthPoints = useMemo(
    () => (data?.trends.professionalGrowth || []).map((d) => ({ label: d.date.slice(5), value: d.count })),
    [data],
  );
  const bookingActivityPoints = useMemo(
    () =>
      (data?.trends.bookingActivity || []).map((d) => ({
        label: d.date.slice(5),
        values: [d.completed, d.cancelled, Math.max(d.total - d.completed - d.cancelled, 0)],
      })),
    [data],
  );

  if (loading) return <PanelLoading label="در حال بارگذاری داشبورد..." />;
  if (error) return <PanelError message={error} onRetry={() => location.reload()} />;
  if (!data) return <PanelError message="داده‌ای دریافت نشد." />;

  const { overview, timeStats, pending, recentActivity, recent } = data;
  const hasAnyData = overview.totalUsers > 0 || overview.totalProfessionals > 0 || overview.totalBookings > 0 || overview.totalReviews > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">داشبورد</h1>
        <p className="mt-1 text-sm text-gray">نمای کلی پلتفرم Beautijoo</p>
      </div>

      {!hasAnyData && (
        <PanelEmpty
          title="هنوز داده‌ای در پلتفرم ثبت نشده"
          description="به محض ثبت‌نام کاربران، زیباگرها و رزروها، این داشبورد پر می‌شود."
        />
      )}

      <Card className="border-amber-200 bg-amber-50/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-bold text-foreground">بررسی شود</h2><p className="mt-1 text-xs text-gray">مواردی که نیاز به اقدام یا بررسی مدیریت دارند.</p></div>
          <span className="rounded-full bg-white px-3 py-1 text-xs text-gray">{fmt(reviewQueue.professionals + reviewQueue.bookings + reviewQueue.reviews + reviewQueue.support + reviewQueue.media + (data?.pending.pendingPayments ?? 0) + (data?.pending.failedPayments ?? 0))} مورد</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {[
            { label: 'زیباگر در انتظار بررسی', value: reviewQueue.professionals, href: '/admin/professionals' },
            { label: 'رزرو در انتظار اقدام', value: reviewQueue.bookings, href: '/admin/bookings' },
            { label: 'نظر در انتظار بررسی', value: reviewQueue.reviews, href: '/admin/reviews' },
            { label: 'تیکت پشتیبانی', value: reviewQueue.support, href: '/admin/support' },
            { label: 'رسانه در انتظار بررسی', value: reviewQueue.media, href: '/admin/media' },
            { label: 'پرداخت در انتظار اقدام', value: data.pending.pendingPayments, href: '/admin/finance' },
            { label: 'پرداخت ناموفق', value: data.pending.failedPayments, href: '/admin/finance' },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="rounded-xl border border-amber-100 bg-white px-3 py-3 transition hover:border-coral/40">
              <p className="text-xs text-gray">{item.label}</p>
              <p className={`mt-1 text-xl font-bold ${item.value > 0 ? 'text-coral' : 'text-foreground'}`}>{fmt(item.value)}</p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="کل کاربران" value={fmt(overview.totalUsers)} href="/admin/users" />
        <KpiCard label="کل زیباگرها" value={fmt(overview.totalProfessionals)} href="/admin/professionals" />
        <KpiCard
          label="زیباگر نیازمند بررسی"
          value={fmt(overview.pendingProfessionals)}
          accent={overview.pendingProfessionals > 0 ? 'text-coral' : 'text-foreground'}
          href="/admin/professionals"
        />
        <KpiCard label="کل رزروها" value={fmt(overview.totalBookings)} href="/admin/bookings" />
        <KpiCard label="رزروهای انجام‌شده" value={fmt(overview.completedBookings)} accent="text-blue" />
        <KpiCard label="رزروهای لغوشده" value={fmt(overview.cancelledBookings)} accent="text-gray" />
        <KpiCard label="کل نظرات" value={fmt(overview.totalReviews)} />
        <Link href="/admin/finance" className="block transition hover:opacity-90">
          <Card className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray">درآمد و مدیریت مالی</p>
              <span className="text-[10px] text-coral font-medium">مشاهده گزارش مالی ←</span>
            </div>
            {overview.revenue.available ? (
              <p className="text-2xl font-bold text-coral">{formatPrice(overview.revenue.total || 0)}</p>
            ) : (
              <p className="text-xs text-gray">مدیریت تراکنش‌ها</p>
            )}
          </Card>
        </Link>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-foreground">آمار زمانی</h2>
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-light/60 p-1">
            {WINDOW_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setWindowKey(tab.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  windowKey === tab.key ? 'bg-white text-coral shadow-sm' : 'text-gray hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <WindowStatsGrid stats={timeStats[windowKey] ?? EMPTY_WINDOW} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold text-foreground">رشد کاربران (۳۰ روز)</h2>
          {userGrowthPoints.length ? (
            <MiniBarChart data={userGrowthPoints} color="#2D6CDF" />
          ) : (
            <p className="py-8 text-center text-sm text-gray">داده‌ای نیست</p>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-foreground">رشد زیباگرها (۳۰ روز)</h2>
          {proGrowthPoints.length ? (
            <MiniBarChart data={proGrowthPoints} color="#FF6F61" />
          ) : (
            <p className="py-8 text-center text-sm text-gray">داده‌ای نیست</p>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-bold text-foreground">فعالیت رزرو (۳۰ روز)</h2>
          {bookingActivityPoints.length ? (
            <MiniStackedBarChart
              data={bookingActivityPoints}
              series={[
                { key: 'completed', color: '#2D6CDF', name: 'انجام‌شده' },
                { key: 'cancelled', color: '#FF6F61', name: 'لغوشده' },
                { key: 'other', color: '#9CA3AF', name: 'سایر' },
              ]}
            />
          ) : (
            <p className="py-8 text-center text-sm text-gray">داده‌ای نیست</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-foreground">زیباگرهای اخیر</h2>
            <Link href="/admin/professionals" className="text-xs text-coral hover:underline">همه</Link>
          </div>
          {recent.professionals.length ? (
            <ul className="space-y-2">
              {recent.professionals.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-gray-light/40 px-3 py-2 text-sm">
                  <span className="truncate">{p.displayName || p.title || p.id}</span>
                  <span className="text-xs text-gray">{persianProfessionalStatus(p.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-gray">موردی نیست</p>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-foreground">کاربران اخیر</h2>
            <Link href="/admin/users" className="text-xs text-coral hover:underline">همه</Link>
          </div>
          {recent.users.length ? (
            <ul className="space-y-2">
              {recent.users.slice(0, 5).map((u) => (
                <li key={u.id} className="flex items-center justify-between rounded-lg bg-gray-light/40 px-3 py-2 text-sm">
                  <span className="truncate">{u.displayName || u.phone || u.id}</span>
                  <span className="text-xs text-gray">{formatDate(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-gray">موردی نیست</p>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-foreground">رزروهای اخیر</h2>
            <Link href="/admin/bookings" className="text-xs text-coral hover:underline">همه</Link>
          </div>
          {recent.bookings.length ? (
            <ul className="space-y-2">
              {recent.bookings.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-lg bg-gray-light/40 px-3 py-2 text-sm">
                  <span className="truncate">{b.professionalTitle || b.customerName || b.id}</span>
                  <span className="text-xs text-gray">{persianBookingStatus(b.status)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-gray">موردی نیست</p>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-foreground">نظرات اخیر</h2>
            <Link href="/admin/reviews" className="text-xs text-coral hover:underline">همه</Link>
          </div>
          {recent.reviews.length ? (
            <ul className="space-y-2">
              {recent.reviews.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg bg-gray-light/40 px-3 py-2 text-sm">
                  <span className="truncate">{r.professionalTitle || r.id}</span>
                  <span className="text-xs text-gray">{r.rating} ⭐</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-gray">موردی نیست</p>
          )}
        </Card>
      </div>

      {recentActivity.length > 0 && (
        <Card>
          <h2 className="mb-3 font-bold text-foreground">فعالیت اخیر</h2>
          <ul className="space-y-2">
            {recentActivity.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg bg-gray-light/40 px-3 py-2 text-sm">
                <span className="truncate">{a.actor ? `${a.actor}: ` : ''}{a.action} ({a.entityType})</span>
                <span className="text-xs text-gray">{formatDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
