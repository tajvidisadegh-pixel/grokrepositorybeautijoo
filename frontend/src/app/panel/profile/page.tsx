'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading } from '@/components/panel/state-blocks';
import { authApi } from '@/lib/auth-api';
import { friendlyApiError } from '@/lib/api-errors';

const GENDERS = [
  { value: 'undisclosed', label: 'ترجیح می‌دهم نگویم' },
  { value: 'female', label: 'زن' },
  { value: 'male', label: 'مرد' },
  { value: 'other', label: 'سایر' },
] as const;

export default function PanelProfilePage() {
  const { user, loading, reload } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<string>('undisclosed');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.profile?.displayName || '');
    setFirstName(user.profile?.firstName || '');
    setLastName(user.profile?.lastName || '');
    setEmail(user.email || '');
    setBio(user.profile?.bio || '');
    setGender((user.profile as { gender?: string } | null)?.gender || 'undisclosed');
    setAvatarUrl(user.profile?.avatarUrl || '');
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
        avatarUrl: avatarUrl.trim() || undefined,
        gender: gender || undefined,
      } as never);
      await reload();
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
        <div className="flex flex-wrap items-center gap-4 border-b border-border/60 pb-3">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-light text-lg font-bold text-gray">
              {(displayName || user.phone || '?')[0]}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-gray">شماره موبایل</span>
              <span className="font-medium" dir="ltr">
                {user.phone || '—'}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-gray">تأیید موبایل</span>
              <span className="font-medium">{user.phoneVerified ? 'بله' : 'خیر'}</span>
            </div>
          </div>
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
            <label className="mb-1 block text-xs text-gray">جنسیت</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
            >
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">آدرس تصویر پروفایل (URL)</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              dir="ltr"
              placeholder="https://..."
              maxLength={512}
            />
            <p className="mt-1 text-[11px] text-gray">فعلاً با لینک مستقیم؛ آپلود فایل از مسیر رسانه</p>
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
            <p className="mt-1 text-left text-xs text-gray" dir="ltr">{`${bio.length}/2000`}</p>
          </div>
          <Button type="submit" loading={saving}>
            ذخیره تغییرات
          </Button>
        </form>
      </Card>
    </div>
  );
}
