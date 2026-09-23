'use client';

import { useAuth } from '@/contexts/auth-context';
import { getImpersonationMeta } from '@/lib/impersonation-storage';
import { useMemo, useState } from 'react';

/** Persistent banner while SUPER_ADMIN views site as a customer (issue #22). */
export function ImpersonationBanner() {
  const { user, stopImpersonation, isImpersonating } = useAuth();
  const [busy, setBusy] = useState(false);
  const meta = useMemo(() => getImpersonationMeta(), [user?.id, isImpersonating]);

  const active = isImpersonating || !!user?.isImpersonating || !!meta;
  if (!active) return null;

  const name =
    meta?.customerName ||
    user?.profile?.displayName ||
    meta?.customerPhone ||
    user?.phone ||
    'مشتری';

  async function onExit() {
    setBusy(true);
    try {
      await stopImpersonation();
      if (typeof window !== 'undefined') {
        window.location.href = '/admin/users';
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] border-b border-amber-600 bg-amber-500 px-3 py-2 text-center text-sm font-medium text-amber-950 shadow-md"
    >
      <span className="ml-2">⚠️ در حال مشاهده حساب «{name}» به‌عنوان مدیر هستید</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onExit()}
        className="mr-3 rounded-lg bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-black disabled:opacity-60"
      >
        {busy ? '…' : 'بازگشت به حساب مدیر'}
      </button>
    </div>
  );
}
