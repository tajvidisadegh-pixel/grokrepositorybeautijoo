import { persianBookingStatus } from '@/lib/persian-status';

/** Prefer no-show label when cancel/reject reason marks absence. */
export function displayBookingStatus(
  status: string,
  reason?: string | null,
): string {
  const r = (reason || '').toLowerCase();
  if (
    r === 'no_show' ||
    r.includes('no_show') ||
    r.includes('no-show') ||
    r.includes('عدم حضور')
  ) {
    return 'عدم حضور';
  }
  return persianBookingStatus(status);
}
