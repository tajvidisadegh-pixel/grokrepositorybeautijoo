import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'وضعیت سامانه', description: 'وضعیت سرویس‌های بیوتی‌جو' };

type Health = { status?: string; database?: string; storage?: string; appVersion?: string; timestamp?: string };

async function fetchHealth(): Promise<Health | null> {
  const base = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '';
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/health`, { next: { revalidate: 30 }, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as Health;
  } catch { return null; }
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3">
      <span className="font-medium">{label}</span>
      <span className={ok ? 'text-emerald-700' : 'text-red-600'}>{ok ? 'سالم' : 'مختل'}{detail ? ` · ${detail}` : ''}</span>
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
      <Row label="ذخیره‌سازی" ok={h?.storage === 'up' || h?.storage === 'unconfigured'} detail={h?.storage || 'نامشخص'} />
      <Row label="پرداخت / پیامک" ok={apiOk} detail="وابسته به API" />
      {h?.timestamp && <p className="text-center text-xs text-gray-muted" dir="ltr">{h.timestamp}</p>}
    </main>
  );
}
