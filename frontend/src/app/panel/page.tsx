'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { fetchMyBookings, fetchUnreadCount } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';

export default function PanelDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [bookings, unreadRes] = await Promise.all([
          fetchMyBookings(1, 5).catch(() => ({ items: [] as { id: string }[], meta: { total: 0 } })),
          fetchUnreadCount().catch(() => ({ count: 0 })),
        ]);
        if (c) return;
        setBookingCount(Array.isArray(bookings.items) ? bookings.items.length : 0);
        setUnread(unreadRes.count ?? 0);
      } catch (e) { if (!c) setError(friendlyApiError(e)); }
      finally { if (!c) setLoading(false); }
    })();
    return () => { c = true; };
  }, []);
  const name = user?.profile?.displayName || user?.phone || 'کاربر';
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-coral px-5 py-6 text-white shadow-sm sm:rounded-3xl sm:px-6">
        <h1 className="text-xl font-bold sm:text-2xl">سلام، {name}</h1>
        <p className="mt-1 text-sm text-white/85">مدیریت رزروها، علاقه‌مندی‌ها و اعلان‌ها</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold text-foreground">رزروهای اخیر</h2>
          <p className="text-sm text-gray">{bookingCount > 0 ? `${bookingCount} مورد در صفحه اول` : 'هنوز رزروی ثبت نشده است'}</p>
          <Link href="/panel/bookings"><Button size="sm">مشاهده رزروها</Button></Link>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold text-foreground">اعلان‌ها</h2>
          <p className="text-sm text-gray">{unread > 0 ? `${unread} اعلان خوانده‌نشده` : 'اعلان خوانده‌نشدهای نیست'}</p>
          <Link href="/panel/notifications"><Button size="sm" variant="secondary">مشاهده اعلان‌ها</Button></Link>
        </Card>
      </div>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">جستجوی زیباگر</h2>
          <p className="text-sm text-gray">رزرو نوبت جدید</p>
        </div>
        <Link href="/professionals"><Button>مشاهده زیباگرها</Button></Link>
      </Card>
    </div>
  );
}
