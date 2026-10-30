'use client';

import { useState } from 'react';
import { formatBookingCopyText } from '@/lib/booking-calendar';
import { formatDateTime, formatPrice } from '@/lib/utils';

type Props = {
  booking: {
    id: string;
    startAt: string;
    endAt?: string | null;
    totalPrice?: number | null;
    status?: string;
  };
  proName: string;
  serviceNames?: string[];
  locationLabel?: string;
  className?: string;
};

/** Customer-facing actions: copy booking details only (no Google Calendar / ICS — issue #65.3). */
export function AddToCalendarActions({
  booking,
  proName,
  serviceNames = [],
  locationLabel,
  className = '',
}: Props) {
  const [msg, setMsg] = useState<string | null>(null);

  async function copyDetails() {
    const text = formatBookingCopyText({
      proName,
      startAt: formatDateTime(booking.startAt),
      endAt: booking.endAt ? formatDateTime(booking.endAt) : undefined,
      services: serviceNames,
      location: locationLabel,
      price: booking.totalPrice,
      bookingId: booking.id,
    });
    try {
      await navigator.clipboard.writeText(text);
      setMsg('جزئیات کپی شد');
    } catch {
      setMsg('کپی ممکن نشد');
    }
    window.setTimeout(() => setMsg(null), 2500);
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyDetails}
          className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-xs font-medium hover:border-coral hover:text-coral"
        >
          کپی جزئیات نوبت
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-gray">{msg}</p>}
    </div>
  );
}
