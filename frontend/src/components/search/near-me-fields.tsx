'use client';

import { useEffect, useState } from 'react';

type Props = {
  defaultLat?: string;
  defaultLng?: string;
  defaultRadiusKm?: string;
};

/**
 * Hidden lat/lng fields + optional radius + "near me" geolocation button for search form.
 */
export function NearMeFields({ defaultLat, defaultLng, defaultRadiusKm }: Props) {
  const [lat, setLat] = useState(defaultLat || '');
  const [lng, setLng] = useState(defaultLng || '');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLat(defaultLat || '');
    setLng(defaultLng || '');
  }, [defaultLat, defaultLng]);

  function requestNearMe() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('موقعیت مکانی در این مرورگر پشتیبانی نمی‌شود');
      return;
    }
    setBusy(true);
    setStatus('برای پیدا کردن زیباگرهای نزدیک شما، اجازه دسترسی به موقعیت مکانی را بدهید…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude.toFixed(6)));
        setLng(String(pos.coords.longitude.toFixed(6)));
        setStatus('موقعیت دریافت شد — روی «اعمال فیلتر» بزنید یا مرتب‌سازی «نزدیک‌ترین» را انتخاب کنید');
        setBusy(false);
      },
      () => {
        setStatus('برای استفاده از «نزدیک من»، دسترسی موقعیت مکانی را در مرورگر فعال کنید.');
        setBusy(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    );
  }

  function clearGeo() {
    setLat('');
    setLng('');
    setStatus(null);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="lat" value={lat} readOnly />
      <input type="hidden" name="lng" value={lng} readOnly />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray">شعاع فاصله (کیلومتر)</label>
          <select
            name="radiusKm"
            defaultValue={defaultRadiusKm || '15'}
            className="h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          >
            <option value="5">۵ کیلومتر</option>
            <option value="10">۱۰ کیلومتر</option>
            <option value="15">۱۵ کیلومتر</option>
            <option value="25">۲۵ کیلومتر</option>
            <option value="50">۵۰ کیلومتر</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={requestNearMe}
            disabled={busy}
            className={`h-11 flex-1 rounded-2xl border px-3 text-sm font-medium transition-colors disabled:opacity-60 ${
              lat && lng
                ? 'border-coral bg-coral text-white'
                : 'border-coral/40 bg-coral-soft/50 text-coral hover:bg-coral-soft'
            }`}
          >
            {busy ? 'در حال پیدا کردن…' : lat && lng ? '📍 نزدیک من (فعال)' : '📍 نزدیک من'}
          </button>
          {(lat || lng) && (
            <button
              type="button"
              onClick={clearGeo}
              className="h-11 rounded-2xl border border-border px-3 text-sm text-gray hover:bg-gray-light"
            >
              پاک
            </button>
          )}
        </div>
      </div>
      {status && <p className="text-xs text-gray">{status}</p>}
      {lat && lng && (
        <p className="text-xs text-emerald-700">موقعیت شما برای جستجوی نزدیک فعال است</p>
      )}
    </div>
  );
}
