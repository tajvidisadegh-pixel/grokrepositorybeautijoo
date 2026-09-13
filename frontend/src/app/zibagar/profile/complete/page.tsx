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
  createCategoryNode,
  type CatalogCategory,
  type OwnProfessional, type ProfileCompletion,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { IRAN_PROVINCES, citiesOf, type IranCity } from '@/lib/geo/iran-provinces';
import LocationMapPicker, { type MapPosition } from '@/components/location/location-map-picker';

const STEPS: WizardStep[] = [
  { id: 'basic', label: 'اطلاعات پایه' },
  { id: 'contact', label: 'معرفی' },
  { id: 'media', label: 'تصاویر' },
  { id: 'location', label: 'موقعیت' },
  { id: 'services', label: 'تخصص‌ها' },
  { id: 'hours', label: 'ساعات کاری' },
  { id: 'review', label: 'بررسی نهایی' },
];

const FEATURED_ROOT_NAMES = ['پوست', 'مو', 'ناخن', 'میکاپ', 'مردانه'];

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
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locProvince, setLocProvince] = useState('');
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [mapSelected, setMapSelected] = useState(false);
  const [cityOptions, setCityOptions] = useState<IranCity[]>([]);
  const [rootCategories, setRootCategories] = useState<CatalogCategory[]>([]);
  const [selectedRootIds, setSelectedRootIds] = useState<string[]>([]);
  const [specialtyMoreOpen, setSpecialtyMoreOpen] = useState(false);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [hourDays, setHourDays] = useState<string[]>(['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday']);
  const [hourStart, setHourStart] = useState('10:00');
  const [hourEnd, setHourEnd] = useState('20:00');

  const featuredRootCategories = useMemo(() => {
    const byName = new Map(rootCategories.map((r) => [r.name, r]));
    return FEATURED_ROOT_NAMES.map((n) => byName.get(n)).filter(Boolean) as CatalogCategory[];
  }, [rootCategories]);

  const specialtySearchResults = useMemo(() => {
    const q = specialtySearch.trim();
    if (!q) return [];
    return rootCategories.filter((r) => r.name.includes(q)).slice(0, 20);
  }, [specialtySearch, rootCategories]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchMyProfessional();
      setPro(data); setCompletion(data.completion || null);
      setTitle(data.title || '');
      setFirstName(data.user?.profile?.firstName || '');
      setLastName(data.user?.profile?.lastName || '');
      setBio(data.bio || data.user?.profile?.bio || '');
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
        const order = ['title','firstName','lastName','bio','avatarOrCover','location','service','workingHours'];
        let resume = 0;
        for (let i = 0; i < order.length; i++) {
          const f = fields.find((x) => x.key === order[i]);
          if (f && !f.done) {
            if (i <= 2) resume = 0;
            else if (i === 3) resume = 1;
            else if (i === 4) resume = 2;
            else if (i === 5) resume = 3;
            else if (i === 6) resume = 4;
            else resume = 5;
            break;
          }
          if (i === order.length - 1 && data.completion?.complete) resume = 6;
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
    if (step === 4) {
      fetchCategories()
        .then((cats) => {
          const roots = (cats || []).filter((c) => !c.parentId);
          setRootCategories(roots);
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

  async function saveContact() {
    setSaving(true); setError(null); setMsg(null);
    try {
      const data = await updateMyProfessional({ bio: bio.trim() });
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

  /** BUG2 fix: persist specialty to DB immediately on toggle so refresh keeps selection */
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
    else if (step === 1) ok = await saveContact();
    else if (step === 2) ok = await saveMedia();
    else if (step === 3) ok = await saveLocation();
    else if (step === 4) ok = await saveService();
    else if (step === 5) ok = await saveHours();
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
          <h2 className="font-semibold">معرفی / بیو</h2>
          <p className="text-xs text-gray">اختیاری — بدون بیو هم می‌توانید پروفایل را کامل کنید.</p>
          <label className="block space-y-1 text-sm">درباره شما
            <textarea className="w-full rounded-xl border border-border p-3 text-sm" rows={4}
              value={bio} onChange={(e) => setBio(e.target.value)} placeholder="اختیاری" /></label>
        </Card>
      )}
      {step === 2 && (
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
      {step === 3 && (
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
              latitude={locLat}
              longitude={locLng}
              onChange={(pos: MapPosition) => {
                setLocLat(pos.lat);
                setLocLng(pos.lng);
                setMapSelected(true);
              }}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
