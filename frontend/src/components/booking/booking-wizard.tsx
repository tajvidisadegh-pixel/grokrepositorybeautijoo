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

      {/* truncated body continues in part 2 - MUST BE FULL */}
      <p className="text-red-600">RESTORE_INCOMPLETE</p>
    </div>
  );
}
