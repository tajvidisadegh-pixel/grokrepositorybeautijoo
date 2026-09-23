'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  changePassword,
  listSessions,
  revokeSession,
  revokeAllSessions,
  deleteAccount,
  type SessionItem,
} from '@/lib/panel-api';
import { formatDateTime } from '@/lib/utils';

const NOTIF_KEY = 'bj_notif_prefs';

type NotifPrefs = {
  bookingSms: boolean;
  bookingPush: boolean;
  marketing: boolean;
};

const defaultPrefs: NotifPrefs = {
  bookingSms: true,
  bookingPush: true,
  marketing: false,
};

function loadPrefs(): NotifPrefs {
  if (typeof window === 'undefined') return defaultPrefs;
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return defaultPrefs;
    return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    return defaultPrefs;
  }
}

function savePrefs(p: NotifPrefs) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(p));
}

export default function PanelSettingsPage() {
  const { logout, user } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessLoading, setSessLoading] = useState(true);
  const [sessMsg, setSessMsg] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<NotifPrefs>(defaultPrefs);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [delMsg, setDelMsg] = useState<string | null>(null);
  const [delErr, setDelErr] = useState<string | null>(null);
  const [delLoading, setDelLoading] = useState(false);

  const refreshSessions = useCallback(async () => {
    setSessLoading(true);
    try {
      const list = await listSessions();
      setSessions(Array.isArray(list) ? list : []);
    } catch {
      setSessions([]);
    } finally {
      setSessLoading(false);
    }
  }, []);

  useEffect(() => {
    setPrefs(loadPrefs());
    refreshSessions();
  }, [refreshSessions]);

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (newPassword.length < 8) {
      setPwErr('رمز جدید باید حداقل ۸ کاراکتر باشد');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr('تکرار رمز جدید مطابقت ندارد');
      return;
    }
    setPwLoading(true);
    try {
      const res = await changePassword({ currentPassword, newPassword });
      setPwMsg(res?.message || 'رمز با موفقیت تغییر کرد');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(async () => {
        await logout();
        router.replace('/login');
      }, 1500);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        'خطا در تغییر رمز';
      setPwErr(String(msg));
    } finally {
      setPwLoading(false);
    }
  }

  async function onRevoke(id: string) {
    setSessMsg(null);
    try {
      await revokeSession(id);
      setSessMsg('نشست لغو شد');
      await refreshSessions();
    } catch {
      setSessMsg('خطا در لغو نشست');
    }
  }

  async function onRevokeAll() {
    setSessMsg(null);
    try {
      await revokeAllSessions();
      setSessMsg('همه نشست‌ها لغو شدند');
      await logout();
      router.replace('/login');
    } catch {
      setSessMsg('خطا در لغو همه نشست‌ها');
    }
  }

  function togglePref(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    savePrefs(next);
  }

  async function onDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDelMsg(null);
    setDelErr(null);
    if (!deleteConfirm) {
      setDelErr('لطفاً تأیید حذف را علامت بزنید');
      return;
    }
    if (!deletePassword) {
      setDelErr('رمز عبور الزامی است');
      return;
    }
    setDelLoading(true);
    try {
      const res = await deleteAccount({ password: deletePassword });
      setDelMsg(res?.message || 'حساب حذف شد');
      setTimeout(async () => {
        await logout();
        router.replace('/login');
      }, 1200);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        'خطا در حذف حساب';
      setDelErr(String(msg));
    } finally {
      setDelLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات</h1>
        <p className="mt-1 text-sm text-gray">مدیریت حساب، نشست‌ها و اعلان‌ها</p>
      </div>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">حساب کاربری</h2>
        <p className="text-sm text-gray">
          وارد شده با:{' '}
          <span className="font-medium text-foreground" dir="ltr">
            {user?.phone || user?.id}
          </span>
        </p>
        <Button variant="secondary" onClick={onLogout}>
          خروج از حساب
        </Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">تغییر رمز عبور</h2>
        <form onSubmit={onChangePassword} className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm mb-1">رمز فعلی</label>
            <input
              type="password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">رمز جدید</label>
            <input
              type="password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">تکرار رمز جدید</label>
            <input
              type="password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              dir="ltr"
            />
          </div>
          {pwErr && <p className="text-sm text-red-600">{pwErr}</p>}
          {pwMsg && <p className="text-sm text-green-600">{pwMsg}</p>}
          <Button type="submit" disabled={pwLoading}>
            {pwLoading ? 'در حال ذخیره…' : 'تغییر رمز'}
          </Button>
        </form>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">نشست‌های فعال</h2>
          <Button variant="secondary" size="sm" onClick={onRevokeAll} disabled={sessions.length === 0}>
            لغو همه نشست‌ها
          </Button>
        </div>
        {sessMsg && <p className="text-sm text-gray">{sessMsg}</p>}
        {sessLoading ? (
          <p className="text-sm text-gray">در حال بارگذاری…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray">نشست فعالی یافت نشد</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div>
                  <div dir="ltr" className="font-mono text-xs text-gray">
                    {s.id.slice(0, 8)}…
                  </div>
                  <div className="text-xs text-gray">ایجاد: {formatDateTime(s.createdAt)}</div>
                  <div className="text-xs text-gray">انقضا: {formatDateTime(s.expiresAt)}</div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onRevoke(s.id)}>
                  لغو
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">ترجیحات اعلان</h2>
        <p className="text-xs text-gray">این تنظیمات فقط روی این دستگاه ذخیره می‌شوند.</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.bookingSms}
            onChange={() => togglePref('bookingSms')}
          />
          پیامک وضعیت رزرو
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.bookingPush}
            onChange={() => togglePref('bookingPush')}
          />
          اعلان درون‌برنامه‌ای رزرو
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.marketing}
            onChange={() => togglePref('marketing')}
          />
          پیشنهادها و خبرهای تبلیغاتی
        </label>
      </Card>

      <Card className="space-y-4 border-red-200">
        <h2 className="text-lg font-semibold text-red-700">منطقه خطر — حذف حساب</h2>
        <p className="text-sm text-gray">
          با حذف حساب، دسترسی شما قطع می‌شود و وضعیت حساب به «حذف‌شده» تغییر می‌کند. این عمل
          قابل بازگشت نیست.
        </p>
        <form onSubmit={onDeleteAccount} className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm mb-1">رمز عبور برای تأیید</label>
            <input
              type="password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.checked)}
            />
            می‌دانم که حذف حساب دائمی است
          </label>
          {delErr && <p className="text-sm text-red-600">{delErr}</p>}
          {delMsg && <p className="text-sm text-green-600">{delMsg}</p>}
          <Button type="submit" variant="danger" disabled={delLoading}>
            {delLoading ? 'در حال حذف…' : 'حذف دائمی حساب'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
