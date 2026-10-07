'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { CompletionBar } from '@/components/profile/completion-bar';
import {
  fetchMyProfessional,
  publishMyProfessional,
  unpublishMyProfessional,
  updateMyProfessional,
  resolveMediaUrl,
  type OwnProfessional,
  type SocialLinks,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { persianProfessionalStatus } from '@/lib/persian-status';
import { formatPrice } from '@/lib/utils';

const DAY_FA: Record<string, string> = {
  saturday: 'شنبه',
  sunday: 'یکشنبه',
  monday: 'دوشنبه',
  tuesday: 'سه‌شنبه',
  wednesday: 'چهارشنبه',
  thursday: 'پنجشنبه',
  friday: 'جمعه',
};

export default function ZibagarProfilePage() {
  const { user, loading: authLoading, reload } = useAuth();
  const [pro, setPro] = useState<OwnProfessional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [socialForm, setSocialForm] = useState<SocialLinks>({});
  const [socialBusy, setSocialBusy] = useState(false);
  const [socialMsg, setSocialMsg] = useState<string | null>(null);
  const [socialDirty, setSocialDirty] = useState(false);
  useEffect(() => {
    if (!socialDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [socialDirty]);


  useEffect(() => {
    if (authLoading || !user) return;
    let c = false;
    (async () => {
      try {
        const data = await fetchMyProfessional();
        if (!c) {
          setPro(data);
          const sl = (data as OwnProfessional).socialLinks || {};
          setSocialForm({
            instagram: sl.instagram || '',
            telegram: sl.telegram || '',
            website: sl.website || '',
            phone: sl.phone || '',
            whatsapp: sl.whatsapp || '',
          });
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
  }, [authLoading, user]);

  if (authLoading || loading) return <PanelLoading />;
  if (error && !pro) return <PanelError message={error} />;
  if (!user) return null;

  const percent = pro?.completion?.percent ?? 0;
  const complete = pro?.completion?.complete ?? false;
  const published = pro?.status === 'approved';

  async function doPublish() {
    setBusy(true);
    setError(null);
    try {
      setPro(await publishMyProfessional());
      setMsg('پروفایل منتشر شد');
      setConfirm(false);
      await reload();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function doUnpublish() {
    setBusy(true);
    setError(null);
    try {
      setPro(await unpublishMyProfessional());
      setMsg('انتشار لغو شد — پروفایل به پیش‌نویس بازگشت');
      await reload();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  const name =
    pro?.user?.profile?.displayName || pro?.title || user.profile?.displayName || 'زیباگر';
  const avatar = resolveMediaUrl(
    pro?.user?.profile?.avatarUrl || pro?.logoUrl || user.profile?.avatarUrl,
  );
  const cover = resolveMediaUrl(pro?.coverImageUrl);
  const city = pro?.locations?.[0]?.location?.city;
  const services = (pro?.professionalServices || []).filter((s) => s.isActive !== false);
  const hours = pro?.workingHours || [];
  const locations = pro?.locations || [];

  async function saveSocialLinks() {
    // clear dirty after save
    setSocialBusy(true);
    setSocialMsg(null);
      setSocialDirty(false);
    setError(null);
    try {
      const payload: SocialLinks = {};
      for (const k of ['instagram', 'telegram', 'website', 'phone', 'whatsapp'] as const) {
        const v = (socialForm[k] || '').trim();
        if (v) payload[k] = v;
      }
      const updated = await updateMyProfessional({ socialLinks: payload });
      setPro(updated);
      setSocialMsg('لینک‌ها ذخیره شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setSocialBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">پروفایل زیباگر</h1>
          <p className="mt-1 text-sm text-gray">
            پیش‌نمایش صفحه عمومی — از همین‌جا بخش‌ها را ویرایش کنید
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pro?.slug && published && (
            <Link href={`/professionals/${pro.slug}`} target="_blank">
              <Button size="sm" variant="outline">
                مشاهده عمومی
              </Button>
            </Link>
          )}
          <Link href="/zibagar/profile/preview">
            <Button size="sm" variant="secondary">
              پیش‌نمایش کامل
            </Button>
          </Link>
        </div>
      </div>

      {msg && <p className="text-sm text-coral">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card className="space-y-3">
        {published ? (
          <>
            <p className="text-base font-semibold text-blue">پروفایل منتشر شده ✓</p>
            <CompletionBar percent={percent} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" loading={busy} onClick={doUnpublish}>
                لغو انتشار
              </Button>
              <Link href="/zibagar/profile/complete">
                <Button size="sm" variant="secondary">
                  ویرایش اطلاعات پایه
                </Button>
              </Link>
            </div>
          </>
        ) : complete ? (
          <>
            <p className="text-base font-semibold text-blue">اطلاعات پروفایل کامل است ✓</p>
            <CompletionBar percent={percent} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setConfirm(true)}>
                انتشار پروفایل
              </Button>
              <Link href="/zibagar/profile/complete">
                <Button variant="outline" size="sm">
                  ویرایش
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-base font-semibold">تکمیل پروفایل — {percent}%</p>
            <CompletionBar percent={percent} fields={pro?.completion?.fields} showFields />
            <p className="text-sm text-gray">پروفایل شما هنوز آماده انتشار نیست.</p>
            <Link href="/zibagar/profile/complete">
              <Button size="sm">ادامه تکمیل پروفایل</Button>
            </Link>
          </>
        )}
      </Card>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-gray-light/50 px-4 py-2 text-xs text-gray">
          <span>پیش‌نمایش صفحه عمومی</span>
          <span>وضعیت: {pro ? persianProfessionalStatus(pro.status) : '—'}</span>
        </div>

        <div
          className="h-36 bg-gradient-to-l from-coral/30 to-blue/20 sm:h-44"
          style={
            cover
              ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        />
        <div className="relative space-y-5 px-4 pb-6 sm:px-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-gray-light text-2xl font-bold text-blue">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  (name || 'ز')[0]
                )}
              </div>
              <div className="pb-1">
                <h2 className="text-xl font-bold">{name}</h2>
                <p className="text-sm text-gray">
                  {pro?.title}
                  {city ? ` · ${city}` : ''}
                </p>
              </div>
            </div>
            <Link href="/zibagar/profile/complete">
              <Button size="sm" variant="outline">
                ویرایش هویت / کاور
              </Button>
            </Link>
          </div>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">درباره</h3>
              <Link href="/zibagar/profile/complete" className="text-xs text-blue hover:underline">
                ویرایش
              </Link>
            </div>
            {pro?.bio ? (
              <p className="text-sm leading-7 text-gray-dark">{pro.bio}</p>
            ) : (
              <p className="text-sm text-gray">بیو ثبت نشده — با ویرایش اضافه کنید.</p>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">خدمات و قیمت</h3>
              <Link href="/zibagar/services" className="text-xs text-blue hover:underline">
                ویرایش / افزودن
              </Link>
            </div>
            <Card className="space-y-0 p-0">
              {services.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray">هنوز خدمتی ثبت نشده.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {services.map((s) => (
                    <li key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span>
                        {s.service?.name}{' '}
                        <span className="text-gray">({s.durationMin} دقیقه)</span>
                      </span>
                      <span dir="ltr">{formatPrice(s.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">آدرس</h3>
              <Link href="/zibagar/locations" className="text-xs text-blue hover:underline">
                ویرایش
              </Link>
            </div>
            <Card className="space-y-2">
              {locations.length === 0 ? (
                <p className="text-sm text-gray">آدرسی ثبت نشده.</p>
              ) : (
                locations.map((l, i) => (
                  <p key={i} className="text-sm">
                    {l.location.name} — {l.location.city}
                    <br />
                    <span className="text-gray">{l.location.address}</span>
                  </p>
                ))
              )}
            </Card>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">ساعات کاری</h3>
              <Link href="/zibagar/hours" className="text-xs text-blue hover:underline">
                ویرایش
              </Link>
            </div>
            <Card>
              {hours.length === 0 ? (
                <p className="text-sm text-gray">ساعات کاری ثبت نشده.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {hours.map((h, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{DAY_FA[h.dayOfWeek] || h.dayOfWeek}</span>
                      <span dir="ltr">
                        {h.startTime} – {h.endTime}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">نمونه‌کار</h3>
              <Link href="/zibagar/portfolio" className="text-xs text-blue hover:underline">
                مدیریت گالری
              </Link>
            </div>
            <Card className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray">تصاویر پورتفولیو در صفحه عمومی نمایش داده می‌شوند.</p>
              <Link href="/zibagar/portfolio">
                <Button size="sm" variant="secondary">
                  افزودن / حذف
                </Button>
              </Link>
            </Card>
          </section>
        </div>
      </div>

      <Card className="space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-gray">وضعیت</span>
          <span className="font-medium">{pro ? persianProfessionalStatus(pro.status) : '—'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray">اسلاگ</span>
          <span className="font-medium" dir="ltr">
            {pro?.slug || '—'}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray">عنوان</span>
          <span className="font-medium">{pro?.title || '—'}</span>
        </div>
      </Card>


      <Card className="space-y-3 border-dashed border-border/70 bg-gray-light/20">
        <div>
          <h3 className="text-sm font-medium text-gray">لینک‌های ارتباطی (اختیاری)</h3>
          <p className="mt-0.5 text-xs text-gray-muted">فقط در پایین صفحه عمومی نمایش داده می‌شود</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {([['instagram','اینستاگرام'],['telegram','تلگرام'],['website','وب‌سایت'],['phone','شماره تماس'],['whatsapp','واتساپ']] as const).map(([key,label]) => (
            <label key={key} className="block text-xs text-gray">{label}
              <input className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-coral" dir="ltr"
                value={socialForm[key] || ''} onChange={(e) => setSocialForm((prev) => ({ ...prev, [key]: e.target.value }))} />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" loading={socialBusy} onClick={saveSocialLinks}>ذخیره لینک‌ها</Button>
          {socialMsg && <span className="text-xs text-coral">{socialMsg}</span>}
        </div>
      </Card>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-w-md space-y-4">
            <h3 className="text-lg font-bold">تأیید انتشار</h3>
            <p className="text-sm text-gray">
              پروفایل شما آماده انتشار است. با تأیید، اطلاعات پروفایل برای کاربران عمومی سایت قابل مشاهده خواهد بود.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirm(false)}>
                انصراف
              </Button>
              <Button size="sm" loading={busy} onClick={doPublish}>
                تأیید و انتشار
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
