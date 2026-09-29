'use client';

import { useEffect, useState } from 'react';

type Props = {
  defaultLat?: string;
  defaultLng?: string;
};

/**
 * Hidden coordinates + geolocation for one-click near-me search.
 * After location is granted, the search is submitted automatically and sorted by distance.
 */
export function NearMeFields({ defaultLat, defaultLng }: Props) {
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
    setStatus('اجازه دسترسی به موقعیت مکانی را بدهید…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude.toFixed(6);
        const ln = pos.coords.longitude.toFixed(6);
        setLat(la);
        setLng(ln);
        setStatus('موقعیت دریافت شد. در حال اعمال فیلتر نزدیک‌ترین…');
        setBusy(false);
        const form = document.querySelector('form[action="/search"]') as HTMLFormElement | null;
        if (form) {
          const sortSel = form.querySelector('select[name="sort"]') as HTMLSelectElement | null;
          if (sortSel) sortSel.value = 'distance';
          window.setTimeout(() => form.requestSubmit(), 50);
        }
      },
      () => {
        setStatus('برای «نزدیک من»، دسترسی موقعیت مکانی را در مرورگر فعال کنید.');
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
      <input type="hidden" name="radiusKm" value="200" readOnly />
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
        <p className="text-xs text-emerald-700">
          جستجو بر اساس فاصله از موقعیت شما فعال است — نتایج نزدیک‌تر بالاتر می‌آیند.
        </p>
      )}
    </div>
  );
}
