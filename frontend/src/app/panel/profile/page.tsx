'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading } from '@/components/panel/state-blocks';
import { authApi } from '@/lib/auth-api';
import { friendlyApiError } from '@/lib/api-errors';

export default function PanelProfilePage() {
  const { user, loading, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.profile?.displayName || '');
    setFirstName((user.profile as any)?.firstName || '');
    setLastName((user.profile as any)?.lastName || '');
    setEmail(user.email || '');
    setBio((user.profile as any)?.bio || '');
  }, [user]);

  if (loading) return <PanelLoading />;
  if (!user) return null;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      await authApi.updateProfile({
        displayName: displayName.trim() || undefined,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      await refreshUser?.();
      setMsg('پروفایل با موفقیت به‌روزرسانی شد.');
    } catch (e) {
      setErr(friendlyApiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">پروفایل</h1>
        <p className="mt-1 text-sm text-gray">ویرایش اطلاعات حساب کاربری</p>
      </div>

      {msg && (
        <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>
      )}
      {err && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
      )}

      <Card className="space-y-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-2">
          <span className="text-gray">شماره موبایل</span>
          <span className="font-medium" dir="ltr">{user.phone || '—'}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-2">
          <span className="text-gray">وضعیت</span>
          <span className="font-medium">{user.status}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-2">
          <span className="text-gray">تأیید موبایل</span>
          <span className="font-medium">{user.phoneVerified ? 'بله' : 'خیر'}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-2 pb-2">
          <span className="text-gray">نقش‌ها</span>
          <span className="font-medium">{(user.roles || []).join('، ') || '—'}</span>
        </div>
      </Card>

      <Card>
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-gray">نام نمایشی</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              maxLength={120}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-gray">نام</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                maxLength={80}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray">نام خانوادگی</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                maxLength={80}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">ایمیل</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              dir="ltr"
              maxLength={255}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">بیو</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              maxLength={2000}
            />
          </div>
          <Button type="submit" loading={saving}>
            ذخیره تغییرات
          </Button>
        </form>
      </Card>
    </div>
  );
}
