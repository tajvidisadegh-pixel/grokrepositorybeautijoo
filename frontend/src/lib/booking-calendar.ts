/** Build Google Calendar / ICS helpers for a booking (client-safe). */

export type CalendarBookingInput = {
  id: string;
  startAt: string;
  endAt?: string | null;
  title?: string;
  details?: string;
  location?: string;
};

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** UTC stamp for ICS / Google: YYYYMMDDTHHMMSSZ */
export function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function defaultEnd(startAt: string): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return startAt;
  d.setMinutes(d.getMinutes() + 60);
  return d.toISOString();
}

export function googleCalendarUrl(b: CalendarBookingInput): string {
  const start = toIcsUtc(b.startAt);
  const end = toIcsUtc(b.endAt || defaultEnd(b.startAt));
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: b.title || 'نوبت بیوتی‌جو',
    dates: `${start}/${end}`,
    details: b.details || '',
    location: b.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcs(b: CalendarBookingInput): string {
  const start = toIcsUtc(b.startAt);
  const end = toIcsUtc(b.endAt || defaultEnd(b.startAt));
  const uid = `${b.id}@beautijoo.ir`;
  const stamp = toIcsUtc(new Date().toISOString());
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Beautijoo//Booking//FA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escape(b.title || 'نوبت بیوتی‌جو')}`,
    `DESCRIPTION:${escape(b.details || '')}`,
    `LOCATION:${escape(b.location || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function downloadIcs(b: CalendarBookingInput, filename = 'beautijoo-booking.ics') {
  const ics = buildIcs(b);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatBookingCopyText(input: {
  proName: string;
  startAt: string;
  endAt?: string | null;
  status?: string;
  price?: number | null;
  services?: string[];
  location?: string;
  bookingId?: string;
}): string {
  const lines = [
    `نوبت در بیوتی‌جو`,
    `زیباگر: ${input.proName}`,
  ];
  if (input.services?.length) lines.push(`خدمات: ${input.services.join('، ')}`);
  lines.push(`شروع: ${input.startAt}`);
  if (input.endAt) lines.push(`پایان: ${input.endAt}`);
  if (input.location) lines.push(`آدرس: ${input.location}`);
  if (input.price != null) lines.push(`مبلغ: ${input.price}`);
  if (input.bookingId) lines.push(`شناسه رزرو: ${input.bookingId}`);
  return lines.join('\n');
}
