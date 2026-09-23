#!/usr/bin/env python3
"""Issue #25 minimal UX fixes — no big rewrite."""
from pathlib import Path

def patch_confirmation():
    p = Path('frontend/src/app/booking/confirmation/[id]/page.tsx')
    t = p.read_text()
    if 'persianPaymentStatus' in t and 'رزرو شما نهایی شده' in t:
        print('confirmation already')
        return
    if "from '@/lib/booking-api'" in t and 'persianPaymentStatus' not in t:
        t = t.replace(
            "import { getBooking, persianBookingStatus } from '@/lib/booking-api';",
            "import { getBooking, persianBookingStatus } from '@/lib/booking-api';\nimport { persianPaymentStatus } from '@/lib/persian-status';",
        )
    # Replace main body return for clearer status
    old = '''  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold">جزئیات رزرو</h1>
      <Card className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-gray">وضعیت</span>
          <span className="font-bold">
            {persianBookingStatus(booking.status)}
          </span>
        </div>'''
    new = '''  const payStatus = booking.payment?.status || '';
  const isPaid = payStatus === 'paid';
  const payFailed = payStatus === 'failed' || payStatus === 'cancelled';
  const awaitingPay = !isPaid && !payFailed;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold">
        {isPaid
          ? 'رزرو شما با موفقیت ثبت شد'
          : payFailed
            ? 'پرداخت انجام نشد'
            : 'بررسی و وضعیت رزرو'}
      </h1>
      {isPaid && (
        <p className="mt-2 text-sm text-emerald-700">
          پرداخت از سرور تأیید شده و رزرو شما نهایی است.
        </p>
      )}
      {payFailed && (
        <p className="mt-2 text-sm text-red-700">
          پرداخت انجام نشد و رزرو شما نهایی نشده است. در صورت نیاز دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.
        </p>
      )}
      {awaitingPay && (
        <p className="mt-2 text-sm text-amber-800">
          رزرو هنوز در انتظار پرداخت یا تأیید است. موفقیت فقط پس از تأیید سرور اعلام می‌شود.
        </p>
      )}
      <Card className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-gray">وضعیت رزرو</span>
          <span className="font-bold">
            {persianBookingStatus(booking.status)}
          </span>
        </div>'''
    if old not in t:
        print('WARN confirmation header block not exact')
    else:
        t = t.replace(old, new, 1)

    t = t.replace(
        '''        {booking.payment && (
          <div className="flex justify-between gap-2 border-t border-border pt-3">
            <span className="text-gray">وضعیت پرداخت</span>
            <span>{booking.payment.status}</span>
          </div>
        )}
        {!booking.payment && (
          <p className="border-t border-border pt-3 text-xs text-gray">
            هنوز رکورد پرداخت تأییدشده‌ای از سرور گزارش نشده است.
          </p>
        )}
        <p className="text-xs text-gray" dir="ltr">
          ID: {booking.id}
        </p>''',
        '''        <div className="flex justify-between gap-2 border-t border-border pt-3">
          <span className="text-gray">وضعیت پرداخت</span>
          <span className="font-medium">
            {booking.payment
              ? persianPaymentStatus(booking.payment.status)
              : 'هنوز پرداختی از سرور تأیید نشده'}
          </span>
        </div>''',
        1,
    )
    # Add panel link
    t = t.replace(
        '''        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-2xl bg-coral px-5 text-sm font-medium text-white"
        >
          صفحه اصلی
        </Link>''',
        '''        <Link
          href="/panel/bookings"
          className="inline-flex h-11 items-center rounded-2xl bg-coral px-5 text-sm font-medium text-white"
        >
          رزروهای من
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-2xl border border-border px-5 text-sm"
        >
          صفحه اصلی
        </Link>''',
        1,
    )
    p.write_text(t)
    print('confirmation ok')

def patch_wizard_done():
    p = Path('frontend/src/components/booking/booking-wizard.tsx')
    t = p.read_text()
    if 'رزرو ذخیره شد — هنوز نهایی نیست' in t:
        print('wizard already')
        return
    t = t.replace(
        "pay.redirectUrl\n            ? 'درخواست پرداخت ثبت شد. درگاه واقعی پس از اتصال فعال می‌شود.'\n            : 'رزرو ذخیره شد. وضعیت پرداخت پس از پیکربندی درگاه از سرور به‌روز می‌شود.',",
        "pay.redirectUrl\n            ? 'درخواست پرداخت ثبت شد. در صورت فعال بودن درگاه به صفحه پرداخت هدایت می‌شوید.'\n            : 'رزرو ذخیره شد اما هنوز نهایی نیست — پرداخت از سرور تأیید نشده است.',",
    )
    t = t.replace(
        "setPaymentInfo('رزرو ذخیره شد. شروع پرداخت در دسترس نیست یا نیاز به پیکرباری درگاه دارد.');",
        "setPaymentInfo('رزرو ذخیره شد اما نهایی نیست. پرداخت آنلاین فعلاً در دسترس نیست یا نیاز به پیکربندی درگاه دارد.');",
    )
    # fix possible typo in my replace - check original
    t = t.replace(
        "setPaymentInfo('رزرو ذخیره شد. شروع پرداخت در دسترس نیست یا نیاز به پیکربندی درگاه دارد.');",
        "setPaymentInfo('رزرو ذخیره شد اما نهایی نیست. پرداخت آنلاین فعلاً در دسترس نیست یا نیاز به پیکربندی درگاه دارد.');",
    )
    t = t.replace(
        '''      {step === 'done' && booking && (
        <Card className="mt-6 space-y-4 text-center">
          <h2 className="text-xl font-bold text-coral">رزرو ثبت شد</h2>
          <p className="text-sm text-gray">
            وضعیت سرور: <strong>{persianBookingStatus(booking.status)}</strong>
          </p>
          <p className="text-sm font-bold text-coral">{formatPrice(booking.totalPrice)}</p>
          {paymentInfo && (
            <p className="rounded-xl bg-gray-light px-3 py-3 text-sm text-gray">{paymentInfo}</p>
          )}
          <p className="text-xs text-gray">
            موفقیت پرداخت فقط پس از تأیید سرور/درگاه — هرگز توسط کلاینت ادعا نمی‌شود.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/booking/confirmation/${booking.id}`}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-coral px-6 text-sm font-medium text-white"
            >
              جزئیات رزرو
            </Link>''',
        '''      {step === 'done' && booking && (
        <Card className="mt-6 space-y-4 text-center">
          <h2 className="text-xl font-bold text-coral">رزرو ذخیره شد — هنوز نهایی نیست</h2>
          <p className="text-sm text-gray">
            وضعیت رزرو: <strong>{persianBookingStatus(booking.status)}</strong>
          </p>
          <p className="text-sm font-bold text-coral">{formatPrice(booking.totalPrice)}</p>
          {paymentInfo && (
            <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900">{paymentInfo}</p>
          )}
          <p className="text-xs text-gray">
            رزرو فقط پس از تأیید پرداخت از سرور قطعی می‌شود. موفقیت را از روی ظاهر مرورگر فرض نکنید.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/booking/confirmation/${booking.id}`}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-coral px-6 text-sm font-medium text-white"
            >
              بررسی وضعیت رزرو
            </Link>''',
    )
    # More flexible replace if whitespace differs
    if 'رزرو ذخیره شد — هنوز نهایی نیست' not in t:
        t = t.replace('رزرو ثبت شد', 'رزرو ذخیره شد — هنوز نهایی نیست', 1)
        t = t.replace('وضعیت سرور:', 'وضعیت رزرو:', 1)
        t = t.replace(
            'موفقیت پرداخت فقط پس از تأیید سرور/درگاه — هرگز توسط کلاینت ادعا نمی‌شود.',
            'رزرو فقط پس از تأیید پرداخت از سرور قطعی می‌شود. موفقیت را از روی ظاهر مرورگر فرض نکنید.',
            1,
        )
        t = t.replace('>جزئیات رزرو<', '>بررسی وضعیت رزرو<', 1)
    # summary CTA
    t = t.replace(
        "{isAuthenticated ? 'ثبت رزرو' : 'ورود و ثبت رزرو'}",
        "{isAuthenticated ? 'ادامه به پرداخت' : 'ورود و ادامه'}",
        1,
    )
    p.write_text(t)
    print('wizard ok')

def patch_card():
    p = Path('frontend/src/components/professionals/professional-card.tsx')
    t = p.read_text()
    if 'زیباگر تأییدشده' in t:
        print('card already')
        return
    # After featured badge block, add verified (public list is approved-only)
    old = '''            {pro.isFeatured && (
              <span className="shrink-0 rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-medium text-coral sm:text-xs">
                ویژه
              </span>
            )}'''
    new = '''            <div className="flex shrink-0 flex-col items-end gap-1">
              {pro.isFeatured && (
                <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-medium text-coral sm:text-xs">
                  ویژه
                </span>
              )}
              {(pro.status === 'approved' || !pro.status) && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 sm:text-xs">
                  ✓ تأییدشده
                </span>
              )}
            </div>'''
    if old not in t:
        raise SystemExit('card featured block missing')
    t = t.replace(old, new, 1)
    # CTA clearer
    t = t.replace('مشاهده پروفایل و رزرو', 'مشاهده پروفایل', 1)
    p.write_text(t)
    print('card ok')

def patch_profile():
    p = Path('frontend/src/app/professionals/[slug]/page.tsx')
    t = p.read_text()
    if 'زیباگر تأییدشده بیوتی‌جو' in t:
        print('profile already')
        return
    old = '''                <h1 className="text-xl font-bold text-blue sm:text-2xl">{name}</h1>
                {pro.title && pro.title !== name && (
                  <p className="mt-1 text-sm text-gray">{pro.title}</p>
                )}'''
    new = '''                <h1 className="text-xl font-bold text-blue sm:text-2xl">{name}</h1>
                {(pro.status === 'approved' || pro.verifiedAt) && (
                  <p className="mt-1 text-xs font-medium text-emerald-700">✓ زیباگر تأییدشده بیوتی‌جو</p>
                )}
                {pro.title && pro.title !== name && (
                  <p className="mt-1 text-sm text-gray">{pro.title}</p>
                )}'''
    if old not in t:
        print('WARN profile header not found')
    else:
        t = t.replace(old, new, 1)
    p.write_text(t)
    print('profile ok')

def patch_panel():
    p = Path('frontend/src/app/panel/page.tsx')
    t = p.read_text()
    if 'رزرو بعدی من' in t:
        print('panel already')
        return
    # Expand to show next upcoming booking
    if "import { useAuth }" not in t and "useAuth" in t:
        pass
    # Replace fetch and UI
    t2 = r'''"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { fetchMyBookings, type BookingListItem } from '@/lib/panel-api';
import { fetchUnreadCount } from '@/lib/panel-api';
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
          fetchMyBookings(1, 20).catch(() => ({ items: [] as BookingListItem[], meta: { total: 0 } })),
          fetchUnreadCount().catch(() => ({ count: 0 })),
        ]);
        if (c) return;
        const items = Array.isArray(bookings.items) ? bookings.items : [];
        setBookingCount(items.length);
        const now = Date.now();
        const upcoming = items
          .filter((b) => {
            const st = (b.status || '').toLowerCase();
            if (st === 'cancelled' || st === 'rejected' || st === 'completed') return false;
            const t0 = new Date(b.startAt).getTime();
            return Number.isFinite(t0) && t0 >= now - 3600_000;
          })
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
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
    nextBooking?.items?.[0]?.serviceName ||
    'نوبت';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-coral px-5 py-6 text-white shadow-sm sm:rounded-3xl sm:px-6">
        <h1 className="text-xl font-bold sm:text-2xl">سلام، {name}</h1>
        <p className="mt-1 text-sm text-white/85">مدیریت رزروها، علاقه‌مندی‌ها و اعلان‌ها</p>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold text-foreground">رزرو بعدی من</h2>
        {nextBooking ? (
          <>
            <p className="text-sm font-medium text-foreground">
              {nextService} با {nextPro}
            </p>
            <p className="text-sm text-gray">
              {formatDate(nextBooking.startAt, { style: 'long', includeTime: true })}
            </p>
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
              {bookingCount > 0 ? 'رزرو آینده‌ای ندارید' : 'هنوز رزروی ثبت نشده است'}
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
            {bookingCount > 0 ? `${bookingCount} مورد در فهرست اخیر` : 'هنوز رزروی نیست'}
          </p>
          <Link href="/panel/bookings">
            <Button size="sm">مشاهده همه</Button>
          </Link>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold text-foreground">اعلان‌ها</h2>
          <p className="text-sm text-gray">
            {unread > 0 ? `${unread} اعلان خوانده‌نشده` : 'اعلان خوانده‌نشده‌ای نیست'}
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
'''
    # Fix potential serviceName - check BookingListItem
    p.write_text(t2)
    print('panel ok')

def patch_home_near_me():
    p = Path('frontend/src/app/page.tsx')
    t = p.read_text()
    if 'نزدیک من' in t and '/search?sort=distance' in t:
        print('home near-me already')
        return
    # Add a quick link after first search form submit button area - minimal: after categories section title is hard.
    # Insert a small strip before categories section case
    needle = "case 'categories':"
    if needle not in t:
        print('WARN no categories case')
        return
    insert = '''      case 'near-me-strip':
        return (
          <section key="near-me-strip" className="mx-auto max-w-6xl px-4 pb-2 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-coral/30 bg-coral-soft/40 px-4 py-3 sm:px-5">
              <p className="text-sm text-foreground">
                <span className="font-medium">📍 نزدیک من</span>
                <span className="text-gray"> — زیباگرهای اطراف موقعیت شما</span>
              </p>
              <Link
                href="/search?sort=distance"
                className="inline-flex h-10 items-center rounded-2xl bg-coral px-4 text-sm font-medium text-white hover:bg-coral-dark"
              >
                جستجوی نزدیک
              </Link>
            </div>
          </section>
        );
'''
    t = t.replace(needle, insert + '\n      ' + needle, 1)
    # Ensure near-me-strip is in ordered sections if ordered list is static default
    if "(['hero', 'categories', 'featured', 'cta']" in t:
        t = t.replace(
            "(['hero', 'categories', 'featured', 'cta']",
            "(['hero', 'near-me-strip', 'categories', 'featured', 'cta']",
            1,
        )
    p.write_text(t)
    print('home ok')

def patch_types_verified():
    p = Path('frontend/src/types/public.ts')
    t = p.read_text()
    if 'verifiedAt' in t:
        print('types ok')
        return
    t = t.replace(
        '  status?: string;',
        "  status?: string;\n  verifiedAt?: string | null;",
        1,
    )
    p.write_text(t)
    print('types ok')

def main():
    patch_confirmation()
    patch_wizard_done()
    patch_card()
    patch_profile()
    patch_panel()
    patch_home_near_me()
    patch_types_verified()
    print('issue25 patches done')

if __name__ == '__main__':
    main()
