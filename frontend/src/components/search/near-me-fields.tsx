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
    setStatus('در حال دریافت موقعیت…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude.toFixed(6)));
        setLng(String(pos.coords.longitude.toFixed(6)));
        setStatus('موقعیت شما اعمال شد — فیلتر را اعمال کنید');
        setBusy(false);
      },
      () => {
        setStatus('دسترسی به موقعیت رد شد یا در دسترس نیست');
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
            className="h-11 flex-1 rounded-2xl border border-coral/40 bg-coral-soft/50 px-3 text-sm font-medium text-coral transition-colors hover:bg-coral-soft disabled:opacity-60"
          >
            {busy ? '…' : 'نزدیک من'}
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
        <p className="text-xs text-gray-muted" dir="ltr">
          {lat}, {lng}
        </p>
      )}
    </div>
  );
}
