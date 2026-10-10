/** #61.37 — lightweight client error beacon for booking/payment */
export function reportClientError(area: string, err: unknown, meta?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      area,
      message: err instanceof Error ? err.message : String(err),
      path: window.location.pathname,
      ts: Date.now(),
      ...meta,
    };
    const prev = JSON.parse(sessionStorage.getItem('bj_client_errors') || '[]') as unknown[];
    sessionStorage.setItem('bj_client_errors', JSON.stringify([...prev.slice(-20), payload]));
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    if (base && navigator.sendBeacon) {
      const url = `${base.replace(/\/$/, '')}/public/client-errors`;
      navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    }
  } catch { /* ignore */ }
}
