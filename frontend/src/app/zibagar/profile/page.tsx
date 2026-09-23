'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { CompletionBar } from '@/components/profile/completion-bar';
import {
  fetchMyProfessional, publishMyProfessional, unpublishMyProfessional,
  type OwnProfessional,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { persianProfessionalStatus } from '@/lib/persian-status';

export default function ZibagarProfilePage() {
  const { user, loading: authLoading, reload } = useAuth();
  const [pro, setPro] = useState<OwnProfessional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    let c = false;
    (async () => {
      try {
        const data = await fetchMyProfessional();
        if (!c) setPro(data);
      } catch (e) {
        if (!c) setError(friendlyApiError(e));
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => { c = true; };
  }, [authLoading, user]);

  if (authLoading || loading) return <PanelLoading />;
  if (error && !pro) return <PanelError message={error} />;
  if (!user) return null;

  const percent = pro?.completion?.percent ?? 0;
  const complete = pro?.completion?.complete ?? false;
  const published = pro?.status === 'approved';

  async function doPublish() {
    setBusy(true); setError(null);
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
    setBusy(true); setError(null);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">پروفایل زیباگر</h1>
        <p className="mt-1 text-sm text-gray">وضعیت، تکمیل و انتشار پروفایل</p>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {msg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>}

      <Card className="space-y-4">
        {published ? (
          <>
            <p className="text-base font-semibold text-blue">پروفایل منتشر شده ✓</p>
            <CompletionBar percent={100} />
            <div className="flex flex-wrap gap-2">
              {pro?.slug && (
                <Link href={`/professionals/${pro.slug}`}>
                  <Button size="sm">مشاهده صفحه عمومی</Button>
                </Link>
              )}
              <Link href="/zibagar/profile/preview">
                <Button variant="secondary" size="sm">پیش‌نمایش</Button>
              </Link>
              <Link href="/zibagar/profile/complete">
                <Button variant="outline" size="sm">ویرایش اطلاعات</Button>
              </Link>
              <Button variant="ghost" size="sm" loading={busy} onClick={doUnpublish}>
                لغو انتشار
              </Button>
            </div>
          </>
        ) : complete ? (
          <>
            <p className="text-base font-semibold text-blue">اطلاعات پروفایل کامل است ✓</p>
            <CompletionBar percent={percent} />
            <div className="flex flex-wrap gap-2">
              <Link href="/zibagar/profile/preview">
                <Button variant="secondary" size="sm">مشاهده پیش‌نمایش</Button>
              </Link>
              <Button size="sm" onClick={() => setConfirm(true)}>انتشار پروفایل</Button>
              <Link href="/zibagar/profile/complete">
                <Button variant="outline" size="sm">ویرایش</Button>
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

      <Card className="space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-gray">وضعیت</span>
          <span className="font-medium">{pro ? persianProfessionalStatus(pro.status) : '—'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray">اسلاگ</span>
          <span className="font-medium" dir="ltr">{pro?.slug || '—'}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray">عنوان</span>
          <span className="font-medium">{pro?.title || '—'}</span>
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
              <Button variant="outline" size="sm" onClick={() => setConfirm(false)}>انصراف</Button>
              <Button size="sm" loading={busy} onClick={doPublish}>تأیید و انتشار</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
