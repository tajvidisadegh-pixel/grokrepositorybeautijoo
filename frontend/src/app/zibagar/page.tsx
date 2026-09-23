'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { CompletionBar } from '@/components/profile/completion-bar';
import { FirstBookingGuide } from '@/components/profile/onboarding-tip';
import {
  fetchProBookings,
  fetchMyServices,
  fetchMyProfessional,
  type CompletionField,
  type ProfessionalServiceItem,
} from '@/lib/panel-api';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';

export default function ZibagarDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [servicesMissingPrice, setServicesMissingPrice] = useState(0);
  const [portfolioCount, setPortfolioCount] = useState(0);
  const [percent, setPercent] = useState(0);
  const [complete, setComplete] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [fields, setFields] = useState<CompletionField[]>([]);

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const [bookings, services, pro, mediaRes] = await Promise.all([
          fetchProBookings(1, 5).catch(() => ({ items: [] as unknown[] })),
          fetchMyServices().catch(() => [] as ProfessionalServiceItem[]),
          fetchMyProfessional().catch(() => null),
          apiClient
            .get<{ items?: unknown[] } | unknown[]>('/professionals/me/media?kind=portfolio')
            .catch(() => [] as unknown[]),
        ]);
        if (c) return;
        setBookingCount(bookings.items.length);
        const list = Array.isArray(services) ? services : [];
        setServiceCount(list.length);
        setServicesMissingPrice(
          list.filter((s) => {
            const p = Number(s.price);
            return !Number.isFinite(p) || p <= 0;
          }).length,
        );
        const mediaList = Array.isArray(mediaRes)
          ? mediaRes
          : (mediaRes as { items?: unknown[] })?.items || [];
        setPortfolioCount(mediaList.length);
        if (pro) {
          setPercent(pro.completion?.percent ?? 0);
          setComplete(!!pro.completion?.complete);
          setStatus(pro.status);
          setSlug(pro.slug);
          setFields(pro.completion?.fields ?? []);
        }
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

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} />;
  const title = user?.professional?.title || user?.profile?.displayName || 'زیباگر';
  const published = status === 'approved';
  const showOps = published || complete;

  const needsSpecialty = serviceCount === 0;
  const needsPrice = servicesMissingPrice > 0;
  const needsPortfolio = portfolioCount === 0;
  const showPostPublishNudge =
    published && (needsSpecialty || needsPrice || needsPortfolio);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl bg-coral px-5 py-6 text-white shadow-sm sm:rounded-3xl sm:px-6">
        <h1 className="text-xl font-bold sm:text-2xl">پنل زیباگر</h1>
        <p className="mt-1 text-sm text-white/85">{title}</p>
      </div>

      {published ? (
        <Card className="space-y-3">
          <h2 className="font-semibold text-blue">پروفایل منتشر شده</h2>
          <p className="text-sm text-gray">
            پروفایل شما در سایت قابل مشاهده است. برای جذب رزرو، منو قیمت و نمونه‌کار را کامل کنید.
          </p>
          <div className="flex flex-wrap gap-2">
            {slug && (
              <Link href={`/professionals/${slug}`}>
                <Button size="sm">مشاهده صفحه عمومی</Button>
              </Link>
            )}
            <Link href="/zibagar/profile">
              <Button variant="outline" size="sm">
                مدیریت پروفایل
              </Button>
            </Link>
            <Link href="/zibagar/services">
              <Button size="sm" variant="secondary">
                تخصص‌ها و منو قیمت
              </Button>
            </Link>
            <Link href="/zibagar/portfolio">
              <Button size="sm" variant="secondary">
                نمونه‌کار
              </Button>
            </Link>
          </div>
          {bookingCount === 0 && !showPostPublishNudge && <FirstBookingGuide />}
        </Card>
      ) : complete || percent >= 100 ? (
        <Card className="space-y-3">
          <h2 className="font-semibold text-blue">آماده انتشار</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/zibagar/profile/preview">
              <Button variant="secondary" size="sm">
                پیش‌نمایش
              </Button>
            </Link>
            <Link href="/zibagar/profile/complete">
              <Button size="sm">انتشار</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="space-y-3">
          <h2 className="font-semibold">تکمیل پروفایل — {percent}%</h2>
          <CompletionBar percent={percent} fields={fields} showFields />
          <p className="text-sm text-gray">
            برای نمایش در سایت و دریافت رزرو، ابتدا پروفایل را کامل کنید. هر مرحله در سرور ذخیره می‌شود.
          </p>
          <Link href="/zibagar/profile/complete">
            <Button size="sm">ادامه تکمیل پروفایل</Button>
          </Link>
        </Card>
      )}

      {/* Clear post-publish checklist (issue #27) */}
      {showPostPublishNudge && (
        <Card className="space-y-4 border-amber-200 bg-amber-50/80">
          <div>
            <h2 className="font-semibold text-amber-950">تکمیل منو و نمونه‌کار</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900/90">
              پروفایل منتشر شده؛ برای اینکه مشتری بتواند رزرو کند، این موارد را کامل کنید:
            </p>
          </div>
          <ul className="space-y-3 text-sm text-amber-950">
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2.5">
              <span>
                {needsSpecialty
                  ? '① هنوز تخصصی انتخاب نکرده‌اید'
                  : '① تخصص‌ها انتخاب شده‌اند'}
              </span>
              <Link href="/zibagar/services">
                <Button size="sm" variant={needsSpecialty ? 'primary' : 'secondary'}>
                  {needsSpecialty ? 'افزودن تخصص' : 'مدیریت تخصص‌ها'}
                </Button>
              </Link>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2.5">
              <span>
                {needsPrice
                  ? `② منو قیمت ناقص است (${servicesMissingPrice} تخصص بدون قیمت)`
                  : serviceCount === 0
                    ? '② بعد از انتخاب تخصص، قیمت و مدت را ثبت کنید'
                    : '② منو قیمت تکمیل شده'}
              </span>
              <Link href="/zibagar/services">
                <Button size="sm" variant={needsPrice || needsSpecialty ? 'primary' : 'secondary'}>
                  منو قیمت
                </Button>
              </Link>
            </li>
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2.5">
              <span>
                {needsPortfolio
                  ? '③ نمونه‌کار ندارید — حداقل یک تصویر اضافه کنید'
                  : `③ ${portfolioCount} نمونه‌کار ثبت شده`}
              </span>
              <Link href="/zibagar/portfolio">
                <Button size="sm" variant={needsPortfolio ? 'primary' : 'secondary'}>
                  {needsPortfolio ? 'افزودن نمونه‌کار' : 'پورتفولیو'}
                </Button>
              </Link>
            </li>
          </ul>
        </Card>
      )}

      {showOps && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="space-y-3">
            <h2 className="font-semibold">رزروهای ورودی</h2>
            <p className="text-sm text-gray">
              {bookingCount > 0 ? `${bookingCount} مورد در صفحه اول` : 'رزرو جدیدی نیست'}
            </p>
            <Link href="/zibagar/bookings">
              <Button size="sm">مدیریت رزروها</Button>
            </Link>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">تخصص‌ها و منو قیمت</h2>
            <p className="text-sm text-gray">
              {serviceCount > 0
                ? `${serviceCount} تخصص · ${servicesMissingPrice > 0 ? `${servicesMissingPrice} بدون قیمت` : 'قیمت‌ها ثبت شده'}`
                : 'هنوز تخصصی تعریف نشده — از اینجا اضافه کنید'}
            </p>
            <Link href="/zibagar/services">
              <Button size="sm" variant="secondary">
                مدیریت تخصص و قیمت
              </Button>
            </Link>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">نمونه‌کار</h2>
            <p className="text-sm text-gray">
              {portfolioCount > 0
                ? `${portfolioCount} تصویر در پورتفولیو`
                : 'با افزودن نمونه‌کار اعتماد مشتری بیشتر می‌شود'}
            </p>
            <Link href="/zibagar/portfolio">
              <Button size="sm" variant="secondary">
                مدیریت پورتفولیو
              </Button>
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}
