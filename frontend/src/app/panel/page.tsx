'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import {
  fetchMyBookings,
  fetchUnreadCount,
  type BookingListItem,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { persianBookingStatus } from '@/lib/persian-status';
import { formatDate } from '@/lib/utils';

export default function PanelDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextBooking, setNextBooking] = useState<BookingListItem | null>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [bookings, unreadRes] = await Promise.all([
          fetchMyBookings(1, 20).catch(() => ({
            items: [] as BookingListItem[],
          })),
          fetchUnreadCount().catch(() => ({ count: 0 })),
        ]);
        if (c) return;
        const items = Array.isArray(bookings.items) ? bookings.items : [];
        setBookingCount(items.length);
        const now = Date.now();
        const upcoming = items
          .filter((b) => {
            const st = (b.status || '').toLowerCase();
            if (st === 'cancelled' || st === 'rejected' || st === 'completed') {
              return false;
            }
            const t0 = new Date(b.startAt).getTime();
            return Number.isFinite(t0) && t0 >= now - 3600_000;
          })
          .sort(
            (a, b) =>
              new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
          );
        setNextBooking(upcoming[0] || null);
        setUnread(unreadRes.count ?? 0);
      } catch (e) {
        if (!c) setError(friendlyApiError(e));
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const name = user?.profile?.displayName || user?.phone || 'کاربر';
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;

  const nextPro =
    nextBooking?.professional?.user?.profile?.displayName ||
    nextBooking?.professional?.title ||
    'زیباگر';
  const nextService =
    nextBooking?.items?.[0]?.service?.name ||
    nextBooking?.services?.[0]?.name ||
    'نوبت';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-coral px-5 py-6 text-white shadow-sm sm:rounded-3xl sm:px-6">
        <h1 className="text-xl font-bold sm:text-2xl">سلام، {name}</h1>
        <p className="mt-1 text-sm text-white/85">
          مدیریت رزروها، علاقه‌مندی‌ها و اعلان‌ها
        </p>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold text-foreground">رزرو بعدی من</h2>
        {nextBooking ? (
          <>
            <p className="text-sm font-medium text-foreground">
              {nextService} با {nextPro}
            </p>
            <p className="text-sm text-gray">
              {formatDate(nextBooking.startAt, {
                style: 'long',
                includeTime: true,
              })}
            </p>
            {nextBooking.location?.city && (
              <p className="text-xs text-gray">📍 {nextBooking.location.city}</p>
            )}
            <p className="text-xs text-gray">
              وضعیت: {persianBookingStatus(nextBooking.status)}
            </p>
            <Link href={`/booking/confirmation/${nextBooking.id}`}>
              <Button size="sm">جزئیات رزرو</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-gray">
              {bookingCount > 0
                ? 'رزرو آینده‌ای ندارید'
                : 'هنوز رزروی ثبت نشده است'}
            </p>
            <Link href="/search">
              <Button size="sm">جستجوی زیباگر</Button>
            </Link>
          </>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold text-foreground">رزروها</h2>
          <p className="text-sm text-gray">
            {bookingCount > 0
              ? `${bookingCount} مورد در فهرست اخیر`
              : 'هنوز رزروی نیست'}
          </p>
          <Link href="/panel/bookings">
            <Button size="sm">مشاهده همه</Button>
          </Link>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold text-foreground">اعلان‌ها</h2>
          <p className="text-sm text-gray">
            {unread > 0
              ? `${unread} اعلان خوانده‌نشده`
              : 'اعلان خوانده‌نشده‌ای نیست'}
          </p>
          <Link href="/panel/notifications">
            <Button size="sm" variant="secondary">
              مشاهده اعلان‌ها
            </Button>
          </Link>
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">جستجوی زیباگر</h2>
          <p className="text-sm text-gray">رزرو نوبت جدید یا نزدیک من</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/search">
            <Button variant="secondary">جستجو</Button>
          </Link>
          <Link href="/search?sort=distance">
            <Button>📍 نزدیک من</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
