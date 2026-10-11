import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'وضعیت سامانه',
  description: 'وضعیت سرویس‌های بیوتی‌جو',
};

/** Never SSG against live API during CI/Liara build (was hanging 60s×3 → red CI) */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Health = {
  status?: string;
  database?: string;
  storage?: string;
  appVersion?: string;
  timestamp?: string;
  payment?: string;
  sms?: string;
};

async function fetchHealth(): Promise<Health | null> {
  const base = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '';
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/health`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3">
      <span className="font-medium">{label}</span>
      <span className={ok ? 'text-emerald-700' : 'text-red-600'}>
        {ok ? 'سالم' : 'مختل'}
        {detail ? ` · ${detail}` : ''}
      </span>
    </div>
  );
}

export default async function StatusPage() {
  const h = await fetchHealth();
  const apiOk = !!h && h.status !== 'degraded' && h.database !== 'down';
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-12" dir="rtl">
      <h1 className="text-2xl font-bold text-blue">وضعیت سامانه بیوتی‌جو</h1>
      <p className="text-sm text-gray">بروزرسانی تقریبی هر ۳۰ ثانیه</p>
      <Row label="API" ok={apiOk} detail={h?.appVersion} />
      <Row label="پایگاه داده" ok={h?.database === 'up'} detail={h?.database} />
      <Row
        label="ذخیره‌سازی"
        ok={h?.storage === 'up' || h?.storage === 'unconfigured'}
        detail={h?.storage || 'نامشخص'}
      />
      <Row
        label="پرداخت"
        ok={h?.payment === 'up' || h?.payment === 'configured' || (apiOk && !h?.payment)}
        detail={h?.payment || 'از health'}
      />
      <Row
        label="پیامک"
        ok={
          h?.sms === 'up' ||
          h?.sms === 'mock' ||
          h?.sms === 'configured' ||
          (apiOk && !h?.sms)
        }
        detail={h?.sms || 'از health'}
      />
      {h?.timestamp && (
        <p className="text-center text-xs text-gray-muted" dir="ltr">
          {h.timestamp}
        </p>
      )}
    </main>
  );
}
