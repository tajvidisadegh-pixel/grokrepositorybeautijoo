/** #61 item 1 — lightweight booking funnel events */
export type FunnelStep =
  | 'profile_view'
  | 'service_select'
  | 'datetime_select'
  | 'summary_view'
  | 'payment_click'
  | 'booking_done';

const KEY = 'bj_funnel_v1';

export function trackFunnel(step: FunnelStep, meta?: Record<string, string | number | undefined>) {
  if (typeof window === 'undefined') return;
  try {
    const row = { step, t: Date.now(), ...meta };
    const prev = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown[];
    const next = [...prev.slice(-40), row];
    localStorage.setItem(KEY, JSON.stringify(next));
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    if (base && navigator.sendBeacon) {
      const url = `${base.replace(/\/$/, '')}/public/funnel`;
      const blob = new Blob([JSON.stringify(row)], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    }
  } catch { /* ignore */ }
}
