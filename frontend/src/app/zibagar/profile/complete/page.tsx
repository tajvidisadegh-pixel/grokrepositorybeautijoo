'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { CompletionBar } from '@/components/profile/completion-bar';
import { ProfileStepper, type WizardStep } from '@/components/profile/stepper';
import {
  fetchMyProfessional, updateMyProfessional, addMyLocation, setMyWorkingHours,
  publishMyProfessional,
  uploadMyMedia, fetchCategories, resolveMediaUrl,
  setMySelectedCategories,
  type CatalogCategory,
  type OwnProfessional, type ProfileCompletion,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { IRAN_PROVINCES, citiesOf, type IranCity } from '@/lib/geo/iran-provinces';
import LocationMapPicker, { type MapPosition } from '@/components/location/location-map-picker';

const STEPS: WizardStep[] = [
  { id: 'basic', label: 'اطلاعات پایه' },
  { id: 'media', label: 'تصاویر' },
  { id: 'location', label: 'موقعیت' },
  { id: 'services', label: 'تخصص‌ها' },
  { id: 'hours', label: 'ساعات کاری' },
  { id: 'review', label: 'بررسی نهایی' },
];

const WEEK_DAYS = [
  { value: 'saturday', label: 'شنبه' },
  { value: 'sunday', label: 'یکشنبه' },
  { value: 'monday', label: 'دوشنبه' },
  { value: 'tuesday', label: 'سه‌شنبه' },
  { value: 'wednesday', label: 'چهارشنبه' },
  { value: 'thursday', label: 'پنج‌شنبه' },
  { value: 'friday', label: 'جمعه' },
];

export default function ProfileCompletePage() {
  const { user, loading: authLoading, reload } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pro, setPro] = useState<OwnProfessional | null>(null);
  const [completion, setCompletion] = useState<ProfileCompletion | null>(null);
  const [step, setStep] = useState(0);
  const resumeApplied = useRef(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locProvince, setLocProvince] = useState('');
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [, setMapSelected] = useState(false);
  const [cityOptions, setCityOptions] = useState<IranCity[]>([]);
  const [rootCategories, setRootCategories] = useState<CatalogCategory[]>([]);
  const [selectedRootIds, setSelectedRootIds] = useState<string[]>([]);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [hourDays, setHourDays] = useState<string[]>(['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday']);
  const [hourStart, setHourStart] = useState('10:00');
  const [hourEnd, setHourEnd] = useState('20:00');



  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchMyProfessional();
      setPro(data); setCompletion(data.completion || null);
      setTitle(data.title || '');
      setFirstName(data.user?.profile?.firstName || '');
      setLastName(data.user?.profile?.lastName || '');
      setAvatarUrl(resolveMediaUrl(data.user?.profile?.avatarUrl || ''));
      setCoverImageUrl(resolveMediaUrl(data.coverImageUrl || ''));
      if (Array.isArray(data.selectedCategoryIds) && data.selectedCategoryIds.length) {
        setSelectedRootIds(data.selectedCategoryIds as string[]);
      }
      const primary = data.locations?.find((l) => l.isPrimary) || data.locations?.[0];
      if (primary) {
        setLocName(primary.location.name || '');
        setLocAddress(primary.location.address || '');
        setLocCity(primary.location.city || '');
        setLocProvince(primary.location.province || '');
        const lat = primary.location.latitude != null ? Number(primary.location.latitude) : null;
        const lng = primary.location.longitude != null ? Number(primary.location.longitude) : null;
        setLocLat(lat); setLocLng(lng);
        setMapSelected(lat != null && lng != null);
        if (primary.location.province) setCityOptions(citiesOf(primary.location.province));
      }
      if (!resumeApplied.current) {
        resumeApplied.current = true;
        const fields = data.completion?.fields || [];
        const order = ['title','firstName','lastName','avatarOrCover','location','service','workingHours'];
        let resume = 0;
        for (let i = 0; i < order.length; i++) {
          const f = fields.find((x) => x.key === order[i]);
          if (f && !f.done) {
            if (i <= 2) resume = 0;
            else if (i === 3) resume = 1;
            else if (i === 4) resume = 2;
            else if (i === 5) resume = 3;
            else resume = 4;
            break;
          }
          if (i === order.length - 1 && data.completion?.complete) resume = 5;
        }
        setStep(resume);
      }
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user, load]);
  useEffect(() => {
    if (step === 3) {
      fetchCategories()
        .then((cats) => {
          const list = cats || [];
          const roots = list.filter((c) => !c.parentId);
          setRootCategories(roots.length ? roots : list);
          const fromPro = Array.isArray(pro?.selectedCategoryIds)
            ? (pro!.selectedCategoryIds as string[]).filter((id) => roots.some((r) => r.id === id))
            : [];
          if (fromPro.length) setSelectedRootIds(fromPro);
        })
        .catch(() => setRootCategories([]));
    }
  }, [step, pro]);

  async function saveBasic() {
    setSaving(true); setError(null); setMsg(null);
    try {
      const data = await updateMyProfessional({
        title: title.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: [firstName, lastName].filter(Boolean).join(' ').trim() || undefined,
      });
      setPro(data); setCompletion(data.completion || null);
      setMsg('ذخیره شد');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }


  async function saveMedia() {
    setSaving(true); setError(null); setMsg(null);
    try {
      await load();
      setMsg('تصاویر ثبت شد');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveLocation() {
    setSaving(true); setError(null); setMsg(null);
    try {
      if (!locProvince.trim() || !locCity.trim()) {
        setError('استان و شهر الزامی است');
        return false;
      }
      await addMyLocation({
        name: locName.trim() || undefined,
        address: locAddress.trim() || undefined,
        city: locCity.trim(),
        province: locProvince.trim(),
        latitude: locLat ?? undefined,
        longitude: locLng ?? undefined,
        isPrimary: true,
      });
      await load();
      setMsg('موقعیت ذخیره شد');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveService() {
    setSaving(true); setError(null); setMsg(null);
    try {
      if (!selectedRootIds.length) {
        setError('انتخاب حداقل یک تخصص الزامی است');
        return false;
      }
      const data = await setMySelectedCategories(selectedRootIds);
      setPro(data); setCompletion(data.completion || null);
      setMsg('تخصص‌ها ذخیره شد. جزئیات قیمت را در بخش تخصص‌ها تکمیل کنید.');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggleRootCategory(id: string) {
    const next = selectedRootIds.includes(id)
      ? selectedRootIds.filter((x) => x !== id)
      : [...selectedRootIds, id];
    setSelectedRootIds(next);
    try {
      const data = await setMySelectedCategories(next);
      setPro(data);
      setCompletion(data.completion || null);
    } catch (e) {
      setError(friendlyApiError(e));
      setSelectedRootIds(selectedRootIds);
    }
  }

  async function saveHours() {
    setSaving(true); setError(null); setMsg(null);
    try {
      if (!hourDays.length) {
        setError('حداقل یک روز کاری انتخاب کنید');
        return false;
      }
      for (const day of hourDays) {
        await setMyWorkingHours({ dayOfWeek: day, startTime: hourStart, endTime: hourEnd });
      }
      await load();
      setMsg('ساعات کاری ذخیره شد');
      return true;
    } catch (e) {
      setError(friendlyApiError(e));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onNext() {
    let ok = true;
    if (step === 0) ok = await saveBasic();
    else if (step === 1) ok = await saveMedia();
    else if (step === 2) ok = await saveLocation();
    else if (step === 3) ok = await saveService();
    else if (step === 4) ok = await saveHours();
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onPublish() {
    setPublishing(true); setError(null);
    try {
      const data = await publishMyProfessional();
      setPro(data); setCompletion(data.completion || null);
      setConfirmPublish(false);
      setMsg('پروفایل منتشر شد');
      await reload();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setPublishing(false);
    }
  }

  function toggleHourDay(day: string) {
    setHourDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  if (authLoading || loading) return <PanelLoading />;
  if (error && !pro) return <PanelError message={error} />;
  if (!user) return null;

  const percent = completion?.percent ?? 0;
  const isPublished = pro?.status === 'approved';

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-coral">تکمیل پروفایل</h1>
        <p className="mt-1 text-sm text-gray">اطلاعات هر مرحله بلافاصله در سرور ذخیره می‌شود</p>
      </div>
      <CompletionBar percent={percent} />
      <ProfileStepper steps={STEPS} current={step} />
      {msg && <p className="rounded-xl bg-blue/10 px-3 py-2 text-sm text-blue">{msg}</p>}
      {error && <p className="rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

      {step === 0 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">اطلاعات پایه</h2>
          <label className="block space-y-1 text-sm">عنوان حرفه‌ای
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً میکاپ آرتیست" /></label>
          <label className="block space-y-1 text-sm">نام
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
          <label className="block space-y-1 text-sm">نام خانوادگی
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
        </Card>
      )}
      {step === 1 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">تصاویر پروفایل</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              { kind: 'avatar' as const, label: 'پروفایل', url: avatarUrl },
              { kind: 'cover' as const, label: 'کاور', url: coverImageUrl },
            ] as const).map(({ kind, label, url }) => (
              <div key={kind} className="flex flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
                <div className="relative h-28 bg-gray-light">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={label} className={`h-full w-full object-cover ${uploading === kind ? 'opacity-40' : ''}`} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray">بدون تصویر</div>
                  )}
                  {uploading === kind && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <span className="inline-block size-8 animate-spin rounded-full border-2 border-white border-t-transparent" aria-label="در حال آپلود" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between px-3 pb-3">
                  <span className="text-sm font-medium">{label}</span>
                  <label className={`cursor-pointer rounded-lg bg-coral px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
                    {uploading === kind ? 'آپلود…' : url ? 'تعویض' : 'آپلود'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={!!uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(kind); setError(null); setMsg(null);
                        try {
                          const asset = await uploadMyMedia(file, kind);
                          if (kind === 'avatar') setAvatarUrl(asset.publicUrl);
                          if (kind === 'cover') setCoverImageUrl(asset.publicUrl);
                          setMsg('تصویر آپلود شد');
                        } catch (err) {
                          setError(friendlyApiError(err));
                        } finally {
                          setUploading(null);
                          e.target.value = '';
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {step === 2 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">موقعیت محل فعالیت</h2>
          <p className="text-xs text-gray">استان و شهر الزامی است.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">استان *
              <select className="w-full rounded-xl border border-border p-3 text-sm" value={locProvince}
                onChange={(e) => {
                  const name = e.target.value;
                  setLocProvince(name);
                  setCityOptions(citiesOf(name));
                  setLocCity('');
                  setLocLat(null); setLocLng(null); setMapSelected(false);
                }}>
                <option value="">انتخاب استان</option>
                {IRAN_PROVINCES.map((pr) => <option key={pr.name} value={pr.name}>{pr.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm">شهر *
              <select className="w-full rounded-xl border border-border p-3 text-sm" value={locCity} disabled={!locProvince}
                onChange={(e) => {
                  const name = e.target.value;
                  setLocCity(name);
                  const c = cityOptions.find((x) => x.name === name);
                  if (c) { setLocLat(c.lat); setLocLng(c.lng); setMapSelected(false); }
                }}>
                <option value="">انتخاب شهر</option>
                {cityOptions.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm">نام مکان (اختیاری)
            <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="مثلاً سالن زیبایی" />
          </label>
          <label className="block space-y-1 text-sm">آدرس
            <Input value={locAddress} onChange={(e) => setLocAddress(e.target.value)} placeholder="آدرس کامل" />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">موقعیت روی نقشه (اختیاری)</p>
            <LocationMapPicker
              position={locLat != null && locLng != null ? { lat: locLat, lng: locLng } : null}
              onPositionChange={(pos: MapPosition) => { setLocLat(pos.lat); setLocLng(pos.lng); setMapSelected(true); }}
              height="280px"
            />
          </div>
        </Card>
      )}
      {step === 3 && (
        <Card className="space-y-4">
          <h2 className="font-semibold text-[#0B2C4A]">تخصص خودت را انتخاب کن</h2>
          {!rootCategories.length ? (
            <p className="text-sm text-gray">هنوز تخصصی از پنل ادمین ثبت نشده است. از سوپرادمین دسته‌بندی/تخصص اضافه کنید.</p>
          ) : (
            <div className="space-y-3">
              <Input
                value={specialtySearch}
                onChange={(e) => setSpecialtySearch(e.target.value)}
                placeholder="جستجوی تخصص..."
                className="text-right"
              />
              <div className="flex flex-wrap gap-2">
                {(specialtySearch.trim()
                  ? rootCategories.filter((c) => c.name.includes(specialtySearch.trim()))
                  : rootCategories
                ).map((c) => {
                  const on = selectedRootIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => void toggleRootCategory(c.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-coral bg-coral text-white' : 'border-border bg-white'}`}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <p className="text-xs text-[#0B2C4A]">{selectedRootIds.length} تخصص انتخاب شده</p>
        </Card>
      )}
      {step === 4 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">ساعات کاری</h2>
          <div className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((d) => (
              <button key={d.value} type="button" onClick={() => toggleHourDay(d.value)}
                className={`rounded-full border px-3 py-1.5 text-sm ${hourDays.includes(d.value) ? 'border-coral bg-coral text-white' : 'border-border'}`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">از ساعت
              <Input type="time" value={hourStart} onChange={(e) => setHourStart(e.target.value)} dir="ltr" /></label>
            <label className="block space-y-1 text-sm">تا ساعت
              <Input type="time" value={hourEnd} onChange={(e) => setHourEnd(e.target.value)} dir="ltr" /></label>
          </div>
        </Card>
      )}
      {step === 5 && (
        <Card className="space-y-4">
          <h2 className="font-semibold">بررسی نهایی</h2>
          <p className="text-sm text-gray">پیشرفت: {percent}٪ {isPublished ? '· منتشر شده' : ''}</p>
          {!completion?.complete && <p className="text-sm text-coral">برخی موارد هنوز کامل نیست؛ می‌توانید بعداً تکمیل کنید.</p>}
          <Button onClick={() => setConfirmPublish(true)} disabled={publishing}>انتشار پروفایل</Button>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>قبلی</Button>
        <div className="flex gap-2">
          <Link href="/zibagar"><Button variant="outline" size="sm">خروج</Button></Link>
          {step < STEPS.length - 1 && <Button size="sm" loading={saving} onClick={onNext}>بعدی</Button>}
        </div>
      </div>
      {confirmPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-w-md space-y-4">
            <h3 className="text-lg font-bold">تأیید انتشار</h3>
            <p className="text-sm text-gray">پروفایل شما آماده انتشار است.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmPublish(false)}>انصراف</Button>
              <Button size="sm" loading={publishing} onClick={onPublish}>تأیید و انتشار</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
