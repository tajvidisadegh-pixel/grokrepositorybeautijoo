'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

/**
 * #83.3 — «گزارش تخلف» روی پروفایل زیباگر → تیکت پشتیبانی ادمین
 * (به‌جای mailto ناکارآمد)
 */
export function ReportProfileButton({
  slug,
  title,
}: {
  slug: string;
  title?: string | null;
}) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const body = text.trim();
    if (body.length < 5) {
      setErr('لطفاً حداقل چند کلمه درباره تخلف بنویسید.');
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiClient.post('/support/tickets', {
        subject: `گزارش تخلف پروفایل: ${title || slug}`.slice(0, 120),
        body: `پروفایل: /professionals/${slug}\n\n${body}`.slice(0, 4000),
        source: 'profile_report',
      });
      setMsg('گزارش شما ارسال شد و به‌زودی مورد بررسی قرار خواهد گرفت.');
      setText('');
      setOpen(false);
    } catch (e) {
      setErr(
        e instanceof ApiError
          ? e.message
          : 'ارسال گزارش ناموفق بود. دوباره تلاش کنید.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <p className="mt-4 text-center text-xs text-gray-muted">
        تخلف مشاهده کردید؟{' '}
        <Link
          href={`/login?next=${encodeURIComponent(`/professionals/${slug}`)}`}
          className="text-coral underline"
        >
          وارد شوید و گزارش دهید
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-4 text-center text-xs text-gray-muted">
      {msg && (
        <p className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800">{msg}</p>
      )}
      {err && (
        <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-red-700">{err}</p>
      )}
      {!open ? (
        <p>
          تخلف مشاهده کردید؟{' '}
          <button
            type="button"
            className="text-coral underline"
            onClick={() => setOpen(true)}
          >
            گزارش تخلف
          </button>
        </p>
      ) : (
        <div className="mx-auto max-w-md space-y-2 rounded-2xl border border-border bg-white p-3 text-right shadow-sm">
          <p className="text-sm font-medium text-foreground">گزارش تخلف به پشتیبانی</p>
          <textarea
            className="w-full rounded-xl border border-border px-3 py-2 text-sm"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="شرح کوتاه تخلف…"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="button" size="sm" loading={busy} onClick={() => void submit()}>
              ارسال گزارش
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
