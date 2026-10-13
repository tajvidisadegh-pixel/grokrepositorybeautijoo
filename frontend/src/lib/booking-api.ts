import { apiClient } from './api';
import type {
  AvailabilityResponse,
  BookingRecord,
  CreateBookingPayload,
} from '@/types/booking';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:3000/api/v1';

/** Public availability — matches GET /professionals/:id/availability */
export async function fetchAvailability(
  professionalId: string,
  date: string,
  durationMin: number,
): Promise<AvailabilityResponse> {
  const qs = new URLSearchParams({
    date,
    durationMin: String(durationMin),
  });
  const url = `${API_URL}/professionals/${encodeURIComponent(professionalId)}/availability?${qs}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw Object.assign(new Error(msg), { status: res.status, body: data });
  }
  return data as AvailabilityResponse;
}

export function createBooking(payload: CreateBookingPayload) {
  return apiClient.post<BookingRecord>('/bookings', payload);
}

export function getBooking(id: string) {
  return apiClient.get<BookingRecord>(`/bookings/${id}`);
}

export function initiatePayment(bookingId: string, callbackUrl: string) {
  return apiClient.post<{
    paymentId?: string;
    redirectUrl?: string;
    providerRef?: string;
  }>('/payments/initiate', { bookingId, callbackUrl });
}

/** Customer cancel — used when payment cannot start (#64.2). */
export function cancelMyBooking(id: string, reason?: string) {
  return apiClient.patch<BookingRecord>(`/bookings/${id}/cancel`, {
    reason: reason || 'payment_unavailable',
  });
}

/** Build startAt ISO to match backend UTC slot comparison */
export function slotToStartAt(date: string, slotStart: string): string {
  return `${date}T${slotStart}:00.000Z`;
}

export function persianBookingStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'در انتظار تأیید',
    confirmed: 'تأیید شده',
    rejected: 'رد شده',
    cancelled: 'لغو شده',
    expired: 'منقضی (پرداخت نشده)',
    completed: 'تکمیل شده',
  };
  return map[status] || status;
}
