'use client';

import { useState } from 'react';
import {
  downloadIcs,
  formatBookingCopyText,
  googleCalendarUrl,
  type CalendarBookingInput,
} from '@/lib/booking-calendar';
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

export function AddToCalendarActions({
  booking,
  proName,
  serviceNames = [],
  locationLabel,
  className = '',
}: Props) {
  const [msg, setMsg] = useState<string | null>(null);

  const cal: CalendarBookingInput = {
    id: booking.id,
    startAt: booking.startAt,
    endAt: booking.endAt,
    title: `نوبت با ${proName}`,
    details: [
      serviceNames.length ? `خدمات: ${serviceNames.join('، ')}` : '',
      booking.totalPrice != null ? `مبلغ: ${formatPrice(booking.totalPrice)}` : '',
      `شناسه: ${booking.id}`,
      'رزرو از بیوتی‌جو',
    ]
      .filter(Boolean)
      .join('\n'),
    location: locationLabel || '',
  };

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
        <a
          href={googleCalendarUrl(cal)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-xs font-medium hover:border-coral hover:text-coral"
        >
          گوگل تقویم
        </a>
        <button
          type="button"
          onClick={() => downloadIcs(cal, `beautijoo-${booking.id.slice(0, 8)}.ics`)}
          className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-xs font-medium hover:border-coral hover:text-coral"
        >
          دانلود ICS (اپل / سایر)
        </button>
        <button
          type="button"
          onClick={() => void copyDetails()}
          className="inline-flex h-9 items-center rounded-xl border border-border bg-white px-3 text-xs font-medium hover:border-coral hover:text-coral"
        >
          کپی جزئیات
        </button>
      </div>
      {msg && <p className="mt-1 text-xs text-emerald-700">{msg}</p>}
    </div>
  );
}
