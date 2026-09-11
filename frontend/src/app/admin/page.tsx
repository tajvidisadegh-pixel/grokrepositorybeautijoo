'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { MiniBarChart, MiniStackedBarChart } from '@/components/panel/mini-chart';
import { fetchAdminDashboard, type AdminDashboard, type AdminWindowStats } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice, formatDate } from '@/lib/utils';
import { persianBookingStatus, persianProfessionalStatus } from '@/lib/persian-status';

type WindowKey = 'today' | 'last7Days' | 'last30Days' | 'thisMonth';
const WINDOW_TABS: { key: WindowKey; label: string }[] = [
  { key: 'today', label: 'امروز' },
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
    today: EMPTY_WINDOW,
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
      today: timeStats.today ?? EMPTY_WINDOW,
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAdminDashboard();
        if (!cancelled) setData(normalizeDashboard(res));
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
                { key: 'other', color: '#D1D5DB', name: 'سایر' },
              ]}
            />
          ) : (
            <p className="py-8 text-center text-sm text-gray">داده‌ای نیست</p>
          )}
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="font-bold text-foreground">موارد نیازمند توجه</h2>
        {pending.professionalsAwaitingReview === 0 && pending.pendingPayments === 0 && pending.failedPayments === 0 ? (
          <p className="text-sm text-gray">در حال حاضر موردی نیاز به بررسی ندارد.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {pending.professionalsAwaitingReview > 0 && (
              <Link href="/admin/professionals" className="rounded-xl border border-coral/20 bg-coral-soft px-4 py-3">
                <p className="text-lg font-bold text-coral">{fmt(pending.professionalsAwaitingReview)}</p>
                <p className="mt-0.5 text-xs text-gray">زیباگر در انتظار بررسی</p>
              </Link>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">زیباگرهای اخیر</h2>
            <Link href="/admin/professionals" className="text-xs font-medium text-blue hover:underline">مشاهده همه</Link>
          </div>
          {recent.professionals.length === 0 ? (
            <p className="text-sm text-gray">هنوز زیباگری نیست.</p>
          ) : (
            <ul className="space-y-2">
              {recent.professionals.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.title || p.displayName || '—'}</span>
                  <span className="text-xs text-gray">{persianProfessionalStatus(p.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">کاربران اخیر</h2>
            <Link href="/admin/users" className="text-xs font-medium text-blue hover:underline">مشاهده همه</Link>
          </div>
          {recent.users.length === 0 ? (
            <p className="text-sm text-gray">هنوز کاربری نیست.</p>
          ) : (
            <ul className="space-y-2">
              {recent.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between text-sm">
                  <span>{u.displayName || u.phone || '—'}</span>
                  <span className="text-xs text-gray">{formatDate(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">رزروهای اخیر</h2>
            <Link href="/admin/bookings" className="text-xs font-medium text-blue hover:underline">مشاهده همه</Link>
          </div>
          {recent.bookings.length === 0 ? (
            <p className="text-sm text-gray">هنوز رزروی نیست.</p>
          ) : (
            <ul className="space-y-2">
              {recent.bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between text-sm">
                  <span>{b.professionalTitle || '—'} / {b.customerName || '—'}</span>
                  <span className="text-xs text-gray">{persianBookingStatus(b.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-3">
          <h2 className="font-bold text-foreground">نظرات اخیر</h2>
          {recent.reviews.length === 0 ? (
            <p className="text-sm text-gray">هنوز نظری نیست.</p>
          ) : (
            <ul className="space-y-2">
              {recent.reviews.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span>{r.professionalTitle || '—'}</span>
                  <span className="text-xs text-gray">{fmt(r.rating)} ⭐</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {recentActivity.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">فعالیت اخیر</h2>
            <Link href="/admin/audit" className="text-xs font-medium text-blue hover:underline">مشاهده همه</Link>
          </div>
          <ul className="divide-y divide-border/70">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{a.actor || 'سیستم'}</span> — {a.action} ({a.entityType})
                </span>
                <span className="text-xs text-gray">{formatDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
