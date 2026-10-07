'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import {
  createBooking,
  fetchAvailability,
  initiatePayment,
  slotToStartAt,
  persianBookingStatus,
} from '@/lib/booking-api';
import {
  saveBookingDraft,
  clearBookingDraft,
  bookingLoginReturnPath,
} from '@/lib/booking-draft';
import { friendlyApiError } from '@/lib/api-errors';
import { CancelPolicyNotice } from '@/components/booking/cancel-policy-notice';
import { formatPrice } from '@/lib/utils';
import { tehranTodayIso, isoToJalaliLabel } from '@/lib/jalali';
import { JalaliDateInput } from '@/components/ui/jalali-date-input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AvailabilitySlot, BookingRecord } from '@/types/booking';
import { ApiError } from '@/lib/api';

type ServiceOption = {
  professionalServiceId: string;
  serviceId: string;
  name: string;
  durationMin: number;
  bufferMin: number;
  price: number;
  categoryName?: string;
  addOns?: { id: string; name: string; price: number; extraDurationMin: number }[];
  priceRules?: { id: string; label: string; price: number }[];
  durationRules?: { id: string; label: string; durationMin: number }[];
};

type LocationOption = {
  id: string;
  name: string;
  city: string;
  address: string;
  isPrimary?: boolean;
};

type Props = {
  professional: { id: string; slug: string; name: string; title?: string };
  services: ServiceOption[];
  locations: LocationOption[];
  initialServiceId?: string;
  initialDate?: string;
  initialSlot?: string;
  initialLocationId?: string;
  initialAddOnIds?: string[];
  initialPriceRuleId?: string;
  initialDurationRuleId?: string;
};


function formatDurationFa(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin || 0));
  if (m < 60) return `حدود ${m.toLocaleString('fa-IR')} دقیقه`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return `حدود ${h.toLocaleString('fa-IR')} ساعت`;
  return `حدود ${h.toLocaleString('fa-IR')} ساعت و ${r.toLocaleString('fa-IR')} دقیقه`;
}

type Step = 'service' | 'datetime' | 'summary' | 'done';

const STEP_LABELS: Record<Step, string> = {
  service: 'خدمت',
  datetime: 'زمان',
  summary: 'خلاصه',
  done: 'پایان',
};

function todayISO(): string {
  return tehranTodayIso();
}

export function BookingWizard({
  professional,
  services,
  locations,
  initialServiceId,
  initialDate,
  initialSlot,
  initialLocationId,
  initialAddOnIds,
  initialPriceRuleId,
  initialDurationRuleId,
}: Props) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('service');
  const [serviceId, setServiceId] = useState(initialServiceId || '');
  const [date, setDate] = useState(initialDate || todayISO());
  const [slotStart, setSlotStart] = useState(initialSlot || '');
  const [locationId, setLocationId] = useState(
    initialLocationId ||
      locations.find((l) => l.isPrimary)?.id ||
      locations[0]?.id ||
      '',
  );
  const [notes, setNotes] = useState('');
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>(initialAddOnIds || []);
  const [priceRuleId, setPriceRuleId] = useState<string | null>(initialPriceRuleId || null);
  const [durationRuleId, setDurationRuleId] = useState<string | null>(
    initialDurationRuleId || null,
  );
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<string | null>(null);
  const [showAddOns, setShowAddOns] = useState(false);

  const selected = useMemo(
    () => services.find((s) => s.serviceId === serviceId) || null,
    [services, serviceId],
  );

  useEffect(() => {
    if (!selected) return;
    const pr = [...(selected.priceRules || [])].sort((a, b) => a.price - b.price);
    const dr = selected.durationRules || [];
    if (pr.length) {
      if (!priceRuleId || !pr.some((r) => r.id === priceRuleId)) {
        const cheapest = pr[0];
        setPriceRuleId(cheapest.id);
        const match = dr.find((d) => d.label === cheapest.label);
        setDurationRuleId(match?.id || dr[0]?.id || null);
      }
    } else {
      setPriceRuleId(null);
    }
    if (!dr.length) setDurationRuleId(null);
    const valid = new Set((selected.addOns || []).map((a) => a.id));
    setSelectedAddOnIds((prev) => prev.filter((id) => valid.has(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.serviceId]);

  const basePrice = useMemo(() => {
    if (!selected) return 0;
    if (priceRuleId) {
      const rule = (selected.priceRules || []).find((r) => r.id === priceRuleId);
      if (rule) return rule.price;
    }
    return selected.price;
  }, [selected, priceRuleId]);

  const baseDuration = useMemo(() => {
    if (!selected) return 0;
    if (durationRuleId) {
      const rule = (selected.durationRules || []).find((r) => r.id === durationRuleId);
      if (rule) return rule.durationMin;
    }
    return selected.durationMin;
  }, [selected, durationRuleId]);

  const addOnExtraPrice = useMemo(() => {
    if (!selected) return 0;
    return (selected.addOns || [])
      .filter((a) => selectedAddOnIds.includes(a.id))
      .reduce((s, a) => s + a.price, 0);
  }, [selected, selectedAddOnIds]);

  const addOnExtraDuration = useMemo(() => {
    if (!selected) return 0;
    return (selected.addOns || [])
      .filter((a) => selectedAddOnIds.includes(a.id))
      .reduce((s, a) => s + (a.extraDurationMin || 0), 0);
  }, [selected, selectedAddOnIds]);

  const displayPrice = basePrice + addOnExtraPrice;
  const serviceDuration = baseDuration + addOnExtraDuration;
  const totalDuration = selected ? serviceDuration + selected.bufferMin : 30;

  const loadSlots = useCallback(async () => {
    if (!selected || !date) return;
    setSlotsLoading(true);
    setSlotsError(null);
    setSlots([]);
    try {
      const res = await fetchAvailability(professional.id, date, totalDuration);
      setSlots(res.slots || []);
      if (
        slotStart &&
        !res.slots.some((s) => s.start === slotStart && s.available !== false)
      ) {
        setSlotStart('');
      }
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 400) setSlotsError('تاریخ یا مدت نامعتبر است');
      else if (status === 404) setSlotsError('زیباگر یافت نشد');
      else setSlotsError('بارگذاری زمان‌های آزاد ممکن نشد');
    } finally {
      setSlotsLoading(false);
    }
  }, [selected, date, professional.id, totalDuration, slotStart]);

  useEffect(() => {
    if (step === 'datetime' && selected) loadSlots();
  }, [step, selected, date, loadSlots]);

  useEffect(() => {
    if (initialServiceId && initialDate && initialSlot) setStep('summary');
    else if (initialServiceId) setStep('datetime');
  }, [initialServiceId, initialDate, initialSlot]);

  function toggleAddOn(id: string) {
    setSelectedAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectPriceRule(id: string) {
    setPriceRuleId(id);
    if (!selected) return;
    const rule = (selected.priceRules || []).find((r) => r.id === id);
    if (rule) {
      const match = (selected.durationRules || []).find((d) => d.label === rule.label);
      if (match) setDurationRuleId(match.id);
    }
    setStep('datetime');
  }

  function goDatetime() {
    if (selected) setStep('datetime');
  }
  function goSummary() {
    if (selected && date && slotStart) setStep('summary');
  }

  function buildDraft() {
    return {
      professionalId: professional.id,
      professionalSlug: professional.slug,
      professionalName: professional.name,
      serviceId: selected!.serviceId,
      serviceName: selected!.name,
      durationMin: totalDuration,
      price: displayPrice,
      locationId: locationId || undefined,
      date,
      slotStart,
      notes: notes || undefined,
      addOnIds: selectedAddOnIds.length ? selectedAddOnIds : undefined,
      priceRuleId: priceRuleId || undefined,
      durationRuleId: durationRuleId || undefined,
    };
  }

  async function submitBooking() {
    if (!selected || !date || !slotStart) return;
    setSubmitError(null);
    if (!isAuthenticated) {
      const draft = buildDraft();
      saveBookingDraft(draft);
      router.push(`/login?next=${encodeURIComponent(bookingLoginReturnPath(draft))}`);
      return;
    }
    if (user && user.phoneVerified === false) {
      const draft = buildDraft();
      saveBookingDraft(draft);
      setSubmitError('قبل از رزرو باید شماره موبایل را تأیید کنید.');
      router.push('/otp?reason=booking&next=' + encodeURIComponent(bookingLoginReturnPath(draft)));
      return;
    }
    setSubmitting(true);
    try {
      const startAt = slotToStartAt(date, slotStart);
      const created = await createBooking({
        professionalId: professional.id,
        serviceIds: [selected.serviceId],
        startAt,
        locationId: locationId || undefined,
        notes: notes.trim() || undefined,
        addOnIds: selectedAddOnIds.length ? selectedAddOnIds : undefined,
        priceRuleId: priceRuleId || undefined,
        durationRuleId: durationRuleId || undefined,
      });
      clearBookingDraft();
      setBooking(created);
      setStep('done');
      try {
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (typeof window !== 'undefined' ? window.location.origin : '');
        const callbackUrl = `${appUrl}/payment/callback`;
        const pay = await initiatePayment(created.id, callbackUrl);
        if (pay.redirectUrl) {
          window.location.href = pay.redirectUrl;
          return;
        }
        setPaymentInfo(
          'رزرو ذخیره شد اما هنوز نهایی نیست — لینک درگاه دریافت نشد.',
        );
      } catch {
        setPaymentInfo(
          'رزرو ذخیره شد اما نهایی نیست. پرداخت آنلاین فعلاً در دسترس نیست یا نیاز به پیکربندی درگاه دارد.',
        );
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const draft = buildDraft();
        saveBookingDraft(draft);
        router.push(`/login?next=${encodeURIComponent(bookingLoginReturnPath(draft))}`);
        return;
      }
      setSubmitError(friendlyApiError(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (services.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-bold">خدماتی برای رزرو فعال نیست</p>
        <Link href={`/professionals/${professional.slug}`} className="mt-4 inline-block text-coral hover:underline">
          بازگشت به پروفایل
        </Link>
      </div>
    );
  }

  const selectedAddOnNames =
    selected?.addOns?.filter((a) => selectedAddOnIds.includes(a.id)).map((a) => a.name) || [];
  const selectedRuleLabel =
    (selected?.priceRules || []).find((r) => r.id === priceRuleId)?.label || null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10" dir="rtl">
      <nav className="mb-4 text-sm text-gray">
        <Link href={`/professionals/${professional.slug}`} className="hover:text-coral">
          {professional.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">رزرو</span>
      </nav>
      <h1 className="text-2xl font-bold text-blue">رزرو با {professional.name}</h1>

      <ol className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
        {(['service', 'datetime', 'summary', 'done'] as const).map((key, i) => (
          <li
            key={key}
            className={`rounded-full px-3 py-1 ${
              step === key ? 'bg-coral text-white' : 'bg-gray-light text-gray'
            }`}
          >
            {i + 1}. {STEP_LABELS[key]}
          </li>
        ))}
      </ol>

      {step === 'service' && (
        <Card className="mt-6 space-y-3">
          <h2 className="font-bold">انتخاب خدمت</h2>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.serviceId}>
                <button
                  type="button"
                  onClick={() => {
                    setServiceId(s.serviceId);
                    if (!(s.priceRules || []).length) setStep('datetime');
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-right text-sm transition ${
                    serviceId === s.serviceId
                      ? 'border-coral bg-coral-soft'
                      : 'border-border hover:border-coral-light'
                  }`}
                >
                  <span>
                    <span className="font-medium">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-gray">
                      {s.durationMin} دقیقه{s.categoryName ? ` · ${s.categoryName}` : ''}
                    </span>
                  </span>
                  <span className="font-bold text-coral">{formatPrice(s.price)}</span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (selected.priceRules || []).length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-sm font-medium">انتخاب زیرمجموعه</p>
              <ul className="space-y-1.5">
                {(selected.priceRules || []).map((r) => {
                  const on = priceRuleId === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => selectPriceRule(r.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-right text-sm ${
                          on ? 'border-coral bg-coral/5' : 'border-border'
                        }`}
                      >
                        <span>
                          {on ? '✓ ' : ''}
                          {r.label}
                        </span>
                        <span className="font-medium">{formatPrice(r.price)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {selected && (selected.addOns || []).length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              {!showAddOns ? (
                <button
                  type="button"
                  onClick={() => setShowAddOns(true)}
                  className="text-sm font-medium text-blue"
                >
                  ＋ گزینه‌های اضافی
                </button>
              ) : (
                <>
                  <p className="text-sm font-medium">گزینه‌های اضافی</p>
                  <ul className="space-y-1.5">
                    {(selected.addOns || []).map((a) => {
                      const on = selectedAddOnIds.includes(a.id);
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => toggleAddOn(a.id)}
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-right text-sm ${
                              on ? 'border-blue bg-blue-soft' : 'border-border'
                            }`}
                          >
                            <span>
                              {on ? '☑ ' : '☐ '}
                              {a.name}
                              {a.extraDurationMin ? ` (+${a.extraDurationMin}د)` : ''}
                            </span>
                            <span className="font-medium">{formatPrice(a.price)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    className="text-xs text-gray-muted"
                    onClick={() => {
                      setShowAddOns(false);
                      setSelectedAddOnIds([]);
                    }}
                  >
                    رد کردن
                  </button>
                  <div className="flex justify-between rounded-xl bg-gray-light/60 px-3 py-2 text-sm">
                    <span className="text-gray">جمع · {serviceDuration} دقیقه</span>
                    <span className="font-bold text-blue">{formatPrice(displayPrice)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <Button className="w-full" disabled={!serviceId} onClick={goDatetime}>
            ادامه
          </Button>
        </Card>
      )}

      {step === 'datetime' && selected && (
        <Card className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">تاریخ و ساعت</h2>
            <button
              type="button"
              className="text-sm text-coral hover:underline"
              onClick={() => setStep('service')}
            >
              تغییر خدمت
            </button>
          </div>
          <p className="text-sm text-gray">
            {selected.name}
            {selectedRuleLabel ? ` · ${selectedRuleLabel}` : ''}
            {selectedAddOnNames.length ? ` · ${selectedAddOnNames.join('، ')}` : ''}
            {' — '}
            {formatDurationFa(totalDuration)} — {formatPrice(displayPrice)}
          </p>
          <div>
            <p className="mb-2 text-xs text-gray">حداقل ۴ ساعت قبل از نوبت باید رزرو کنید.</p>
            <label className="mb-1 block text-sm font-medium">تاریخ</label>
            <JalaliDateInput
              value={date}
              min={todayISO()}
              onChange={(iso) => {
                setDate(iso);
                setSlotStart('');
              }}
            />
          </div>
          {locations.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">مکان</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.city}
                    {l.isPrimary ? ' (اصلی)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">ساعت</label>
            {slotsLoading ? (
              <p className="text-sm text-gray">در حال بارگذاری…</p>
            ) : slotsError ? (
              <p className="text-sm text-red-600">{slotsError}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray">ساعت آزادی برای این روز نیست.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(() => {
              const avail = slots.filter((s) => s.available !== false);
              if (avail.length > 0 && avail.length <= 3) {
                return (
                  <p className="mb-2 text-xs font-medium text-coral">
                    فقط {avail.length.toLocaleString('fa-IR')} نوبت باقی مانده
                  </p>
                );
              }
              return null;
            })()}
            {slots.map((s) => {
                  const available = s.available !== false;
                  const on = slotStart === s.start;
                  return (
                    <button
                      key={s.start}
                      type="button"
                      disabled={!available}
                      onClick={() => available && setSlotStart(s.start)}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        on
                          ? 'border-coral bg-coral text-white'
                          : available
                            ? 'border-border bg-white hover:border-coral'
                            : 'cursor-not-allowed border-border bg-gray-light text-gray-muted'
                      }`}
                    >
                      {s.start}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button className="w-full" disabled={!slotStart} onClick={goSummary}>
            ادامه به خلاصه
          </Button>
        </Card>
      )}

      {step === 'summary' && selected && (
        <Card className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">خلاصه رزرو</h2>
            <button
              type="button"
              className="text-sm text-coral hover:underline"
              onClick={() => setStep('datetime')}
            >
              ویرایش زمان
            </button>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray">زیباگر</dt>
              <dd>{professional.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray">خدمت</dt>
              <dd>
                {selected.name}
                {selectedRuleLabel ? ` · ${selectedRuleLabel}` : ''}
              </dd>
            </div>
            {selectedAddOnNames.length > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-gray">اضافات</dt>
                <dd>{selectedAddOnNames.join('، ')}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-gray">تاریخ</dt>
              <dd>{isoToJalaliLabel(date)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray">ساعت</dt>
              <dd dir="ltr">{slotStart}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray">مدت</dt>
              <dd>{formatDurationFa(totalDuration)}</dd>
            </div>
          </dl>
          <div className="space-y-2 rounded-2xl border border-border bg-gray-light/40 p-3 text-sm">
            <p className="font-medium">جزئیات مبلغ</p>
            <div className="flex justify-between gap-2">
              <span className="text-gray">
                {selected.name}
                {selectedRuleLabel ? ` (${selectedRuleLabel})` : ''}
              </span>
              <span>{formatPrice(basePrice)}</span>
            </div>
            {(selected.addOns || [])
              .filter((a) => selectedAddOnIds.includes(a.id))
              .map((a) => (
                <div key={a.id} className="flex justify-between gap-2">
                  <span className="text-gray">+ {a.name}</span>
                  <span>{formatPrice(a.price)}</span>
                </div>
              ))}
            <div className="flex justify-between gap-2 border-t border-border pt-2 text-base font-bold">
              <span>مبلغ قابل پرداخت</span>
              <span className="text-coral">{formatPrice(displayPrice)}</span>
            </div>
            <p className="text-xs text-gray">هیچ هزینه پنهانی اضافه نمی‌شود.</p>
            <CancelPolicyNotice className="mb-0" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">یادداشت (اختیاری)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-border px-3 py-2 text-sm outline-none focus:border-coral"
              placeholder="توضیح کوتاه برای زیباگر…"
            />
          </div>
          {user && user.phoneVerified === false && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              قبل از ثبت رزرو باید شماره موبایل را تأیید کنید.
              <Link
                href="/otp?reason=booking"
                className="ms-2 font-medium text-coral underline"
              >
                تأیید موبایل
              </Link>
            </div>
          )}
          {submitError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
          )}
          <Button className="w-full" loading={submitting} onClick={() => void submitBooking()}>
            تأیید و پرداخت
          </Button>
        </Card>
      )}

      {step === 'done' && booking && (
        <Card className="mt-6 space-y-4 text-center">
          <h2 className="text-xl font-bold text-blue">رزرو ثبت شد</h2>
          <p className="text-sm text-gray">
            وضعیت: {persianBookingStatus(booking.status)}
          </p>
          {paymentInfo && <p className="text-sm text-amber-800">{paymentInfo}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/booking/confirmation/${booking.id}`}>
              <Button size="sm">جزئیات رزرو</Button>
            </Link>
            <Link href="/panel/bookings">
              <Button size="sm" variant="outline">
                رزروهای من
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
