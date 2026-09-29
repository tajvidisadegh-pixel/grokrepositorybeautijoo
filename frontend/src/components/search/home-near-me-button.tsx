'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';

export function HomeNearMeButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function requestNearMe() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('موقعیت مکانی در این مرورگر پشتیبانی نمی‌شود');
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        window.location.href = `/search?sort=distance&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radiusKm=200`;
      },
      () => {
        setBusy(false);
        setError('برای «نزدیک من»، دسترسی موقعیت مکانی را در مرورگر فعال کنید.');
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={requestNearMe}
        disabled={busy}
        className="inline-flex h-10 items-center rounded-2xl bg-coral px-4 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-60"
      >
        <MapPin className="ml-1.5 size-4" />
        {busy ? 'در حال پیدا کردن…' : 'نزدیک من'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
