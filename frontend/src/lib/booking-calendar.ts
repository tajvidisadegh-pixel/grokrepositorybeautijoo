/**
 * #65.3 — Customer booking helpers.
 * Google Calendar / ICS download were removed for customers; only copy-to-clipboard remains.
 */

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
  const lines = [`نوبت در بیوتی‌جو`, `زیباگر: ${input.proName}`];
  if (input.services?.length) lines.push(`خدمات: ${input.services.join('، ')}`);
  lines.push(`شروع: ${input.startAt}`);
  if (input.endAt) lines.push(`پایان: ${input.endAt}`);
  if (input.location) lines.push(`آدرس: ${input.location}`);
  if (input.price != null) lines.push(`مبلغ: ${input.price}`);
  if (input.bookingId) lines.push(`شناسه رزرو: ${input.bookingId}`);
  return lines.join('\n');
}
